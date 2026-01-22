/**
 * TEST: 5 minutos - Prioridad a correcciones recientes
 * 
 * Enfocado en:
 * 1. Validación estricta de términos (terminoCoincideConNombre, terminoCoincideConSku)
 * 2. Cambio de contexto entre productos diferentes
 * 3. Uso de SOLO productos REALES del catálogo
 * 
 * ⚠️ REGLA: Usa SOLO productos REALES del catálogo
 * Ver PRODUCTOS_REALES.md para lista completa
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
const DELAY_BETWEEN_TESTS = 2000 // 2 segundos para test rápido
const TEST_DURATION_MS = 5 * 60 * 1000 // 5 minutos

// Productos REALES verificados
const productosReales = {
  base: ['tazas', 'tazones', 'mochilas', 'llaveros', 'gorros'],
  variantes: {
    'tazas': ['para café', 'encobrizadas'],
    'tazones': ['enlozados', 'cerámicos'],
    'mochilas': ['de viaje', 'porta notebook'],
    'llaveros': ['acrílicos', 'metálicos', 'plástico'],
    'gorros': ['de lana']
  },
  nombresCompletos: [
    'Set de 2 tazas para café encobrizadas M69',
    'Mochila de Viaje E70',
    'Tazón Enlozado M181 Sublimación',
    'Llavero Acrílico Sublimable Rectangular',
    'Llavero Metálico Linterna K74'
  ],
  skus: ['601063368', '601052111', '601063166', '591074146', '591074145']
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

async function sendMessage(userId, message) {
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
    return {
      success: false,
      response: error.response?.data?.error || error.message,
      duration: 0,
      error: error.message,
      status: error.response?.status || 0
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

function detectContextIssue(response, previousProduct, currentProduct) {
  if (!previousProduct || !currentProduct || previousProduct === currentProduct) return null
  
  const responseLower = response.toLowerCase()
  const prevLower = previousProduct.toLowerCase()
  const currLower = currentProduct.toLowerCase()
  
  const mentionsPrevious = responseLower.includes(prevLower)
  const mentionsCurrent = responseLower.includes(currLower)
  const saysNotFound = /no.*encontr[eoé]|no.*tengo.*informaci[oó]n|no.*disponible/i.test(response)
  
  // Si menciona producto anterior pero NO el actual, y dice "no encontré", es un bug
  if (mentionsPrevious && !mentionsCurrent && saysNotFound) {
    return {
      type: 'CRITICAL',
      message: `Usa contexto de "${previousProduct}" cuando se busca "${currentProduct}"`,
      expected: `Debería buscar "${currentProduct}" como término nuevo`
    }
  }
  
  return null
}

async function runTest() {
  console.log('╔════════════════════════════════════════════════════════╗')
  console.log('║   TEST: 5 Minutos - Correcciones Prioritarias         ║')
  console.log('╚════════════════════════════════════════════════════════╝')
  console.log()
  
  const timestamp = Date.now()
  const userId = `test-5min-${timestamp}`
  
  try {
    await initChat(userId)
    console.log(`✅ Chat inicializado`)
  } catch (error) {
    console.log(`❌ Error: ${error.message}`)
    process.exit(1)
  }
  
  console.log()
  console.log('🎯 ENFOQUE: Correcciones recientes')
  console.log('   1. Validación estricta de términos')
  console.log('   2. Cambio de contexto correcto')
  console.log('   3. Solo productos REALES')
  console.log()
  
  const stats = {
    total: 0,
    success: 0,
    failed: 0,
    totalDuration: 0,
    byCategory: {},
    contextIssues: [],
    responses: {
      hasProducts: 0,
      asksForInfo: 0,
      saysNotFound: 0,
      hasPrice: 0,
      hasStock: 0
    }
  }
  
  const startTime = Date.now()
  const endTime = startTime + TEST_DURATION_MS
  let previousProduct = null
  let questionCount = 0
  
  console.log('🚀 Iniciando test (5 minutos)...')
  console.log()
  
  // Generar preguntas dinámicamente
  const tiposPreguntas = [
    // 1. Búsquedas generales (productos base)
    () => {
      const producto = productosReales.base[Math.floor(Math.random() * productosReales.base.length)]
      const formas = ['tienen', 'tienes', 'hay']
      return `${formas[Math.floor(Math.random() * formas.length)]} ${producto}?`
    },
    
    // 2. Búsquedas con variantes (productos reales)
    () => {
      const producto = productosReales.base[Math.floor(Math.random() * productosReales.base.length)]
      const variantes = productosReales.variantes[producto] || []
      if (variantes.length > 0) {
        const variante = variantes[Math.floor(Math.random() * variantes.length)]
        return `tienen ${producto} ${variante}?`
      }
      return `tienen ${producto}?`
    },
    
    // 3. Consultas de stock
    () => {
      const producto = productosReales.base[Math.floor(Math.random() * productosReales.base.length)]
      const preguntas = ['cuánto stock', 'hay stock', 'disponibilidad']
      return `${preguntas[Math.floor(Math.random() * preguntas.length)]} de ${producto}?`
    },
    
    // 4. Consultas de precio
    () => {
      const producto = productosReales.base[Math.floor(Math.random() * productosReales.base.length)]
      const preguntas = ['cuánto cuesta', 'qué precio', 'precio']
      return `${preguntas[Math.floor(Math.random() * preguntas.length)]} de ${producto}?`
    },
    
    // 5. Búsquedas por SKU
    () => {
      const sku = productosReales.skus[Math.floor(Math.random() * productosReales.skus.length)]
      return `tienen el producto ${sku}?`
    },
    
    // 6. Búsquedas por nombre completo
    () => {
      const nombre = productosReales.nombresCompletos[Math.floor(Math.random() * productosReales.nombresCompletos.length)]
      return `tienen ${nombre}?`
    }
  ]
  
  while (Date.now() < endTime) {
    questionCount++
    stats.total++
    
    // Seleccionar tipo de pregunta
    const tipoPregunta = tiposPreguntas[Math.floor(Math.random() * tiposPreguntas.length)]
    const question = tipoPregunta()
    
    // Detectar producto actual
    let currentProduct = null
    for (const prod of productosReales.base) {
      if (question.toLowerCase().includes(prod.toLowerCase())) {
        currentProduct = prod
        break
      }
    }
    
    // Mostrar progreso cada 10 preguntas
    if (questionCount % 10 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
      const remaining = ((endTime - Date.now()) / 1000).toFixed(0)
      const avgTime = stats.totalDuration / stats.success || 0
      console.log(`📊 Progreso: ${questionCount} preguntas | Tiempo: ${elapsed}s | Restante: ${remaining}s | Promedio: ${avgTime.toFixed(0)}ms`)
    }
    
    try {
      const result = await sendMessage(userId, question)
      
      if (result.success) {
        stats.success++
        stats.totalDuration += result.duration
        
        const analysis = analyzeResponse(result.response, question, 'general')
        
        // Verificar problemas de contexto
        if (previousProduct && currentProduct && previousProduct !== currentProduct) {
          const contextIssue = detectContextIssue(result.response, previousProduct, currentProduct)
          if (contextIssue) {
            stats.contextIssues.push({
              question,
              previousProduct,
              currentProduct,
              ...contextIssue
            })
          }
        }
        
        // Actualizar estadísticas de respuestas
        if (analysis.hasProducts) stats.responses.hasProducts++
        if (analysis.asksForInfo) stats.responses.asksForInfo++
        if (analysis.saysNotFound) stats.responses.saysNotFound++
        if (analysis.hasPrice) stats.responses.hasPrice++
        if (analysis.hasStock) stats.responses.hasStock++
        
        // Actualizar producto anterior
        if (currentProduct) {
          previousProduct = currentProduct
        }
      } else {
        stats.failed++
      }
    } catch (error) {
      stats.failed++
    }
    
    // Delay entre preguntas
    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_TESTS))
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
  
  if (stats.contextIssues.length > 0) {
    console.log(`⚠️  PROBLEMAS DE CONTEXTO DETECTADOS: ${stats.contextIssues.length}`)
    stats.contextIssues.forEach((issue, idx) => {
      console.log(`   ${idx + 1}. ${issue.type}: ${issue.message}`)
      console.log(`      Pregunta: "${issue.question}"`)
      console.log(`      Esperado: ${issue.expected}`)
    })
    console.log()
  } else {
    console.log(`✅ PROBLEMAS DE CONTEXTO: 0 detectados`)
    console.log(`   El cambio de contexto funciona correctamente`)
    console.log()
  }
  
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
