/**
 * @file qrEncoder.js
 * @description Codificador QR ISO/IEC 18004 (Byte Mode, nivel de corrección de errores ECC M,
 * versiones 1 a 12, hasta 287 bytes UTF-8) implementado en JavaScript puro sin dependencias externas.
 * Genera la matriz binaria NxN consumida por `QrCodeDisplay.jsx` para renderizar códigos QR SVG locales.
 * @location /trustlink-web/src/utils/qrEncoder.js
 */

// ============================================================================
// Tablas normativas ISO/IEC 18004 (Versiones 1 a 12, Nivel ECC M)
// ============================================================================

/**
 * Tabla de distribución de codewords para ECC Level M por versión (1..12).
 * Cada entrada sigue el formato `[ecPerBlock, g1Blocks, g1Data, g2Blocks, g2Data]`:
 * - `ecPerBlock`: codewords Reed-Solomon por bloque.
 * - `g1Blocks` / `g1Data`: cantidad de bloques del Grupo 1 y bytes de datos por bloque.
 * - `g2Blocks` / `g2Data`: cantidad de bloques del Grupo 2 y bytes de datos por bloque.
 */
const ECC_M_TABLE = {
  1: [10, 1, 16, 0, 0],
  2: [16, 1, 28, 0, 0],
  3: [26, 1, 44, 0, 0],
  4: [18, 2, 32, 0, 0],
  5: [24, 2, 43, 0, 0],
  6: [16, 4, 27, 0, 0],
  7: [18, 4, 31, 0, 0],
  8: [22, 2, 38, 2, 39],
  9: [22, 3, 36, 2, 37],
  10: [26, 4, 43, 1, 44],
  11: [30, 1, 50, 4, 51],
  12: [22, 6, 36, 2, 37],
};

/**
 * Coordenadas centrales de los patrones de alineación (*alignment patterns*) para versiones 1..12.
 * Cada par cartesiano `(r, c)` de la lista genera un patrón 5x5 salvo donde solapa un *finder pattern*.
 */
const ALIGNMENT_COORDS = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
  11: [6, 30, 54],
  12: [6, 32, 58],
};

// ============================================================================
// Aritmética en campo finito GF(256) y corrección de errores Reed-Solomon
// ============================================================================

/**
 * Tablas precalculadas de exponenciación (`GF_EXP`, duplicada a 512 para evitar módulo)
 * y logaritmo discreto (`GF_LOG`) sobre el campo de Galois GF(256) con polinomio primitivo
 * `0x11d` (`x^8 + x^4 + x^3 + x^2 + 1`).
 */
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  // Duplicación de la tabla exponencial para resolver `GF_EXP[log(a) + log(b)]` sin `% 255`.
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

/**
 * Multiplica dos elementos en el campo finito GF(256) usando tablas de logaritmo y antilogaritmo.
 * @param {number} a Primer operando (byte 0..255).
 * @param {number} b Segundo operando (byte 0..255).
 * @returns {number} Producto en GF(256).
 */
function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

/**
 * Construye el polinomio generador Reed-Solomon de grado `degree`:
 * `g(x) = (x - α^0)(x - α^1)...(x - α^(degree-1))` en GF(256).
 * @param {number} degree Cantidad de codewords de corrección de errores a generar.
 * @returns {number[]} Coeficientes del polinomio generador ordenados de mayor a menor grado.
 */
function rsGeneratorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

/**
 * Calcula los codewords de corrección de errores Reed-Solomon para un bloque de datos
 * mediante división polinomial sintética en GF(256).
 * @param {number[]} data Bloque de bytes de datos.
 * @param {number} ecCount Cantidad de bytes de redundancia ECC requeridos.
 * @returns {Uint8Array} Resto polinomial de longitud `ecCount` (codewords ECC).
 */
function rsComputeEcc(data, ecCount) {
  const gen = rsGeneratorPoly(ecCount);
  const rem = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    for (let j = 0; j < ecCount - 1; j++) {
      rem[j] = rem[j + 1] ^ gfMul(gen[j + 1], factor);
    }
    rem[ecCount - 1] = gfMul(gen[ecCount], factor);
  }
  return rem;
}

