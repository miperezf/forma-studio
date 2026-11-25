import { z } from 'zod'
import { err, ok, type Result } from '../../core/result'
import { FIRST_EXTRA_PLATE, FIRST_EXTRA_SLOT, LIMITS } from './constants'

/** Servicios opcionales del cotizador único (chips de la Beta). Ningún «modo avanzado»: solo se muestran si se activan. */
export const QUOTE_EXTRAS = ['multicolor', 'design', 'finishing', 'assembly', 'packing', 'planning', 'sales'] as const
export type QuoteExtra = (typeof QUOTE_EXTRAS)[number]

/** Un número de un `<input>`: texto vacío NO es 0 (se rechaza); "0" sí es 0. */
const num = (min: number, max: number, label: string) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? (value.trim() === '' ? undefined : Number(value)) : value),
    z.number({ required_error: `Ingresa ${label}.`, invalid_type_error: `Ingresa ${label}.` })
      .finite(`Ingresa ${label}.`)
      .min(min, `Revisa ${label}.`)
      .max(max, `Revisa ${label}.`),
  )
const int = (min: number, max: number, label: string) => num(min, max, label).pipe(z.number().int(`${label}: debe ser un entero.`))
const id = (label: string) => z.string({ required_error: `Selecciona ${label}.` }).trim().min(1, `Selecciona ${label}.`)

const BaseSchema = z.object({
  clientId: id('un cliente'),
  project: z.string({ required_error: 'Indica el nombre de la pieza.' }).trim().min(1, 'Indica el nombre de la pieza.').max(LIMITS.project),
  machineId: id('una impresora'),
  materialId: id('un filamento'),
  channel: id('un canal de venta'),
  quantity: int(1, LIMITS.quantity, 'la cantidad'),
  partsPerPlate: int(1, LIMITS.partsPerPlate, 'las piezas por placa'),
  plateWeightGr: num(0, LIMITS.grams, 'los gramos de la placa').refine((grams) => grams > 0, 'Los gramos de la placa deben ser mayores a 0.'),
  plateHours: num(0, LIMITS.hours, 'las horas de la placa').refine((hours) => hours > 0, 'Las horas de la placa deben ser mayores a 0.'),
})

/** Filamentos adicionales de una placa multicolor (AMS): campos `amsMaterial2..4` y `amsGrams2..4`. */
export const AMS_EXTRA_SLOTS = Array.from({ length: LIMITS.amsSlots - 1 }, (_, index) => index + FIRST_EXTRA_SLOT)

export interface FilamentSlot {
  readonly materialId: string
  /** Gramos POR PLACA de este filamento, tal como los informa Bambu Studio (incluyen purga). */
  readonly grams: number
}

function parseAmsSlots(raw: Readonly<Record<string, unknown>>): Result<readonly FilamentSlot[], readonly FormIssue[]> {
  const issues: FormIssue[] = []
  const slots: FilamentSlot[] = []
  for (const slot of AMS_EXTRA_SLOTS) {
    const material = String(raw[`amsMaterial${String(slot)}`] ?? '').trim()
    const gramsText = String(raw[`amsGrams${String(slot)}`] ?? '').trim()
    if (material === '' && gramsText === '') continue
    if (material === '') {
      issues.push({ field: `amsMaterial${String(slot)}`, message: `Color ${String(slot)}: elige el filamento.` })
      continue
    }
    const grams = gramsText === '' ? Number.NaN : Number(gramsText)
    if (!Number.isFinite(grams) || grams <= 0 || grams > LIMITS.grams) {
      issues.push({ field: `amsGrams${String(slot)}`, message: `Color ${String(slot)}: ingresa los gramos por placa (mayor a 0).` })
      continue
    }
    slots.push({ materialId: material, grams })
  }
  if (issues.length === 0 && slots.length === 0) issues.push({ field: 'amsMaterial2', message: 'Multicolor: agrega al menos un segundo filamento.' })
  return issues.length > 0 ? err(issues) : ok(slots)
}

/**
 * Placas ADICIONALES de un producto (2..8): cada una con sus filamentos (1–4, g por placa), su tiempo y cuántas
 * unidades del producto salen de ella. Campos `plate{n}Units`, `plate{n}Hours`, `plate{n}Mat{k}`, `plate{n}Grams{k}`.
 * Una placa existe si su campo de unidades viene en el formulario.
 */
