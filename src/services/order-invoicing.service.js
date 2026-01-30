/**
 * Stub: order-invoicing (sin lógica ERP/facturación)
 * Mantiene la interfaz para que order.service y order.routes no rompan.
 */

export async function enrichOrderWithInvoicingData(order) {
  return order
}

export function validateStatusTransition(fromStatus, toStatus) {
  return true
}

export async function sendOrderToErp(orderId) {
  return { ok: false, message: 'ERP/facturación no configurado' }
}

export async function markOrderAsInvoiced(orderId, erpReference) {
  return null
}
