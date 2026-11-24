/**
 * @file serviceSearchMatcher.js
 * @description Buscador inteligente por síntomas, problemas cotidianos del hogar y sinónimos
 * para TrustLink Web (Fase 5.2). Permite que al buscar expresiones naturales como
 * "pérdida de agua", "salta la térmica", "no enfría el aire" o "pileta verde" en la Landing
 * o en el Directorio, se identifiquen automáticamente las especialidades compatibles.
 * @location /trustlink-web/src/utils/serviceSearchMatcher.js
 */

/**
 * Catálogo de mapeo entre síntomas/necesidades frecuentes del hogar y rubros técnicos.
 * Cada entrada define:
 * - `label`: texto sugerido para el autocompletado del buscador.
 * - `targetSpecialty`: especialidad principal sugerida al elegir el ítem.
 * - `keywords`: sinónimos, problemas y términos asociados (en minúsculas sin tildes).
 * - `specialties`: raíces de especialidad contra las que hace match en el directorio.
 */
export const SYMPTOM_SYNONYM_RULES = [
  {
    label: 'Pérdida de agua / canillas / caños',
    targetSpecialty: 'Plomero',
    keywords: [
      'agua',
      'perdida',
      'fuga',
      'canilla',
      'cano',
      'caneria',
      'inodoro',
      'mochila',
      'destapacion',
      'desague',
      'cloaca',
      'tanque',
      'bomba presurizadora',
      'plomeria',
      'plomero',
      'gotea',
      'humedad cano',
    ],
    specialties: ['plomer', 'sanitar', 'destap'],
  },
  {
    label: 'Salta la térmica / cortocircuito / tablero',
    targetSpecialty: 'Electricista',
    keywords: [
      'luz',
      'termica',
      'disyuntor',
      'cortocircuito',
      'corto',
      'tablero',
      'enchufe',
      'tomacorriente',
      'cable',
      'iluminacion',
      'lampara',
      'bajon de tension',
      'electrico',
      'electricidad',
      'electricista',
    ],
    specialties: ['electric'],
  },
  {
    label: 'No enfría el aire / split / calefacción',
    targetSpecialty: 'Climatización',
    keywords: [
      'aire',
      'split',
      'enfria',
      'calor',
      'frio',
      'refrigeracion',
      'carga de gas aire',
      'calefaccion',
      'loza radiante',
      'losa radiante',
      'radiador',
      'caldera',
      'climatizacion',
      'inverter',
    ],
    specialties: ['climat', 'aire', 'refrig', 'calefac'],
  },
  {
    label: 'Olor a gas / estufa / termotanque / caldera',
    targetSpecialty: 'Gasista',
    keywords: [
      'gas',
      'olor a gas',
      'estufa',
      'hornalla',
      'cocina',
      'horno',
      'termotanque',
      'calefon',
      'piloto',
      'caldera',
      'matriculado',
      'gasista',
    ],
    specialties: ['gasist', 'gas', 'calefac'],
  },
  {
    label: 'Pileta verde / bomba / filtro de piscina',
    targetSpecialty: 'Piletero',
    keywords: [
      'pileta',
      'piscina',
      'cloro',
      'agua verde',
      'filtro',
      'bomba pileta',
      'barrefondo',
      'skimmer',
      'piletero',
    ],
    specialties: ['pilet', 'piscin'],
  },
  {
    label: 'Corte de pasto / poda / riego / jardín',
    targetSpecialty: 'Jardinero',
    keywords: [
      'pasto',
      'cesped',
      'poda',
      'arbol',
      'cerco',
      'jardin',
      'parque',
      'riego',
      'paisajismo',
      'desmalezar',
      'jardinero',
      'parquero',
    ],
    specialties: ['jardin', 'parqu', 'paisaj', 'riego'],
  },
  {
    label: 'Cerradura trabada / llaves / portón',
    targetSpecialty: 'Cerrajero',
    keywords: [
      'llave',
      'cerradura',
      'puerta trabada',
      'cerrojo',
      'copia',
      'porton',
      'automatizacion',
      'cerrajero',
      'cerrajeria',
    ],
    specialties: ['cerraj', 'herrer', 'porton'],
  },
  {
    label: 'Pintura / humedad / pared / techo / obra',
    targetSpecialty: 'Pintor',
    keywords: [
      'pintar',
      'pintura',
      'humedad',
      'filtracion',
      'membrana',
      'techo',
      'gotera',
      'revoque',
      'durlock',
      'yeso',
      'pared',
      'albanil',
      'pintor',
      'impermeabilizacion',
    ],
    specialties: ['pinto', 'alban', 'durlock', 'constr', 'techo', 'impermeab'],
  },
  {
    label: 'Limpieza integral / vidrios / mantenimiento',
    targetSpecialty: 'Limpieza',
    keywords: [
      'limpieza',
      'limpiar',
      'vidrios',
      'final de obra',
      'mantenimiento',
      'fumigacion',
      'plagas',
    ],
    specialties: ['limpiez', 'mantenim', 'fumig'],
  },
];

