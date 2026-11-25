import { err, InvariantViolation, ok, type Result } from '../../../../core/result'
import { parseFraction, roundToClp, type Clp, type Fraction } from '../../../../core/money'
import {
  BelowMinPolicyId,
  CalculationMode,
  FlagCode,
  FlagSeverity,
  LineKind,
  OverrideKind,
  PricingMode,
} from '../../contracts/enums'
import type { CalculationError } from '../../contracts/errors'
import { checkPricingInvariants } from '../../contracts/invariants'
import type { CalculationRequest } from '../../contracts/request'
import type { CalculationFlag, PricingOutput, PricingResult } from '../../contracts/results'
import { fromTaxError, invalidInput } from '../common/errors'
import type { CostCalculation } from '../cost/engine'
import { checkLedgerInvariants, economicFixedFee, effectiveCommissionRate, salesVatRateOf } from '../tax'
import { allocateProportional } from './allocation'
import {
  BISECTION_DIVISOR,
  MARGIN_TOLERANCE,
  MAX_SEARCH_DOUBLINGS,
  MIN_MARGIN_DENOMINATOR,
  SEARCH_GROWTH_FACTOR,
} from './constants'
import { resolveVolumeDiscount } from './discounts'
import { groupCostLines, MAIN_LINE_CODE, type CostLine } from './lines'
import { evaluateOutcome, oneUnit, type LineSpec, type Outcome, type OutcomeContext } from './outcome'
import { resolvePricingParameters } from './parameters'
import { customerToNet, gridToCustomer, priceFromNet, type PriceDomain } from './price-grid'
import { gridStep } from './rounding'
import { unwrap } from './unwrap'

/**
 * Menor valor de grilla ≥ `start` cuyo margen efectivo (después de IVA y redondeo) alcanza `minMargin`.
 * Precondición: el margen en `start` es menor. El margen crece con el precio y tiende a 1 − c_eff > minMargin,
 * así que en aritmética exacta existe; se busca duplicando el desplazamiento y luego por bisección sobre
 * múltiplos del paso. El resultado SIEMPRE cumple el mínimo (la bisección conserva "a falla, b cumple").
 * Devuelve `undefined` si el precio necesario sale del rango seguro de CLP o se agota el tope de búsqueda:
 * el llamador lo informa como `NO_FEASIBLE_PRICE` (nunca se emite un precio no finito).
 */
function minGridMeetingMargin(
  start: Clp,
  step: number,
  marginAt: (grid: Clp) => number,
  minMargin: number,
): { readonly grid: Clp } | { readonly failure: 'PRICE_OUT_OF_RANGE' | 'SEARCH_EXHAUSTED' } {
  const inRange = (steps: number): boolean => Number.isSafeInteger(Math.round(start + steps * step))
  const meets = (steps: number): boolean => marginAt(roundToClp(start + steps * step)) >= minMargin - MARGIN_TOLERANCE
  let failing = 0
  let passing = 1
  let doublings = 0
  for (;;) {
    if (!inRange(passing)) return { failure: 'PRICE_OUT_OF_RANGE' }
    if (meets(passing)) break
    failing = passing
    passing *= SEARCH_GROWTH_FACTOR
    doublings += 1
    if (doublings > MAX_SEARCH_DOUBLINGS) return { failure: 'SEARCH_EXHAUSTED' }
  }
  while (passing - failing > 1) {
    const middle = failing + Math.floor((passing - failing) / BISECTION_DIVISOR)
    if (meets(middle)) passing = middle
    else failing = middle
  }
  return { grid: roundToClp(start + passing * step) }
}

function fraction(value: number, where: string): Fraction {
  return unwrap(parseFraction(value, where, 'EXCLUSIVE'), where)
}

