/**
 * TEST: 100 consultas variadas simulando cliente real
 * Prueba exhaustiva del sistema con diferentes tipos de consultas
 * 
 * ⚠️ REGLA CRÍTICA: Este test usa SOLO productos REALES del catálogo WooCommerce
 * para evitar correcciones incorrectas basadas en productos inexistentes.
 * 
 * Productos REALES verificados:
 * - Tazas: tazas, tazas para café, tazas encobrizadas
 * - Tazones: tazones, tazones enlozados, tazones cerámicos
 * - Mochilas: mochilas, mochilas de viaje, mochilas porta notebook, mochilas morral
 * - Llaveros: llaveros, llaveros acrílicos, llaveros metálicos, llaveros plástico
 * - Gorros: gorros, gorros de lana
 * 
 * Ver PRODUCTOS_REALES.md para lista completa de productos verificados.
 * 
 * ❌ NO usar: poleras, poleras polo, gorros bordados, tazones porcelana, etc.
 */
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import axios from 'axios'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const envPath = join(__dirname, '../../.env')
dotenv.config({ path: envPath })

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:3001'
const INIT_URL = `${BASE_URL}/api/chat/init`
const MESSAGE_URL = `${BASE_URL}/api/chat/message`
const REQUEST_TIMEOUT_MS = 60000
const DELAY_BETWEEN_TESTS = 5000 // 5 segundos entre consultas para evitar saturación
const MAX_RETRIES = 3 // Reintentos en caso de error
const RETRY_DELAY = 10000 // 10 segundos entre reintentos
const TOTAL_QUESTIONS = 100 // Reducido a 100 preguntas

