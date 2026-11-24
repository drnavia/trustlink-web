/**
 * @file serviceSearchMatcher.test.js
 * @description Pruebas unitarias del buscador inteligente por síntomas y sinónimos
 * (`serviceSearchMatcher.js`): verifica emparejamiento sin tildes, detección de rubros
 * a partir de problemas cotidianos del hogar y generación de sugerencias de autocompletado.
 * @location /trustlink-web/tests/serviceSearchMatcher.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  matchesProviderQuery,
  getSearchSuggestions,
  resolveSymptomSpecialtyRoots,
} from '../src/utils/serviceSearchMatcher.js';

describe('serviceSearchMatcher (búsqueda por síntomas y sinónimos)', () => {
  const plumber = {
    first_name: 'Carlos',
    last_name: 'Gómez',
    specialty: 'Plomero',
    service_bio: 'Destapaciones y reparación de cañerías.',
  };
  const electrician = {
    first_name: 'Lucía',
    last_name: 'Fernández',
    specialty: 'Electricista',
    service_bio: 'Tableros, térmicas y urgencias domiciliarias.',
  };

  // Caso 1: Síntoma de pérdida de agua matchea al plomero y no al electricista
  it('encuentra Plomero al buscar "pérdida de agua" o "gotea la canilla"', () => {
    assert.equal(matchesProviderQuery(plumber, 'pérdida de agua'), true);
    assert.equal(matchesProviderQuery(electrician, 'pérdida de agua'), false);
    assert.equal(matchesProviderQuery(plumber, 'gotea canilla'), true);
  });

  // Caso 2: Problema eléctrico ("salta la térmica") matchea al electricista
  it('encuentra Electricista al buscar "salta la térmica"', () => {
    assert.equal(matchesProviderQuery(electrician, 'salta la térmica'), true);
    assert.equal(matchesProviderQuery(plumber, 'salta la térmica'), false);
  });

  // Caso 3: Sugerencias de autocompletado para búsquedas parciales
  it('genera sugerencias relevantes de autocompletado y raíces de especialidad', () => {
    const suggestions = getSearchSuggestions('no enfria el aire');
    assert.ok(suggestions.some((s) => s.targetSpecialty === 'Climatización'));
    const roots = resolveSymptomSpecialtyRoots('pileta verde');
    assert.ok(roots.includes('pilet'));
  });
});
