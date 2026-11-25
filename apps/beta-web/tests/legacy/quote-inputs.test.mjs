import test from 'node:test';
import assert from 'node:assert/strict';
import { assembleQuoteInputs, normalizedShopSettings, DEFAULT_SHOP_SETTINGS } from '../../src/domain/quote-inputs.js';
import { estimateQuote } from '../../src/domain/legacy/quote-estimate.js';
import { DEMO_PRINTERS } from '../../src/domain/printer-profiles.js';

const core={quantity:8,partsPerPlate:4,plateWeightGr:340,plateHours:5.5,channel:'direct',project:'Macetero',materialId:'MAT-001',machineId:'MAC-001'};
const material={id:'MAT-001',priceKg:22000};
test('un cotizador, ajustes del taller sin pedir entradas adicionales',()=>{
 const profile=normalizedShopSettings({laborPerHour:9800,targetMargin:40,packingPerUnit:700});
 const input=assembleQuoteInputs(core,[],profile);
 assert.equal(input.targetMargin,40);
 assert.equal(input.packagingPerUnit,700);
 assert.equal(input.partsPerUnit,1);
 assert.equal(input.validDays,7);
 const q=estimateQuote(input,material,DEMO_PRINTERS[0],profile);
 assert.equal(q.plates,2);
 assert.equal(q.breakdown.material,14960); // 2 placas × 340g × $22.000/kg
 assert.equal(q.breakdown.packaging,5600);
});
test('opciones desactivadas no influyen aunque se conserven en el borrador',()=>{
 const raw={...core,oneOffDesignCost:30000,finishingMinutesPerUnit:20,partsPerUnit:3,batches:7,packagingPerUnit:5000,targetMargin:85};
 const input=assembleQuoteInputs(raw,[]);
 assert.equal(input.oneOffDesignCost,0);
 assert.equal(input.finishingMinutesPerUnit,0);
 assert.equal(input.partsPerUnit,1);
 assert.equal(input.batches,1);
 assert.equal(input.targetMargin,DEFAULT_SHOP_SETTINGS.targetMargin);
 assert.equal(input.packagingPerUnit,DEFAULT_SHOP_SETTINGS.packingPerUnit);
});
test('diseño único y planificación especial se aplican solo si se activan',()=>{
 const raw={...core,oneOffDesignCost:30000,partsPerUnit:2,batches:3,extraGrPerPlate:5};
 const input=assembleQuoteInputs(raw,['design','planning']);
 const quote=estimateQuote(input,material,DEMO_PRINTERS[0]);
 assert.equal(quote.breakdown.design,30000);
 assert.equal(quote.batches,3);
 assert.equal(quote.plates,4);
 assert.equal(quote.breakdown.material,30360);
});
test('ensamblaje se cuenta por piezas adicionales y nunca por la primera',()=>{
 const one=estimateQuote(assembleQuoteInputs({...core,assemblyMinutesPerExtraPart:8},['assembly']),material,DEMO_PRINTERS[0]);
 assert.equal(one.breakdown.assembly,0);
 const two=estimateQuote(assembleQuoteInputs({...core,partsPerUnit:3,assemblyMinutesPerExtraPart:8},['assembly','planning']),material,DEMO_PRINTERS[0]);
 assert.equal(two.breakdown.assembly,8*2*8/60*DEFAULT_SHOP_SETTINGS.laborPerHour);
});
test('venta particular no altera margen ni vigencia predeterminados del taller',()=>{
 const special=assembleQuoteInputs({...core,targetMargin:'47',validDays:'11',terms:'Entrega en tienda'},['sales']);
 assert.equal(special.targetMargin,'47');assert.equal(special.validDays,'11');
 const next=assembleQuoteInputs({...core,targetMargin:'47',validDays:'11',terms:'Entrega en tienda'},[]);
 assert.equal(next.targetMargin,35);assert.equal(next.validDays,7);
});
test('gramos de placa y peso por producto son entradas alternativas, no se suman',()=>{
 const plate=estimateQuote({...core,weightGr:9999},material,DEMO_PRINTERS[0]);
 assert.equal(plate.breakdown.material,14960);
 assert.throws(()=>estimateQuote({...core,plateWeightGr:-1},material,DEMO_PRINTERS[0]),/gramos de la placa/);
});
