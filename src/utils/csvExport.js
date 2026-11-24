/**
 * @file csvExport.js
 * @description Utilidad liviana para exportar tablas administrativas y listados operativos
 * a archivos CSV compatibles con Microsoft Excel mediante codificación UTF-8 con BOM.
 * @location /trustlink-web/src/utils/csvExport.js
 */

/**
 * Escapa un valor individual para incrustarlo de forma segura en una celda CSV (RFC 4180).
 * Envuelve el texto entre comillas dobles y duplica comillas internas cuando contiene separadores o saltos de línea.
 * @param {*} value Valor crudo de la celda.
 * @returns {string} Cadena saneada lista para concatenar en una fila CSV.
 */
function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Genera y dispara la descarga de un archivo CSV en el navegador.
 * @param {string} filename Nombre del archivo destino (se agrega `.csv` si falta).
 * @param {Array<{key: string, label: string, format?: (row: object) => *}>} columns Definición de columnas y formateadores opcionales.
 * @param {Array<object>} rows Colección de filas de datos a exportar.
 * @returns {boolean} `true` si se disparó la descarga o `false` si faltan precondiciones de entorno/datos.
 */
export function downloadCsv(filename, columns, rows) {
  if (typeof window === 'undefined' || !Array.isArray(columns) || !Array.isArray(rows)) {
    return false;
  }

  // Construcción de fila de encabezados y filas de datos aplicando formateadores personalizados si existen.
  const headerLine = columns.map((c) => escapeCsvCell(c.label)).join(',');
  const dataLines = rows.map((row) =>
    columns
      .map((c) => {
        const val = typeof c.format === 'function' ? c.format(row) : row?.[c.key];
        return escapeCsvCell(val);
      })
      .join(',')
  );

  // Prefijo BOM (`\uFEFF`) y saltos CRLF para asegurar correcta detección de acentos en Excel.
  const csvContent = `\uFEFF${[headerLine, ...dataLines].join('\r\n')}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  // Descarga programática mediante enlace temporal y liberación diferida del Object URL.
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
