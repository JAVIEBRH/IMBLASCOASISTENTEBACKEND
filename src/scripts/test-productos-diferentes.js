/**
 * TEST: Verificar cambio de contexto con productos diferentes
 * Prueba con productos REALES que NO sean mochila ni llavero
 * Verifica que el sistema busque correctamente y no reutilice contexto incorrecto
 * 
 * ⚠️ REGLA: Usa SOLO productos REALES del catálogo (tazas, llaveros, mochilas, tazones)
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
const DELAY_BETWEEN_TESTS = 1000

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
      duration
    }
  } catch (error) {
    return {
      success: false,
      response: error.response?.data?.error || error.message,
      duration: 0,
      error: error.message
    }
  }
}

function detectContextIssues(question, response, previousProduct, currentProduct) {
  const issues = []
  if (!response || typeof response !== 'string') return issues
  
  const responseLower = response.toLowerCase()
  const currentProductLower = currentProduct ? currentProduct.toLowerCase() : ''
  const previousProductLower = previousProduct ? previousProduct.toLowerCase() : ''
  
  // Verificar que NO use contexto del producto anterior cuando se busca uno nuevo
  if (previousProduct && currentProduct && previousProductLower !== currentProductLower) {
    // Si menciona el producto anterior pero NO menciona el producto actual, es un problema
    const mentionsPrevious = responseLower.includes(previousProductLower)
    const mentionsCurrent = responseLower.includes(currentProductLower)
    const saysNotFound = /no.*encontr[eoé]|no.*tengo.*informaci[oó]n|no.*disponible/i.test(response)
    
    if (mentionsPrevious && !mentionsCurrent && saysNotFound) {
      issues.push({
        type: 'CRITICAL',
        message: `Está usando contexto de "${previousProduct}" cuando se busca "${currentProduct}"`,
        expected: `Debería buscar "${currentProduct}" como término nuevo, no usar contexto de "${previousProduct}"`
      })
    }
  }
  
  // Verificar que realmente busque el producto actual
  if (currentProduct) {
    const listsProducts = /encontr[eoé].*\d+.*producto|producto.*relacionado|mostrando/i.test(response)
    const asksForMoreInfo = /nombre completo|sku del producto|me lo puedes confirmar/i.test(response)
    const mentionsCurrent = responseLower.includes(currentProductLower)
    
    // Si no lista productos, no pide más info, y no menciona el producto actual, podría ser un problema
    if (!listsProducts && !asksForMoreInfo && !mentionsCurrent) {
      const saysNotFound = /no.*encontr[eoé]|no.*tengo.*informaci[oó]n|no.*disponible/i.test(response)
      if (saysNotFound) {
        issues.push({
          type: 'WARNING',
          message: `No está buscando "${currentProduct}" correctamente`,
          expected: `Debería buscar y listar productos relacionados con "${currentProduct}" o pedir más información`
        })
      }
    }
  }
  
  return issues
}

async function runTest() {
  console.log('╔════════════════════════════════════════════════════════╗')
  console.log('║   TEST: Cambio de contexto con productos diferentes   ║')
  console.log('╚════════════════════════════════════════════════════════╝')
  console.log()
  
  const timestamp = Date.now()
  const userId = `test-productos-${timestamp}`
  
  try {
    await initChat(userId)
    console.log(`✅ Chat inicializado`)
  } catch (error) {
    console.log(`❌ Error: ${error.message}`)
    process.exit(1)
  }
  
  console.log()
  console.log('🧪 ESCENARIO: Probar con productos diferentes (NO mochila, NO llavero)')
  console.log('   Verificar que el cambio de contexto funcione correctamente')
  console.log()
  
  // Productos REALES del catálogo (verificado en logs)
  const tests = [
    {
      step: 1,
      question: 'tienen tazas?',
      description: 'Buscar tazas (establece contexto)',
      product: 'taza',
      previousProduct: null
    },
    {
      step: 2,
      question: 'tienes llaveros?',
      description: 'Buscar llaveros (NO debe usar contexto de tazas)',
      product: 'llavero',
      previousProduct: 'taza'
    },
    {
      step: 3,
      question: 'tienen mochilas?',
      description: 'Buscar mochilas (NO debe usar contexto de llaveros)',
      product: 'mochila',
      previousProduct: 'llavero'
    },
    {
      step: 4,
      question: 'tienes tazones?',
      description: 'Buscar tazones (NO debe usar contexto de mochilas)',
      product: 'tazón',
      previousProduct: 'mochila'
    },
    {
      step: 5,
      question: 'tienen tazas para café?',
      description: 'Buscar "tazas para café" (debe coincidir con "tazas" - palabra común)',
      product: 'taza',
      previousProduct: 'tazón'
    }
  ]
  
  let allPassed = true
  let passedCount = 0
  let failedCount = 0
  let issuesDetected = []
  
  for (const test of tests) {
    console.log(`📝 Paso ${test.step}: "${test.question}"`)
    console.log(`   Producto buscado: ${test.product}`)
    console.log(`   Esperado: ${test.description}`)
    if (test.previousProduct) {
      console.log(`   ⚠️  Contexto anterior: ${test.previousProduct}`)
    }
    
    try {
      const result = await sendMessage(userId, test.question)
      
      if (!result.success) {
        console.log(`   ❌ Error: ${result.error || 'Sin respuesta'}`)
        allPassed = false
        failedCount++
      } else {
        const issues = detectContextIssues(test.question, result.response, test.previousProduct, test.product)
        
        if (issues.length > 0) {
          console.log(`   ❌ PROBLEMAS DETECTADOS:`)
          issues.forEach(issue => {
            console.log(`      - ${issue.type}: ${issue.message}`)
            console.log(`        Esperado: ${issue.expected}`)
            issuesDetected.push(issue)
          })
          allPassed = false
          failedCount++
        } else {
          console.log(`   ✅ OK`)
          const hasProducts = /encontr[eoé].*\d+.*producto/i.test(result.response)
          if (hasProducts) {
            const match = result.response.match(/encontr[eoé].*?(\d+).*?producto/i)
            const count = match ? match[1] : 'varios'
            console.log(`   📦 Encontró ${count} producto(s)`)
          }
          const asksForInfo = /nombre completo|sku del producto|me lo puedes confirmar/i.test(result.response)
          if (asksForInfo) {
            console.log(`   💬 Pide más información (producto no encontrado o ambiguo)`)
          }
          console.log(`   Respuesta: ${result.response.substring(0, 150)}...`)
          passedCount++
        }
        
        console.log(`   Tiempo: ${result.duration}ms`)
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`)
      allPassed = false
      failedCount++
    }
    
    console.log()
    
    if (test.step < tests.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_TESTS))
    }
  }
  
  console.log('╔════════════════════════════════════════════════════════╗')
  console.log('║                    RESULTADO                             ║')
  console.log('╚════════════════════════════════════════════════════════╝')
  console.log()
  console.log(`📊 Estadísticas:`)
  console.log(`   Total de tests: ${tests.length}`)
  console.log(`   ✅ Pasados: ${passedCount}`)
  console.log(`   ❌ Fallidos: ${failedCount}`)
  console.log(`   Porcentaje de éxito: ${((passedCount / tests.length) * 100).toFixed(1)}%`)
  console.log()
  
  if (issuesDetected.length > 0) {
    console.log(`⚠️  PROBLEMAS DETECTADOS: ${issuesDetected.length}`)
    issuesDetected.forEach(issue => {
      console.log(`   - ${issue.type}: ${issue.message}`)
    })
    console.log()
  }
  
  if (allPassed) {
    console.log('🎉 TEST PASADO: El cambio de contexto funciona correctamente')
    console.log('   Los productos diferentes se buscan correctamente sin reutilizar contexto incorrecto')
  } else {
    console.log('⚠️  TEST PARCIALMENTE PASADO: Algunos casos fallaron')
    console.log('   Revisar los casos fallidos para identificar problemas de contexto')
  }
  
  console.log()
}

runTest().catch(error => {
  console.error(`❌ Error fatal: ${error.message}`)
  process.exit(1)
})
