/**
 * @file QrCodeDisplay.jsx
 * @description Componente reutilizable que genera un código QR visual escaneable 100% local
 * en formato SVG vectorial codificando el enlace directo con `?qr_token=...` para Consola Garita.
 * @location /trustlink-web/src/components/QrCodeDisplay.jsx
 */

import React, { useState, useMemo } from 'react';
import { Check, Link2 } from 'lucide-react';
import { encodeQrMatrix } from '../utils/qrEncoder';

export function buildGateQrUrl(qrToken) {
  if (!qrToken) return '';
  if (typeof window === 'undefined') return String(qrToken);
  const url = new URL(window.location.origin);
  url.searchParams.set('qr_token', String(qrToken).trim());
  return url.toString();
}

export default function QrCodeDisplay({ token, size = 184, showLinkCopy = true }) {
  const [copiedLink, setCopiedLink] = useState(false);

  const gateUrl = useMemo(() => buildGateQrUrl(token), [token]);

  const qrSvgData = useMemo(() => {
    if (!gateUrl) return null;
    try {
      const { size: matrixSize, modules } = encodeQrMatrix(gateUrl);
      const quietZone = 2;
      const fullSize = matrixSize + quietZone * 2;
      const pathParts = [];

      for (let r = 0; r < matrixSize; r++) {
        const row = modules[r];
        for (let c = 0; c < matrixSize; c++) {
          if (row[c]) {
            pathParts.push(`M${c + quietZone},${r + quietZone}h1v1h-1z`);
          }
        }
      }

      return { fullSize, pathD: pathParts.join('') };
    } catch (err) {
      console.error('Error al generar matriz QR:', err);
      return null;
    }
  }, [gateUrl]);

  const handleCopyGateLink = async () => {
    if (!gateUrl) return;
    try {
      await navigator.clipboard.writeText(gateUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch (err) {
      console.error('No se pudo copiar el enlace QR:', err);
    }
  };

  if (!token) return null;

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="bg-white p-2.5 rounded-2xl shadow-md border border-slate-200 inline-flex items-center justify-center">
        {qrSvgData ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`0 0 ${qrSvgData.fullSize} ${qrSvgData.fullSize}`}
            width={size}
            height={size}
            shapeRendering="crispEdges"
            role="img"
            aria-label="Código QR de acceso TrustLink"
            className="block rounded-lg"
          >
            <rect width={qrSvgData.fullSize} height={qrSvgData.fullSize} fill="#FFFFFF" />
            <path d={qrSvgData.pathD} fill="#020617" />
          </svg>
        ) : (
          <div
            style={{ width: size, height: size }}
            className="flex items-center justify-center text-[11px] text-slate-500 font-semibold"
          >
            QR no disponible
          </div>
        )}
      </div>

      {showLinkCopy && gateUrl && (
        <button
          type="button"
          onClick={handleCopyGateLink}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 cursor-pointer"
          title="Copiar enlace directo de validación para Garita"
        >
          {copiedLink ? (
            <>
              <Check size={12} className="text-emerald-400" /> Enlace Garita copiado
            </>
          ) : (
            <>
              <Link2 size={12} className="text-sky-400" /> Copiar enlace Garita
            </>
          )}
        </button>
      )}
    </div>
  );
}