// Generar 250 preguntas variadas
function generateQuestions() {
  const questions = []
  
  // Categorías de productos REALES del catálogo (verificado en logs)
  const productos = [
    'tazas', 'tazones', 'mochilas', 'llaveros', 'gorros',
    'tazas para café', 'tazones enlozados', 'mochilas de viaje',
    'llaveros acrílicos', 'llaveros metálicos', 'gorros de lana',
    'tazas encobrizadas', 'tazones sublimables', 'mochilas porta notebook',
    'llaveros plástico', 'llaveros sublimables', 'gorros',
    'tazas', 'tazones cerámicos', 'mochilas morral',
    'llaveros', 'tazones', 'mochilas'
  ]
  
  // Preguntas de búsqueda general
  const busquedasGenerales = [
    'tienen', 'tienes', 'hay', 'disponible', 'tienen stock',
    'qué tienen', 'muéstrame', 'busco', 'necesito', 'quiero ver'
  ]
  
  // Preguntas sobre stock
  const preguntasStock = [
    'cuánto stock', 'hay stock', 'tienen disponible', 'cuántas unidades',
    'disponibilidad', 'stock disponible', 'cuántos hay', 'hay en stock'
  ]
  
  // Preguntas sobre precios
  const preguntasPrecio = [
    'cuánto cuesta', 'qué precio', 'cuál es el precio', 'precio',
    'costo', 'valor', 'cuánto vale', 'precio unitario'
  ]
  
  // Preguntas sobre variaciones
  const preguntasVariaciones = [
    'qué colores', 'qué tallas', 'qué tamaños', 'qué modelos',
    'qué variantes', 'qué opciones', 'disponible en', 'tienen en'
  ]
  
  // Preguntas de seguimiento
  const seguimiento = [
    'y el precio', 'y el stock', 'cuánto cuesta', 'hay disponible',
    'qué más tienen', 'otro', 'siguiente', 'más información',
    'dame más detalles', 'cuéntame más', 'y qué más'
  ]
  
  // Preguntas sobre información general
  const infoGeneral = [
    'hola', 'buenos días', 'buenas tardes', 'ayuda',
    'qué pueden hacer', 'qué productos tienen', 'catálogo',
    'información', 'servicios', 'qué ofrecen'
  ]
  
  let questionId = 0
  
  // 1-20: Búsquedas generales de productos
  for (let i = 0; i < 20; i++) {
    const producto = productos[Math.floor(Math.random() * productos.length)]
    const busqueda = busquedasGenerales[Math.floor(Math.random() * busquedasGenerales.length)]
    questions.push({
      id: ++questionId,
      question: `${busqueda} ${producto}?`,
      category: 'busqueda_general'
    })
  }
  
  // 21-40: Búsquedas específicas con contexto (solo variantes REALES)
  const productosContexto = ['tazas', 'mochilas', 'llaveros', 'tazones', 'gorros']
  const variantesReales = {
    'tazas': ['para café', 'encobrizadas', 'cerámica'],
    'mochilas': ['de viaje', 'porta notebook', 'morral'],
    'llaveros': ['acrílicos', 'metálicos', 'plástico', 'sublimables'],
    'tazones': ['enlozados', 'sublimables', 'cerámicos'],
    'gorros': ['de lana']
  }
  for (let i = 0; i < 20; i++) {
    const producto = productosContexto[Math.floor(Math.random() * productosContexto.length)]
    const variantes = variantesReales[producto] || []
    if (variantes.length > 0) {
      const variante = variantes[Math.floor(Math.random() * variantes.length)]
      questions.push({
        id: ++questionId,
        question: `tienen ${producto} ${variante}?`,
        category: 'busqueda_especifica'
      })
    } else {
      questions.push({
        id: ++questionId,
        question: `tienen ${producto}?`,
        category: 'busqueda_especifica'
      })
    }
  }
  
  // 41-60: Preguntas sobre stock
  for (let i = 0; i < 20; i++) {
    const producto = productos[Math.floor(Math.random() * productos.length)]
    const preguntaStock = preguntasStock[Math.floor(Math.random() * preguntasStock.length)]
    questions.push({
      id: ++questionId,
      question: `${preguntaStock} de ${producto}?`,
      category: 'consulta_stock'
    })
  }
  
  // 61-80: Preguntas sobre precios
  for (let i = 0; i < 20; i++) {
    const producto = productos[Math.floor(Math.random() * productos.length)]
    const preguntaPrecio = preguntasPrecio[Math.floor(Math.random() * preguntasPrecio.length)]
    questions.push({
      id: ++questionId,
      question: `${preguntaPrecio} de ${producto}?`,
      category: 'consulta_precio'
    })
  }
  
  // 81-100: Preguntas sobre variaciones
  for (let i = 0; i < 20; i++) {
    const producto = productosContexto[Math.floor(Math.random() * productosContexto.length)]
    const preguntaVariacion = preguntasVariaciones[Math.floor(Math.random() * preguntasVariaciones.length)]
    questions.push({
      id: ++questionId,
      question: `${preguntaVariacion} tienen de ${producto}?`,
      category: 'consulta_variaciones'
    })
  }
  
  // 101-120: Cambios de contexto (productos diferentes - solo REALES)
  const productosCambio = [
    ['tazas', 'mochilas'], ['llaveros', 'tazones'], ['tazones', 'gorros'],
    ['mochilas', 'tazas'], ['tazones', 'llaveros'], ['gorros', 'tazones'],
    ['tazas', 'llaveros'], ['mochilas', 'tazones'], ['tazones', 'tazas']
  ]
  for (let i = 0; i < 20; i++) {
    const par = productosCambio[i % productosCambio.length]
    if (i % 2 === 0) {
      questions.push({
        id: ++questionId,
        question: `tienen ${par[0]}?`,
        category: 'cambio_contexto'
      })
    } else {
      questions.push({
        id: ++questionId,
        question: `tienen ${par[1]}?`,
        category: 'cambio_contexto'
      })
    }
  }
  
  // 121-140: Preguntas de seguimiento
  for (let i = 0; i < 20; i++) {
    const seguimientoPreg = seguimiento[Math.floor(Math.random() * seguimiento.length)]
    questions.push({
      id: ++questionId,
      question: seguimientoPreg,
      category: 'seguimiento'
    })
  }
  
  // 141-160: Búsquedas con SKU (simulados)
  const skus = ['601063368', '601052111', '601063166', '591074146', '591074145']
  for (let i = 0; i < 20; i++) {
    const sku = skus[Math.floor(Math.random() * skus.length)]
    questions.push({
      id: ++questionId,
      question: `tienen el producto ${sku}?`,
      category: 'busqueda_sku'
    })
  }
  
  // 161-180: Preguntas ambiguas
  const ambiguas = [
    'tienen productos?', 'qué tienen?', 'muéstrame algo',
    'qué ofrecen?', 'tienen algo?', 'qué hay disponible?',
    'tienen cosas?', 'muéstrame productos', 'qué tienen en stock?'
  ]
  for (let i = 0; i < 20; i++) {
    questions.push({
      id: ++questionId,
      question: ambiguas[Math.floor(Math.random() * ambiguas.length)],
      category: 'pregunta_ambigua'
    })
  }
  
  // 181-200: Información general
  for (let i = 0; i < 20; i++) {
    const info = infoGeneral[Math.floor(Math.random() * infoGeneral.length)]
    questions.push({
      id: ++questionId,
      question: info,
      category: 'info_general'
    })
  }
  
  // 201-220: Búsquedas con nombres completos
  const nombresCompletos = [
    'Set de 2 tazas para café encobrizadas M69',
    'Mochila de Viaje E70',
    'Tazón Enlozado M181 Sublimación',
    'Llavero Acrílico Sublimable Rectangular',
    'Llavero Acrílico Sublimable Redondo'
  ]
  for (let i = 0; i < 20; i++) {
    const nombre = nombresCompletos[Math.floor(Math.random() * nombresCompletos.length)]
    questions.push({
      id: ++questionId,
      question: `tienen ${nombre}?`,
      category: 'busqueda_nombre_completo'
    })
  }
  
  // 221-230: Preguntas combinadas (stock + precio)
  for (let i = 0; i < 10; i++) {
    const producto = productos[Math.floor(Math.random() * productos.length)]
    questions.push({
      id: ++questionId,
      question: `cuánto cuesta ${producto} y cuánto stock tienen?`,
      category: 'consulta_combinada'
    })
  }
  
  // 231-240: Preguntas sobre características
  const caracteristicas = [
    'qué material', 'de qué están hechos', 'qué capacidad',
    'qué dimensiones', 'qué características', 'qué incluye'
  ]
  for (let i = 0; i < 10; i++) {
    const producto = productos[Math.floor(Math.random() * productos.length)]
    const caracteristica = caracteristicas[Math.floor(Math.random() * caracteristicas.length)]
    questions.push({
      id: ++questionId,
      question: `${caracteristica} tienen los ${producto}?`,
      category: 'consulta_caracteristicas'
    })
  }
  
  // 241-250: Preguntas aleatorias variadas
  const todasLasPreguntas = [
    ...busquedasGenerales.map(b => productos.map(p => `${b} ${p}?`)).flat(),
    ...preguntasStock.map(s => productos.map(p => `${s} de ${p}?`)).flat(),
    ...preguntasPrecio.map(pr => productos.map(p => `${pr} de ${p}?`)).flat(),
    ...seguimiento,
    ...infoGeneral
  ]
  for (let i = 0; i < 10; i++) {
    questions.push({
      id: ++questionId,
      question: todasLasPreguntas[Math.floor(Math.random() * todasLasPreguntas.length)],
      category: 'aleatoria'
    })
  }
  
  return questions
}

