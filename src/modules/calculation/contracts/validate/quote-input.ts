import { parseGrams, parseHours, parseMinutes, parseQuantity } from '../../../../core/money'
import {
  childPath,
  ID_PATTERN,
  indexPath,
  issue,
  readArray,
  readBoolean,
  readEnum,
  readPattern,
  readRecord,
  readString,
  take,
  type Issue,
} from '../../../../core/validation'
import {
  MAX_EXTRA_COSTS,
  MAX_FILAMENTS_PER_PLATE,
  MAX_LABEL_LENGTH,
  MAX_PLATES,
  MAX_SERVICES,
} from '../constants'
import { PlateSource } from '../enums'
import type { FilamentUse, LastRunSpec, PlateSpec, QuoteInput, ServiceSelection } from '../quote-input'
import { checkUniqueCodes, readCostSpec } from './cost-spec'
import type { CostSpec } from '../cost-spec'

const ID_HINT = 'letras, números, _ . -'

function readFilament(issues: Issue[], path: string, value: unknown): FilamentUse | undefined {
  const record = readRecord(issues, path, value, ['materialId', 'grams'])
  if (record === undefined) return undefined
  const materialId = readPattern(issues, childPath(path, 'materialId'), record.materialId, ID_PATTERN, ID_HINT)
  const grams = take(issues, parseGrams(record.grams, childPath(path, 'grams'), 'POSITIVE'))
  if (materialId === undefined || grams === undefined) return undefined
  return { materialId, grams }
}

function readFilamentList(issues: Issue[], path: string, value: unknown): { list: FilamentUse[]; complete: boolean } {
  const raw = readArray(issues, path, value, { min: 1, max: MAX_FILAMENTS_PER_PLATE })
  const list: FilamentUse[] = []
  raw?.forEach((entry, index) => {
    const filament = readFilament(issues, indexPath(path, index), entry)
    if (filament !== undefined) list.push(filament)
  })
  const seen = new Set<string>()
  list.forEach((filament, index) => {
    if (seen.has(filament.materialId)) {
      issues.push(issue(`${indexPath(path, index)}.materialId`, 'DUPLICATE', 'Material repetido en la placa; sume los gramos'))
    }
    seen.add(filament.materialId)
  })
  return { list, complete: raw !== undefined && list.length === raw.length }
}

function readLastRun(issues: Issue[], path: string, value: unknown): LastRunSpec | undefined {
  const record = readRecord(issues, path, value, ['parts', 'filaments', 'printHours'])
  if (record === undefined) return undefined
  const parts = take(issues, parseQuantity(record.parts, childPath(path, 'parts')))
  const filaments = readFilamentList(issues, childPath(path, 'filaments'), record.filaments)
  const printHours = take(issues, parseHours(record.printHours, childPath(path, 'printHours'), 'POSITIVE'))
  if (parts === undefined || !filaments.complete || printHours === undefined) return undefined
  return { parts, filaments: filaments.list, printHours }
}

function readPlate(issues: Issue[], path: string, value: unknown): PlateSpec | undefined {
  const record = readRecord(issues, path, value, [
    'id',
    'label',
    'filaments',
    'machineId',
    'printHours',
    'partsPerPlate',
    'partsPerUnit',
    'weightIncludesWaste',
    'source',
    'sourceTestId',
    'lastRun',
  ])
  if (record === undefined) return undefined
  const id = readPattern(issues, childPath(path, 'id'), record.id, ID_PATTERN, ID_HINT)
  const label = readString(issues, childPath(path, 'label'), record.label, MAX_LABEL_LENGTH)
  const filamentsPath = childPath(path, 'filaments')
  const rawFilaments = readArray(issues, filamentsPath, record.filaments, {
    min: 1,
    max: MAX_FILAMENTS_PER_PLATE,
  })
  const filaments: FilamentUse[] = []
  rawFilaments?.forEach((raw, index) => {
    const filament = readFilament(issues, indexPath(filamentsPath, index), raw)
    if (filament !== undefined) filaments.push(filament)
  })
  const seenMaterials = new Set<string>()
  filaments.forEach((filament, index) => {
    if (seenMaterials.has(filament.materialId)) {
      issues.push(
        issue(`${indexPath(filamentsPath, index)}.materialId`, 'DUPLICATE', 'Material repetido en la placa; sume los gramos'),
      )
    }
    seenMaterials.add(filament.materialId)
  })
  const machineId = readPattern(issues, childPath(path, 'machineId'), record.machineId, ID_PATTERN, ID_HINT)
  const printHours = take(issues, parseHours(record.printHours, childPath(path, 'printHours'), 'POSITIVE'))
  const partsPerPlate = take(issues, parseQuantity(record.partsPerPlate, childPath(path, 'partsPerPlate')))
  const partsPerUnit = take(issues, parseQuantity(record.partsPerUnit, childPath(path, 'partsPerUnit')))
  const weightIncludesWaste = readBoolean(
    issues,
    childPath(path, 'weightIncludesWaste'),
    record.weightIncludesWaste,
  )
  const source = readEnum(issues, childPath(path, 'source'), record.source, PlateSource)
  const sourceTestId =
    record.sourceTestId === undefined
      ? undefined
      : readPattern(issues, childPath(path, 'sourceTestId'), record.sourceTestId, ID_PATTERN, ID_HINT)
  const lastRun = record.lastRun === undefined ? undefined : readLastRun(issues, childPath(path, 'lastRun'), record.lastRun)
  if (source === PlateSource.TEST && record.sourceTestId === undefined) {
    issues.push(issue(childPath(path, 'sourceTestId'), 'REQUIRED', 'Requerido cuando source es TEST'))
  }
  if (
    id === undefined ||
    label === undefined ||
    rawFilaments === undefined ||
    filaments.length !== rawFilaments.length ||
    machineId === undefined ||
    printHours === undefined ||
    partsPerPlate === undefined ||
    partsPerUnit === undefined ||
    weightIncludesWaste === undefined ||
    source === undefined ||
    (record.sourceTestId !== undefined && sourceTestId === undefined) ||
    (record.lastRun !== undefined && lastRun === undefined)
  ) {
    return undefined
  }
  return {
    id,
    label,
    filaments,
    machineId,
    printHours,
    partsPerPlate,
    partsPerUnit,
    weightIncludesWaste,
    source,
    ...(sourceTestId === undefined ? {} : { sourceTestId }),
    ...(lastRun === undefined ? {} : { lastRun }),
  }
}

