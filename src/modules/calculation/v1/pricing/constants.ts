/** Tolerancia al comparar márgenes (cocientes de enteros) con el objetivo o el mínimo. */
export const MARGIN_TOLERANCE = 1e-12

/** Tolerancia relativa para decidir que un precio ya cae exactamente sobre un múltiplo del paso de redondeo. */
export const STEP_TOLERANCE = 1e-9

/** Tope de duplicaciones en la búsqueda del precio mínimo (cada una duplica el desplazamiento). */
export const MAX_SEARCH_DOUBLINGS = 60

/** Factor con el que crece el desplazamiento al buscar el precio mínimo, y divisor de la bisección. */
export const SEARCH_GROWTH_FACTOR = 2
export const BISECTION_DIVISOR = 2

/** Denominador mínimo de la fórmula de margen (1 − c_eff − margen): por debajo, el precio diverge y se rechaza. */
export const MIN_MARGIN_DENOMINATOR = 1e-9
