declare const brandSymbol: unique symbol

/**
 * Tipo nominal: impide mezclar valores con la misma representación
 * (p. ej. `Clp` con `Fraction`, ambos `number`) sin una conversión explícita.
 */
export type Brand<T, Name extends string> = T & { readonly [brandSymbol]: Name }