export interface ExtraPlateState {
  /** Unidades del producto que salen de UNA placa (piezas de la placa con 1 pieza por unidad). */
  readonly unitsPerPlate: number
  readonly printHours: number
  readonly filaments: readonly FilamentSlot[]
}

export const EXTRA_PLATE_NUMBERS = Array.from({ length: LIMITS.plates - 1 }, (_, index) => index + FIRST_EXTRA_PLATE)
const FILAMENT_NUMBERS = Array.from({ length: LIMITS.amsSlots }, (_, index) => index + 1)

function parseExtraPlates(raw: Readonly<Record<string, unknown>>): Result<readonly ExtraPlateState[], readonly FormIssue[]> {
  const issues: FormIssue[] = []
  const plates: ExtraPlateState[] = []
  const text = (key: string) => String(raw[key] ?? '').trim()
  for (const n of EXTRA_PLATE_NUMBERS) {
    const key = `plate${String(n)}`
    if (raw[`${key}Units`] === undefined) continue
    const units = Number(text(`${key}Units`))
    if (!Number.isInteger(units) || units < 1 || units > LIMITS.partsPerPlate) {
      issues.push({ field: `${key}Units`, message: `Placa ${String(n)}: indica cuántas unidades salen de la placa (entero, 1 o más).` })
    }
    const hoursText = text(`${key}Hours`)
    const hours = hoursText === '' ? Number.NaN : Number(hoursText)
    if (!Number.isFinite(hours) || hours <= 0 || hours > LIMITS.hours) {
      issues.push({ field: `${key}Hours`, message: `Placa ${String(n)}: ingresa el tiempo de Bambu Studio (mayor a 0).` })
    }
    const filaments: FilamentSlot[] = []
    for (const k of FILAMENT_NUMBERS) {
      const material = text(`${key}Mat${String(k)}`)
      const gramsText = text(`${key}Grams${String(k)}`)
      if (material === '' && gramsText === '') continue
      if (material === '') {
        issues.push({ field: `${key}Mat${String(k)}`, message: `Placa ${String(n)}, color ${String(k)}: elige el filamento.` })
        continue
      }
      const grams = gramsText === '' ? Number.NaN : Number(gramsText)
      if (!Number.isFinite(grams) || grams <= 0 || grams > LIMITS.grams) {
        issues.push({ field: `${key}Grams${String(k)}`, message: `Placa ${String(n)}, color ${String(k)}: ingresa los gramos (mayor a 0).` })
        continue
      }
      filaments.push({ materialId: material, grams })
    }
    if (filaments.length === 0 && !issues.some((issue) => issue.field.startsWith(`${key}Mat`) || issue.field.startsWith(`${key}Grams`))) {
      issues.push({ field: `${key}Grams1`, message: `Placa ${String(n)}: ingresa los gramos de al menos un filamento.` })
    }
    plates.push({ unitsPerPlate: units, printHours: hours, filaments })
  }
  return issues.length > 0 ? err(issues) : ok(plates)
}

/** Archivo de Bambu Studio del que salieron los datos (trazabilidad; no afecta el cálculo). */
export interface ImportedFrom {
  readonly fileName: string
  readonly slicer: string
  readonly printer: string
}

function parseImportedFrom(raw: Readonly<Record<string, unknown>>): ImportedFrom | null {
  const text = (key: string) => String(raw[key] ?? '').trim().slice(0, LIMITS.importText)
  const fileName = text('importFile')
  return fileName === '' ? null : { fileName, slicer: text('importSlicer'), printer: text('importPrinter') }
}

/**
 * Última placa incompleta (motor v2): tiempo y gramos POR COLOR (lastRunGrams1 = filamento principal, 2..4 = AMS)
 * obtenidos al rebanar en Bambu Studio solo las piezas restantes. Todo vacío = sin datos (estimación conservadora).
 */
export interface LastRunData {
  readonly printHours: number
  /** Gramos por color en el MISMO orden que los filamentos de la placa (0 = ese color no se usa en la última placa). */
  readonly grams: readonly number[]
}

