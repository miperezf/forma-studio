import { err, ok, type Result } from '../../../../core/result'
import { issue } from '../../../../core/validation'
import { roundToClp, sumClp, type Clp } from '../../../../core/money'
import { Recovery } from '../../contracts/enums'
import type { CalculationError } from '../../contracts/errors'
import type { CostItem } from '../../contracts/results'

/** Línea comercial candidata (aún sin precio). */
export interface CostLine {
  /** `main` o el código del ítem origen. */
  readonly code: string
  readonly label: string
  /** Σ pooledAmount de sus ítems (incluye las fallas derivadas agrupadas). */
  readonly cost: Clp
  readonly itemCodes: readonly string[]
}

export interface CostLines {
  readonly main: CostLine
  /** En orden de aparición; pueden tener costo 0. */
  readonly separate: readonly CostLine[]
}

export const MAIN_LINE_CODE = 'main'

/**
 * Agrupa los costos en líneas comerciales:
 *  - IN_PRICE       → línea principal.
 *  - SEPARATE_LINE  → la línea de su ítem ORIGEN. Una falla (`derivedFrom`) va SIEMPRE con su origen y nunca
 *                     genera una línea propia; el detalle de ítems se conserva en `itemCodes`.
 *  - ABSORBED       → ninguna línea (no entra al precio).
 * Una falla marcada SEPARATE_LINE cuyo origen no es SEPARATE_LINE es una combinación inválida
 * (la falla no puede tener una línea independiente).
 */
export function groupCostLines(items: readonly CostItem[]): Result<CostLines, CalculationError> {
  const mainCodes: string[] = []
  const mainPooled: Clp[] = []
  const lines = new Map<string, { label: string; pooled: Clp[]; codes: string[] }>()

  for (const item of items) {
    const recovery = item.recoveryConfig.recovery
    if (recovery === Recovery.ABSORBED) continue
    if (recovery === Recovery.IN_PRICE) {
      mainCodes.push(item.code)
      mainPooled.push(item.pooledAmount)
      continue
    }
    const rootCode = item.derivedFrom ?? item.code
    const root = item.derivedFrom === undefined ? item : items.find((candidate) => candidate.code === rootCode)
    if (root === undefined || root.recoveryConfig.recovery !== Recovery.SEPARATE_LINE) {
      return err({
        code: 'INVALID_INPUT',
        issues: [
          issue(
            `breakdown.items.${item.code}`,
            'INCONSISTENT',
            'Un ítem de falla SEPARATE_LINE requiere que su origen también sea SEPARATE_LINE: una falla no genera línea propia',
          ),
        ],
      })
    }
    const line = lines.get(rootCode) ?? { label: root.label, pooled: [], codes: [] }
    line.pooled.push(item.pooledAmount)
    line.codes.push(item.code)
    lines.set(rootCode, line)
  }

  return ok({
    main: { code: MAIN_LINE_CODE, label: 'Principal', cost: sumClp(mainPooled), itemCodes: mainCodes },
    separate: [...lines.entries()].map(([code, line]) => ({
      code,
      label: line.label,
      cost: sumClp(line.pooled),
      itemCodes: line.codes,
    })),
  })
}

export const ZERO = roundToClp(0)
