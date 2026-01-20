/**
 * COMPANY INFO SERVICE
 * Información general de la empresa ImBlasco
 * Esta información se pasa al agente Conkavo para responder consultas TIPO A
 */

/**
 * Información general de la empresa
 * Actualizada con información oficial de ImBlasco
 */
export const COMPANY_INFO = {
  nombre: "Importadora Blas y Cía. Ltda. (Imblasco)",
  nombreCorto: "Imblasco",
  experiencia: "Más de 50 años de experiencia en el mercado chileno",
  condicionComercial: "Importador mayorista exclusivo. No se realizan ventas a clientes finales.",
  direccion: "Álvarez de Toledo 981, San Miguel, Santiago",
  comuna: "San Miguel",
  referencia: "A pasos del Metro San Miguel. Estacionamiento para clientes.",
  rubros: [
    "Pesca y caza deportiva",
    "Trofeos y premiación",
    "Artículos publicitarios",
    "Grabado personalizado"
  ],
  horarios: {
    semana: "Lunes a viernes: 9:42 a 14:00 y 15:30 a 19:00 hrs",
    sabado: "Sábados: 10:00 a 13:00 hrs",
    domingo: "Cerrado",
  },
  contacto: {
    email: "ventas@imblasco.cl",
    telefonos: ["225443327", "225443382", "225440418"],
    telefono: "225443327 / 225443382 / 225440418",
  },
  despachos: {
    regiones: {
      envios: "Envíos por transporte por pagar",
      diasFijos: "Martes y jueves",
      condiciones: "La carga viaja a costo y riesgo del cliente",
      noTrabajan: "No se trabaja con Chilexpress, Correos de Chile ni Blue Express"
    },
    santiago: "Retiro en casa matriz"
  },
  empresasTransporte: [
    "JAC", "Económico", "Express", "Chevalier", "Poblete", "Tur Bus", 
    "Pullman del Sur", "Binder", "LIT", "Rapid Cargo", "Espinoza (V Región)", 
    "Mena", "Merco Sur", "Transcargo", "Tromen", "entre otras"
  ],
  comoRealizarPedido: {
    paso1: "Solicitar cuenta para consultar precios y stock",
    paso2: "Enviar datos de la empresa a ventas@imblasco.cl: RUT, razón social, giro, dirección y comuna",
    paso3: "Clientes activos deben enviar cotización con modelos, tamaños y cantidades"
  },
  retiroPedidos: {
    pago: "Pago previo por transferencia bancaria",
    documentos: "Presentar RUT de compra o nota de venta",
    sinFacturar: "Si no está facturado, presentar comprobante de pago"
  },
  garantia: {
    productosNuevos: "6 meses",
    pereciblesUsoBreve: "7 días",
    requisitos: "Requiere comprobante de compra. Producto debe entregarse para revisión técnica"
  },
  derechoRetracto: {
    aplica: "Aplica solo a compras a distancia, dentro de los plazos legales",
    costos: "Costos de envío a cargo del consumidor",
    noAplica: "No aplica a productos a medida, perecibles ni servicios"
  },
  diasApertura: "Lunes a Sábado",
  diasCierre: "Domingo y festivos",
};

/**
 * Obtener información completa de la empresa
 * @returns {Object} Información de la empresa
 */
export function getCompanyInfo() {
  return COMPANY_INFO;
}

/**
 * Formatear información de la empresa para el contexto del agente
 * @returns {string} Información formateada
 */
export function formatCompanyInfoForAgent() {
  const info = COMPANY_INFO;

  return `
INFORMACIÓN GENERAL – IMBLASCO

EMPRESA
${info.nombre}
${info.experiencia}
Condición comercial: ${info.condicionComercial}

RUBROS
${info.rubros.map(r => `- ${r}`).join('\n')}

DIRECCIÓN
${info.direccion}
${info.referencia}

HORARIO DE ATENCIÓN
${info.horarios.semana}
${info.horarios.sabado}

⚠️ IMPORTANTE: NO se atiende durante la hora de almuerzo (entre las 14:00 y 15:30 hrs).
Si alguien pregunta sobre atención durante la hora de almuerzo, debes responder claramente que NO se atiende en ese horario.

DESPACHOS
Regiones:
- ${info.despachos.regiones.envios}
- Días fijos: ${info.despachos.regiones.diasFijos}
- ${info.despachos.regiones.condiciones}
- ${info.despachos.regiones.noTrabajan}

Santiago:
- ${info.despachos.santiago}

EMPRESAS DE TRANSPORTE FRECUENTES
${info.empresasTransporte.join(', ')}

CÓMO REALIZAR UN PEDIDO
- ${info.comoRealizarPedido.paso1}
- ${info.comoRealizarPedido.paso2}
- ${info.comoRealizarPedido.paso3}

RETIRO DE PEDIDOS
- ${info.retiroPedidos.pago}
- ${info.retiroPedidos.documentos}
- ${info.retiroPedidos.sinFacturar}

GARANTÍA LEGAL
- Productos nuevos: ${info.garantia.productosNuevos}
- Perecibles o uso breve: ${info.garantia.pereciblesUsoBreve}
- ${info.garantia.requisitos}

DERECHO A RETRACTO
${info.derechoRetracto.aplica}
${info.derechoRetracto.costos}
${info.derechoRetracto.noAplica}

CONTACTO
Correo: ${info.contacto.email}
Teléfonos: ${info.contacto.telefono}
`.trim();
}

export default {
  COMPANY_INFO,
  getCompanyInfo,
  formatCompanyInfoForAgent,
};
