import { err, ok, type Result } from '../../../../core/result'
import { InvariantViolation } from '../../../../core/result'
import { isClp, roundToClp, type Clp } from '../../../../core/money'
import { HALF, SPLIT_TOLERANCE } from './constants'
import { taxError, type TaxError } from './errors'
import { isRate } from './rates'

/** Un precio de venta separado en neto, IVA de venta y bruto (CLP enteros). */
export interface SaleSplit {
  readonly net: Clp
  readonly vat: Clp
  readonly gross: Clp
}

/**
 * Invariantes de un `SaleSplit` con tasa `rate`:
 *  1. net + vat = gross, exacto.
 *  2. Todos enteros seguros, no negativos; vat ≤ gross.
 *  3. |vat − net × rate| ≤ (1 + rate)/2: el IVA se aparta del exacto en menos de lo que permite el redondeo.
 * Devuelve el primer incumplimiento o `undefined`.
 */
export function checkSplitInvariant(split: SaleSplit, rate: number): string | undefined {
  const { net, vat, gross } = split
  if (!isClp(net) || !isClp(vat) || !isClp(gross)) return 'net, vat y gross deben ser enteros seguros'
  if (net < 0 || vat < 0 || gross < 0) return 'net, vat y gross no pueden ser negativos'
  if (net + vat !== gross) return 'net + vat debe ser igual a gross'
  if (vat > gross) return 'vat no puede superar gross'
  if (Math.abs(vat - net * rate) > (1 + rate) * HALF + SPLIT_TOLERANCE) {
    return 'vat se aparta del IVA exacto más de lo que permite el redondeo'
  }
  return undefined
}

function finalize(split: SaleSplit, rate: number): Result<SaleSplit, TaxError> {
  const violation = checkSplitInvariant(split, rate)
  if (violation !== undefined) throw new InvariantViolation('tax.split', violation)
  return ok(split)
}

function checkInputs(value: number, rate: number, field: string): TaxError | undefined {
  if (!isClp(value) || value < 0) {
    return taxError('INVALID_AMOUNT', field, 'Debe ser un entero CLP no negativo')
  }
  if (!isRate(rate)) return taxError('INVALID_RATE', 'rate', 'Debe ser finita y estar en [0, 1)')
  return undefined
}

/**
 * Parte del NETO: IVA = redondeo(neto × tasa); bruto = neto + IVA.
 * Úsese cuando el precio de verdad es el neto (customerPriceMode NET).
 */
export function splitFromNet(net: Clp, rate: number): Result<SaleSplit, TaxError> {
  const problem = checkInputs(net, rate, 'net')
  if (problem !== undefined) return err(problem)
  const vat = roundToClp(net * rate)
  return finalize({ net, vat, gross: roundToClp(net + vat) }, rate)
}

/**
 * Parte del BRUTO: neto = redondeo(bruto / (1 + tasa)); IVA = bruto − neto.
 * Úsese cuando el precio de verdad es el bruto (customerPriceMode GROSS): el cliente paga
 * exactamente `gross` y el neto/IVA se derivan de él, nunca al revés.
 */
export function splitFromGross(gross: Clp, rate: number): Result<SaleSplit, TaxError> {
  const problem = checkInputs(gross, rate, 'gross')
  if (problem !== undefined) return err(problem)
  const net = roundToClp(gross / (1 + rate))
  return finalize({ net, vat: roundToClp(gross - net), gross }, rate)
}