async function initChat(userId) {
  try {
    const response = await axios.post(INIT_URL, { userId }, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' }
    })
    return response.data ? userId : null
  } catch (error) {
    throw new Error(`Error inicializando chat: ${error.message}`)
  }
}

async function sendMessage(userId, message, retryCount = 0) {
  try {
    const startTime = Date.now()
    const response = await axios.post(MESSAGE_URL, { userId, message }, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' }
    })
    const duration = Date.now() - startTime
    
    const responseText = response.data?.response || response.data?.botMessage || response.data?.message || ''
    
    return {
      success: !!responseText,
      response: responseText,
      duration,
      status: response.status
    }
  } catch (error) {
    // Si es un error 508, 500, 503 o timeout, reintentar
    const status = error.response?.status || 0
    const isRetryable = status === 508 || status === 500 || status === 503 || 
                       error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' ||
                       error.message.includes('timeout')
    
    if (isRetryable && retryCount < MAX_RETRIES) {
      const retryDelay = RETRY_DELAY * (retryCount + 1) // Delay exponencial
      console.log(`   ⚠️  Error ${status || error.code}, reintentando en ${retryDelay/1000}s (${retryCount + 1}/${MAX_RETRIES})...`)
      await new Promise(resolve => setTimeout(resolve, retryDelay))
      return sendMessage(userId, message, retryCount + 1)
    }
    
    return {
      success: false,
      response: error.response?.data?.error || error.message,
      duration: 0,
      error: error.message,
      status: status
    }
  }
}