function parseLastRun(raw: Readonly<Record<string, unknown>>, colors: number): Result<LastRunData | null, readonly FormIssue[]> {
  const text = (key: string) => String(raw[key] ?? '').trim()
  const hoursText = text('lastRunHours')
  const gramsText = Array.from({ length: colors }, (_, index) => text(`lastRunGrams${String(index + 1)}`))
  if (hoursText === '' && gramsText.every((value) => value === '')) return ok(null)
  const issues: FormIssue[] = []
  const hours = Number(hoursText)
  if (hoursText === '' || !Number.isFinite(hours) || hours <= 0 || hours > LIMITS.hours) {
    issues.push({ field: 'lastRunHours', message: 'Última placa: ingresa el tiempo de Bambu Studio (mayor a 0).' })
  }
  const grams = gramsText.map((value, index) => {
    const parsed = value === '' ? 0 : Number(value)
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > LIMITS.grams) {
      issues.push({ field: `lastRunGrams${String(index + 1)}`, message: `Última placa: revisa los gramos del color ${String(index + 1)}.` })
    }
    return parsed
  })
  if (issues.length === 0 && !grams.some((value) => value > 0)) {
    issues.push({ field: 'lastRunGrams1', message: 'Última placa: ingresa los gramos de Bambu Studio.' })
  }
  return issues.length > 0 ? err(issues) : ok({ printHours: hours, grams })
}

const ExtraSchemas = {
  design: z.object({ oneOffDesignCost: num(0, LIMITS.money, 'el costo del diseño') }),
  finishing: z.object({ finishingMinutesPerUnit: num(0, LIMITS.minutes, 'los minutos de acabado') }),
  assembly: z.object({ assemblyMinutesPerExtraPart: num(0, LIMITS.minutes, 'los minutos de ensamblaje') }),
  packing: z.object({ packagingPerUnit: num(0, LIMITS.money, 'el embalaje por unidad') }),
  planning: z.object({
    partsPerUnit: int(1, LIMITS.partsPerUnit, 'las piezas por producto'),
    batches: int(1, LIMITS.batches, 'los lotes de trabajo'),
    extraGrPerPlate: num(0, LIMITS.grams, 'el material no incluido'),
  }),
  sales: z.object({
    targetMargin: num(0, LIMITS.marginPct, 'el margen objetivo'),
    validDays: int(1, LIMITS.validDays, 'la validez'),
    terms: z.string().trim().max(LIMITS.terms).default(''),
  }),
} as const

/**
 * Estado validado del formulario. Un extra APAGADO no aporta nada (ni siquiera se valida): `null` significa
 * «usar el perfil», y es distinto de 0. Este objeto es el `formState` que se guarda para recotizar.
 */
export interface QuoteFormState {
  readonly clientId: string
  readonly project: string
  readonly machineId: string
  readonly materialId: string
  readonly channelId: string
  readonly quantity: number
  readonly partsPerPlate: number
  readonly plateWeightGr: number
  readonly plateHours: number
  readonly partsPerUnit: number
  readonly batches: number
  readonly extraGrPerPlate: number
  readonly oneOffDesignCost: number | null
  readonly finishingMinutesPerUnit: number | null
  readonly assemblyMinutesPerExtraPart: number | null
  readonly packagingPerUnit: number | null
  /** Margen objetivo de ESTA venta en % (override auditado); `null` = el del perfil. */
  readonly targetMarginPct: number | null
  readonly validDays: number | null
  readonly terms: string | null
  readonly extras: readonly QuoteExtra[]
  /**
   * Placa multicolor (AMS): filamentos adicionales al principal (`materialId` + `plateWeightGr` = color 1).
   * Opcional: los formState guardados antes de 0.10 no lo tienen (equivale a []).
   */
  readonly extraFilaments?: readonly FilamentSlot[]
  /** v2: datos reales de la última placa incompleta; null/ausente = estimación conservadora (placa completa). */
  readonly lastRun?: LastRunData | null
  /** Placas adicionales (producto con varias placas). Ausente o [] = una sola placa (como antes de 0.14). */
  readonly extraPlates?: readonly ExtraPlateState[]
  /** Composición opcional por placa, solo guía para calcular la capacidad; el precio usa la capacidad validada. */
  readonly plateComposition?: readonly PlateComponent[]
  /** Archivo .gcode.3mf importado (trazabilidad). Ausente/null = datos digitados a mano. */
  readonly importedFrom?: ImportedFrom | null
}

export interface PlateComponent {
  readonly name: string
  readonly required: number
  readonly produced: number
}

