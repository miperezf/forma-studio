/** UI-side demo profiles. Machine rates are USER-EDITABLE ESTIMATES, not official specs. */
export const DEMO_PRINTERS = Object.freeze([
  { id: 'MAC-001', name: 'Bambu Lab A1', technology: 'FDM', purchasePrice: 420000, residualValue: 40000, lifeHours: 5000, averageWatts: 95, maintenanceBudget: 60000, maintenanceHours: 5000, revision: 1, isExample: true },
]);
export const MACHINE_CATALOG = ['Bambu Lab A1','Bambu Lab A1 Mini','Bambu Lab P1S','Bambu Lab P1P','Bambu Lab X1 Carbon','Prusa MK4','Creality Ender 3','Otra impresora FDM'];
const finite = n => Number.isFinite(Number(n)) && String(n).trim() !== '';
export function validatePrinterProfile(machine) {
  if (!machine || !String(machine.name||'').trim()) throw new Error('Asigna un nombre a la impresora.');
  if (machine.technology !== 'FDM') throw new Error('Esta beta solo calcula trabajos FDM. Resina requiere un perfil de costos distinto.');
  for (const key of ['purchasePrice','residualValue','lifeHours','averageWatts','maintenanceBudget','maintenanceHours']) {
    if (!finite(machine[key]) || Number(machine[key]) < 0) throw new Error(`Parámetro de impresora inválido: ${key}.`);
  }
  if (Number(machine.lifeHours) <= 0 || Number(machine.maintenanceHours) <= 0) throw new Error('Las horas de vida útil y mantenimiento deben ser mayores a cero.');
  if (Number(machine.residualValue) > Number(machine.purchasePrice)) throw new Error('El valor residual no puede exceder el precio de adquisición.');
  return true;
}
export function machineHourlyCosts(machine) {
  validatePrinterProfile(machine);
  const depreciationPerHour = (Number(machine.purchasePrice) - Number(machine.residualValue)) / Number(machine.lifeHours);
  const maintenancePerHour = Number(machine.maintenanceBudget) / Number(machine.maintenanceHours);
  return { depreciationPerHour, maintenancePerHour, machineCostPerHour: depreciationPerHour + maintenancePerHour };
}