// ============================================================================
// Codificación de entrada UTF-8, selección de versión y armado de codewords
// ============================================================================

/**
 * Convierte una cadena de texto Unicode a su secuencia de bytes UTF-8.
 * Emplea `TextEncoder` cuando está disponible y un respaldo compatible con entornos legados.
 * @param {string} text Texto a codificar.
 * @returns {number[]} Arreglo de bytes UTF-8 (valores 0..255).
 */
function encodeUtf8Bytes(text) {
  if (typeof TextEncoder !== 'undefined') {
    return Array.from(new TextEncoder().encode(text));
  }
  const encoded = unescape(encodeURIComponent(text));
  const bytes = [];
  for (let i = 0; i < encoded.length; i++) bytes.push(encoded.charCodeAt(i));
  return bytes;
}

/**
 * Determina la versión QR mínima (entre 1 y 12) capaz de alojar `byteLen` bytes en Byte Mode (ECC M),
 * contemplando los bytes de cabecera (modo + contador de longitud).
 * @param {number} byteLen Longitud del payload en bytes UTF-8.
 * @returns {number} Número de versión QR seleccionada (1..12).
 * @throws {Error} Si el payload excede la capacidad máxima de Versión 12 (287 bytes).
 */
function selectVersion(byteLen) {
  for (let v = 1; v <= 12; v++) {
    const [, g1B, g1D, g2B, g2D] = ECC_M_TABLE[v];
    const totalData = g1B * g1D + g2B * g2D;
    // Cabecera Byte Mode: 4 bits de modo + 8 bits de longitud (v1..9) o 16 bits (v10..12),
    // lo que consume 2 bytes efectivos hasta v9 y 3 bytes desde v10 (redondeado a byte completo).
    const overhead = v <= 9 ? 2 : 3; // 4 bits mode + 8/16 bits count
    if (byteLen <= totalData - overhead) return v;
  }
  throw new Error('El texto supera la capacidad soportada (máx. 287 bytes).');
}

/**
 * Construye la secuencia final de codewords intercalados (datos + Reed-Solomon ECC)
 * para la versión QR elegida siguiendo el estándar ISO/IEC 18004 en Byte Mode.
 * @param {number[]} bytes Payload codificado en UTF-8.
 * @param {number} version Versión QR (1..12).
 * @returns {number[]} Arreglo completo de bytes listos para escribir bit a bit en la matriz.
 */
function buildCodewords(bytes, version) {
  const [ecPerBlock, g1B, g1D, g2B, g2D] = ECC_M_TABLE[version];
  const totalData = g1B * g1D + g2B * g2D;

  // Helper interno para insertar `len` bits de `val` del bit más significativo al menos significativo.
  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };

  // Encabezado Byte Mode (0100), contador de longitud (8 o 16 bits según versión) y payload.
  pushBits(0b0100, 4);
  pushBits(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) pushBits(b, 8);

  // Terminador estándar (hasta 4 bits en cero sin exceder la capacidad de datos).
  const maxBits = totalData * 8;
  const termLen = Math.min(4, maxBits - bits.length);
  for (let i = 0; i < termLen; i++) bits.push(0);

  // Relleno con ceros para alinear el flujo de bits a frontera de byte (múltiplo de 8).
  while (bits.length % 8 !== 0) bits.push(0);

  // Empaquetado del flujo de bits en bytes de datos.
  const dataBytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let val = 0;
    for (let j = 0; j < 8; j++) val = (val << 1) | bits[i + j];
    dataBytes.push(val);
  }

  // Relleno normativo alternado (0xEC, 0x11) hasta completar la capacidad total de datos.
  let padIdx = 0;
  while (dataBytes.length < totalData) {
    dataBytes.push(padIdx % 2 === 0 ? 0xec : 0x11);
    padIdx++;
  }

  // División de datos en bloques del Grupo 1 y Grupo 2, con cálculo Reed-Solomon independiente por bloque.
  const dataBlocks = [];
  const eccBlocks = [];
  let offset = 0;

  for (let i = 0; i < g1B; i++) {
    const block = dataBytes.slice(offset, offset + g1D);
    offset += g1D;
    dataBlocks.push(block);
    eccBlocks.push(rsComputeEcc(block, ecPerBlock));
  }
  for (let i = 0; i < g2B; i++) {
    const block = dataBytes.slice(offset, offset + g2D);
    offset += g2D;
    dataBlocks.push(block);
    eccBlocks.push(rsComputeEcc(block, ecPerBlock));
  }

  // Intercalado (interleaving) columna a columna: primero todos los bloques de datos y luego los bloques ECC.
  const result = [];
  const maxDataLen = Math.max(g1D, g2D);
  for (let i = 0; i < maxDataLen; i++) {
    for (const blk of dataBlocks) {
      if (i < blk.length) result.push(blk[i]);
    }
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const ecc of eccBlocks) {
      result.push(ecc[i]);
    }
  }
  return result;
}

