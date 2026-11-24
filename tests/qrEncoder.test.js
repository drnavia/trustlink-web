/**
 * @file qrEncoder.test.js
 * @description Pruebas unitarias nativas (`node:test`) para el codificador QR ISO/IEC 18004
 * (`encodeQrMatrix`). Verifica dimensiones de matriz, patrones funcionales obligatorios,
 * enlaces reales de Consola Garita y límites de capacidad en Versión 12.
 * @location /trustlink-web/tests/qrEncoder.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encodeQrMatrix } from '../src/utils/qrEncoder.js';

// Suite de regresión del codificador QR local (Byte Mode, nivel de corrección ECC M).
describe('qrEncoder (ISO/IEC 18004 ECC M)', () => {
  // Valida que un payload breve seleccione Versión 1 (21x21), coloque el módulo oscuro
  // obligatorio en (size - 8, 8) y mantenga activos los centros de los 3 finder patterns.
  it('codifica cadenas cortas en Versión 1 (21x21) con finder y módulo oscuro válidos', () => {
    const res = encodeQrMatrix('TRUSTLINK');
    assert.equal(res.version, 1);
    assert.equal(res.size, 21);
    assert.equal(res.modules.length, 21);
    assert.equal(res.modules[res.size - 8][8], 1);
    // Centros de los 3 patrones buscadores (superior izquierdo, superior derecho e inferior izquierdo).
    assert.equal(res.modules[3][3], 1);
    assert.equal(res.modules[3][res.size - 4], 1);
    assert.equal(res.modules[res.size - 4][3], 1);
  });

  // Valida el caso real de uso: URL completa de producción con token hexadecimal de 64 caracteres,
  // comprobando rango de versión esperado (6..8), fórmula dimensional `17 + 4 * version` y dark module.
  it('codifica enlaces completos de garita (?qr_token=64hex) dentro de capacidad estándar', () => {
    const url = `https://trustlink.vercel.app/?qr_token=${'a1b2c3d4'.repeat(8)}`;
    const res = encodeQrMatrix(url);
    assert.ok(res.version >= 6 && res.version <= 8);
    assert.equal(res.size, 17 + 4 * res.version);
    assert.equal(res.modules[res.size - 8][8], 1);
  });

  // Valida la frontera máxima soportada: 280 bytes entran en Versión 12 (65x65)
  // y un payload superior a 287 bytes lanza una excepción controlada por exceso de capacidad.
  it('soporta hasta 287 bytes en Versión 12 (65x65) y rechaza payloads mayores', () => {
    const ok = encodeQrMatrix('x'.repeat(280));
    assert.equal(ok.version, 12);
    assert.equal(ok.size, 65);
    assert.throws(() => encodeQrMatrix('x'.repeat(300)), /supera la capacidad/i);
  });
});
