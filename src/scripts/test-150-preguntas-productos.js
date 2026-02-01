/**
 * Test 150 preguntas – Productos reales, preguntas lógicas
 *
 * - 150 preguntas contra el backend local (POST /api/chat/message).
 * - Cada pregunta está relacionada con un producto concreto del catálogo WordPress.
 * - Preguntas lógicas como las haría un cliente: precio, stock, colores, características, etc.
 * - Salida en tiempo real y reporte en reports/test-150-preguntas-<timestamp>.jsonl
 *
 * Uso:
 *   1. En una terminal: npm run dev  (backend con logs en tiempo real)
 *   2. En otra terminal: node src/scripts/test-150-preguntas-productos.js
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { writeFileSync, appendFileSync, mkdirSync } from 'fs'
import axios from 'axios'
import wordpressService from '../services/wordpress.service.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '../../.env') })

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:3001'
const MESSAGE_URL = `${BASE_URL}/api/chat/message`
const USER_ID = 'test-150-productos'
const REQUEST_TIMEOUT_MS = 60000
const DELAY_MS = 400
const RETRY_DELAY_MS = 2000
const MAX_RETRIES = 2
const REPORTS_DIR = join(__dirname, '../../reports')

let products = []
let skus = []
let productTypes = []
let productNamesByType = {} // tipo -> [{ name, sku }]

function log(msg, color = '') {
  const colors = { green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', red: '\x1b[31m', cyan: '\x1b[36m', magenta: '\x1b[35m', bright: '\x1b[1m', reset: '\x1b[0m' }
  const c = colors[color] || colors.reset
  console.log(`${c}${msg}${colors.reset}`)
}

async function loadProducts() {
  log('\nCargando productos reales de WooCommerce...', 'cyan')
  try {
    products = await wordpressService.getAllProducts()
    if (!products || !products.length) {
      log('No hay productos en WC. Usando datos de respaldo.', 'yellow')
      products = [
        { name: 'Llavero Camion', sku: 'B85' },
        { name: 'Bolígrafo Bamboo', sku: 'L39' },
        { name: 'Mochila', sku: 'K78' }
      ]
    }
    skus = [...new Set(products.map(p => p.sku).filter(Boolean))].slice(0, 120)
    const words = new Set()
    products.forEach(p => {
      const name = (p.name || '').trim()
      if (name.length > 2) {
        const first = name.split(/\s+/)[0].toLowerCase().replace(/[^a-záéíóúñ]/g, '')
        if (first.length >= 3) words.add(first)
      }
    })
    productTypes = [...words].filter(w => !['el', 'la', 'los', 'las', 'con', 'para', 'por', 'del', 'una', 'uno'].includes(w)).slice(0, 30)
    productTypes.forEach(t => {
      productNamesByType[t] = products.filter(p => {
        const n = (p.name || '').toLowerCase()
        return n.includes(t) || n.split(/\s+/)[0].toLowerCase().replace(/[^a-záéíóúñ]/g, '') === t
      }).slice(0, 10)
    })
    log(`   Productos: ${products.length}, SKUs: ${skus.length}, Tipos: ${productTypes.length}`, 'green')
    return true
  } catch (e) {
    log(`Error cargando WC: ${e.message}`, 'red')
    return false
  }
}

function pick(arr, n = 1) {
  const out = []
  const copy = [...arr]
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(Math.random() * copy.length)
    out.push(copy.splice(idx, 1)[0])
  }
  return n === 1 ? out[0] : out
}

async function sendMessage(message) {
  let lastError
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data } = await axios.post(MESSAGE_URL, { userId: USER_ID, message }, { timeout: REQUEST_TIMEOUT_MS })
      return (data && data.botMessage) || (data && data.message) || '[sin texto]'
    } catch (e) {
      lastError = e
      const isRetryable = e.code === 'ECONNRESET' || e.code === 'ETIMEDOUT' || e.code === 'ECONNREFUSED' || e.message === 'Network Error'
      if (isRetryable && attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
        continue
      }
      break
    }
  }
  const msg = (lastError && lastError.response && lastError.response.data && lastError.response.data.message) || (lastError && lastError.message) || 'Error'
  return `[ERROR] ${msg}`
}

function errorHeuristic(response, productRef) {
  if (!response || typeof response !== 'string') return false
  const r = response.toLowerCase()
  const noEncontre = r.includes('no encontr') || r.includes('no encontré') || r.includes('nombre o sku') || r.includes('nombre completo o el sku')
  const tieneRef = productRef && (productRef.sku || productRef.name)
  return !!tieneRef && noEncontre
}

function buildQuestions() {
  const list = []
  const add = (question, category, productRef) => list.push({ question, category, productRef: productRef || {} })

  const sku = (i) => skus[i % skus.length] || skus[0] || 'B85'
  const prod = (i) => products[i % products.length] || products[0]
  const tipo = (i) => productTypes[i % productTypes.length] || productTypes[0] || 'llavero'

  // 1. Precio por SKU (15)
  for (let i = 0; i < 15; i++) {
    const s = sku(i)
    const p = products.find(pr => pr.sku === s) || prod(i)
    add(`cuánto cuesta el ${s}?`, 'PRECIO_SKU', { sku: s, name: p.name })
    add(`precio del ${s}`, 'PRECIO_SKU', { sku: s, name: p.name })
  }
  const precioSku = list.filter(x => x.category === 'PRECIO_SKU').slice(0, 15)
  list.length = 0
  list.push(...precioSku)

  // 2. Stock por SKU (15)
  for (let i = 0; i < 15; i++) {
    const s = sku(i + 10)
    const p = products.find(pr => pr.sku === s) || prod(i)
    add(`hay stock del ${s}?`, 'STOCK_SKU', { sku: s, name: p.name })
    add(`tienen stock de ${s}?`, 'STOCK_SKU', { sku: s, name: p.name })
  }
  const stockSku = list.filter(x => x.category === 'STOCK_SKU').slice(0, 15)
  list.length = 0
  list.push(...precioSku, ...stockSku)

  // 3. SKU explícito "sku: X" (10)
  for (let i = 0; i < 10; i++) {
    const s = sku(i + 5)
    const p = products.find(pr => pr.sku === s) || prod(i)
    add(`sku: ${s}`, 'SKU_EXPLICITO', { sku: s, name: p.name })
  }
  const skuExpl = list.filter(x => x.category === 'SKU_EXPLICITO').slice(-10)
  list.length = 0
  list.push(...precioSku, ...stockSku, ...skuExpl)

  // 4. "Tienen X?" por tipo de producto (15)
  for (let i = 0; i < 15; i++) {
    const t = tipo(i)
    const refs = productNamesByType[t] || []
    const ref = refs[0] || prod(i)
    add(`tienen ${t}?`, 'TIENEN_TIPO', { name: ref.name, sku: ref.sku })
    add(`hay ${t}s?`, 'TIENEN_TIPO', { name: ref.name, sku: ref.sku })
  }
  const tienenTipo = list.filter(x => x.category === 'TIENEN_TIPO').slice(-15)
  list.length = 0
  list.push(...precioSku, ...stockSku, ...skuExpl, ...tienenTipo)

  // 5. Nombre + SKU (10)
  const nombres = ['llavero', 'mochila', 'bolígrafo', 'lapicero', 'libreta', 'taza', 'polera', 'corchetera', 'usb', 'marcador']
  for (let i = 0; i < 10; i++) {
    const nom = nombres[i % nombres.length]
    const s = sku(i)
    const p = products.find(pr => pr.sku === s) || prod(i)
    add(`${nom} ${s}`, 'NOMBRE_SKU', { sku: s, name: p.name })
  }
  const nombreSku = list.filter(x => x.category === 'NOMBRE_SKU').slice(-10)
  list.length = 0
  list.push(...precioSku, ...stockSku, ...skuExpl, ...tienenTipo, ...nombreSku)

  // 6. Colores / variantes por producto (15)
  for (let i = 0; i < 15; i++) {
    const s = sku(i)
    const p = products.find(pr => pr.sku === s) || prod(i)
    add(`qué colores tiene el ${s}?`, 'VARIANTE_COLORES', { sku: s, name: p.name })
    add(`el ${s} en qué tallas viene?`, 'VARIANTE_TALLAS', { sku: s, name: p.name })
  }
  const variantes = list.filter(x => x.category === 'VARIANTE_COLORES' || x.category === 'VARIANTE_TALLAS').slice(-15)
  list.length = 0
  list.push(...precioSku, ...stockSku, ...skuExpl, ...tienenTipo, ...nombreSku, ...variantes)

  // 7. Características por producto (15)
  for (let i = 0; i < 15; i++) {
    const s = sku(i + 3)
    const p = products.find(pr => pr.sku === s) || prod(i)
    add(`qué tiene el ${s}?`, 'CARACTERISTICAS', { sku: s, name: p.name })
    add(`características del ${s}`, 'CARACTERISTICAS', { sku: s, name: p.name })
  }
  const caract = list.filter(x => x.category === 'CARACTERISTICAS').slice(-15)
  list.length = 0
  list.push(...precioSku, ...stockSku, ...skuExpl, ...tienenTipo, ...nombreSku, ...variantes, ...caract)

  // 8. Precio por tipo ("precio de mochilas") (10)
  for (let i = 0; i < 10; i++) {
    const t = tipo(i)
    const refs = productNamesByType[t] || []
    const ref = refs[0] || prod(i)
    add(`precio de ${t}s?`, 'PRECIO_TIPO', { name: ref.name, sku: ref.sku })
  }
  const precioTipo = list.filter(x => x.category === 'PRECIO_TIPO').slice(-10)
  list.length = 0
  list.push(...precioSku, ...stockSku, ...skuExpl, ...tienenTipo, ...nombreSku, ...variantes, ...caract, ...precioTipo)

  // 9. Contexto: primero preguntar por un producto, luego seguimiento (15 pares = 30 mensajes, pero usamos 15 preguntas de seguimiento con producto ref)
  for (let i = 0; i < 15; i++) {
    const s = sku(i)
    const p = products.find(pr => pr.sku === s) || prod(i)
    add(`cuánto cuesta el ${s}?`, 'CONTEXTO_PRECIO', { sku: s, name: p.name })
  }
  const ctxPrecio = list.filter(x => x.category === 'CONTEXTO_PRECIO').slice(-15)
  list.length = 0
  list.push(...precioSku, ...stockSku, ...skuExpl, ...tienenTipo, ...nombreSku, ...variantes, ...caract, ...precioTipo, ...ctxPrecio)

  // 10. Ambigua con término que existe en catálogo (15)
  for (let i = 0; i < 15; i++) {
    const t = tipo(i + 7)
    const refs = productNamesByType[t] || []
    const ref = refs[0] || prod(i)
    add(`tienen ${t}?`, 'AMBIGUA_TERMINO', { name: ref.name, sku: ref.sku })
  }
  const ambigua = list.filter(x => x.category === 'AMBIGUA_TERMINO').slice(-15)
  list.length = 0
  list.push(...precioSku, ...stockSku, ...skuExpl, ...tienenTipo, ...nombreSku, ...variantes, ...caract, ...precioTipo, ...ctxPrecio, ...ambigua)

  // 11. Disponibilidad / "tienen el X?" por SKU (15) -> total 150
  for (let i = 0; i < 15; i++) {
    const s = sku(i + 20)
    const p = products.find(pr => pr.sku === s) || prod(i)
    add(`tienen el ${s}?`, 'DISPO_SKU', { sku: s, name: p.name })
    add(`está disponible el ${s}?`, 'DISPO_SKU', { sku: s, name: p.name })
  }
  const dispoSku = list.filter(x => x.category === 'DISPO_SKU').slice(-15)
  list.length = 0
  list.push(...precioSku, ...stockSku, ...skuExpl, ...tienenTipo, ...nombreSku, ...variantes, ...caract, ...precioTipo, ...ctxPrecio, ...ambigua, ...dispoSku)

  return list.slice(0, 150)
}

async function run() {
  console.log('\n' + '='.repeat(60))
  log('  TEST 150 PREGUNTAS – PRODUCTOS REALES (backend local)', 'bright')
  log('  Cada pregunta está ligada a un producto del catálogo. Revisa logs CANDIDATO_SINONIMO.', 'cyan')
  console.log('='.repeat(60))

  const ok = await loadProducts()
  if (!ok) {
    log('Continuando con datos limitados...', 'yellow')
  }

  const questions = buildQuestions()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const reportPath = join(REPORTS_DIR, `test-150-preguntas-${timestamp}.jsonl`)

  try {
    mkdirSync(REPORTS_DIR, { recursive: true })
  } catch (_) {}

  log(`\nTotal preguntas: ${questions.length}`, 'green')
  log(`Reporte: ${reportPath}`, 'blue')
  log('\nEnviando... (delay ' + DELAY_MS + ' ms entre cada una)\n', 'yellow')

  let okCount = 0
  let errCount = 0
  let heuristicErrors = 0

  for (let i = 0; i < questions.length; i++) {
    const { question, category, productRef } = questions[i]
    const num = i + 1
    process.stdout.write(`[${num}/${questions.length}] ${category} | "${question.slice(0, 45)}${question.length > 45 ? '…' : ''}" → `)
    try {
      const response = await sendMessage(question)
      const preview = (response || '').slice(0, 100).replace(/\n/g, ' ')
      console.log(preview + (response && response.length > 100 ? '…' : ''))
      if (response.startsWith('[ERROR]')) errCount++; else okCount++

      const errH = errorHeuristic(response, productRef)
      if (errH) heuristicErrors++

      const line = JSON.stringify({
        num,
        category,
        question,
        productRef,
        response: (response || '').slice(0, 500),
        errorHeuristic: errH
      }) + '\n'
      appendFileSync(reportPath, line, 'utf8')
    } catch (e) {
      console.log('[ERROR] ' + (e.message || e))
      errCount++
      appendFileSync(reportPath, JSON.stringify({
        num,
        category,
        question,
        productRef,
        response: '[ERROR] ' + (e.message || e),
        errorHeuristic: false
      }) + '\n', 'utf8')
    }
    if (num < questions.length) await new Promise(r => setTimeout(r, DELAY_MS))
  }

  log('\n' + '='.repeat(60), 'green')
  log(`  FIN: ${okCount} OK, ${errCount} errores de red`, errCount ? 'yellow' : 'green')
  log(`  Posibles errores (heurística): ${heuristicErrors}`, heuristicErrors ? 'yellow' : 'green')
  log('  Revisa la otra terminal para los logs del backend (CANDIDATO_SINONIMO).', 'cyan')
  log(`  Reporte guardado: ${reportPath}`, 'blue')
  console.log('='.repeat(60) + '\n')
}

run().catch(e => {
  console.error(e)
  process.exit(1)
})
