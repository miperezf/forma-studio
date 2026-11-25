/** Explicit commercial whitelist: never spread internal quote or snapshot into this DTO. */
export function makeCustomerQuote(quote, clientName) {
  const lines = Array.isArray(quote.lines) ? quote.lines.map(l => Object.freeze({
    description:String(l.description),quantity:Number(l.quantity),total:Number(l.total),
  })) : Object.freeze([]);
  return Object.freeze({
    id: String(quote.id), clientName:String(clientName), project:String(quote.project),
    quantity:Number(quote.quantity), unitGross:Number(quote.unitGross),gross:Number(quote.gross),
    createdAt:String(quote.createdAt), status:String(quote.status),
    validDays:Number(quote.validDays ?? 7),
    lines:Object.freeze(lines),
    terms:String(quote.terms || 'Plazos de entrega y forma de pago sujetos a confirmación.'),
  });
}
export const customerMoney = n => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n);
export function customerQuoteText(dto) {
  const d = [
    'FORMA STUDIO · COTIZACIÓN',
    `N°: ${dto.id}`, `Cliente: ${dto.clientName}`, `Proyecto: ${dto.project}`,
    `Cantidad: ${dto.quantity} unidad(es)`,
  ];
  if (dto.lines?.length) dto.lines.forEach(l=>d.push(`${l.description} (${l.quantity}): ${customerMoney(l.total)}`));
  else d.push(`Precio unitario aprox.: ${customerMoney(dto.unitGross)}`);
  d.push(`TOTAL: ${customerMoney(dto.gross)} (IVA incl.)`,
    `Validez: ${dto.validDays ?? 7} días desde ${dto.createdAt}`,dto.terms||'',
    '', 'Gracias por tu interés. Sujeto a confirmación antes de iniciar producción.');
  return d.join('\n');
}