// ============================================================================
// Bits de formato/versión (BCH) y construcción de la matriz QR funcional
// ============================================================================

/**
 * Calcula los 15 bits de información de formato (ECC M = `00` + patrón de máscara 0..7)
 * protegidos con código BCH(15,5) (polinomio `0x537`) y enmascarados con XOR `0x5412`.
 * @param {number} mask Índice de máscara QR (0..7).
 * @returns {number} Entero de 15 bits con la palabra de formato lista para escribir.
 */
function computeFormatBits(mask) {
  // Indicador ECC Level M = 00 en los 2 bits superiores de los 5 bits de datos.
  const data = (0b00 << 3) | mask;
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) {
    if ((rem >>> i) & 1) rem ^= 0x537 << (i - 10);
  }
  return ((data << 10) | rem) ^ 0x5412;
}

/**
 * Calcula los 18 bits de información de versión (requeridos para versiones >= 7)
 * aplicando el código corrector BCH(18,6) con polinomio generador `0x1f25`.
 * @param {number} version Versión QR (>= 7).
 * @returns {number} Entero de 18 bits con la palabra de versión.
 */
function computeVersionBits(version) {
  let rem = version << 12;
  for (let i = 17; i >= 12; i--) {
    if ((rem >>> i) & 1) rem ^= 0x1f25 << (i - 12);
  }
  return (version << 12) | rem;
}

/**
 * Inicializa la matriz QR base de tamaño `17 + 4 * version` y dibuja todos los patrones
 * funcionales fijos (*finders*, separadores, *alignments*, *timing*, áreas de formato,
 * módulo oscuro fijo e información de versión para v >= 7).
 * @param {number} version Versión QR (1..12).
 * @returns {{ size: number, modules: Uint8Array[], isFunc: Uint8Array[] }} Dimensión, matriz de módulos y mapa de celdas funcionales protegidas.
 */
function createBaseMatrix(version) {
  const size = 17 + 4 * version;
  const modules = Array.from({ length: size }, () => new Uint8Array(size));
  const isFunc = Array.from({ length: size }, () => new Uint8Array(size));

  // Marca un módulo como funcional (no sobrescribible ni enmascarable) y fija su color.
  const setFunc = (r, c, dark) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      modules[r][c] = dark ? 1 : 0;
      isFunc[r][c] = 1;
    }
  };

  // Patrones buscadores (Finder patterns 7x7) en 3 esquinas junto con su borde separador blanco de 1 módulo.
  const drawFinder = (top, left) => {
    for (let dy = -1; dy <= 7; dy++) {
      for (let dx = -1; dx <= 7; dx++) {
        const r = top + dy;
        const c = left + dx;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const dist = Math.max(Math.abs(dy - 3), Math.abs(dx - 3));
        const dark = dist !== 2 && dist !== 4;
        setFunc(r, c, dark);
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Patrones de alineación (Alignment patterns 5x5) evitando solapar las 3 esquinas de los finders.
  const coords = ALIGNMENT_COORDS[version] || [];
  for (let i = 0; i < coords.length; i++) {
    for (let j = 0; j < coords.length; j++) {
      const rCenter = coords[i];
      const cCenter = coords[j];
      const inTopLeft = i === 0 && j === 0;
      const inTopRight = i === 0 && j === coords.length - 1;
      const inBottomLeft = i === coords.length - 1 && j === 0;
      if (inTopLeft || inTopRight || inBottomLeft) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const dist = Math.max(Math.abs(dy), Math.abs(dx));
          setFunc(rCenter + dy, cCenter + dx, dist !== 1);
        }
      }
    }
  }

  // Patrones de temporización (Timing patterns) alternados en fila 6 y columna 6.
  for (let i = 8; i < size - 8; i++) {
    if (!isFunc[6][i]) setFunc(6, i, i % 2 === 0);
    if (!isFunc[i][6]) setFunc(i, 6, i % 2 === 0);
  }

  // Reserva de celdas para los bits de formato (se completan tras elegir máscara) y módulo oscuro obligatorio.
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      setFunc(8, i, false);
      setFunc(i, 8, false);
    }
  }
  for (let i = 0; i < 8; i++) {
    setFunc(8, size - 1 - i, false);
    if (i < 7) setFunc(size - 1 - i, 8, false);
  }
  setFunc(size - 8, 8, true); // Módulo oscuro fijo (Dark module) exigido por la norma.

  // Bloques de información de versión (dos bloques espejados de 6x3, obligatorios desde Versión 7).
  if (version >= 7) {
    const vBits = computeVersionBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = Boolean((vBits >>> i) & 1);
      const a = Math.floor(i / 3);
      const b = size - 11 + (i % 3);
      setFunc(a, b, bit);
      setFunc(b, a, bit);
    }
  }

  return { size, modules, isFunc };
}

