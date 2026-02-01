# Análisis de debilidades – Lógica de búsqueda del asistente

**Objetivo:** Identificar posibles inconsistencias y puntos débiles en el flujo de búsqueda y uso de contexto, en el sentido de *"es posible que ocurra X porque no tenemos Y"*, sin cambiar el esquema ni la arquitectura.

---

## Estado de lo ya corregido

| # | Debilidad original | Estado |
|---|--------------------|--------|
| 1 | AMBIGUA con término → no se buscaba | ✅ Corregido: AMBIGUA con término no genérico se promueve a PRODUCTOS |
| 2 | VARIANTE/CARACTERISTICAS sin comprobar “otro producto” | ✅ Corregido: se llama `userAsksForDifferentProduct` antes de usar contexto |
| 3 | AMBIGUA→VARIANTE con otro producto en el mensaje | ✅ Corregido: se comprueba “otro producto” antes de reutilizar contexto |
| 4 | Lista fija “nombre + SKU” (llavero, mochila, etc.) | ✅ Corregido: ampliada con llavero, mochila, usb, taza, etc. |
| 5 | Dependencia total del tipo OpenAI | ✅ Mitigado: corrección AMBIGUA→PRODUCTOS cuando hay término |
| 6 | session.currentProduct no se limpiaba | ✅ Mitigado: VARIANTE/CARACTERISTICAS comprueban “otro producto” |
| 7 | Término en contexto (abreviaturas/sinónimos) | ⚠️ Sin cambiar: comparación literal |
| - | Falso positivo “usuario pide otro” (contexto sin SKU) | ✅ Corregido: si nombre contiene SKU del mensaje → mismo producto |
| - | SKU con guión (B11-1) se normalizaba a B111 | ✅ Corregido: `rawExplicitSku` y búsqueda primero con raw |

---

## Debilidades restantes o nuevas (mismo estilo de análisis)

### 1. SKU con guión solo se preserva cuando viene de "sku: X"

**Es posible que ocurra:** Si el usuario escribe *"tienen B11-1?"* **sin** el prefijo "sku:" o "SKU", el SKU se detecta dentro del bloque PRODUCTOS (standalone o por OpenAI). En ese camino **no** se guarda `rawExplicitSku` (solo se guarda cuando hay `explicitSkuMatch`). Si en algún punto se normaliza a "B111" antes de llamar a `getProductBySku`, la búsqueda por "B111" puede fallar.

**Por qué:** `rawExplicitSku` solo se asigna cuando hay match del regex `(?:sku|SKU)[:\s]+([^\s]+)`. Cuando el SKU viene de OpenAI o del regex standalone dentro de PRODUCTOS, no existe un “raw” explícito para probar primero.

**Consecuencia:** *"tienen B11-1?"* puede resolverse bien si OpenAI devuelve "B11-1" y se busca tal cual; si en algún flujo se normaliza antes, podría fallar y depender del fallback por nombre/SKU.

**Posible mejora:** En el bloque PRODUCTOS, cuando se asigna `providedExplicitSku` desde `detectedSkus` o desde OpenAI, guardar también una versión “raw” (sin `normalizeCode`) y, si el SKU contiene guión/punto, probar primero `getProductBySku(raw)` antes que el normalizado.

---

### 2. Múltiples SKUs en el mensaje: solo se usa el primero

**Es posible que ocurra:** Si el usuario escribe *"tienen L71 y N35?"* o *"precio del L71 y del N35"*, solo se considera un SKU (el primero detectado). No hay lógica de “varios productos en una pregunta”.

**Por qué:** Tanto el regex explícito como la detección en PRODUCTOS (standalone, nombre+SKU, etc.) fijan un solo `providedExplicitSku`; no hay lista de SKUs ni búsquedas múltiples.

**Consecuencia:** Se responde solo por un producto; el otro se ignora. No es necesariamente un bug si el diseño es “una pregunta = un producto”, pero puede sorprender al usuario.

**Posible mejora:** Documentar el comportamiento o, si se quiere soportar varios productos, recolectar todos los SKUs detectados y hacer N búsquedas (o una búsqueda por términos combinados), con el impacto en UX y rendimiento que corresponda.

---

### 3. Historial de sesión limitado a 50 mensajes

**Es posible que ocurra:** En conversaciones muy largas (más de 50 intercambios), el historial que se envía a OpenAI y el que se usa para “contexto reciente” se recorta a los últimos 50. Mensajes antiguos donde se mencionó un producto ya no están en ese slice, aunque la sesión siga teniendo `session.currentProduct`.

**Por qué:** `addToHistory` hace `session.history = session.history.slice(-50)`. Los prompts usan `session.history?.slice(-10)` o `slice(-4)` para contexto reciente.

**Consecuencia:** La IA no “ve” mensajes muy atrás; el contexto de producto depende de `session.currentProduct`, no del historial. Si en algún flujo se usara solo el historial para inferir el producto, podría perderse contexto en hilos muy largos.

**Posible mejora:** Dejar como está si el diseño es “producto actual en sesión”; si se quisiera reforzar con historial, considerar ventana deslizante mayor o resumen de contexto (más coste de implementación y de tokens).

---

### 4. “Término en contexto” sin sinónimos ni abreviaturas

**Es posible que ocurra:** El usuario tiene en contexto “Bolígrafo Bamboo L39” y escribe *"y el boli?"* o *"y el bamboo?"*. En `userAsksForDifferentProduct`, el término extraído puede ser “boli” o “bamboo”. Si “boli” no está literalmente en el nombre normalizado del producto, se considera “producto distinto” y se fuerza búsqueda.

