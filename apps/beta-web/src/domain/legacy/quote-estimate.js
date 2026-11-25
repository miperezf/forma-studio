/**
 * BETA UX ESTIMATOR ONLY. Deliberately NOT calculation/v1 or QuoteCalculator.
 * A narrow, testable interface preview with explicit machine profiles and cost behaviours.
 * All prices remain fictitious until the reviewed versioned engine is integrated.
 */
import { machineHourlyCosts } from '../printer-profiles.js';
export const DEMO_CALCULATION_VERSION = 'DEMO-UI-0.3';
export const CHANNELS = [
  { id: 'direct', name: 'Venta directa', rate: 0, fixed: 0 },
  { id: 'instagram', name: 'Instagram', rate: 0.03, fixed: 0 },
  { id: 'web', name: 'Tienda web', rate: 0.045, fixed: 100 },
  { id: 'marketplace', name: 'Marketplace', rate: 0.12, fixed: 250 },
];
export const DEFAULT_PROFILE = Object.freeze({
  targetMargin: 35, minMargin: 25, taxRate: 19, energyPerKwh: 210,
  laborPerHour: 4500, supervisionFactor: 0.15, preparationMinutes: 20,
  packingPerUnit: 350, failureRate: 5, priceRounding: 100,
});
const round = v => Math.round(v*100)/100;
function number(raw, name, {min=0, max=1e9, integer=false}={}) {
  if (raw === '' || raw === undefined || raw === null || !Number.isFinite(Number(raw))) throw new Error(`Ingresa un valor válido en ${name}.`);
  const v = Number(raw);
  if (v < min || v > max || (integer && !Number.isSafeInteger(v))) throw new Error(`Revisa el valor de ${name}.`);
  return v;
}
/**
 * @param {object} input UI contract, with N quantity, partsPerUnit, partsPerPlate, batches.
 * @param {object} material Price per kilogram.
 * @param {object} machine Selected persisted printer profile.
 * @param {object} profile UI operational defaults.
 */