/**
 * Escribe de forma redundante los 15 bits de información de formato (ECC M + máscara)
 * en las dos ubicaciones definidas por ISO/IEC 18004 dentro de la matriz.
 * @param {Uint8Array[]} modules Matriz QR destino.
 * @param {number} size Dimensión NxN de la matriz.
 * @param {number} mask Índice de máscara aplicada (0..7).
 */
function drawFormatBits(modules, size, mask) {
  const bits = computeFormatBits(mask);
  const getBit = (i) => (bits >>> i) & 1;

  // Copia 1: rodeando el finder superior izquierdo (saltando fila/columna 6 de timing).
  for (let i = 0; i <= 5; i++) modules[8][i] = getBit(14 - i);
  modules[8][7] = getBit(8);
  modules[8][8] = getBit(7);
  modules[7][8] = getBit(6);
  for (let i = 9; i < 15; i++) modules[14 - i][8] = getBit(14 - i);

  // Copia 2: franja vertical junto al finder inferior izquierdo y horizontal bajo el finder superior derecho.
  for (let i = 0; i < 7; i++) modules[size - 1 - i][8] = getBit(14 - i);
  for (let i = 0; i < 8; i++) modules[8][size - 8 + i] = getBit(7 - i);
}

// ============================================================================
// Colocación de datos, enmascaramiento y evaluación de penalización
// ============================================================================

/**
 * Recorre la matriz en patrón zigzag de dos columnas (de derecha a izquierda, alternando
 * subida/bajada y omitiendo la columna 6 de timing) escribiendo los bits de `codewords`
 * únicamente en celdas no funcionales.
 * @param {Uint8Array[]} modules Matriz QR base donde se escriben los datos.
 * @param {Uint8Array[]} isFunc Mapa de celdas funcionales protegidas.
 * @param {number} size Dimensión NxN de la matriz.
 * @param {number[]} codewords Secuencia intercalada de bytes de datos y ECC.
 */