**Por qué:** La coincidencia es `combiContexto.includes(termNorm)` o que todas las palabras del término estén en `combiContexto`. No hay mapa boli→bolígrafo, bamboo→bamboo (este sí coincidiría), etc.

**Consecuencia:** Posible falso “otro producto” y búsqueda innecesaria o respuesta que pide “nombre o SKU” cuando el usuario se refería al producto en contexto con otra palabra.

**Posible mejora:** Mantener la lógica actual y, si se quiere afinar, añadir una lista corta de sinónimos/abreviaturas solo para la comparación “término en contexto” (sin tocar el resto del flujo).

---

### 5. Contexto “mismo producto” por nombre cuando el padre no tiene SKU

**Es posible que ocurra:** El producto en contexto es un **padre variable** sin `sku` (o con otro formato). Comprobamos “mismo producto” si el **nombre** del contexto contiene el SKU del mensaje (ej. nombre "Bolígrafo plástico opaco L72" y usuario "sku L72"). Si en el catálogo hay **otro** producto cuyo nombre también contiene "L72" (ej. "Otro producto L72"), no estamos comparando IDs ni SKU real; solo nombre. En la práctica, el contexto ya está fijado por `session.currentProduct`, así que no hay ambigüedad entre dos productos en ese turno, pero la regla es “nombre contiene SKU” y no “producto en contexto es exactamente este”.

**Por qué:** La condición es `contextNameNorm.includes(providedNorm)` cuando `contextSku` está vacío. No se verifica que el producto en contexto sea el que realmente tiene ese SKU en WooCommerce.

**Consecuencia:** En escenarios raros (dos productos con el mismo código en el nombre, uno en contexto), podría no limpiarse contexto cuando sí se debería. Impacto bajo si los nombres son únicos en la práctica.

**Posible mejora:** Dejar como está; si se quisiera ser estricto, se podría comprobar también contra `session.productVariations` (si el SKU del mensaje coincide con alguna variación del producto en contexto).

---

### 6. Fallback “código en nombre/SKU” recorre todos los productos

**Es posible que ocurra:** Cuando `getProductBySku` falla (ej. SKU con typo o formato distinto), se hace `getAllProducts()` y se filtra en memoria por `normalizeCode` en nombre y SKU. Con muchos productos (miles), esa llamada es costosa y se hace en cada fallo de SKU.

**Por qué:** No hay caché de “todos los productos” ni búsqueda por API de WooCommerce por término cuando falla SKU; se usa el listado completo.

**Consecuencia:** Latencia alta en conversaciones donde el usuario introduce SKUs incorrectos o con guiones/puntos que no coinciden en la primera búsqueda.

**Posible mejora:** Caché de lista de productos (con TTL), o intentar antes una búsqueda por término (nombre/SKU) en la API de WooCommerce en lugar de traer todo el catálogo.

---

### 7. Un solo análisis de OpenAI por mensaje

**Es posible que ocurra:** Si OpenAI devuelve FALLBACK o INFORMACION_GENERAL cuando el usuario en realidad preguntaba por un producto (ej. “¿tienen X?”), no hay segunda pasada ni corrección en backend basada solo en extracción de término/SKU en nuestro código. La corrección actual solo aplica a AMBIGUA→PRODUCTOS cuando hay término no genérico.

**Por qué:** No hay reglas del tipo “si es FALLBACK pero el mensaje contiene SKU/término de producto, tratar como PRODUCTOS”.

**Consecuencia:** Comportamiento que puede variar entre mensajes muy parecidos según lo que devuelva el modelo.

**Posible mejora:** Opcionalmente, si `queryType === 'FALLBACK'` o `INFORMACION_GENERAL` y en el mensaje hay SKU explícito o término no genérico extraíble, considerar una segunda pasada como PRODUCTOS (con el mismo cuidado que en AMBIGUA para no generar falsos positivos).

---

## Resumen de prioridad (debilidades restantes)

| # | Debilidad | Frase tipo “es posible que…” | Impacto | Esfuerzo |
|---|-----------|------------------------------|--------|----------|
| 1 | rawExplicitSku solo con "sku:" | …B11-1 sin prefijo falle si se normaliza en algún camino | Bajo | Bajo |
| 2 | Múltiples SKUs | …solo se responda por el primero si pregunta por varios | Bajo | Medio |
| 3 | Historial 50 mensajes | …en hilos muy largos el historial no refleje todo el contexto | Bajo | Bajo |
| 4 | Sinónimos/abreviaturas en “término en contexto” | …“el boli” se trate como producto distinto y se fuerce búsqueda | Bajo | Medio |
| 5 | “Nombre contiene SKU” para mismo producto | …en casos raros no se limpie contexto cuando debiera | Muy bajo | Bajo |
| 6 | Fallback con getAllProducts | …haya latencia alta cuando falla SKU y hay muchos productos | Medio | Medio |
| 7 | Sin corrección FALLBACK/INFO→PRODUCTOS | …algunas preguntas de producto se respondan con mensaje fijo | Bajo | Bajo |

Recomendación: seguir monitoreando con tests (ej. las 300 preguntas); priorizar 6 si la latencia en fallos de SKU es perceptible, y 4 si aparecen quejas de “me pide nombre/SKU cuando ya hablaba de un producto”.