function run(request: CalculationRequest, cost: CostCalculation): Result<PricingOutput, CalculationError> {
  if (request.mode !== CalculationMode.QUOTE) {
    return err(invalidInput('mode', 'INCONSISTENT', 'El modo TEST no calcula precio'))
  }
  const { params, overrides } = request
  const tax = params.taxProfile
  const breakdown = cost.breakdown
  const units = cost.quantities.units

  // ① parámetros efectivos, tasa de venta y comisión (validados: de aquí en adelante un fallo es un defecto)
  const sales = salesVatRateOf(tax)
  if (!sales.ok) return err(fromTaxError(sales.error))
  const salesRate = sales.value
  const effective = resolvePricingParameters(params, overrides)
  const commissionRate = effectiveCommissionRate(params.channel, tax)
  if (!commissionRate.ok) return err(fromTaxError(commissionRate.error))
  const fixedFee = economicFixedFee(params.channel, tax)
  if (!fixedFee.ok) return err(fromTaxError(fixedFee.error))
  const cEff = commissionRate.value
  const fee = fixedFee.value.economicCost

  // ② factibilidad: con c_eff + margen ≥ 1 ningún precio alcanza el margen
  //    Umbral 1e-9: bajo él se distingue inviabilidad real (c_eff + margen > 1) de inestabilidad numérica (≈ 1).
  for (const margin of [effective.targetMargin, effective.minMargin]) {
    const denominator = 1 - cEff - margin
    if (!(denominator > MIN_MARGIN_DENOMINATOR)) {
      const reason = denominator < -MIN_MARGIN_DENOMINATOR ? 'EXCEEDS_LIMIT' : 'AT_LIMIT'
      return err({ code: 'INFEASIBLE_MARGIN', effectiveCommission: cEff, margin, reason })
    }
  }

  // ③ líneas comerciales: fallas con su origen; una línea por costo único; nada se cuenta dos veces
  const grouped = groupCostLines(breakdown.items)
  if (!grouped.ok) return grouped
  const pool: number = breakdown.pricingPool
  const lineCosts = grouped.value.main.cost + grouped.value.separate.reduce((sum, line) => sum + line.cost, 0)
  if (lineCosts !== pool) throw new InvariantViolation('pricing.lines', 'el costo de las líneas no suma el pool')

  // ④ objetivo teórico: neto = (C + cargo fijo) / (1 − c_eff − margen)
  const targetNet = (pool + fee) / (1 - cEff - effective.targetMargin)
  const floorNet = (pool + fee) / (1 - cEff - effective.minMargin)
  const breakEvenNet = (pool + fee) / (1 - cEff)
  if (![targetNet, floorNet, breakEvenNet].every((value) => Number.isFinite(value) && Number.isSafeInteger(Math.ceil(value)))) {
    return err({ code: 'NO_FEASIBLE_PRICE', minMargin: effective.minMargin, reason: 'PRICE_OUT_OF_RANGE' })
  }

  const domain: PriceDomain = { rounding: effective.rounding, mode: tax.customerPriceMode, salesRate }
  const context: OutcomeContext = { params, salesRate, breakdown }
  const one = oneUnit()

  // ⑤ líneas con precio fijo vs. líneas a precio objetivo
  const mainFixed = effective.fixedUnitPrice
  const separate = grouped.value.separate.filter((line) => line.cost > 0 || effective.fixedLinePrices[line.code] !== undefined)
  const fixedLine = (line: CostLine): Clp | undefined => effective.fixedLinePrices[line.code]

  let fixedNet = 0
  if (mainFixed !== undefined) fixedNet += customerToNet(mainFixed * units, domain)
  for (const line of separate) {
    const price = fixedLine(line)
    if (price !== undefined) fixedNet += customerToNet(price, domain)
  }

  const targetLines: { key: string; cost: number }[] = []
  if (mainFixed === undefined) targetLines.push({ key: MAIN_LINE_CODE, cost: grouped.value.main.cost })
  for (const line of separate) if (fixedLine(line) === undefined) targetLines.push({ key: line.code, cost: line.cost })
  const revenueForTargetLines = Math.max(0, targetNet - fixedNet)
  const shares = allocateProportional(revenueForTargetLines, targetLines.map((line) => line.cost))
  const netShare = new Map(targetLines.map((line, index) => [line.key, shares[index] ?? 0]))

  // ⑥ precio de las líneas separadas (sin descuento)
  const separatePrice = (line: CostLine): Clp => fixedLine(line) ?? priceFromNet(netShare.get(line.code) ?? 0, domain).customer
  const separateSpecs: LineSpec[] = separate.map((line) => ({
    code: line.code,
    kind: LineKind.SEPARATE_LINE,
    quantity: one,
    customerUnitPrice: separatePrice(line),
    costBasis: line.cost,
    sourceItemCodes: line.itemCodes,
  }))
  const specsWith = (mainUnitPrice: Clp): LineSpec[] => [
    {
      code: MAIN_LINE_CODE,
      kind: LineKind.MAIN,
      quantity: units,
      customerUnitPrice: mainUnitPrice,
      costBasis: grouped.value.main.cost,
      sourceItemCodes: grouped.value.main.itemCodes,
    },
    ...separateSpecs,
  ]
  const evaluate = (mainUnitPrice: Clp): Outcome => evaluateOutcome(context, specsWith(mainUnitPrice))

  // ⑦ línea principal: precio objetivo → descuento → redondeo comercial → política bajo el mínimo
  let mainUnitPrice: Clp
  let appliedDiscount = 0
  let cappedFrom: number | undefined
  if (mainFixed !== undefined) {
    mainUnitPrice = mainFixed
  } else {
    const listNetUnit = (netShare.get(MAIN_LINE_CODE) ?? 0) / units
    const tierDiscount =
      effective.discount.kind === 'NONE'
        ? 0
        : effective.discount.kind === 'MANUAL'
          ? (effective.discount.pct ?? 0)
          : resolveVolumeDiscount(units, effective.tiers)
    const first = priceFromNet(listNetUnit * (1 - tierDiscount), domain)
    mainUnitPrice = first.customer
    appliedDiscount = tierDiscount
    if (effective.policy === BelowMinPolicyId.CAP && evaluate(first.customer).policyMargin < effective.minMargin - MARGIN_TOLERANCE) {
      // CAP: el mínimo se garantiza sobre el precio EFECTIVO (después de IVA y redondeo), no sobre el teórico,
      // también cuando solo el redondeo (sin descuento) lo dejó bajo el mínimo.
      const search = minGridMeetingMargin(
        first.grid,
        gridStep(effective.rounding),
        (value) => evaluate(gridToCustomer(value, domain)).policyMargin,
        effective.minMargin,
      )
      if ('failure' in search) {
        return err({ code: 'NO_FEASIBLE_PRICE', minMargin: effective.minMargin, reason: search.failure })
      }
      mainUnitPrice = gridToCustomer(search.grid, domain)
      const effectiveDiscount = listNetUnit > 0 ? 1 - customerToNet(mainUnitPrice, domain) / listNetUnit : 0
      appliedDiscount = Math.min(tierDiscount, Math.max(0, effectiveDiscount))
      if (appliedDiscount < tierDiscount - MARGIN_TOLERANCE) cappedFrom = tierDiscount
    }
  }

  // ⑧ consecuencias sobre el precio efectivo
  const outcome = evaluate(mainUnitPrice)
  const utility: number = outcome.ledger.utility
  const margin = outcome.policyMargin
  const realUtility = roundToClp(utility - breakdown.absorbedCost)
  const net: number = outcome.split.net
  const realMargin = net > 0 ? realUtility / net : null

  // ⑨ advertencias
  const flags: CalculationFlag[] = []
  const unknownInCost = new Set(
    cost.flags.filter((flag) => flag.code === FlagCode.UNKNOWN_OVERRIDE_TARGET).map((flag) => flag.path),
  )
  const separateCodes = new Set(grouped.value.separate.map((line) => line.code))
  overrides.forEach((override, index) => {
    const path = `overrides[${String(index)}]`
    if (unknownInCost.has(path)) return // la capa de costos ya advirtió que no encontró su ítem
    const unknown = override.kind === OverrideKind.FIXED_LINE_PRICE && !separateCodes.has(override.itemCode)
    flags.push({
      code: unknown ? FlagCode.UNKNOWN_OVERRIDE_TARGET : FlagCode.OVERRIDE_APPLIED,
      severity: unknown ? FlagSeverity.WARNING : FlagSeverity.INFO,
      path,
    })
  })
  if (pool === 0 && mainFixed === undefined && separate.every((line) => fixedLine(line) === undefined)) {
    flags.push({ code: FlagCode.PRICING_POOL_EMPTY, severity: FlagSeverity.WARNING, path: 'breakdown.pricingPool' })
  }
  if (cappedFrom !== undefined) {
    flags.push({ code: FlagCode.DISCOUNT_CAPPED, severity: FlagSeverity.INFO, path: 'pricing.discount' })
  }
  if (margin < effective.targetMargin - MARGIN_TOLERANCE) {
    flags.push({ code: FlagCode.BELOW_TARGET, severity: FlagSeverity.INFO, path: 'pricing.realMargin' })
  }
  if (margin < effective.minMargin - MARGIN_TOLERANCE) {
    flags.push({ code: FlagCode.BELOW_MIN, severity: FlagSeverity.WARNING, path: 'pricing.commercialMargin' })
    // BLOCK impide EMITIR; también CAP si ni el precio mínimo de grilla alcanzó el mínimo (precio fijo).
    // El cálculo y el borrador siguen siendo posibles.
    if (effective.policy !== BelowMinPolicyId.WARN) {
      flags.push({ code: FlagCode.BLOCKED, severity: FlagSeverity.BLOCKING, path: 'pricing.commercialMargin' })
    }
  } else if (realMargin !== null && realMargin < effective.minMargin - MARGIN_TOLERANCE) {
    // Informativo: el precio cumple la política, pero los costos absorbidos dejan la utilidad real bajo el mínimo.
    flags.push({ code: FlagCode.REAL_MARGIN_BELOW_MIN, severity: FlagSeverity.WARNING, path: 'pricing.realMargin' })
  }
  if (utility < 0) {
    flags.push({ code: FlagCode.NEGATIVE_UTILITY, severity: FlagSeverity.WARNING, path: 'pricing.commercialUtility' })
  }

  const pricing: PricingResult = {
    mode: mainFixed === undefined ? PricingMode.TARGET_MARGIN : PricingMode.FIXED_PRICE,
    customerPriceMode: tax.customerPriceMode,
    targetNetTotal: roundToClp(targetNet),
    lines: outcome.lines,
    discount: {
      applied: fraction(appliedDiscount, 'discount.applied'),
      ...(cappedFrom === undefined ? {} : { cappedFrom: fraction(cappedFrom, 'discount.cappedFrom') }),
    },
    customerUnitPrice: mainUnitPrice,
    netTotal: outcome.split.net,
    vatTotal: outcome.split.vat,
    grossTotal: outcome.split.gross,
    commission: outcome.commission,
    commercialUtility: outcome.ledger.utility,
    commercialMargin: outcome.margin,
    commercialMarkup: pool > 0 ? utility / pool : null,
    absorbedCost: breakdown.absorbedCost,
    realUtility,
    realMargin,
    realMarkup: pool + breakdown.absorbedCost > 0 ? realUtility / (pool + breakdown.absorbedCost) : null,
    floorNetTotal: roundToClp(floorNet),
    breakEvenNetTotal: roundToClp(breakEvenNet),
  }

  // ⑩ autoverificación: un fallo aquí es un defecto del motor, no un dato inválido
  const violations = [
    ...checkPricingInvariants(pricing, breakdown).map((v) => `${v.path}:${v.code}`),
    ...checkLedgerInvariants(outcome.ledger),
  ]
  if (violations.length > 0) throw new InvariantViolation('pricing.result', violations.join(', '))

  return ok({ pricing, flags })
}

/**
 * Calcula el precio de una solicitud QUOTE a partir de su desglose de costos.
 * Puro y determinista. `BLOCK` se informa como la advertencia `BLOCKED` (severidad BLOCKING): impide EMITIR la
 * cotización (`isIssuable`), nunca calcularla. Errores de entrada → `INVALID_INPUT`, `INFEASIBLE_MARGIN`
 * (con `reason`), `NO_FEASIBLE_PRICE`, `INCONSISTENT_SNAPSHOT`; invariantes internas rotas → `INTERNAL_INVARIANT`.
 */
export function calculatePricing(request: CalculationRequest, cost: CostCalculation): Result<PricingOutput, CalculationError> {
  try {
    return run(request, cost)
  } catch (error) {
    if (error instanceof InvariantViolation) return err({ code: 'INTERNAL_INVARIANT', invariant: error.invariant })
    throw error
  }
}
