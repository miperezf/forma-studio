import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateQuote,DEFAULT_PROFILE,DEMO_CALCULATION_VERSION} from '../../src/domain/legacy/quote-estimate.js';
import {machineHourlyCosts, validatePrinterProfile,DEMO_PRINTERS} from '../../src/domain/printer-profiles.js';
import {makeCustomerQuote, customerQuoteText} from '../../src/domain/legacy/customer-quote.js';
const material={id:'MAT-TEST',name:'PLA',priceKg:20000};
const machine={...DEMO_PRINTERS[0],purchasePrice:500000,residualValue:50000,lifeHours:5000,averageWatts:100,maintenanceBudget:50000,maintenanceHours:5000};
const input={project:'Macetero',quantity:6,partsPerUnit:1,partsPerPlate:3,weightGr:100,plateHours:12,targetMargin:35,channel:'direct'};
test('seis productos x una pieza, tres piezas/placa = dos placas y 24 h',()=>{
 const q=estimateQuote(input,material,machine);
 assert.equal(q.plates,2);assert.equal(q.totalPrintHours,24);
});
test('productos con múltiples piezas siguen ceil(N*P/Pplaca)',()=>{
 const q=estimateQuote({...input,quantity:7,partsPerUnit:2,partsPerPlate:5},material,machine);
 assert.equal(q.plates,3);assert.equal(q.totalPrintHours,36);
});
test('lotes multiplican preparación, no placas',()=>{
 const one=estimateQuote({...input,batches:1},material,machine);
 const three=estimateQuote({...input,batches:3},material,machine);
 assert.equal(one.plates,three.plates);
 assert.equal(three.breakdown.preparation-one.breakdown.preparation,3000);
});
test('perfil: depreciación y mantenimiento se calculan por separado',()=>{
 const x=machineHourlyCosts(machine);
 assert.equal(x.depreciationPerHour,90);
 assert.equal(x.maintenancePerHour,10);
 assert.equal(x.machineCostPerHour,100);
 const q=estimateQuote(input,material,machine);
 assert.equal(q.breakdown.depreciation,2160);
 assert.equal(q.breakdown.maintenance,240);
});
test('vida útil cero y residual mayor a adquisición generan error',()=>{
 assert.throws(()=>validatePrinterProfile({...machine,lifeHours:0}),/mayores a cero/);
 assert.throws(()=>validatePrinterProfile({...machine,residualValue:999999}),/residual/);
});
test('no se aceptan consumos negativos ni horas no finitas',()=>{
 assert.throws(()=>estimateQuote(input,material,{...machine,averageWatts:-1}),/inválido/);
 assert.throws(()=>estimateQuote({...input,plateHours:'NaN'},material,machine),/horas/);
});
test('IVA separado de utilidad y neto',()=>{
 const q=estimateQuote(input,material,machine);
 assert.equal(q.gross,q.net+q.vat);
 assert.equal(q.profit,Math.round((q.net-q.economicCost-q.commission)*100)/100);
 assert.equal(q.calculationVersion,DEMO_CALCULATION_VERSION);
});
test('comisiones encarecen precio manteniendo margen demo',()=>{
 const direct=estimateQuote(input,material,machine);
 const mp=estimateQuote({...input,channel:'marketplace'},material,machine);
 assert.ok(mp.net>direct.net);assert.ok(mp.commission>direct.commission);
 assert.ok(mp.actualMargin>=DEFAULT_PROFILE.targetMargin-0.01);
});
test('ONE_OFF se cuenta una vez, sin multiplicarlo por unidades',()=>{
 const single=estimateQuote({...input,quantity:1,oneOffDesignCost:9000},material,machine);
 const bulk=estimateQuote({...input,quantity:10,oneOffDesignCost:9000},material,machine);
 assert.equal(single.breakdown.design,9000);
 assert.equal(bulk.breakdown.design,9000);
 assert.ok(single.designGross>0);assert.ok(bulk.designGross>0);
 assert.equal(bulk.mainGross+bulk.designGross,bulk.gross);
});
test('costos de falla excluyen embalaje y diseño único',()=>{
 const basic=estimateQuote(input,material,machine);
 const add=estimateQuote({...input,oneOffDesignCost:30000,packagingPerUnit:9000},material,machine);
 assert.equal(basic.breakdown.failure,add.breakdown.failure);
});
test('rechaza entradas inválidas y pricing inviable',()=>{
 assert.throws(()=>estimateQuote({...input,quantity:0},material,machine),/cantidad/);
 assert.throws(()=>estimateQuote({...input,targetMargin:89,channel:'marketplace'},material,machine),/incompatibles/);
 assert.throws(()=>estimateQuote(input,{...material,priceKg:-1},machine),/Material no válido/);
});
test('CustomerQuote whitelist nunca filtra costos ni comisiones',()=>{
 const q=estimateQuote(input,material,machine);
 const internal={...q,id:'COT-1',project:'Macetero',createdAt:'2026-10-20',status:'Borrador',unitGross:q.unitGross,economicCost:987654321,margin:35,commission:1000,secret:'NUNCA MOSTRAR',validDays:7,terms:'Entrega sujeto a confirmación',lines:[{description:'Macetero',quantity:6,total:q.gross}]};
 const dto=makeCustomerQuote(internal,'Cliente de prueba');
 assert.deepEqual(Object.keys(dto).sort(),['id','clientName','project','quantity','unitGross','gross','createdAt','status','validDays','lines','terms'].sort());
 const txt=customerQuoteText(dto);
 assert.ok(txt.includes('Cliente de prueba'));
 for(const forbidden of ['NUNCA MOSTRAR','987654321','Margen','comisión','utilidad','costo operativo']) assert.ok(!txt.includes(forbidden),forbidden);
});
test('resina no se hace pasar por FDM con otro costo',()=>{
 assert.throws(()=>estimateQuote(input,material,{...machine,technology:'RESIN'}),/resina|FDM/i);
});
