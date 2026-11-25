/**
 * Configuración del taller (perfil versionado por `revision`). El cotizador NO usa estas funciones para calcular:
 * desde Beta 0.6 los perfiles se validan y convierten en `src/modules/quoting` (motor v1). `assembleQuoteInputs`
 * queda solo como referencia del prototipo (tests en tests/legacy).
 */
export const DEFAULT_SHOP_SETTINGS = Object.freeze({
  revision: 1,
  targetMargin: 35, minMargin: 25, taxRegime: 'VAT_REGISTERED', taxRate: 19, taxRegimeConfirmed: false, energyPerKwh: 210,
  laborPerHour: 4500, supervisionFactor: 0.15, preparationMinutes: 20,
  packingPerUnit: 350, failureRate: 5, priceRounding: 100,
  onBelowMin: 'WARN',
  validDays: 7,
  terms: 'Plazos y forma de pago sujetos a confirmación.',
});

export const QUOTE_EXTRAS = Object.freeze({
  design: ['oneOffDesignCost'],
  finishing: ['finishingMinutesPerUnit'],
  assembly: ['assemblyMinutesPerExtraPart'],
  planning: ['partsPerUnit','batches','extraGrPerPlate'],
  packing: ['packagingPerUnit'],
  sales: ['targetMargin','validDays','terms'],
});

export function normalizedShopSettings(raw={}) {
  return {...DEFAULT_SHOP_SETTINGS, ...(raw && typeof raw === 'object' ? raw : {})};
}

/** Disabled extras MUST NOT affect a price, even if their saved draft has values. */
export function assembleQuoteInputs(raw, enabled=[], settings=DEFAULT_SHOP_SETTINGS) {
  const chosen = new Set(enabled);
  const profile = normalizedShopSettings(settings);
  const result = {...raw,
    targetMargin: profile.targetMargin,
    validDays: profile.validDays,
    terms: profile.terms,
    oneOffDesignCost: 0,
    finishingMinutesPerUnit: 0,
    assemblyMinutesPerExtraPart: 0,
    partsPerUnit: 1,
    batches: 1,
    extraGrPerPlate: 0,
    packagingPerUnit: profile.packingPerUnit,
  };
  for (const [option, keys] of Object.entries(QUOTE_EXTRAS)) {
    if (!chosen.has(option)) continue;
    for (const key of keys) {
      // Empty deliberate override remains empty and fails validation in the estimator.
      if (Object.hasOwn(raw,key)) result[key] = raw[key];
    }
  }
  return result;
}
