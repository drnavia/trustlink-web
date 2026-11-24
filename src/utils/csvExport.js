/**
 * @file csvExport.js
 * @description Utilidad liviana para exportar tablas administrativas a CSV compatible con Excel (UTF-8 BOM).
 * @location /trustlink-web/src/utils/csvExport.js
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
 * Descarga un archivo CSV en el navegador.
 * @param {string} filename Nombre del archivo (con o sin .csv)
 * @param {Array<{key: string, label: string}>} columns Definición de columnas
 * @param {Array<object>} rows Filas de datos
 */
export function downloadCsv(filename, columns, rows) {
  if (typeof window === 'undefined' || !Array.isArray(columns) || !Array.isArray(rows)) {
    return false;
  }

  const headerLine = columns.map((c) => escapeCsvCell(c.label)).join(',');
  const dataLines = rows.map((row) =>
    columns
      .map((c) => {
        const val = typeof c.format === 'function' ? c.format(row) : row?.[c.key];
        return escapeCsvCell(val);
      })
      .join(',')
  );

  const csvContent = `\uFEFF${[headerLine, ...dataLines].join('\r\n')}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
