import { CustomerPriceMode, RoundingMode, RoundingTarget } from '../../contracts/enums'
import type { RoundingStrategy } from '../../contracts/parameters'
import { roundToClp, type Clp } from '../../../../core/money'
import { splitFromGross, splitFromNet } from '../tax'
import { roundToGrid } from './rounding'
import { unwrap } from './unwrap'

/** Cómo se traduce un precio neto teórico al precio que ve el cliente. */
export interface PriceDomain {
  readonly rounding: RoundingStrategy
  readonly mode: CustomerPriceMode
  readonly salesRate: number
}

/** Dominio donde se redondea: el `target` del redondeo; sin redondeo comercial, el del precio al cliente. */
export function gridDomain(domain: PriceDomain): RoundingTarget {
  if (domain.rounding.mode === RoundingMode.STEP) return domain.rounding.target
  return domain.mode === CustomerPriceMode.GROSS ? RoundingTarget.GROSS : RoundingTarget.NET
}

/** Precio neto decimal → valor decimal en el dominio de redondeo (neto, o bruto = neto × (1 + IVA de venta)). */
export function netToGridValue(net: number, domain: PriceDomain): number {
  return gridDomain(domain) === RoundingTarget.NET ? net : net * (1 + domain.salesRate)
}

/** Valor entero de la grilla → precio entero que ve el cliente (en su modo). */
export function gridToCustomer(grid: Clp, domain: PriceDomain): Clp {
  const target = gridDomain(domain)
  if (target === RoundingTarget.NET && domain.mode === CustomerPriceMode.GROSS) {
    return unwrap(splitFromNet(grid, domain.salesRate), 'grid-to-customer').gross
  }
  if (target === RoundingTarget.GROSS && domain.mode === CustomerPriceMode.NET) {
    return unwrap(splitFromGross(grid, domain.salesRate), 'grid-to-customer').net
  }
  return grid
}

/** Precio que ve el cliente → neto decimal equivalente (para repartir y comparar; no es un monto contable). */
export function customerToNet(customer: number, domain: PriceDomain): number {
  return domain.mode === CustomerPriceMode.GROSS ? customer / (1 + domain.salesRate) : customer
}

/** Neto teórico → (valor de grilla, precio al cliente) aplicando el redondeo comercial. */
export function priceFromNet(net: number, domain: PriceDomain): { grid: Clp; customer: Clp } {
  const grid = roundToGrid(Math.max(0, net === 0 ? 0 : netToGridValue(net, domain)), domain.rounding)
  return { grid, customer: gridToCustomer(grid, domain) }
}

export const ZERO_PRICE = roundToClp(0)