/** Metadatos opcionales del asistente: las cotizaciones antiguas siguen sin ellos. */
function parsePlateComposition(
  raw: Readonly<Record<string, unknown>>,
  plateCount: number,
): Result<readonly PlateComponent[] | null, readonly FormIssue[]> {
  const hasAny = Array.from({ length: plateCount }, (_, i) => i + 1).some((n) =>
    ['Name', 'Required', 'Produced'].some((suffix) => raw[`component${String(n)}${suffix}`] !== undefined),
  )
  if (!hasAny) return ok(null)
  const components: PlateComponent[] = []
  const issues: FormIssue[] = []
  for (let n = 1; n <= plateCount; n++) {
    const prefix = `component${String(n)}`
    const name = String(raw[`${prefix}Name`] ?? '').trim()
    const requiredText = String(raw[`${prefix}Required`] ?? '').trim()
    const producedText = String(raw[`${prefix}Produced`] ?? '').trim()
    const required = requiredText === '' ? Number.NaN : Number(requiredText)
    const produced = producedText === '' ? Number.NaN : Number(producedText)
    if (name.length > LIMITS.componentName) issues.push({ field: `${prefix}Name`, message: `Placa ${String(n)}: nombre demasiado largo.` })
    if (!Number.isSafeInteger(required) || required < 1 || required > LIMITS.partsPerPlate)
      issues.push({ field: `${prefix}Required`, message: `Placa ${String(n)}: indica las piezas necesarias por producto.` })
    if (!Number.isSafeInteger(produced) || produced < 1 || produced > LIMITS.partsPerPlate * LIMITS.partsPerPlate)
      issues.push({ field: `${prefix}Produced`, message: `Placa ${String(n)}: indica las piezas impresas en una placa.` })
    if (Number.isSafeInteger(required) && required > 0 && Number.isSafeInteger(produced) && produced > 0) {
      const capacity = Math.floor(produced / required)
      const savedCapacity = Number(raw[n === 1 ? 'partsPerPlate' : `plate${String(n)}Units`])
      if (capacity < 1 || capacity > LIMITS.partsPerPlate || capacity !== savedCapacity)
        issues.push({ field: `${prefix}Produced`, message: `Placa ${String(n)}: la cantidad impresa no coincide con la capacidad de productos.` })
    }
    components.push({ name, required, produced })
  }
  return issues.length ? err(issues) : ok(components)
}

export interface FormIssue {
  readonly field: string
  readonly message: string
}

const issuesOf = (error: z.ZodError): FormIssue[] =>
  error.issues.map((issue) => ({ field: issue.path.map(String).join('.'), message: issue.message }))

/** Valida los valores crudos del formulario (FormData) con los extras activos. Puro. */
export function parseQuoteForm(raw: Readonly<Record<string, unknown>>, enabled: Iterable<string>): Result<QuoteFormState, readonly FormIssue[]> {
  const active = new Set<string>(enabled)
  const extras = QUOTE_EXTRAS.filter((extra) => active.has(extra))
  const issues: FormIssue[] = []
  const base = BaseSchema.safeParse(raw)
  if (!base.success) issues.push(...issuesOf(base.error))
  const parseExtra = <K extends keyof typeof ExtraSchemas>(key: K): z.infer<(typeof ExtraSchemas)[K]> | null => {
    if (!active.has(key)) return null
    const parsed = ExtraSchemas[key].safeParse(raw)
    if (!parsed.success) {
      issues.push(...issuesOf(parsed.error))
      return null
    }
    return parsed.data as z.infer<(typeof ExtraSchemas)[K]>
  }
  const design = parseExtra('design')
  const finishing = parseExtra('finishing')
  const assembly = parseExtra('assembly')
  const packing = parseExtra('packing')
  const planning = parseExtra('planning')
  const sales = parseExtra('sales')
  let extraFilaments: readonly FilamentSlot[] = []
  if (active.has('multicolor')) {
    const ams = parseAmsSlots(raw)
    if (ams.ok) extraFilaments = ams.value
    else issues.push(...ams.error)
  }
  const lastRun = parseLastRun(raw, 1 + extraFilaments.length)
  if (!lastRun.ok) issues.push(...lastRun.error)
  const extraPlates = parseExtraPlates(raw)
  if (!extraPlates.ok) issues.push(...extraPlates.error)
  const composition = parsePlateComposition(raw, 1 + (extraPlates.ok ? extraPlates.value.length : 0))
  if (!composition.ok) issues.push(...composition.error)
  if (extraPlates.ok && extraPlates.value.length > 0 && (planning?.partsPerUnit ?? 1) > 1) {
    issues.push({ field: 'partsPerUnit', message: 'Con varias placas, indica en cada placa cuántas unidades salen (deja «Piezas por producto» en 1).' })
  }
  if (!base.success || issues.length > 0 || !lastRun.ok || !extraPlates.ok) return err(issues)
  const b = base.data
  return ok({
    clientId: b.clientId,
    project: b.project,
    machineId: b.machineId,
    materialId: b.materialId,
    channelId: b.channel,
    quantity: b.quantity,
    partsPerPlate: b.partsPerPlate,
    plateWeightGr: b.plateWeightGr,
    plateHours: b.plateHours,
    partsPerUnit: planning?.partsPerUnit ?? 1,
    batches: planning?.batches ?? 1,
    extraGrPerPlate: planning?.extraGrPerPlate ?? 0,
    oneOffDesignCost: design?.oneOffDesignCost ?? null,
    finishingMinutesPerUnit: finishing?.finishingMinutesPerUnit ?? null,
    assemblyMinutesPerExtraPart: assembly?.assemblyMinutesPerExtraPart ?? null,
    packagingPerUnit: packing?.packagingPerUnit ?? null,
    targetMarginPct: sales?.targetMargin ?? null,
    validDays: sales?.validDays ?? null,
    terms: sales === null ? null : sales.terms,
    extras,
    extraFilaments,
    lastRun: lastRun.value,
    extraPlates: extraPlates.value,
    ...(composition.ok && composition.value ? { plateComposition: composition.value } : {}),
    importedFrom: parseImportedFrom(raw),
  })
}