function readService(issues: Issue[], path: string, value: unknown): ServiceSelection | undefined {
  const record = readRecord(issues, path, value, ['serviceId', 'active', 'laborMinutes'])
  if (record === undefined) return undefined
  const serviceId = readPattern(issues, childPath(path, 'serviceId'), record.serviceId, ID_PATTERN, ID_HINT)
  const active = readBoolean(issues, childPath(path, 'active'), record.active)
  const laborMinutes =
    record.laborMinutes === undefined ? undefined : take(issues, parseMinutes(record.laborMinutes, childPath(path, 'laborMinutes')))
  if (serviceId === undefined || active === undefined) return undefined
  if (record.laborMinutes !== undefined && laborMinutes === undefined) return undefined
  return { serviceId, active, ...(laborMinutes === undefined ? {} : { laborMinutes }) }
}

export function readQuoteInput(issues: Issue[], path: string, value: unknown): QuoteInput | undefined {
  const record = readRecord(issues, path, value, [
    'quantity',
    'batches',
    'plates',
    'services',
    'extraCosts',
    'channelId',
  ])
  if (record === undefined) return undefined
  const quantity = take(issues, parseQuantity(record.quantity, childPath(path, 'quantity')))
  const batches = take(issues, parseQuantity(record.batches, childPath(path, 'batches')))

  const platesPath = childPath(path, 'plates')
  const rawPlates = readArray(issues, platesPath, record.plates, { min: 1, max: MAX_PLATES })
  const plates: PlateSpec[] = []
  rawPlates?.forEach((raw, index) => {
    const plate = readPlate(issues, indexPath(platesPath, index), raw)
    if (plate !== undefined) plates.push(plate)
  })
  const seenPlates = new Set<string>()
  plates.forEach((plate, index) => {
    if (seenPlates.has(plate.id)) {
      issues.push(issue(`${indexPath(platesPath, index)}.id`, 'DUPLICATE', `Placa repetida: ${plate.id}`))
    }
    seenPlates.add(plate.id)
  })

  const servicesPath = childPath(path, 'services')
  const rawServices = readArray(issues, servicesPath, record.services, { min: 0, max: MAX_SERVICES })
  const services: ServiceSelection[] = []
  rawServices?.forEach((raw, index) => {
    const service = readService(issues, indexPath(servicesPath, index), raw)
    if (service !== undefined) services.push(service)
  })
  const seenServices = new Set<string>()
  services.forEach((service, index) => {
    if (seenServices.has(service.serviceId)) {
      issues.push(
        issue(`${indexPath(servicesPath, index)}.serviceId`, 'DUPLICATE', `Servicio repetido: ${service.serviceId}`),
      )
    }
    seenServices.add(service.serviceId)
  })

  const extraPath = childPath(path, 'extraCosts')
  const rawExtras = readArray(issues, extraPath, record.extraCosts, { min: 0, max: MAX_EXTRA_COSTS })
  const extraCosts: CostSpec[] = []
  rawExtras?.forEach((raw, index) => {
    const spec = readCostSpec(issues, indexPath(extraPath, index), raw)
    if (spec !== undefined) extraCosts.push(spec)
  })
  checkUniqueCodes(issues, extraPath, extraCosts)

  const channelId = readPattern(issues, childPath(path, 'channelId'), record.channelId, ID_PATTERN, ID_HINT)

  if (
    quantity === undefined ||
    batches === undefined ||
    rawPlates === undefined ||
    plates.length !== rawPlates.length ||
    rawServices === undefined ||
    services.length !== rawServices.length ||
    rawExtras === undefined ||
    extraCosts.length !== rawExtras.length ||
    channelId === undefined
  ) {
    return undefined
  }
  return { quantity, batches, plates, services, extraCosts, channelId }
}