export function estimateQuote(input, material, machine, profile=DEFAULT_PROFILE) {
  const n = number(input.quantity,'cantidad',{min:1,max:100000,integer:true});
  const partsPerUnit = number(input.partsPerUnit ?? 1,'piezas por producto',{min:1,max:1000,integer:true});
  const partsPerPlate = number(input.partsPerPlate ?? input.unitsPerPlate,'piezas por placa',{min:1,max:1000,integer:true});
  const batches = number(input.batches ?? 1,'lotes de trabajo',{min:1,max:10000,integer:true});
  const plateWeightGr = input.plateWeightGr !== undefined ? number(input.plateWeightGr,'gramos de la placa') : null;
  const weightGr = plateWeightGr === null ? number(input.weightGr,'peso por producto') : null;
  const extraGrPerPlate = number(input.extraGrPerPlate ?? 0,'desperdicio por placa');
  const plateHours = number(input.plateHours,'horas por placa');
  const finishingMinutesPerUnit = number(input.finishingMinutesPerUnit ?? 0,'minutos de acabado por unidad');
  const assemblyMinutesPerExtraPart = number(input.assemblyMinutesPerExtraPart ?? 0,'minutos de ensamblaje por pieza adicional');
  const setupMinutesPerBatch = number(input.setupMinutesPerBatch ?? profile.preparationMinutes,'preparación por lote');
  const packagingPerUnit = number(input.packagingPerUnit ?? profile.packingPerUnit,'embalaje por unidad');
  const oneOffDesignCost = number(input.oneOffDesignCost ?? 0,'diseño único');
  const targetMargin = number(input.targetMargin ?? profile.targetMargin,'margen objetivo',{max:99.99})/100;
  const failureRate = number(input.failureRate ?? profile.failureRate,'tasa de fallas',{max:99.99})/100;
  const energyPerKwh = number(input.energyPerKwh ?? profile.energyPerKwh,'tarifa eléctrica');
  const laborPerHour = number(input.laborPerHour ?? profile.laborPerHour,'costo por hora de trabajo');
  if (!material || !Number.isFinite(Number(material.priceKg)) || Number(material.priceKg) < 0) throw new Error('Material no válido.');
  const hourly = machineHourlyCosts(machine);
  const channel = CHANNELS.find(c=>c.id===input.channel);
  if (!channel) throw new Error('Selecciona un canal de venta válido.');
  const plates = Math.ceil(n * partsPerUnit / partsPerPlate);
  const hours = plates * plateHours;
  // WHOLE_PLATES: when Bambu Studio supplies full-plate grams, reserve whole plates.
  // Legacy weightGr-per-product remains supported for old drafts and tests.
  const rawMaterial = ((plateWeightGr === null ? n*weightGr : plates*plateWeightGr)+(plates*extraGrPerPlate))/1000*Number(material.priceKg);
  const rawElectricity = hours * Number(machine.averageWatts)/1000*energyPerKwh;
  const rawDepreciation = hours * hourly.depreciationPerHour;
  const rawMaintenance = hours * hourly.maintenancePerHour;
  const rawSupervision = hours * (profile.supervisionFactor ?? 0.15)*laborPerHour;
  // Demonstration policy: retry cost applies to repeatable costs only, not ONE_OFF design,
  // packaging, finishing or batch setup. Production v1 has its own reviewed Strategy.
  const retryBase = rawMaterial+rawElectricity+rawDepreciation+rawMaintenance+rawSupervision;
  const failuresExtra = retryBase*failureRate/(1-failureRate);
  const preparation = batches*setupMinutesPerBatch/60*laborPerHour;
  const finishing = n*finishingMinutesPerUnit/60*laborPerHour;
  const assembly = n*Math.max(0,partsPerUnit-1)*assemblyMinutesPerExtraPart/60*laborPerHour;
  const packaging = n*packagingPerUnit;
  const mainEconomicCost = retryBase+failuresExtra+preparation+finishing+assembly+packaging;
  const denom = 1-targetMargin-channel.rate;
  if (denom <= 0) throw new Error('Margen y comisión incompatibles: no hay precio viable.');
  // Demo simplification: ONE_OFF design is sold as a separate line, but still incurs sales-channel
  // commission. Solve one aggregate target margin exactly, then split after pricing.
  const designNet = oneOffDesignCost>0 ? oneOffDesignCost/(1-targetMargin) : 0;
  const aggregateNetRaw = (mainEconomicCost+oneOffDesignCost+channel.fixed)/denom;
  const step = number(profile.priceRounding ?? 100,'redondeo',{max:100000});
  const net = step ? Math.ceil(aggregateNetRaw/step)*step : round(aggregateNetRaw);
  const designLineNet = round(Math.min(net,designNet));
  const mainLineNet = round(net-designLineNet);
  const commission = round(net*channel.rate+channel.fixed);
  const economicCost = mainEconomicCost+oneOffDesignCost;
  const profit = round(net-economicCost-commission);
  const actualMargin = net>0 ? round(profit/net*100) : null;
  const vat = Math.round(net*number(profile.taxRate,'IVA',{max:100})/100);
  const gross = net+vat;
  // Split VAT preserving whole-document total (not independently rounded commercial unit lines).
  const mainGross = Math.round(mainLineNet*(1+profile.taxRate/100));
  const designGross = gross-mainGross;
  return {
    calculationVersion: DEMO_CALCULATION_VERSION, quantity:n, partsPerUnit, partsPerPlate, batches,
    plates, totalPrintHours:round(hours),
    breakdown: {material:round(rawMaterial),electricity:round(rawElectricity),depreciation:round(rawDepreciation),maintenance:round(rawMaintenance),supervision:round(rawSupervision),failure:round(failuresExtra),preparation:round(preparation),finishing:round(finishing),assembly:round(assembly),packaging:round(packaging),design:round(oneOffDesignCost)},
    economicCost:round(economicCost),commission,profit,net,vat,gross,
    mainGross,designGross,unitGross:Math.round(mainGross/n),
    actualMargin,belowMinimum:actualMargin!==null&&actualMargin<profile.minMargin,
    channelName:channel.name,machineName:machine.name,
    // Historical snapshots remain fixed. UI is replaced by the approved application layer later.
    snapshot:{input:{...input},material:{...material},machine:{...machine},profile:{...profile},channel:{...channel}},
  };
}
