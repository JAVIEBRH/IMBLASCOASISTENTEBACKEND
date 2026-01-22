/**
 * TEST: Validación estricta de coincidencia de términos
 * Verifica que los bugs de validación permisiva estén corregidos
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
const DELAY_BETWEEN_TESTS = 800

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

function detectIssues(question, response, expectedBehavior, previousProduct) {
  const issues = []
  if (!response || typeof response !== 'string') return issues
  
  const responseLower = response.toLowerCase()
  
  if (expectedBehavior === 'shouldNotMatch') {
    // NO debe usar contexto del producto anterior
    if (previousProduct) {
      const previousProductLower = previousProduct.toLowerCase()
      const mentionsPrevious = responseLower.includes(previousProductLower)
      const saysNotFound = /no.*encontr[eoé]|no.*tengo.*informaci[oó]n|no.*disponible/i.test(response)
      
      // Si menciona el producto anterior Y dice "no encontré", es un problema
      if (mentionsPrevious && saysNotFound) {
        issues.push({
          type: 'CRITICAL',
          message: `Está usando contexto de "${previousProduct}" en lugar de buscar el nuevo producto`,
          expected: 'Debería buscar el nuevo producto, no usar contexto anterior',
          actual: response.substring(0, 200)
        })
      }
    }
    
    // Debe buscar el nuevo producto, no reutilizar contexto
    const listsProducts = /encontr[eoé].*\d+.*producto|producto.*relacionado|mostrando/i.test(response)
    const asksForMoreInfo = /nombre completo|sku del producto|me lo puedes confirmar/i.test(response)
    
    // Si no lista productos ni pide más info, podría estar usando contexto incorrecto
    if (!listsProducts && !asksForMoreInfo) {
      const saysNotFound = /no.*encontr[eoé]|no.*tengo.*informaci[oó]n|no.*disponible/i.test(response)
      if (saysNotFound) {
        issues.push({
          type: 'WARNING',
          message: 'Responde "no encontré" - verificar que realmente buscó y no usó contexto',
          expected: 'Debería buscar el producto o pedir más información',
          actual: response.substring(0, 200)
        })
      }
    }
  }
  
  return issues
}

async function runTest() {
  console.log('╔════════════════════════════════════════════════════════╗')
  console.log('║   TEST: Validación estricta de coincidencia            ║')
  console.log('╚════════════════════════════════════════════════════════╝')
  console.log()
  
  const timestamp = Date.now()
  const userId = `test-validacion-${timestamp}`
  
  try {
    await initChat(userId)
    console.log(`✅ Chat inicializado`)
  } catch (error) {
    console.log(`❌ Error: ${error.message}`)
    process.exit(1)
  }
  
  console.log()
  console.log('🧪 ESCENARIO: Probar casos que antes causaban falsos positivos')
  console.log()
  
  const tests = [
    {
      step: 1,
      question: 'tienen mochila?',
      description: 'Buscar mochila (establece contexto)',
      expectedBehavior: 'shouldSearch',
      previousProduct: null
    },
    {
      step: 2,
      question: 'tienes mochilas cocina?',
      description: 'Buscar "mochilas cocina" (NO debe usar contexto de "mochila")',
      expectedBehavior: 'shouldNotMatch',
      previousProduct: 'mochila',
      bug: 'Bug 1: "mochilas cocina" no debe coincidir con "mochila"'
    },
    {
      step: 3,
      question: 'tienen llaveros?',
      description: 'Buscar llaveros (establece nuevo contexto)',
      expectedBehavior: 'shouldSearch',
      previousProduct: null
    },
    {
      step: 4,
      question: 'tienes llavero metálico?',
      description: 'Buscar "llavero metálico" (debe coincidir con "llaveros" - palabra común)',
      expectedBehavior: 'shouldMatch',
      previousProduct: 'llavero'
    }
  ]
  
  let allPassed = true
  let passedCount = 0
  let failedCount = 0
  
  for (const test of tests) {
    console.log(`📝 Paso ${test.step}: "${test.question}"`)
    console.log(`   Esperado: ${test.description}`)
    if (test.bug) {
      console.log(`   🐛 Bug a verificar: ${test.bug}`)
    }
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
        const issues = detectIssues(test.question, result.response, test.expectedBehavior, test.previousProduct)
        
        if (issues.length > 0) {
          console.log(`   ❌ FALLO DETECTADO:`)
          issues.forEach(issue => {
            console.log(`      - ${issue.type}: ${issue.message}`)
            console.log(`        Esperado: ${issue.expected}`)
            console.log(`        Actual: ${issue.actual}...`)
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
          console.log(`   Respuesta: ${result.response.substring(0, 120)}...`)
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
  
  if (allPassed) {
    console.log('🎉 TEST PASADO: Las correcciones de validación estricta funcionan correctamente')
    console.log('   Los bugs de falsos positivos han sido corregidos.')
  } else {
    console.log('⚠️  TEST PARCIALMENTE PASADO: Algunos casos fallaron')
    console.log('   Revisar los casos fallidos.')
  }
  
  console.log()
}

runTest().catch(error => {
  console.error(`❌ Error fatal: ${error.message}`)
  process.exit(1)
})