function placeDataBits(modules, isFunc, size, codewords) {
  let bitIdx = 0;
  const totalBits = codewords.length * 8;
  let upward = true;

  for (let col = size - 1; col >= 1; col -= 2) {
    // La columna 6 está ocupada por el timing pattern vertical y se salta según norma.
    if (col === 6) col = 5;
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (let dx = 0; dx < 2; dx++) {
        const c = col - dx;
        if (!isFunc[row][c]) {
          let dark = 0;
          if (bitIdx < totalBits) {
            dark = (codewords[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1;
            bitIdx++;
          }
          modules[row][c] = dark;
        }
      }
    }
    upward = !upward;
  }
}

/**
 * Evalúa la condición booleana de inversión de bit para cada una de las 8 máscaras
 * estandarizadas por ISO/IEC 18004 en la coordenada `(r, c)`.
 * @param {number} mask Número de máscara (0..7).
 * @param {number} r Índice de fila.
 * @param {number} c Índice de columna.
 * @returns {boolean} `true` si el módulo de datos debe invertirse con XOR 1.
 */
function maskBit(mask, r, c) {
  switch (mask) {
    case 0: return (r + c) % 2 === 0;
    case 1: return r % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    default: return false;
  }
}

/**
 * Calcula el puntaje de penalización de una matriz candidata para seleccionar la máscara
 * con mejor legibilidad óptica (a menor puntaje, mejor patrón de escaneo).
 * Evalúa corridas consecutivas (Regla 1), bloques 2x2 homogéneos (Regla 2) y balance claro/oscuro (Regla 4).
 * @param {Uint8Array[]} modules Matriz candidata ya enmascarada con bits de formato.
 * @param {number} size Dimensión NxN de la matriz.
 * @returns {number} Penalización acumulada.
 */
function scoreMatrix(modules, size) {
  let penalty = 0;

  // Regla 1: penaliza corridas horizontales y verticales de 5 o más módulos consecutivos del mismo color.
  for (let r = 0; r < size; r++) {
    let runColor = modules[r][0];
    let runLen = 1;
    for (let c = 1; c < size; c++) {
      if (modules[r][c] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = modules[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }
  for (let c = 0; c < size; c++) {
    let runColor = modules[0][c];
    let runLen = 1;
    for (let r = 1; r < size; r++) {
      if (modules[r][c] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = modules[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }

  // Regla 2: penaliza cada bloque 2x2 uniforme del mismo color (+3 puntos).
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = modules[r][c];
      if (v === modules[r][c + 1] && v === modules[r + 1][c] && v === modules[r + 1][c + 1]) {
        penalty += 3;
      }
    }
  }

  // Regla 4: penaliza el desvío de la proporción de módulos oscuros respecto al ideal del 50%.
  let darkCount = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) darkCount += modules[r][c];
  }
  const ratio = (darkCount * 100) / (size * size);
  const k = Math.floor(Math.abs(ratio - 50) / 5);
  penalty += k * 10;

  return penalty;
}

// ============================================================================
// API pública de generación de matriz QR (consumida para renderizado SVG)
// ============================================================================

/**
 * Codifica una cadena de texto en una matriz NxN de Código QR (ISO/IEC 18004, Byte Mode, ECC M).
 * Ejecuta el pipeline completo: codificación UTF-8, selección de versión, generación de codewords
 * Reed-Solomon, armado de patrones funcionales, inserción de bits y selección automática de la
 * máscara óptima entre las 8 posibles para su posterior trazado vectorial SVG.
 * @param {string} text Texto o URL a codificar (hasta 287 bytes UTF-8).
 * @returns {{ size: number, version: number, mask: number, modules: Uint8Array[] }} Metadatos del símbolo y matriz binaria (1 = oscuro, 0 = claro).
 */
export function encodeQrMatrix(text) {
  // 1. Preparación de bytes UTF-8, versión óptima, codewords ECC y matriz base con datos.
  const bytes = encodeUtf8Bytes(String(text || ''));
  const version = selectVersion(bytes.length);
  const codewords = buildCodewords(bytes, version);
  const { size, modules: base, isFunc } = createBaseMatrix(version);
  placeDataBits(base, isFunc, size, codewords);

  // 2. Evaluación exhaustiva de las 8 máscaras estándar eligiendo la de menor penalización.
  let bestMask = 0;
  let bestScore = Infinity;
  let bestModules = null;

  for (let mask = 0; mask < 8; mask++) {
    const candidate = base.map((row) => Uint8Array.from(row));
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!isFunc[r][c] && maskBit(mask, r, c)) {
          candidate[r][c] ^= 1;
        }
      }
    }
    drawFormatBits(candidate, size, mask);
    const sc = scoreMatrix(candidate, size);
    if (sc < bestScore) {
      bestScore = sc;
      bestMask = mask;
      bestModules = candidate;
    }
  }

  return { size, version, mask: bestMask, modules: bestModules };
}
