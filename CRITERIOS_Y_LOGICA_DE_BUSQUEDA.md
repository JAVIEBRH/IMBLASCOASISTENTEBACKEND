# Criterios y lógica de búsqueda del sistema

Documento de referencia de todos los criterios, reglas y flujos de búsqueda de productos y procesamiento de consultas en el backend del asistente B2B.

---

## 1. Arquitectura general

- **Orquestador:** OpenAI analiza la intención cuando no hay SKU/ID explícito.
- **Regex primero:** Si el mensaje contiene `sku: X` o `id: N`, se usa directamente sin llamar a la IA.
- **Backend ejecuta:** Según el tipo de consulta (PRODUCTOS, VARIANTE, CARACTERISTICAS, etc.) se aplican distintas búsquedas y reglas.

---

## 2. Detección de SKU e ID (regex, sin IA)

### 2.1 SKU explícito con prefijo

- **Patrón:** `(?:sku|SKU)[:\s]+([^\s]+)`
- **Ejemplos:** "sku: B11-1", "SKU: L88", "sku L02"
- **Lógica:**
  - Se extrae el valor raw (sin normalizar) en `rawExplicitSku` para preservar guiones/puntos (ej. B11-1).
  - Se normaliza con `normalizeCode()` en `providedExplicitSku` para comparaciones.
  - Se fuerza `queryType = 'PRODUCTOS'` y no se llama a OpenAI.

### 2.2 ID explícito con prefijo

- **Patrón:** `(?:id|ID)[:\s]+(\d+)`
- **Ejemplos:** "id: 12345", "ID 67890"
- **Valor:** `providedExplicitId` (string del número).
- **Efecto:** `queryType = 'PRODUCTOS'`, búsqueda posterior por ID.

---

## 3. Normalización de textos y códigos

### 3.1 `normalizeSearchText(text)` (conversation.service.js)

- Minúsculas.
- NFD + quitar diacríticos (tildes).
- Sustituir `-_.,;:()[]{}'"!?¡¿` por espacio.
- Colapsar espacios múltiples y trim.
- **Uso:** comparar nombres, “término en contexto”, filtros por nombre.

### 3.2 `normalizeCode(code)` (conversation.service.js)

- Mayúsculas.
- Eliminar: `?¿!¡.,;:()[]{}'"\s_-`
- **Uso:** SKUs para comparación y búsqueda (N35 = N-35 = N 35).

### 3.3 `normalizeText(text)` (product-matcher.service.js)

- Minúsculas, NFD, sin tildes.
- Solo caracteres `a-z0-9` (quitar espacios y especiales).
- **Uso:** matching determinístico (ej. "Libreta White PU N35" → "libretawhitepun35").

---

## 4. Tipos de consulta (queryType) y origen

| queryType interno   | Origen (OpenAI tipo)   | Descripción breve                          |
|---------------------|------------------------|--------------------------------------------|
| PRODUCTOS           | PRODUCTO o regex SKU/ID| Búsqueda de producto(s) por término/SKU/ID  |
| VARIANTE            | VARIANTE               | Colores, tallas, variaciones               |
| CARACTERISTICAS     | CARACTERISTICAS        | Qué características tiene un producto      |
| INFORMACION_GENERAL | INFORMACION_GENERAL    | Horarios, contacto, empresa                |
| FALLBACK            | FALLBACK               | Futuro, reserva, descuento (respuesta fija)|
| AMBIGUA             | AMBIGUA                | Genérico; puede promoverse a PRODUCTOS     |

---

## 5. Análisis OpenAI (cuando no hay SKU/ID explícito)

- **Función:** `conkavoAI.analizarIntencionConsulta(message, recentHistory, currentProduct)`.
- **Salida:** `tipo`, `terminoProducto`, `sku`, `id`, `atributo`, `valorAtributo`, `tipoFallback`, `necesitaMasInfo`, `razon`.
- **Validaciones en backend:**
  - Si `sku` o `id` no aparecen literalmente en el mensaje, se anulan (evitar arrastrar contexto erróneo).
  - Si OpenAI devuelve SKU/ID y el regex no lo tenía, se rellenan `providedExplicitSku` / `providedExplicitId`.
  - Tipos no válidos → AMBIGUA; FALLBACK sin tipo válido → AMBIGUA; VARIANTE sin atributo → PRODUCTO; PRODUCTO sin término ni SKU ni ID → AMBIGUA.
  - Términos genéricos ("producto", "artículo", etc.) → AMBIGUA.