/** Reconstruye los valores crudos (para «Nueva revisión y recotizar»): parseQuoteForm(toRawForm(s), s.extras) ≡ s. */
export function toRawForm(state: QuoteFormState): Record<string, string> {
  const raw: Record<string, string> = {
    clientId: state.clientId,
    project: state.project,
    machineId: state.machineId,
    materialId: state.materialId,
    channel: state.channelId,
    quantity: String(state.quantity),
    partsPerPlate: String(state.partsPerPlate),
    plateWeightGr: String(state.plateWeightGr),
    plateHours: String(state.plateHours),
    partsPerUnit: String(state.partsPerUnit),
    batches: String(state.batches),
    extraGrPerPlate: String(state.extraGrPerPlate),
  }
  const put = (key: string, value: number | string | null) => {
    if (value !== null) raw[key] = String(value)
  }
  put('oneOffDesignCost', state.oneOffDesignCost)
  put('finishingMinutesPerUnit', state.finishingMinutesPerUnit)
  put('assemblyMinutesPerExtraPart', state.assemblyMinutesPerExtraPart)
  put('packagingPerUnit', state.packagingPerUnit)
  put('targetMargin', state.targetMarginPct)
  put('validDays', state.validDays)
  put('terms', state.terms)
  ;(state.extraFilaments ?? []).forEach((slot, index) => {
    raw[`amsMaterial${String(index + FIRST_EXTRA_SLOT)}`] = slot.materialId
    raw[`amsGrams${String(index + FIRST_EXTRA_SLOT)}`] = String(slot.grams)
  })
  if (state.lastRun) {
    raw.lastRunHours = String(state.lastRun.printHours)
    state.lastRun.grams.forEach((grams, index) => {
      raw[`lastRunGrams${String(index + 1)}`] = String(grams)
    })
  }
  ;(state.extraPlates ?? []).forEach((plate, index) => {
    const key = `plate${String(index + FIRST_EXTRA_PLATE)}`
    raw[`${key}Units`] = String(plate.unitsPerPlate)
    raw[`${key}Hours`] = String(plate.printHours)
    plate.filaments.forEach((slot, k) => {
      raw[`${key}Mat${String(k + 1)}`] = slot.materialId
      raw[`${key}Grams${String(k + 1)}`] = String(slot.grams)
    })
  })
  ;(state.plateComposition ?? []).forEach((component, index) => {
    const prefix = `component${String(index + 1)}`
    raw[`${prefix}Name`] = component.name
    raw[`${prefix}Required`] = String(component.required)
    raw[`${prefix}Produced`] = String(component.produced)
  })
  if (state.importedFrom) {
    raw.importFile = state.importedFrom.fileName
    raw.importSlicer = state.importedFrom.slicer
    raw.importPrinter = state.importedFrom.printer
  }
  return raw
}