function analyzeResponse(response, question, category) {
  const analysis = {
    hasResponse: !!response && response.length > 0,
    hasProducts: /encontr[eoé].*\d+.*producto|producto.*relacionado|mostrando/i.test(response),
    asksForInfo: /nombre completo|sku del producto|me lo puedes confirmar/i.test(response),
    saysNotFound: /no.*encontr[eoé]|no.*tengo.*informaci[oó]n|no.*disponible/i.test(response),
    hasPrice: /\$\d+|\d+.*peso|precio.*\d+/i.test(response),
    hasStock: /stock.*\d+|disponible.*\d+|\d+.*unidad/i.test(response),
    category
  }
  return analysis
}

async function runTest() {
  console.log('╔════════════════════════════════════════════════════════╗')
  console.log('║   TEST: 100 Consultas Variadas - Cliente Real          ║')
  console.log('╚════════════════════════════════════════════════════════╝')
  console.log()
  
  const timestamp = Date.now()
  const userId = `test-250-${timestamp}`
  
  try {
    await initChat(userId)
    console.log(`✅ Chat inicializado`)
  } catch (error) {
    console.log(`❌ Error: ${error.message}`)
    process.exit(1)
  }
  
  console.log()
  console.log(`📝 Generando ${TOTAL_QUESTIONS} preguntas variadas...`)
  const questions = generateQuestions().slice(0, TOTAL_QUESTIONS) // Limitar a 100
  console.log(`✅ ${questions.length} preguntas generadas`)
  console.log(`⏱️  Delay entre consultas: ${DELAY_BETWEEN_TESTS}ms`)
  console.log(`🔄 Reintentos máximos: ${MAX_RETRIES}`)
  console.log(`⏳ Tiempo estimado: ~${Math.ceil((questions.length * DELAY_BETWEEN_TESTS) / 60000)} minutos`)
  console.log()
  
  const stats = {
    total: 0,
    success: 0,
    failed: 0,
    totalDuration: 0,
    byCategory: {},
    responses: {
      hasProducts: 0,
      asksForInfo: 0,
      saysNotFound: 0,
      hasPrice: 0,
      hasStock: 0
    }
  }
  
  const startTime = Date.now()
  let lastProgressUpdate = Date.now()
  
  console.log('🚀 Iniciando test...')
  console.log()
  
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i]
    stats.total++
    
    // Mostrar progreso cada 25 preguntas
    if (i % 25 === 0 || i === questions.length - 1) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      const progress = ((i / questions.length) * 100).toFixed(1)
      const avgTime = stats.totalDuration / stats.total || 0
      console.log(`📊 Progreso: ${i}/${questions.length} (${progress}%) | Tiempo: ${elapsed}s | Promedio: ${avgTime.toFixed(0)}ms/pregunta`)
    }
    
    try {
      const result = await sendMessage(userId, question.question)
      
      if (result.success) {
        stats.success++
        stats.totalDuration += result.duration
        
        const analysis = analyzeResponse(result.response, question.question, question.category)
        
        // Actualizar estadísticas por categoría
        if (!stats.byCategory[question.category]) {
          stats.byCategory[question.category] = {
            total: 0,
            success: 0,
            failed: 0,
            totalDuration: 0
          }
        }
        stats.byCategory[question.category].total++
        stats.byCategory[question.category].success++
        stats.byCategory[question.category].totalDuration += result.duration
        
        // Actualizar estadísticas de respuestas
        if (analysis.hasProducts) stats.responses.hasProducts++
        if (analysis.asksForInfo) stats.responses.asksForInfo++
        if (analysis.saysNotFound) stats.responses.saysNotFound++
        if (analysis.hasPrice) stats.responses.hasPrice++
        if (analysis.hasStock) stats.responses.hasStock++
      } else {
        stats.failed++
        if (!stats.byCategory[question.category]) {
          stats.byCategory[question.category] = {
            total: 0,
            success: 0,
            failed: 0,
            totalDuration: 0
          }
        }
        stats.byCategory[question.category].total++
        stats.byCategory[question.category].failed++
      }
    } catch (error) {
      stats.failed++
      console.error(`❌ Error en pregunta ${question.id}: ${error.message}`)
    }
    
    // Delay entre preguntas (aumentado si hubo errores para no saturar)
    let delay = DELAY_BETWEEN_TESTS
    if (typeof result !== 'undefined' && !result.success) {
      // Si hay error del servidor, esperar más tiempo
      const status = result.status || 0
      if (status === 508 || status === 500 || status === 503) {
        delay = DELAY_BETWEEN_TESTS * 3 // 15 segundos si hay error del servidor
        console.log(`   ⏸️  Esperando ${delay/1000}s adicionales debido a error del servidor...`)
      } else {
        delay = DELAY_BETWEEN_TESTS * 2 // 10 segundos para otros errores
      }
    }
    if (i < questions.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
  const avgDuration = (stats.totalDuration / stats.success || 0).toFixed(0)
  
  console.log()
  console.log('╔════════════════════════════════════════════════════════╗')
  console.log('║                    RESULTADO FINAL                      ║')
  console.log('╚════════════════════════════════════════════════════════╝')
  console.log()
  console.log(`📊 ESTADÍSTICAS GENERALES:`)
  console.log(`   Total de consultas: ${stats.total}`)
  console.log(`   ✅ Exitosas: ${stats.success}`)
  console.log(`   ❌ Fallidas: ${stats.failed}`)
  console.log(`   Porcentaje de éxito: ${((stats.success / stats.total) * 100).toFixed(1)}%`)
  console.log(`   Tiempo total: ${totalTime}s`)
  console.log(`   Tiempo promedio por consulta: ${avgDuration}ms`)
  console.log()
  
  console.log(`📋 TIPOS DE RESPUESTAS:`)
  console.log(`   📦 Con productos listados: ${stats.responses.hasProducts}`)
  console.log(`   💬 Pide más información: ${stats.responses.asksForInfo}`)
  console.log(`   ❌ No encontrado: ${stats.responses.saysNotFound}`)
  console.log(`   💰 Menciona precio: ${stats.responses.hasPrice}`)
  console.log(`   📊 Menciona stock: ${stats.responses.hasStock}`)
  console.log()
  
  console.log(`📂 ESTADÍSTICAS POR CATEGORÍA:`)
  Object.keys(stats.byCategory).sort().forEach(category => {
    const cat = stats.byCategory[category]
    const successRate = ((cat.success / cat.total) * 100).toFixed(1)
    const avgTime = (cat.totalDuration / cat.success || 0).toFixed(0)
    console.log(`   ${category}:`)
    console.log(`      Total: ${cat.total} | Éxito: ${cat.success} (${successRate}%) | Promedio: ${avgTime}ms`)
  })
  console.log()
  
  if (stats.success === stats.total) {
    console.log('🎉 TEST COMPLETADO: 100% de éxito')
  } else if (stats.success / stats.total >= 0.95) {
    console.log('✅ TEST COMPLETADO: Excelente rendimiento (>95%)')
  } else if (stats.success / stats.total >= 0.90) {
    console.log('⚠️  TEST COMPLETADO: Buen rendimiento (>90%)')
  } else {
    console.log('⚠️  TEST COMPLETADO: Rendimiento mejorable (<90%)')
  }
  
  console.log()
}

runTest().catch(error => {
  console.error(`❌ Error fatal: ${error.message}`)
  process.exit(1)
})