---

## 6. ¿El usuario pide otro producto? (`userAsksForDifferentProduct`)

Se usa para **no** reutilizar el producto en contexto cuando el usuario claramente pide otro.

- **Entradas:** mensaje, producto en contexto, análisis OpenAI, `providedExplicitSku`, `providedExplicitId`.
- **Reglas:**
  1. Si hay **SKU explícito** y su normalizado ≠ SKU del contexto → **sí** (otro producto), salvo que el contexto no tenga SKU y el **nombre** del contexto contenga el SKU del mensaje (mismo producto).
  2. Si hay **ID explícito** y ≠ ID del contexto → **sí** (otro producto).
  3. Si OpenAI trae **sku** y su normalizado ≠ SKU del contexto → misma lógica que (1).
  4. Si OpenAI trae **id** y ≠ ID del contexto → **sí** (otro producto).
  5. **Término de búsqueda:** se usa `terminoProducto` de OpenAI o `extractProductTerm(message)`. Si el término es vacío o genérico (producto, artículo, etc.) → **no** (se mantiene contexto).
  6. Si el término **no** está en el texto combinado (nombre + SKU normalizados del contexto): ni literal ni todas las palabras del término dentro del contexto → **sí** (otro producto).

**Uso:** En PRODUCTOS, VARIANTE, CARACTERISTICAS y al promover AMBIGUA a VARIANTE/PRODUCTOS; si devuelve true, se ignora el producto en contexto y se hace búsqueda real.

---

## 7. Extracción de término de producto (`extractProductTerm`)

- **Stop words:** hay, stock, del, de, producto, productos, precio, cuánto, tienes, tiene, etc. (lista fija).
- **Patrones genéricos:** p. ej. "necesito saber si tienen producto", "tienen productos" → retorna `''`.
- **Limpieza:** quitar "hola", "hay stock de", "cuánto cuesta el/la", "estoy buscando", "producto llamado", etc.
- **Normalización:** `normalizeSearchText`; luego quitar stop words, palabras de 1 carácter; aplicar `pluralToSingular`; quitar preposiciones al inicio.
- **Uso:** cuando OpenAI no da término o para comparar “término en contexto”.

---

## 8. Detección adicional de SKU en bloque PRODUCTOS (sin prefijo "sku:")

Solo si aún no hay `providedExplicitSku` ni `providedExplicitId`:

### 8.1 Nombre de producto + SKU (lista fija de palabras)

- **Patrón:** `\b(lapicero|libreta|bolígrafo|boligrafo|producto|product|articulo|artículo|cuaderno|marcador|resaltador|llavero|mochila|usb|pendrive|corchetera|capsula|cápsula|taza|vaso|polera|polerón|gorro|cojin|cojín|mouse|teclado|memoria|stick)\s+([A-Za-z]\d+[A-Za-z]?[-]?\d*)\b/gi`
- **Ejemplos:** "lapicero L88", "llavero B85", "mochila K78".
- Se toman todos los matches; se usa el **primero** para `providedExplicitSku`. No se guarda `rawExplicitSku` en este camino (solo con "sku: X").

### 8.2 SKU standalone (mensaje corto, ≤2 palabras)

- **Patrón:** `\b([A-Za-z]\d+[A-Za-z]?[-]?\d*)\b/i` (una letra + números + letra opcional + guión opcional + dígitos).
- Ej.: "L88", "N35".

### 8.3 Solo letras (2–5 caracteres, mensaje corto)

- **Patrón:** `\b([A-Za-z]{2,5})\b/i`.
- Se excluyen palabras comunes (el, la, que, tienes, tienen, hay, tiene).

### 8.4 SKU numérico largo (6+ dígitos)

- **Patrón:** `\b(\d{6,})\b`.
- Sin restricción de longitud del mensaje.

### 8.5 SKU numérico por IA (último recurso)

- **Función:** `conkavoAI.detectarSkuNumerico(message)`.
- Devuelve un número de 6+ dígitos si el mensaje parece contener un SKU numérico; si no, null.

### 8.6 Múltiples SKUs

- Si se detectan varios SKUs (p. ej. nombre+SKU o varios matches), **solo se usa el primero** para la búsqueda.

---

## 9. Prioridad de búsqueda por SKU (bloque PRODUCTOS)

Cuando hay `providedExplicitSku`:

