import { describe, expect, it } from 'vitest'
import { costOf, costSpecRaw, item } from '../../testing/cost-helpers'
import { override } from '../../testing/pricing-helpers'
import { mutated, validRequestRaw } from '../../testing/fixtures'
import { groupCostLines } from './index'

const withNre = (raw = validRequestRaw()) => mutated('input.services', [{ serviceId: 'modeling-3d', active: true }], raw)
/** El NRE (componente DESIGN) también sufre fallas: así existe un ítem `failure:service:modeling-3d`. */
const nreWithFailures = (raw = validRequestRaw()) =>
  mutated('params.costProfile.failure.affectedComponents', ['MATERIAL', 'ELECTRICITY', 'WEAR', 'SUPERVISION', 'DESIGN'], withNre(raw))

const group = (raw: unknown) => {
  const result = groupCostLines(costOf(raw).breakdown.items)
  if (!result.ok) throw new Error(`se esperaba éxito: ${JSON.stringify(result.error)}`)
  return result.value
}

describe('líneas comerciales: agrupación de costos', () => {
  it('todo IN_PRICE va a la línea principal; sin costos separados no hay líneas separadas', () => {
    const lines = group(validRequestRaw())
    expect(lines.main.cost).toBe(13885)
    expect(lines.separate).toEqual([])
    expect(lines.main.itemCodes).toHaveLength(10)
  })

  it('un costo SEPARATE_LINE genera su propia línea con el costo de su ítem', () => {
    const lines = group(withNre())
    expect(lines.main.cost).toBe(13885)
    expect(lines.separate).toHaveLength(1)
    expect(lines.separate[0]).toMatchObject({ code: 'service:modeling-3d', cost: 27000, itemCodes: ['service:modeling-3d'] })
  })

  describe('condición 1: las fallas de un SEPARATE_LINE van con su origen', () => {
    it('la falla se suma a la línea de su origen y NO genera una línea independiente', () => {
      const raw = nreWithFailures()
      const calc = costOf(raw)
      const failure = item(calc, 'failure:service:modeling-3d')
      expect(failure.derivedFrom).toBe('service:modeling-3d')
      expect(failure.recoveryConfig.recovery).toBe('SEPARATE_LINE')
      expect(failure.amount).toBe(2348) // 27.000 × 0,08 / 0,92

      const lines = group(raw)
      expect(lines.separate).toHaveLength(1) // una sola línea separada
      expect(lines.separate.map((line) => line.code)).toEqual(['service:modeling-3d']) // nunca `failure:...`
      expect(lines.separate[0]?.cost).toBe(27000 + 2348)
    })

    it('el detalle completo se conserva internamente: origen y falla figuran en itemCodes', () => {
      const line = group(nreWithFailures()).separate[0]
      expect(line?.itemCodes).toEqual(['service:modeling-3d', 'failure:service:modeling-3d'])
    })

    it('la línea principal no incluye los ítems de la línea separada', () => {
      const lines = group(nreWithFailures())
      expect(lines.main.itemCodes.some((code) => code.includes('modeling-3d'))).toBe(false)
      expect(lines.main.cost).toBe(13885)
    })

    it('con varios costos separados cada falla va con SU origen', () => {
      const design = costSpecRaw('design', 5000, 'ONE_OFF', { component: 'DESIGN', recoveryConfig: { recovery: 'SEPARATE_LINE' } })
      const raw = mutated('input.extraCosts', [design], nreWithFailures())
      const lines = group(raw)
      expect(lines.separate.map((line) => line.code)).toEqual(['service:modeling-3d', 'extra:design'])
      expect(lines.separate[1]?.itemCodes).toEqual(['extra:design', 'failure:extra:design'])
      expect(lines.separate[1]?.cost).toBe(5000 + 435)
    })

    it('si la falla se reasigna a IN_PRICE por override, esa falla va a la línea principal (decisión explícita)', () => {
      const raw = mutated('overrides', [override('ITEM_RECOVERY', { itemCode: 'failure:service:modeling-3d', value: { recovery: 'IN_PRICE' } })], nreWithFailures())
      const lines = group(raw)
      expect(lines.separate[0]?.cost).toBe(27000)
      expect(lines.main.cost).toBe(13885 + 2348)
      expect(lines.main.itemCodes).toContain('failure:service:modeling-3d')
    })

    it('una falla SEPARATE_LINE cuyo origen no es SEPARATE_LINE es inválida: no puede tener línea propia', () => {
      const raw = mutated(
        'overrides',
        [
          override('ITEM_RECOVERY', { itemCode: 'service:modeling-3d', value: { recovery: 'IN_PRICE' } }),
          override('ITEM_RECOVERY', { itemCode: 'failure:service:modeling-3d', value: { recovery: 'SEPARATE_LINE' } }),
        ],
        nreWithFailures(),
      )
      const result = groupCostLines(costOf(raw).breakdown.items)
      expect(result.ok).toBe(false)
      if (!result.ok && result.error.code === 'INVALID_INPUT') {
        expect(result.error.issues[0]?.path).toBe('breakdown.items.failure:service:modeling-3d')
        expect(result.error.issues[0]?.code).toBe('INCONSISTENT')
      } else {
        throw new Error('se esperaba INVALID_INPUT')
      }
    })
  })

  it('un ítem ABSORBED no pertenece a ninguna línea (no entra al precio)', () => {
    const raw = mutated('overrides', [override('ITEM_RECOVERY', { itemCode: 'service:modeling-3d', value: { recovery: 'ABSORBED' } })], withNre())
    const lines = group(raw)
    expect(lines.separate).toEqual([])
    expect(lines.main.cost).toBe(13885)
  })

  it('las líneas aparecen en el orden de sus ítems origen', () => {
    const second = costSpecRaw('later', 1000, 'ONE_OFF', { recoveryConfig: { recovery: 'SEPARATE_LINE' } })
    const first = costSpecRaw('earlier', 2000, 'ONE_OFF', { recoveryConfig: { recovery: 'SEPARATE_LINE' } })
    const lines = group(mutated('input.extraCosts', [first, second], validRequestRaw()))
    expect(lines.separate.map((line) => line.code)).toEqual(['extra:earlier', 'extra:later'])
  })

  it('el costo de las líneas suma exactamente el pool (sin doble conteo)', () => {
    for (const raw of [validRequestRaw(), withNre(), nreWithFailures()]) {
      const calc = costOf(raw)
      const lines = group(raw)
      const total = lines.main.cost + lines.separate.reduce((sum, line) => sum + line.cost, 0)
      expect(total).toBe(calc.breakdown.pricingPool)
      const codes = [...lines.main.itemCodes, ...lines.separate.flatMap((line) => line.itemCodes)]
      expect(new Set(codes).size).toBe(codes.length)
    }
  })
})
