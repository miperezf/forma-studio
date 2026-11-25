import type { Result } from '../../../core/result'
import type { CalculationError } from '../contracts/errors'
import type { PricingOutput } from '../contracts/results'
import { calculatePricing } from '../v1/pricing/engine'
import { calculateCost, type CostCalculation } from '../v1/cost/engine'
import { requestOf } from './cost-helpers'
import { mutated } from './fixtures'

export function priceResult(raw: unknown): Result<PricingOutput, CalculationError> {
  const request = requestOf(raw)
  const cost = calculateCost(request)
  if (!cost.ok) throw new Error(`costo falló: ${JSON.stringify(cost.error)}`)
  return calculatePricing(request, cost.value)
}

export function priceOf(raw: unknown): PricingOutput {
  const result = priceResult(raw)
  if (!result.ok) throw new Error(`precio falló: ${JSON.stringify(result.error)}`)
  return result.value
}

export function fullOf(raw: unknown): { cost: CostCalculation; output: PricingOutput } {
  const request = requestOf(raw)
  const cost = calculateCost(request)
  if (!cost.ok) throw new Error(`costo falló: ${JSON.stringify(cost.error)}`)
  const output = calculatePricing(request, cost.value)
  if (!output.ok) throw new Error(`precio falló: ${JSON.stringify(output.error)}`)
  return { cost: cost.value, output: output.value }
}

export const REASON = 'Decisión comercial de prueba'

/** Cambia el canal de venta de la solicitud (comisión, base, cargo fijo y tratamiento de IVA de la comisión). */
export function withChannel(
  raw: Record<string, unknown>,
  channel: {
    commission?: number
    base?: 'NET' | 'GROSS'
    vatCharged?: boolean
    vatRecoverable?: boolean
    fixedFee?: { amount: number; basis: 'NET' | 'GROSS'; vatRecoverable: boolean }
  },
): Record<string, unknown> {
  let r = raw
  if (channel.commission !== undefined) r = mutated('params.channel.commission', channel.commission, r)
  if (channel.base !== undefined) r = mutated('params.channel.commissionBase', channel.base, r)
  if (channel.vatCharged !== undefined || channel.vatRecoverable !== undefined) {
    r = mutated('params.channel.commissionTax', { vatCharged: channel.vatCharged ?? false, vatRecoverable: channel.vatRecoverable ?? false }, r)
  }
  if (channel.fixedFee !== undefined) r = mutated('params.channel.fixedFee', channel.fixedFee, r)
  return r
}

export const override = (kind: string, rest: Record<string, unknown>) => ({ kind, ...rest, reason: REASON })
