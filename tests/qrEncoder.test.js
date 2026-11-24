/**
 * @file qrEncoder.test.js
 * @description Pruebas unitarias nativas (`node:test`) para el codificador QR ISO/IEC 18004.
 * @location /trustlink-web/tests/qrEncoder.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encodeQrMatrix } from '../src/utils/qrEncoder.js';

describe('qrEncoder (ISO/IEC 18004 ECC M)', () => {
  it('codifica cadenas cortas en Versión 1 (21x21) con finder y módulo oscuro válidos', () => {
    const res = encodeQrMatrix('TRUSTLINK');
    assert.equal(res.version, 1);
    assert.equal(res.size, 21);
    assert.equal(res.modules.length, 21);
    assert.equal(res.modules[res.size - 8][8], 1);
    // Centro de los 3 finder patterns
    assert.equal(res.modules[3][3], 1);
    assert.equal(res.modules[3][res.size - 4], 1);
    assert.equal(res.modules[res.size - 4][3], 1);
  });

  it('codifica enlaces completos de garita (?qr_token=64hex) dentro de capacidad estándar', () => {
    const url = `https://trustlink.vercel.app/?qr_token=${'a1b2c3d4'.repeat(8)}`;
    const res = encodeQrMatrix(url);
    assert.ok(res.version >= 6 && res.version <= 8);
    assert.equal(res.size, 17 + 4 * res.version);
    assert.equal(res.modules[res.size - 8][8], 1);
  });

  it('soporta hasta 287 bytes en Versión 12 (65x65) y rechaza payloads mayores', () => {
    const ok = encodeQrMatrix('x'.repeat(280));
    assert.equal(ok.version, 12);
    assert.equal(ok.size, 65);
    assert.throws(() => encodeQrMatrix('x'.repeat(300)), /supera la capacidad/i);
  });
});
