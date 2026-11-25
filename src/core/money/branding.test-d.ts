/**
 * Pruebas de tipos (se verifican con `tsc -p tsconfig.test.json`, no se ejecutan).
 * Cada `@ts-expect-error` falla la compilación si la línea siguiente deja de ser un error.
 */
import type { Clp, Fraction, Hours, Quantity } from './index'
import { roundToClp } from './index'

declare const clp: Clp
declare const fraction: Fraction
declare const hours: Hours
declare const quantity: Quantity

// @ts-expect-error un number plano no es Clp
export const a: Clp = 1000

// @ts-expect-error Fraction no es Clp
export const b: Clp = fraction

// @ts-expect-error Clp no es Fraction (evita confundir 35 con 0,35)
export const c: Fraction = clp

// @ts-expect-error Hours no es Quantity
export const d: Quantity = hours

// @ts-expect-error un number plano no es Fraction
export const e: Fraction = 0.35

// Correctos: la conversión explícita y el uso aritmético como number
export const f: Clp = roundToClp(1000.4)
export const g: number = clp * fraction
export const h: number = quantity + hours