1. **SKU a probar primero:**  
   - Si existe `rawExplicitSku` (solo con prefijo "sku:") y contiene guión/punto/espacio → usar `rawExplicitSku`.  
   - Si no, y el SKU tiene guión/punto → usar `providedExplicitSku` tal cual.  
   - Si no → usar SKU normalizado (`normalizedSku`).
2. **Llamada:** `wordpressService.getProductBySku(skuToTryFirst)`.
3. Si no hay resultado y `skuToTryFirst !== normalizedSku`, llamar `getProductBySku(normalizedSku)`.
4. Si aún no hay resultado: búsqueda por API `searchProductsInWordPress(providedExplicitSku, 30)` y filtrar en memoria por nombre/SKU normalizado que contenga el código normalizado.
5. Si sigue vacío: `getAllProducts()` y filtrar por `normalizeCode(nombre)` o `normalizeCode(sku)` contenga el código normalizado.
6. Un resultado → producto único; varios → lista (productSearchResults); ninguno → mensaje “no encontré producto con el SKU…”.

---

## 10. Búsqueda por ID

- Si hay `providedExplicitId` y no se encontró por SKU: `wordpressService.getProductStock(providedExplicitId)`.

---

## 11. Búsqueda por nombre (sin SKU/ID o tras fallo de SKU/ID)

### 11.1 Limpieza del mensaje

- Quitar frases tipo "cuánto cuesta…", "cuánto stock hay de…", "precio de…", "stock de…", "producto:", "sku: …", "id: …".
- `cleanMessage` con longitud > 3.

### 11.2 Nombre completo (productMatcher)

- **Fuente:** `wordpressService.getAllProducts()`.
- **Función:** `productMatcher.matchProduct(cleanMessage, allProducts, p => p.sku, p => p.name)`.
- **Criterio:** coincidencia **exacta** tras normalizar (normalizeText: minúsculas, sin tildes, solo alfanuméricos). Compara entrada normalizada con SKU normalizado y con nombre normalizado de cada producto.
- **Resultados:** FOUND (un producto), AMBIGUOUS (varios), NOT_FOUND.

### 11.3 Si no hay match por nombre completo: SKU dentro del mensaje

- **Patrones de SKU en texto:**  
  - `\b([A-Za-z]\d+[A-Za-z]?[-.\s]?\d*)\b`  
  - `\b([A-Za-z][-.\s]\d+[A-Za-z]?)\b`  
  - `\b([A-Za-z]\d+[-.\s]\d+)\b`
- Se extrae un `detectedSkuFromName` y se busca con `getProductBySku(detectedSkuFromName)`; si falla, `getAllProducts()` y filtrar por nombre/SKU que contenga el código normalizado.
- Si hay producto pero el término restante (sin SKU) es genérico, se usa solo el producto por SKU; si no, además `productMatcher.matchProduct` sobre el término restante.

### 11.4 Fallback por término

- Término: `context.terminoProductoParaBuscar || extractProductTerm(message)`.
- `searchProductsInWordPress(termToUse, 10)` y/o filtro sobre resultados por nombre/SKU normalizado que contenga el término normalizado.
- Si hay un solo candidato fuerte (nombre muy similar al término), se toma como producto único.

---

## 12. Términos genéricos (no buscar)

- Lista: producto, productos, articulo, artículos, artículo, artículos, item, items, cosa, cosas, objeto, objetos.
- Si el término a buscar es uno de estos, no se ejecuta búsqueda por término (se evitan falsos positivos).
- AMBIGUA con término no genérico puede promoverse a PRODUCTOS; con término genérico no.

---

## 13. Promoción AMBIGUA → VARIANTE / PRODUCTOS

- **Saludos:** si el mensaje es tipo "hola", "buenos días", etc. (patrón corto) → respuesta de saludo, no búsqueda.
- **Variaciones:** si el mensaje contiene palabras como color, colores, talla, variación, etc. y hay producto en contexto:
  - Si `userAsksForDifferentProduct` es true → se intenta extraer término; si es no genérico, `queryType = 'PRODUCTOS'` y se busca; si no, mensaje “necesito nombre o SKU”.
  - Si `userAsksForDifferentProduct` es false → se trata como VARIANTE usando el producto en contexto y se detecta atributo (color, talla, tamaño, acabado).
- **AMBIGUA con término no genérico:** si hay término extraíble y no genérico, se promueve a PRODUCTOS y se busca (sin depender solo de OpenAI).

