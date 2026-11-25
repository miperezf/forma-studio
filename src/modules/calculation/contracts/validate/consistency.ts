import { indexPath, issue, type Issue } from '../../../../core/validation'
import { CalculationMode, ServiceKind } from '../enums'
import { CALCULATION_V1 } from '../version'
import type { CalculationRequest } from '../request'
import type { CostSpec } from '../cost-spec'

function checkCatalogKeys(
  issues: Issue[],
  path: string,
  catalog: Readonly<Record<string, { readonly ref: { readonly id: string } }>>,
): void {
  for (const [key, entry] of Object.entries(catalog)) {
    if (entry.ref.id !== key) {
      issues.push(issue(`${path}.${key}`, 'INCONSISTENT', 'La clave no coincide con ref.id'))
    }
  }
}

/**
 * Consistencia entre entrada, parámetros y overrides ya tipados.
 * No toca el motor: son verificaciones de referencias y reglas cruzadas.
 */
export function checkRequestConsistency(request: CalculationRequest): readonly Issue[] {
  const issues: Issue[] = []
  const { input, params, overrides } = request

  checkCatalogKeys(issues, 'params.materials', params.materials)
  checkCatalogKeys(issues, 'params.machines', params.machines)
  checkCatalogKeys(issues, 'params.services', params.services)

  if (input.channelId !== params.channel.ref.id) {
    issues.push(issue('input.channelId', 'INCONSISTENT', 'No coincide con el canal del snapshot (params.channel.ref.id)'))
  }

  input.plates.forEach((plate, plateIndex) => {
    const platePath = indexPath('input.plates', plateIndex)
    if (params.machines[plate.machineId] === undefined) {
      issues.push(issue(`${platePath}.machineId`, 'UNKNOWN_REFERENCE', `Máquina inexistente en el snapshot: ${plate.machineId}`))
    }
    if (plate.lastRun !== undefined) {
      const lastPath = `${platePath}.lastRun`
      if (request.calculationVersion === CALCULATION_V1) {
        issues.push(issue(lastPath, 'INCONSISTENT', 'La última placa con datos propios requiere calculationVersion v2 o superior'))
      }
      const remainder = (input.quantity * plate.partsPerUnit) % plate.partsPerPlate
      if (remainder === 0) {
        issues.push(issue(lastPath, 'INCONSISTENT', 'No hay placa incompleta: todas las placas van llenas'))
      } else if (plate.lastRun.parts !== remainder) {
        issues.push(issue(`${lastPath}.parts`, 'INCONSISTENT', `La última placa debe tener ${String(remainder)} pieza(s)`))
      }
      plate.lastRun.filaments.forEach((filament, filamentIndex) => {
        if (params.materials[filament.materialId] === undefined) {
          issues.push(issue(`${indexPath(`${lastPath}.filaments`, filamentIndex)}.materialId`, 'UNKNOWN_REFERENCE', `Material inexistente en el snapshot: ${filament.materialId}`))
        } else if (!plate.filaments.some((full) => full.materialId === filament.materialId)) {
          issues.push(issue(`${indexPath(`${lastPath}.filaments`, filamentIndex)}.materialId`, 'INCONSISTENT', 'La última placa solo puede usar filamentos de la placa completa'))
        }
      })
    }
    plate.filaments.forEach((filament, filamentIndex) => {
      if (params.materials[filament.materialId] === undefined) {
        issues.push(
          issue(
            `${indexPath(`${platePath}.filaments`, filamentIndex)}.materialId`,
            'UNKNOWN_REFERENCE',
            `Material inexistente en el snapshot: ${filament.materialId}`,
          ),
        )
      }
    })
  })

  input.services.forEach((service, index) => {
    if (params.services[service.serviceId] === undefined) {
      issues.push(
        issue(
          `${indexPath('input.services', index)}.serviceId`,
          'UNKNOWN_REFERENCE',
          `Servicio inexistente en el snapshot: ${service.serviceId}`,
        ),
      )
    }
  })

  // Ensamblaje: una sola fuente de verdad. Dos servicios de ensamblaje activos cobrarían dos veces.
  const activeAssemblies = input.services.filter(
    (service) => service.active && params.services[service.serviceId]?.kind === ServiceKind.ASSEMBLY,
  )
  if (activeAssemblies.length > 1) {
    issues.push(
      issue('input.services', 'INCONSISTENT', 'Solo un servicio de ensamblaje puede estar activo (se cobra una sola vez)'),
    )
  }

  const auxiliaryCodes = new Set(params.costProfile.auxiliaryCosts.map((spec: CostSpec) => spec.code))
  input.extraCosts.forEach((spec, index) => {
    if (auxiliaryCodes.has(spec.code)) {
      issues.push(
        issue(
          `${indexPath('input.extraCosts', index)}.code`,
          'DUPLICATE',
          `Colisiona con un costo auxiliar del perfil: ${spec.code}`,
        ),
      )
    }
  })

  // D13: un override de margen de UNA cotización puede quedar bajo el mínimo (la Beta lo permitía y advertía).
  // No es un dato inválido: la política del perfil decide (WARN advierte, CAP sube al mínimo, BLOCK impide emitir).
  // El perfil, en cambio, sigue exigiendo mínimo ≤ objetivo (ver validate/parameters.ts).

  if (request.mode === CalculationMode.TEST && overrides.length > 0) {
    issues.push(issue('overrides', 'INCONSISTENT', 'El modo TEST no admite overrides (no calcula precio)'))
  }

  return issues
}