/**
 * Normaliza una cadena de texto a minúsculas y sin tildes/diacríticos para búsqueda flexible.
 *
 * @param {string|null|undefined} text - Texto original.
 * @returns {string} Texto normalizado sin tildes ni espacios extremos.
 */
export function normalizeSearchText(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Resuelve las raíces de especialidad que coinciden con una consulta libre por síntoma o sinónimo.
 *
 * @param {string} rawQuery - Término ingresado por el usuario.
 * @returns {string[]} Lista deduplicada de prefijos de especialidad compatibles.
 */
export function resolveSymptomSpecialtyRoots(rawQuery) {
  const q = normalizeSearchText(rawQuery);
  if (!q || q.length < 2) return [];

  const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
  const matchedRoots = new Set();

  for (const rule of SYMPTOM_SYNONYM_RULES) {
    const hitsRule = rule.keywords.some((kw) => {
      const nkw = normalizeSearchText(kw);
      if (q.includes(nkw) || nkw.includes(q)) return true;
      return tokens.some((tok) => tok.length >= 3 && (nkw.includes(tok) || tok.includes(nkw)));
    });
    if (hitsRule) {
      rule.specialties.forEach((root) => matchedRoots.add(root));
    }
  }

  return Array.from(matchedRoots);
}

/**
 * Evalúa si un prestador del directorio coincide con una búsqueda libre del residente,
 * considerando nombre, apellido, especialidad, correo, bio comercial (`service_bio`) y
 * coincidencias semánticas por síntomas/problemas del hogar.
 *
 * @param {Object} provider - Registro de prestador devuelto por `/api/v1/providers/directory`.
 * @param {string} rawQuery - Texto ingresado en el buscador.
 * @returns {boolean} `true` si el prestador es relevante para la consulta.
 */
export function matchesProviderQuery(provider, rawQuery) {
  const q = normalizeSearchText(rawQuery);
  if (!q) return true;

  const fullName = normalizeSearchText(`${provider?.first_name || ''} ${provider?.last_name || ''}`);
  const specialty = normalizeSearchText(
    `${provider?.specialty || ''} ${provider?.specialties_label || ''}`
  );
  const email = normalizeSearchText(provider?.email || '');
  const bio = normalizeSearchText(provider?.service_bio || '');

  // Coincidencia textual directa en campos del perfil
  if (
    fullName.includes(q) ||
    specialty.includes(q) ||
    email.includes(q) ||
    bio.includes(q)
  ) {
    return true;
  }

  // Coincidencia semántica por síntomas/sinónimos contra la especialidad o bio del prestador
  const roots = resolveSymptomSpecialtyRoots(q);
  if (roots.length === 0) return false;

  return roots.some((root) => specialty.includes(root) || bio.includes(root));
}

/**
 * Devuelve sugerencias de búsqueda estilo autocompletado (máximo 4) cuando el usuario escribe
 * un problema o necesidad en la Landing o en el Directorio.
 *
 * @param {string} rawQuery - Texto parcial escrito por el usuario.
 * @returns {Array<{ label: string, targetSpecialty: string }>} Sugerencias relevantes.
 */
export function getSearchSuggestions(rawQuery) {
  const q = normalizeSearchText(rawQuery);
  if (!q || q.length < 2) return [];

  const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
  const matches = [];

  for (const rule of SYMPTOM_SYNONYM_RULES) {
    const labelNorm = normalizeSearchText(rule.label);
    const specNorm = normalizeSearchText(rule.targetSpecialty);
    const hits =
      labelNorm.includes(q) ||
      specNorm.includes(q) ||
      rule.keywords.some((kw) => {
        const nkw = normalizeSearchText(kw);
        return (
          q.includes(nkw) ||
          nkw.includes(q) ||
          tokens.some((tok) => tok.length >= 3 && (nkw.includes(tok) || tok.includes(nkw)))
        );
      });

    if (hits) {
      matches.push({
        label: rule.label,
        targetSpecialty: rule.targetSpecialty,
      });
      if (matches.length >= 4) break;
    }
  }

  return matches;
}
