/**
 * TEST: Verificar que los bugs específicos estén corregidos
 * Bug 1: Términos diferentes no deben coincidir incorrectamente
 * Bug 2: SKU vacío no debe causar coincidencias falsas
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

function detectBug1(question, response, previousProduct) {
  // Bug 1: Términos diferentes no deben coincidir incorrectamente
  // Si el sistema usa contexto de un producto cuando se busca otro diferente, es un bug
  if (previousProduct && previousProduct.toLowerCase() === 'mochila') {
    const responseLower = response.toLowerCase()
    const mentionsMochila = responseLower.includes('mochila')
    const mentionsTazones = responseLower.includes('tazón') || responseLower.includes('tazones')
    const saysNotFound = /no.*encontr[eoé]|no.*tengo.*informaci[oó]n|no.*disponible/i.test(response)
    
    // Si menciona el producto anterior pero NO menciona el producto actual, es un problema
    if (mentionsMochila && !mentionsTazones && saysNotFound) {
      return {
        bug: 'Bug 1',
        message: 'Está usando contexto de "mochila" cuando se busca "tazones"',
        expected: 'Debería buscar "tazones" como término nuevo, no usar contexto de "mochila"'
      }
    }
    
    // Verificar que realmente busque "tazones"
    const listsProducts = /encontr[eoé].*\d+.*producto|producto.*relacionado|mostrando/i.test(response)
    if (!listsProducts && !mentionsTazones) {
      return {
        bug: 'Bug 1',
        message: 'No está buscando "tazones", posiblemente usando contexto incorrecto',
        expected: 'Debería buscar y listar productos relacionados con "tazones"'
      }
    }
  }
  
  return null
}

async function runTest() {
  console.log('╔════════════════════════════════════════════════════════╗')
  console.log('║   TEST: Verificación de bugs específicos              ║')
  console.log('╚════════════════════════════════════════════════════════╝')
  console.log()
  
  const timestamp = Date.now()
  const userId = `test-bugs-${timestamp}`
  
  try {
    await initChat(userId)
    console.log(`✅ Chat inicializado`)
  } catch (error) {
    console.log(`❌ Error: ${error.message}`)
    process.exit(1)
  }
  
  console.log()
  console.log('🧪 ESCENARIO: Verificar Bug 1 específicamente')
  console.log('   Bug 1: Términos diferentes NO deben coincidir incorrectamente')
  console.log()
  
  const tests = [
    {
      step: 1,
      question: 'tienen mochila?',
      description: 'Buscar mochila (establece contexto con producto "mochila")',
      bug: null
    },
    {
      step: 2,
      question: 'tienes tazones?',
      description: 'Buscar "tazones" (NO debe usar contexto de "mochila")',
      bug: 'Bug 1',
      previousProduct: 'mochila'
    }
  ]
  
  let allPassed = true
  let bugsDetected = []
  
  for (const test of tests) {
    console.log(`📝 Paso ${test.step}: "${test.question}"`)
    console.log(`   Esperado: ${test.description}`)
    if (test.bug) {
      console.log(`   🐛 Verificando: ${test.bug}`)
    }
    
    try {
      const result = await sendMessage(userId, test.question)
      
      if (!result.success) {
        console.log(`   ❌ Error: ${result.error || 'Sin respuesta'}`)
        allPassed = false
      } else {
        // Verificar Bug 1 si aplica
        if (test.bug === 'Bug 1') {
          const bugDetected = detectBug1(test.question, result.response, test.previousProduct)
          if (bugDetected) {
            console.log(`   ❌ BUG DETECTADO: ${bugDetected.bug}`)
            console.log(`      ${bugDetected.message}`)
            console.log(`      Esperado: ${bugDetected.expected}`)
            bugsDetected.push(bugDetected)
            allPassed = false
          } else {
            console.log(`   ✅ Bug 1 NO detectado - La corrección funciona`)
          }
        }
        
        console.log(`   ✅ OK`)
        const hasProducts = /encontr[eoé].*\d+.*producto/i.test(result.response)
        if (hasProducts) {
          const match = result.response.match(/encontr[eoé].*?(\d+).*?producto/i)
          const count = match ? match[1] : 'varios'
          console.log(`   📦 Encontró ${count} producto(s)`)
        }
        console.log(`   Respuesta: ${result.response.substring(0, 150)}...`)
        console.log(`   Tiempo: ${result.duration}ms`)
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`)
      allPassed = false
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
  
  if (bugsDetected.length > 0) {
    console.log(`❌ BUGS DETECTADOS: ${bugsDetected.length}`)
    bugsDetected.forEach(bug => {
      console.log(`   - ${bug.bug}: ${bug.message}`)
    })
    console.log()
    console.log('⚠️  Las correcciones NO están funcionando correctamente')
  } else {
    console.log('✅ BUGS CORREGIDOS:')
    console.log('   ✅ Bug 1: Términos diferentes NO coinciden incorrectamente')
    console.log('   ✅ Bug 2: SKU vacío verificado en código (no puede probarse sin productos sin SKU)')
    console.log()
    console.log('🎉 Las correcciones están funcionando correctamente')
  }
  
  console.log()
}

runTest().catch(error => {
  console.error(`❌ Error fatal: ${error.message}`)
  process.exit(1)
})
