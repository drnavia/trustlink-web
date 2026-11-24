/**
 * @file qrEncoder.js
 * @description Codificador QR ISO/IEC 18004 (Byte Mode, nivel ECC M, versiones 1 a 12,
 * hasta 287 bytes UTF-8) sin dependencias externas, para generar códigos QR SVG locales.
 * @location /trustlink-web/src/utils/qrEncoder.js
 */

// [ecPerBlock, g1Blocks, g1Data, g2Blocks, g2Data] para ECC Level M (Versiones 1..12)
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

// Tablas GF(256) con polinomio primitivo 0x11d
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
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

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

function encodeUtf8Bytes(text) {
  if (typeof TextEncoder !== 'undefined') {
    return Array.from(new TextEncoder().encode(text));
  }
  const encoded = unescape(encodeURIComponent(text));
  const bytes = [];
  for (let i = 0; i < encoded.length; i++) bytes.push(encoded.charCodeAt(i));
  return bytes;
}

function selectVersion(byteLen) {
  for (let v = 1; v <= 12; v++) {
    const [, g1B, g1D, g2B, g2D] = ECC_M_TABLE[v];
    const totalData = g1B * g1D + g2B * g2D;
    const overhead = v <= 9 ? 2 : 3; // 4 bits mode + 8/16 bits count
    if (byteLen <= totalData - overhead) return v;
  }
  throw new Error('El texto supera la capacidad soportada (máx. 287 bytes).');
}

function buildCodewords(bytes, version) {
  const [ecPerBlock, g1B, g1D, g2B, g2D] = ECC_M_TABLE[version];
  const totalData = g1B * g1D + g2B * g2D;

  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };

  // Mode indicator: Byte mode = 0100
  pushBits(0b0100, 4);
  pushBits(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) pushBits(b, 8);

  // Terminator (hasta 4 ceros)
  const maxBits = totalData * 8;
  const termLen = Math.min(4, maxBits - bits.length);
  for (let i = 0; i < termLen; i++) bits.push(0);

  // Alinear a múltiplo de 8
  while (bits.length % 8 !== 0) bits.push(0);

  const dataBytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let val = 0;
    for (let j = 0; j < 8; j++) val = (val << 1) | bits[i + j];
    dataBytes.push(val);
  }

  // Pad bytes alternados 0xEC, 0x11
  let padIdx = 0;
  while (dataBytes.length < totalData) {
    dataBytes.push(padIdx % 2 === 0 ? 0xec : 0x11);
    padIdx++;
  }

  // Dividir en bloques y calcular Reed-Solomon ECC
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

  // Interleaving de datos y luego ECC
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

function computeFormatBits(mask) {
  // ECC Level M = 00
  const data = (0b00 << 3) | mask;
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) {
    if ((rem >>> i) & 1) rem ^= 0x537 << (i - 10);
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function computeVersionBits(version) {
  let rem = version << 12;
  for (let i = 17; i >= 12; i--) {
    if ((rem >>> i) & 1) rem ^= 0x1f25 << (i - 12);
  }
  return (version << 12) | rem;
}

function createBaseMatrix(version) {
  const size = 17 + 4 * version;
  const modules = Array.from({ length: size }, () => new Uint8Array(size));
  const isFunc = Array.from({ length: size }, () => new Uint8Array(size));

  const setFunc = (r, c, dark) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      modules[r][c] = dark ? 1 : 0;
      isFunc[r][c] = 1;
    }
  };

  // Finder patterns + separadores
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

  // Alignment patterns
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

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!isFunc[6][i]) setFunc(6, i, i % 2 === 0);
    if (!isFunc[i][6]) setFunc(i, 6, i % 2 === 0);
  }

  // Reservar áreas de formato + módulo oscuro fijo
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
  setFunc(size - 8, 8, true); // Dark module

  // Version info (versiones >= 7)
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

function drawFormatBits(modules, size, mask) {
  const bits = computeFormatBits(mask);
  const getBit = (i) => (bits >>> i) & 1;

  // Copia 1: alrededor de finder superior izquierdo
  for (let i = 0; i <= 5; i++) modules[8][i] = getBit(14 - i);
  modules[8][7] = getBit(8);
  modules[8][8] = getBit(7);
  modules[7][8] = getBit(6);
  for (let i = 9; i < 15; i++) modules[14 - i][8] = getBit(14 - i);

  // Copia 2: inferior izquierdo + superior derecho
  for (let i = 0; i < 7; i++) modules[size - 1 - i][8] = getBit(14 - i);
  for (let i = 0; i < 8; i++) modules[8][size - 8 + i] = getBit(7 - i);
}

function placeDataBits(modules, isFunc, size, codewords) {
  let bitIdx = 0;
  const totalBits = codewords.length * 8;
  let upward = true;

  for (let col = size - 1; col >= 1; col -= 2) {
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

function scoreMatrix(modules, size) {
  let penalty = 0;

  // Regla 1: corridas de >= 5 módulos del mismo color
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

  // Regla 2: bloques 2x2
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = modules[r][c];
      if (v === modules[r][c + 1] && v === modules[r + 1][c] && v === modules[r + 1][c + 1]) {
        penalty += 3;
      }
    }
  }

  // Regla 4: balance de módulos oscuros
  let darkCount = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) darkCount += modules[r][c];
  }
  const ratio = (darkCount * 100) / (size * size);
  const k = Math.floor(Math.abs(ratio - 50) / 5);
  penalty += k * 10;

  return penalty;
}

/**
 * Codifica una cadena en una matriz booleana/numérica NxN de Código QR (ECC M).
 * @param {string} text
 * @returns {{ size: number, version: number, modules: Uint8Array[] }}
 */
export function encodeQrMatrix(text) {
  const bytes = encodeUtf8Bytes(String(text || ''));
  const version = selectVersion(bytes.length);
  const codewords = buildCodewords(bytes, version);
  const { size, modules: base, isFunc } = createBaseMatrix(version);
  placeDataBits(base, isFunc, size, codewords);

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
