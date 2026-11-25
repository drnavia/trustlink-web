/**
 * @file AuditView.jsx
 * @description Vista dedicada de Auditoría para `superadmin`, separada de la infraestructura técnica.
 * Homologada con `AdminPageHeader`, `AdminListToolbar` y `AdminPaginationBar` (`6 / 12 / 24 / 50`):
 * 1) Accesos en Garita: KPIs de validaciones (totales/autorizados/denegados), bitácora paginada,
 *    buscador, filtros predeterminados por resultado y exportación CSV.
 * 2) Contratos y Transacciones: resumen financiero (volumen bruto, comisión 7% y neto 93%),
 *    buscador, filtro por estado de pago, paginación homologada y exportación CSV.
 * @location /trustlink-web/src/modules/admin/AuditView.jsx
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ClipboardList, Receipt, AlertCircle, Download } from 'lucide-react';
import { useBranding, DEFAULT_BRANDING_CONFIG } from '../branding/BrandingContext';
import { useAuth } from '../auth/AuthContext';
import { API_BASE } from '../../config/api';
import {
  PAGE_SHELL_CLASS,
  SECTION_CARD_CLASS,
  getUnifiedStatusMeta,
} from '../../config/uiTokens';
import { downloadCsv } from '../../utils/csvExport';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminListToolbar from '../../components/admin/AdminListToolbar';
import AdminPaginationBar from '../../components/admin/AdminPaginationBar';
import { paginateItems } from '../../utils/adminPagination';

const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Formatea una fecha UTC a formato local legible `dd/mm hh:mm`.
 *
 * @param {string|number|null|undefined} value - Marca temporal.
 * @param {string} [timeZone=DEFAULT_TIMEZONE] - Zona horaria IANA.
 * @returns {string} Fecha formateada o `'—'`.
 */