---

## 14. VARIANTE: obtención del producto

- Si ya hay producto en contexto y **no** `userAsksForDifferentProduct` → usar contexto (y validar que el producto tenga el atributo pedido; si no, limpiar contexto).
- Si no: buscar por `analisisOpenAI.sku` o `analisisOpenAI.terminoProducto` → `getProductBySku`; si falla, `searchProductsInWordPress(termino, 5)` y tomar el primero.
- Si el producto en contexto es variación (tiene `parent_id`), se resuelve el padre para listar variaciones.

---

## 15. CARACTERISTICAS: obtención del producto

- Misma idea que VARIANTE: primero contexto si **no** `userAsksForDifferentProduct`; si no, buscar por SKU o término con `getProductBySku` y luego `searchProductsInWordPress(termino, 5)`.

---

## 16. Servicios de datos (WooCommerce vs stock interno)

### 16.1 WordPress / WooCommerce

- **getProductBySku(sku):** Prueba variaciones del SKU (original, mayúsculas, minúsculas, sin guiones, guiones por espacios, sin espacios). Llama a la API `products?sku=...`. Comparación exacta o sin guiones para elegir el producto.
- **searchProductsInWordPress(searchTerm, limit):** API `products?search=...&per_page=limit`. Búsqueda full-text del lado de WooCommerce.
- **getAllProducts():** Paginación hasta traer todos los productos (costoso en catálogos grandes).
- **getProductById(id):** Producto por ID (para padres de variaciones).

### 16.2 Stock (MongoDB / interno)

- **stockService.searchProducts(term, limit):** Por SKU exacto primero; luego regex sobre `sku` y `name`; ordenar priorizando SKU exacto; limitar resultados.
- **stockService.getAllProducts():** Todos los productos del stock cargado.
- **Uso en rutas:** GET con query `q` y opcional `limit` llama a `stockService.searchProducts(q.trim(), limitNum)`.

---

## 17. Product Matcher (determinístico)

- **matchProduct(userInput, products, getSku, getName):**
  - Normaliza `userInput` con `normalizeText` (solo a-z0-9, sin espacios).
  - Compara con cada producto: `normalizeText(sku) === normalizedInput` o `normalizeText(name) === normalizedInput`.
  - Un match → FOUND; varios → AMBIGUOUS; ninguno → NOT_FOUND.
- Sin fuzzy ni semántica; solo coincidencia exacta tras normalización.

---

## 18. Límites y comportamiento conocido

- **Un solo SKU por mensaje:** Solo el primer SKU detectado se usa para búsqueda.
- **rawExplicitSku:** Solo se guarda cuando el SKU viene con prefijo "sku:" o "SKU"; en otros caminos (OpenAI, nombre+SKU) no hay “raw” para probar primero con guiones.
- **Historial:** Últimos 50 mensajes en sesión; prompts usan slice reciente (p. ej. últimos 4 o 10).
- **FALLBACK / INFORMACION_GENERAL:** No hay promoción automática a PRODUCTOS si el mensaje contiene SKU o término de producto; solo AMBIGUA puede promoverse a PRODUCTOS cuando hay término no genérico.
- **Fallback costoso:** Si `getProductBySku` falla, en algunos flujos se usa `getAllProducts()` y filtro en memoria (latencia alta en catálogos grandes).

---

## 19. Resumen de flujo de búsqueda (PRODUCTOS)

1. Regex SKU/ID explícito → si hay, `queryType = PRODUCTOS`, no IA.
2. Si no, OpenAI → tipo, término, sku, id.
3. Si hay producto en contexto y `userAsksForDifferentProduct` → limpiar contexto.
4. Término genérico → no buscar por término.
5. Detección adicional de SKU (nombre+SKU, standalone, numérico, IA) si falta SKU/ID.
6. Búsqueda por SKU: raw/normalizado → getProductBySku; si falla, searchProductsInWordPress + filtro; si falla, getAllProducts + filtro.
7. Búsqueda por ID si aplica.
8. Búsqueda por nombre: cleanMessage → matchProduct(nombre completo); si no, extraer SKU del mensaje y buscar por SKU + opcionalmente por término restante; fallback por término con searchProductsInWordPress y filtro.

Este documento refleja el estado del código en `conversation.service.js`, `wordpress.service.js`, `stock.service.js`, `product-matcher.service.js`, `conkavo-ai.service.js` y rutas de stock.
