/**
 * @file receiptPrinter.js
 * @description Genera y abre una ventana HTML limpia lista para imprimir o guardar en PDF
 * del Comprobante del Hogar emitido por `GET /api/v1/contracts/:id/receipt`.
 * @location /trustlink-web/src/utils/receiptPrinter.js
 */

/**
 * Escapa caracteres especiales HTML para prevenir inyección (XSS) al interpolar
 * datos dinámicos del comprobante dentro del documento imprimible.
 * @param {*} value Valor a sanitizar.
 * @returns {string} Texto seguro para insertar en nodos o atributos HTML.
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formatea una marca temporal completa (fecha y hora) en formato local argentino (`es-AR`).
 * @param {string|number|Date|null|undefined} value Fecha/hora de entrada.
 * @returns {string} Fecha y hora legibles o `—` cuando no existe valor.
 */
function formatDateAr(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formatea únicamente la fecha (sin horario) en formato `es-AR`, utilizado para
 * vigencias documentales de compliance (ART y antecedentes penales).
 * @param {string|number|Date|null|undefined} value Fecha de vencimiento o registro.
 * @returns {string} Fecha localizada o leyenda `'Sin fecha cargada'` si falta el dato.
 */
function formatDateOnlyAr(value) {
  if (!value) return 'Sin fecha cargada';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('es-AR');
}

/**
 * Construye el documento HTML autocontenido del Comprobante del Hogar y abre una ventana
 * emergente que invoca automáticamente el diálogo de impresión del navegador (`window.print()`).
 * @param {object} receipt Objeto de comprobante devuelto por el backend (contrato, comunidad, residente, prestador, pase, pago y disputas).
 * @returns {boolean} `true` si se abrió y escribió la ventana de impresión; `false` si faltan datos o el navegador bloqueó el popup.
 */
export function printServiceReceipt(receipt) {
  if (!receipt || typeof window === 'undefined') return false;
  const win = window.open('', '_blank', 'width=840,height=920');
  if (!win) return false;

  // Normalización defensiva de cada bloque del comprobante para evitar fallos ante campos opcionales.
  const contract = receipt.contract || {};
  const community = receipt.community || {};
  const resident = receipt.resident || {};
  const provider = receipt.provider || {};
  const pass = receipt.access_pass || null;
  const payment = receipt.payment || {};
  const disputes = Array.isArray(receipt.disputes) ? receipt.disputes : [];

  // Armado del documento HTML imprimible: estilos embebidos (@media print), cabecera institucional,
  // bloques de partes y compliance, detalle del servicio, resumen financiero y reclamos opcionales.
  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Comprobante ${escapeHtml(receipt.receipt_code || '')} - TrustLink</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; margin: 28px; line-height: 1.45; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #059669; padding-bottom: 14px; margin-bottom: 18px; }
    .brand { font-size: 22px; font-weight: 800; color: #059669; }
    .code { font-family: monospace; font-size: 13px; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 6px 10px; border-radius: 8px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; }
    .box { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 14px; }
    .box h3 { margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; }
    .row { font-size: 13px; margin: 4px 0; }
    .row strong { color: #0f172a; }
    .money { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; border-bottom: 1px dashed #e2e8f0; }
    .money:last-child { border-bottom: none; font-weight: 700; }
    .footer { margin-top: 22px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; }
    @media print { body { margin: 14px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">TrustLink · Comprobante del Hogar</div>
      <div style="font-size:12px;color:#475569;">Respaldo auditable de servicio verificado y control perimetral</div>
    </div>
    <div class="code">
      <div><strong>${escapeHtml(receipt.receipt_code)}</strong></div>
      <div>Emitido: ${escapeHtml(formatDateAr(receipt.issued_at))}</div>
    </div>
  </div>

  <div class="grid">
    <div class="box">
      <h3>Comunidad y Residente</h3>
      <div class="row"><strong>Barrio:</strong> ${escapeHtml(community.name || '—')}</div>
      <div class="row"><strong>Titular:</strong> ${escapeHtml(resident.name || '—')}</div>
      <div class="row"><strong>DNI:</strong> ${escapeHtml(resident.dni || '—')}</div>
      <div class="row"><strong>Destino:</strong> ${escapeHtml([resident.fraction, resident.lot ? `Lote ${resident.lot}` : ''].filter(Boolean).join(' · ') || '—')}</div>
    </div>

    <div class="box">
      <h3>Prestador y Compliance Auditado</h3>
      <div class="row"><strong>Prestador:</strong> ${escapeHtml(provider.name || '—')}</div>
      <div class="row"><strong>DNI:</strong> ${escapeHtml(provider.dni || '—')} · <strong>Rubro:</strong> ${escapeHtml(provider.specialty || '—')}</div>
      <div class="row"><strong>Estado Compliance:</strong> ${escapeHtml(provider.compliance_status || '—')}</div>
      <div class="row"><strong>Vigencia ART:</strong> ${escapeHtml(formatDateOnlyAr(provider.insurance_expiry))}</div>
      <div class="row"><strong>Vigencia Antecedentes:</strong> ${escapeHtml(formatDateOnlyAr(provider.criminal_record_expiry))}</div>
    </div>
  </div>

  <div class="box" style="margin-bottom:16px;">
    <h3>Detalle del Servicio y Conformidad</h3>
    <div class="row"><strong>Contrato #${escapeHtml(contract.id)}:</strong> ${escapeHtml(contract.description || '—')}</div>
    <div class="row"><strong>Estado:</strong> ${escapeHtml(contract.status || '—')} · <strong>Creado:</strong> ${escapeHtml(formatDateAr(contract.created_at))}</div>
    <div class="row"><strong>Conformidad final:</strong> ${escapeHtml(contract.completed_at ? formatDateAr(contract.completed_at) : 'Pendiente de conformidad')}</div>
    ${contract.completion_notes ? `<div class="row"><strong>Notas de conformidad:</strong> ${escapeHtml(contract.completion_notes)}</div>` : ''}
    ${pass ? `<div class="row"><strong>Pase QR vinculado #${escapeHtml(pass.id)}:</strong> ${escapeHtml(pass.qr_token_masked || '—')} (${escapeHtml(pass.status || '—')})</div>` : ''}
  </div>

  <div class="box" style="margin-bottom:16px;">
    <h3>Resumen Financiero</h3>
    <div class="money"><span>Monto acordado</span><span>$${Number(payment.total_amount || 0).toLocaleString('es-AR')}</span></div>
    <div class="money"><span>Comisión plataforma TrustLink</span><span>$${Number(payment.platform_fee || 0).toLocaleString('es-AR')}</span></div>
    <div class="money"><span>Neto prestador</span><span>$${Number(payment.provider_payout || 0).toLocaleString('es-AR')}</span></div>
    <div class="money"><span>Modalidad / Estado</span><span>${escapeHtml(payment.gateway_provider || '—')} (${escapeHtml(payment.status || '—')})</span></div>
  </div>

  ${
    disputes.length > 0
      ? `<div class="box">
          <h3>Historial de Reclamos / Garantía (${disputes.length})</h3>
          ${disputes
            .map(
              (d) =>
                `<div class="row"><strong>#${escapeHtml(d.id)} (${escapeHtml(d.status)}):</strong> ${escapeHtml(d.reason)} — ${escapeHtml(d.details)}${d.resolution_notes ? ` | Resolución: ${escapeHtml(d.resolution_notes)}` : ''}</div>`
            )
            .join('')}
        </div>`
      : ''
  }

  <div class="footer">
    Documento generado electrónicamente por TrustLink. Conserva trazabilidad de habilitación documental, pase perimetral y conformidad del residente.
  </div>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

  // Inyección del HTML en la ventana emergente y cierre del stream para disparar `window.onload`.
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
