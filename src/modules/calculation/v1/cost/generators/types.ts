import type { Result } from '../../../../../core/result'
import type { CalculationError } from '../../../contracts/errors'
import type { CostContext, CostDraft } from '../context'

/** Función pura: contexto → ítems exactos (sin redondear). Agregar un costo = agregar un generador. */
export type CostItemGenerator = (context: CostContext) => Result<readonly CostDraft[], CalculationError>