function formatDateTime(value, timeZone = DEFAULT_TIMEZONE) {
  if (!value) return '—';
  const raw = String(value).trim();
  const hasOffsetOrZ = /([zZ]|[+-]\d{2}:?\d{2})$/.test(raw);
  const ms = Date.parse(hasOffsetOrZ ? raw : `${raw.replace(' ', 'T')}Z`);
  if (Number.isNaN(ms)) return '—';
  try {
    return new Date(ms).toLocaleString('es-AR', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date(ms).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

/**
 * Consola dedicada de Auditoría de Garita y Transacciones Financieras para `superadmin`.
 *
 * @returns {JSX.Element} Vista de auditoría y trazabilidad.
 */
export default function AuditView() {
  const { brand } = useBranding();
  const { user } = useAuth();
  const activeTimeZone = user?.timezone || user?.time_zone || DEFAULT_TIMEZONE;

  const cardStyle = {
    backgroundColor: brand?.cardBgColor || DEFAULT_BRANDING_CONFIG.cardBgColor,
    color: brand?.cardTextColor || DEFAULT_BRANDING_CONFIG.cardTextColor,
  };

  const innerStyle = {
    backgroundColor: brand?.innerBgColor || DEFAULT_BRANDING_CONFIG.innerBgColor,
    color: brand?.innerTextColor || DEFAULT_BRANDING_CONFIG.innerTextColor,
  };

  // Pestañas internas: 'gate' (Accesos en Garita) | 'transactions' (Contratos y Transacciones)
  const [activeTab, setActiveTab] = useState('gate');

  // Datos remotos de auditoría
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [auditError, setAuditError] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditOutcomeFilter, setAuditOutcomeFilter] = useState('all');
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(6);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditTotalCount, setAuditTotalCount] = useState(0);
  const [accessSummary, setAccessSummary] = useState({
    total_attempts: 0,
    authorized_count: 0,
    denied_count: 0,
  });
  const [accessLogs, setAccessLogs] = useState([]);

  // Transacciones financieras (filtros y paginación homologada 6 / 12 / 24 / 50)
  const [transactionsSummary, setTransactionsSummary] = useState({
    total_transactions: 0,
    gross_volume: 0,
    platform_fee_total: 0,
    provider_payout_total: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [txSearch, setTxSearch] = useState('');
  const [txStatusFilter, setTxStatusFilter] = useState('all');
  const [txPage, setTxPage] = useState(1);
  const [txPageSize, setTxPageSize] = useState(6);

  const getAuthHeaders = useCallback(
    () => ({
      Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
    }),
    []
  );

  /**
   * Consulta el panorama de auditoría de accesos y transacciones (`GET /api/v1/external/audit`).
   *
   * @param {number} [pageToLoad=auditPage] - Página de la bitácora de garita.
   * @param {string} [outcomeToLoad=auditOutcomeFilter] - Resultado (`all`, `authorized`, `denied`).
   * @param {string} [searchToLoad=auditSearch] - Texto de búsqueda.
   * @param {number} [limitToLoad=auditPageSize] - Eventos por página (`6/12/24/50`).
   * @returns {Promise<void>}
   */
  const fetchAuditOverview = useCallback(
    async (
      pageToLoad = auditPage,
      outcomeToLoad = auditOutcomeFilter,
      searchToLoad = auditSearch,
      limitToLoad = auditPageSize
    ) => {
      setLoadingAudit(true);
      setAuditError('');
      try {
        const params = new URLSearchParams({
          page: String(pageToLoad),
          limit: String(limitToLoad),
          outcome: outcomeToLoad,
          search: searchToLoad,
        });
        const res = await fetch(`${API_BASE}/api/v1/external/audit?${params.toString()}`, {
          headers: getAuthHeaders(),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setAccessSummary(
            data.access_summary || {
              total_attempts: 0,
              authorized_count: 0,
              denied_count: 0,
            }
          );
          setAccessLogs(Array.isArray(data.access_logs) ? data.access_logs : []);
          const pag = data.access_pagination || {};
          setAuditPage(pag.page || pageToLoad);
          setAuditTotalPages(pag.totalPages || 1);
          setAuditTotalCount(pag.total ?? (data.access_logs || []).length);

          setTransactionsSummary(
            data.transactions_summary || {
              total_transactions: 0,
              gross_volume: 0,
              platform_fee_total: 0,
              provider_payout_total: 0,
            }
          );
          setRecentTransactions(
            Array.isArray(data.recent_transactions) ? data.recent_transactions : []
          );
        } else {
          setAuditError(data.error || 'No se pudo cargar la auditoría del sistema.');
        }
      } catch (error) {
        console.error('Error al cargar auditoría:', error);
        setAuditError('Error de conexión al consultar auditoría.');
      } finally {
        setLoadingAudit(false);
      }
    },
    [auditPage, auditOutcomeFilter, auditSearch, auditPageSize, getAuthHeaders]
  );

  useEffect(() => {
    fetchAuditOverview(1, auditOutcomeFilter, auditSearch, auditPageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditOutcomeFilter, auditPageSize]);

  // Filtrado y paginación homologada para Transacciones
  const txCounts = useMemo(() => {
    return recentTransactions.reduce(
      (acc, tx) => {
        const st = String(tx.status || '').toLowerCase();
        acc.all += 1;
        if (st === 'released') acc.released += 1;
        else if (st === 'approved') acc.approved += 1;
        else if (st === 'pending') acc.pending += 1;
        return acc;
      },
      { all: 0, released: 0, approved: 0, pending: 0 }
    );
  }, [recentTransactions]);

  const filteredTransactions = useMemo(() => {
    const q = txSearch.trim().toLowerCase();
    return recentTransactions.filter((tx) => {
      if (txStatusFilter !== 'all' && String(tx.status || '').toLowerCase() !== txStatusFilter) {
        return false;
      }
      if (!q) return true;
      const hay = `${tx.id || ''} ${tx.contract_id || ''} ${tx.provider_name || ''} ${
        tx.status || ''
      }`.toLowerCase();
      return hay.includes(q);
    });
  }, [recentTransactions, txStatusFilter, txSearch]);

  const pagedTransactions = useMemo(
    () => paginateItems(filteredTransactions, txPage, txPageSize),
    [filteredTransactions, txPage, txPageSize]
  );

  return (
    <div className={`${PAGE_SHELL_CLASS} font-sans`}>
      <AdminPageHeader
        icon={<ClipboardList size={22} />}
        iconColorClass="text-indigo-300"
        title="Auditoría"
        subtitle="Bitácora de validaciones perimetrales en garita, contratos y movimientos financieros."
        tabs={[
          {
            id: 'gate',
            label: 'Accesos en Garita',
            icon: <ClipboardList size={14} />,
            count: Number(accessSummary.total_attempts || 0),
          },
          {
            id: 'transactions',
            label: 'Contratos y Transacciones',
            icon: <Receipt size={14} />,
            count: recentTransactions.length,
          },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onRefresh={() =>
          fetchAuditOverview(auditPage, auditOutcomeFilter, auditSearch, auditPageSize)
        }
        refreshing={loadingAudit}
        cardStyle={cardStyle}
        innerStyle={innerStyle}
      />

      {auditError && (
        <div className="flex items-center gap-2 bg-rose-950/60 border border-rose-800/80 text-rose-200 p-4 rounded-xl text-xs">
          <AlertCircle size={16} className="text-rose-400 shrink-0" />
          <span>{auditError}</span>
        </div>
      )}

      {/* ==================== PESTAÑA 1: ACCESOS EN GARITA ==================== */}
      {activeTab === 'gate' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <section className="border border-white/10 p-5 rounded-2xl shadow-sm" style={cardStyle}>
              <div className="text-xs opacity-80">Intentos de validación</div>
              <div className="text-2xl font-black font-mono mt-1">
                {accessSummary.total_attempts ?? 0}
              </div>
            </section>
            <section className="border border-white/10 p-5 rounded-2xl shadow-sm" style={cardStyle}>
              <div className="text-xs text-emerald-400">Autorizados</div>
              <div className="text-2xl font-black text-emerald-300 font-mono mt-1">
                {accessSummary.authorized_count ?? 0}
              </div>
            </section>
            <section className="border border-white/10 p-5 rounded-2xl shadow-sm" style={cardStyle}>
              <div className="text-xs text-rose-400">Denegados</div>
              <div className="text-2xl font-black text-rose-300 font-mono mt-1">
                {accessSummary.denied_count ?? 0}
              </div>
            </section>
          </div>

          <section className={SECTION_CARD_CLASS} style={cardStyle}>
            <AdminListToolbar
              searchValue={auditSearch}
              onSearchChange={setAuditSearch}
              onSearchSubmit={(overrideVal) => {
                const q = overrideVal !== undefined ? overrideVal : auditSearch;
                setAuditPage(1);
                fetchAuditOverview(1, auditOutcomeFilter, q, auditPageSize);
              }}
              searchPlaceholder="Buscar motivo, barrio, origen o token..."
              showSubmitButton
              chips={[
                { id: 'all', label: 'Todos', count: Number(accessSummary.total_attempts || 0) },
                {
                  id: 'authorized',
                  label: 'Autorizados',
                  count: Number(accessSummary.authorized_count || 0),
                },
                { id: 'denied', label: 'Denegados', count: Number(accessSummary.denied_count || 0) },
              ]}
              activeChip={auditOutcomeFilter}
              onChipChange={(nextOutcome) => {
                setAuditOutcomeFilter(nextOutcome);
                setAuditPage(1);
              }}
              hasActiveFilters={Boolean(auditSearch.trim() || auditOutcomeFilter !== 'all')}
              onResetFilters={() => {
                setAuditSearch('');
                setAuditOutcomeFilter('all');
                setAuditPage(1);
                fetchAuditOverview(1, 'all', '', auditPageSize);
              }}
              actions={
                <button
                  type="button"
                  disabled={accessLogs.length === 0}
                  onClick={() =>
                    downloadCsv(
                      `trustlink-auditoria-garita-${new Date().toISOString().slice(0, 10)}.csv`,
                      [
                        { key: 'id', label: 'ID' },
                        { key: 'created_at', label: 'Fecha' },
                        { key: 'authorized', label: 'Autorizado' },
                        { key: 'reason_code', label: 'Codigo' },
                        { key: 'integration_label', label: 'Origen' },
                        { key: 'auth_mode', label: 'Auth' },
                        { key: 'qr_token', label: 'Token' },
                        { key: 'message', label: 'Detalle' },
                      ],
                      accessLogs
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-white/15 cursor-pointer hover:opacity-90 disabled:opacity-40"
                  style={innerStyle}
                >
                  <Download size={13} /> Exportar CSV
                </button>
              }
              innerStyle={innerStyle}
            />

            {loadingAudit && accessLogs.length === 0 ? (
              <div className="text-center py-8 text-xs opacity-80">Cargando bitácora...</div>
            ) : accessLogs.length === 0 ? (
              <div
                className="text-center py-8 rounded-xl border border-white/10 text-xs opacity-80"
                style={innerStyle}
              >
                Sin registros de validación para los filtros aplicados.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10" style={innerStyle}>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 opacity-75">
                      <th className="py-2.5 px-3 font-semibold">Resultado</th>
                      <th className="py-2.5 px-3 font-semibold">Motivo</th>
                      <th className="py-2.5 px-3 font-semibold">Barrio / Origen</th>
                      <th className="py-2.5 px-3 font-semibold">Mensaje</th>
                      <th className="py-2.5 px-3 font-semibold">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {accessLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="py-2.5 px-3">
                          {log.authorized ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                              Autorizado
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                              Denegado
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-amber-300">
                          {log.reason_code}
                        </td>
                        <td className="py-2.5 px-3">
                          {log.country_name || log.integration_label || '—'}
                        </td>
                        <td className="py-2.5 px-3 opacity-85">{log.message}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] opacity-80 whitespace-nowrap">
                          {formatDateTime(log.created_at, activeTimeZone)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <AdminPaginationBar
              page={auditPage}
              totalPages={auditTotalPages}
              totalItems={auditTotalCount}
              pageSize={auditPageSize}
              onPageChange={(nextPage) =>
                fetchAuditOverview(nextPage, auditOutcomeFilter, auditSearch, auditPageSize)
              }
              onPageSizeChange={(nextSize) => {
                setAuditPageSize(nextSize);
                setAuditPage(1);
              }}
              loading={loadingAudit}
              itemLabel="evento(s)"
              innerStyle={innerStyle}
            />
          </section>
        </div>
      )}

      {/* ==================== PESTAÑA 2: CONTRATOS Y TRANSACCIONES ==================== */}
      {activeTab === 'transactions' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <section className="border border-white/10 p-5 rounded-2xl shadow-sm" style={cardStyle}>
              <div className="text-xs opacity-80">Volumen bruto</div>
              <div className="text-2xl font-black font-mono mt-1">
                ${transactionsSummary.gross_volume ?? 0}
              </div>
            </section>
            <section className="border border-white/10 p-5 rounded-2xl shadow-sm" style={cardStyle}>
              <div className="text-xs text-emerald-400">Comisión plataforma (7%)</div>
              <div className="text-2xl font-black text-emerald-300 font-mono mt-1">
                ${transactionsSummary.platform_fee_total ?? 0}
              </div>
            </section>
            <section className="border border-white/10 p-5 rounded-2xl shadow-sm" style={cardStyle}>
              <div className="text-xs text-sky-400">Neto prestadores (93%)</div>
              <div className="text-2xl font-black text-sky-300 font-mono mt-1">
                ${transactionsSummary.provider_payout_total ?? 0}
              </div>
            </section>
          </div>

          <section className={SECTION_CARD_CLASS} style={cardStyle}>
            <AdminListToolbar
              searchValue={txSearch}
              onSearchChange={(val) => {
                setTxSearch(val);
                setTxPage(1);
              }}
              searchPlaceholder="Buscar por #Tx, #contrato o prestador..."
              chips={[
                { id: 'all', label: 'Todas', count: txCounts.all },
                { id: 'released', label: 'Liberadas', count: txCounts.released },
                { id: 'approved', label: 'Aprobadas', count: txCounts.approved },
                { id: 'pending', label: 'Pendientes', count: txCounts.pending },
              ]}
              activeChip={txStatusFilter}
              onChipChange={(chip) => {
                setTxStatusFilter(chip);
                setTxPage(1);
              }}
              hasActiveFilters={Boolean(txSearch.trim() || txStatusFilter !== 'all')}
              onResetFilters={() => {
                setTxSearch('');
                setTxStatusFilter('all');
                setTxPage(1);
              }}
              actions={
                <button
                  type="button"
                  disabled={filteredTransactions.length === 0}
                  onClick={() =>
                    downloadCsv(
                      `trustlink-transacciones-${new Date().toISOString().slice(0, 10)}.csv`,
                      [
                        { key: 'id', label: 'ID' },
                        { key: 'contract_id', label: 'Contrato' },
                        { key: 'provider_name', label: 'Prestador' },
                        { key: 'gross_amount', label: 'Bruto' },
                        { key: 'platform_fee', label: 'Comision Plataforma' },
                        { key: 'provider_payout', label: 'Neto Prestador' },
                        { key: 'status', label: 'Estado' },
                        { key: 'created_at', label: 'Fecha' },
                      ],
                      filteredTransactions
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-white/15 cursor-pointer hover:opacity-90 disabled:opacity-40"
                  style={innerStyle}
                >
                  <Download size={13} /> Exportar CSV
                </button>
              }
              innerStyle={innerStyle}
            />

            {pagedTransactions.pageItems.length === 0 ? (
              <div
                className="text-center py-8 rounded-xl border border-white/10 text-xs opacity-80"
                style={innerStyle}
              >
                No hay transacciones registradas para los filtros actuales.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10" style={innerStyle}>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 opacity-75">
                      <th className="py-2.5 px-3 font-semibold">Tx</th>
                      <th className="py-2.5 px-3 font-semibold">Contrato</th>
                      <th className="py-2.5 px-3 font-semibold">Prestador</th>
                      <th className="py-2.5 px-3 font-semibold">Bruto</th>
                      <th className="py-2.5 px-3 font-semibold">Comisión (7%)</th>
                      <th className="py-2.5 px-3 font-semibold">Neto (93%)</th>
                      <th className="py-2.5 px-3 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {pagedTransactions.pageItems.map((tx) => {
                      const statusMeta = getUnifiedStatusMeta(tx.status, 'generic');
                      return (
                        <tr key={tx.id}>
                          <td className="py-2.5 px-3 font-mono">#{tx.id}</td>
                          <td className="py-2.5 px-3 font-mono">#{tx.contract_id}</td>
                          <td className="py-2.5 px-3 font-semibold">{tx.provider_name || '—'}</td>
                          <td className="py-2.5 px-3 font-mono">${tx.gross_amount}</td>
                          <td className="py-2.5 px-3 font-mono text-emerald-300">
                            ${tx.platform_fee}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-sky-300">
                            ${tx.provider_payout}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusMeta.cls}`}
                            >
                              {statusMeta.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <AdminPaginationBar
              page={pagedTransactions.safePage}
              totalPages={pagedTransactions.totalPages}
              totalItems={pagedTransactions.totalItems}
              pageSize={txPageSize}
              onPageChange={setTxPage}
              onPageSizeChange={(nextSize) => {
                setTxPageSize(nextSize);
                setTxPage(1);
              }}
              itemLabel="transacción(es)"
              innerStyle={innerStyle}
            />
          </section>
        </div>
      )}
    </div>
  );
}
