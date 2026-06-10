'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import ReportesNav from '@/components/ReportesNav';

const fmt = (n) => Number(n || 0).toLocaleString('es-PY');
const todayISO = () => new Date().toISOString().slice(0, 10);

const COLUMNS = [
    { key: 'numero', label: 'Mesa', align: 'left', numeric: true },
    { key: 'capacidad', label: 'Cap.', align: 'right', numeric: true },
    { key: 'cheques', label: 'Cheques', align: 'right', numeric: true },
    { key: 'rotacionPorDia', label: 'Rotación/día', align: 'right', numeric: true },
    { key: 'diasConActividad', label: 'Días activos', align: 'right', numeric: true },
    { key: 'ventas', label: 'Ventas', align: 'right', numeric: true },
    { key: 'ticketPromedio', label: 'Ticket prom.', align: 'right', numeric: true },
    { key: 'ventaPorAsiento', label: 'Venta/asiento', align: 'right', numeric: true },
    { key: 'pctDelTotal', label: '% del total', align: 'right', numeric: true },
];

export default function ReporteVentasMesa() {
    const router = useRouter();
    const [user, setUser] = useState(null);

    const [desde, setDesde] = useState(todayISO());
    const [hasta, setHasta] = useState(todayISO());

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [sortKey, setSortKey] = useState('ventas');
    const [sortDir, setSortDir] = useState('desc');
    const [soloActivas, setSoloActivas] = useState(false);

    // ── Auth ─────────────────────────────────────────────────────────
    useEffect(() => {
        const stored = localStorage.getItem('user');
        if (!stored) { router.push('/login'); return; }
        const parsed = JSON.parse(stored);
        if (parsed.roleId !== 1) { router.push('/'); return; }
        setUser(parsed);
    }, [router]);

    // ── Cargar reporte ───────────────────────────────────────────────
    const cargar = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({ desde, hasta });
            const r = await fetch(`/api/reportes/ventas-mesa?${params}`);
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Error al cargar el reporte');
            setData(d);
        } catch (e) {
            setError(e.message);
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [desde, hasta]);

    useEffect(() => {
        if (user) cargar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // ── Sorting + filtro de "solo activas" ───────────────────────────
    const mesasOrdenadas = useMemo(() => {
        if (!data?.mesas) return [];
        let arr = [...data.mesas];
        if (soloActivas) arr = arr.filter(m => m.tieneActividad);
        arr.sort((a, b) => {
            const va = a[sortKey];
            const vb = b[sortKey];
            const na = Number(va) || 0;
            const nb = Number(vb) || 0;
            return sortDir === 'asc' ? na - nb : nb - na;
        });
        return arr;
    }, [data, sortKey, sortDir, soloActivas]);

    // Para el grid visual SIEMPRE mostramos todas las mesas, ordenadas por número.
    const mesasGrid = useMemo(() => {
        if (!data?.mesas) return [];
        return [...data.mesas].sort((a, b) => a.numero - b.numero);
    }, [data]);

    const cambiarOrden = (key) => {
        if (sortKey === key) {
            setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };

    // ── Atajos ───────────────────────────────────────────────────────
    const setRango = (tipo) => {
        const hoy = new Date();
        const iso = (d) => d.toISOString().slice(0, 10);
        if (tipo === 'hoy') { setDesde(iso(hoy)); setHasta(iso(hoy)); }
        else if (tipo === 'ayer') { const a = new Date(hoy); a.setDate(a.getDate() - 1); setDesde(iso(a)); setHasta(iso(a)); }
        else if (tipo === '7d') { const a = new Date(hoy); a.setDate(a.getDate() - 6); setDesde(iso(a)); setHasta(iso(hoy)); }
        else if (tipo === '30d') { const a = new Date(hoy); a.setDate(a.getDate() - 29); setDesde(iso(a)); setHasta(iso(hoy)); }
        else if (tipo === 'mes') { const a = new Date(hoy.getFullYear(), hoy.getMonth(), 1); setDesde(iso(a)); setHasta(iso(hoy)); }
    };

    // ── Export CSV ────────────────────────────────────────────────────
    const exportarCSV = () => {
        if (!mesasOrdenadas.length) return;
        const num = (n) => (n == null ? '' : Number(n).toString().replace('.', ','));
        const esc = (v) => {
            const s = String(v ?? '');
            return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };

        const headers = ['Mesa', 'Capacidad', 'Cheques', 'Rotación/día', 'Días con actividad', 'Ventas', 'Ticket promedio', 'Venta por asiento', '% del total'];
        const rows = mesasOrdenadas.map(m => [
            `Mesa ${m.numero}`, num(m.capacidad), num(m.cheques),
            num(m.rotacionPorDia), num(m.diasConActividad),
            num(m.ventas), num(m.ticketPromedio), num(m.ventaPorAsiento), num(m.pctDelTotal),
        ]);
        const csv = [headers, ...rows].map(r => r.map(esc).join(';')).join('\r\n');

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ventas-mesa_${desde}_${hasta}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!user) return null;
    const resumen = data?.resumen;
    const maxVentasMesa = Math.max(1, ...mesasGrid.map(m => m.ventas));

    return (
        <div className="desktop-app">
            <Sidebar user={user} />
            <main className="main-view" style={{ padding: '1.5rem 2rem', overflowY: 'auto', height: '100vh' }}>

                {/* Header */}
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem', gap: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#fff' }}>🍽️ Ventas por Mesa</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                            Rendimiento por mesa — identifica las mesas con mayor rotación, asienta a tus mejores meseros en las zonas calientes.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={cargar} disabled={loading} className="luxury-button" style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--border)', fontSize: '0.78rem', padding: '9px 18px' }}>
                            {loading ? '⏳ Cargando...' : '🔄 Refrescar'}
                        </button>
                        <button onClick={exportarCSV} disabled={!mesasOrdenadas.length} className="luxury-button" style={{ background: 'var(--accent-gradient)', color: '#000', fontSize: '0.78rem', padding: '9px 18px', opacity: mesasOrdenadas.length ? 1 : 0.4 }}>
                            ⬇️ Exportar CSV
                        </button>
                    </div>
                </header>

                <ReportesNav />

                {/* Filtros */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end', background: 'rgba(8,10,14,0.6)', border: '1px solid rgba(0,210,190,0.08)', borderRadius: '14px', padding: '1rem 1.2rem', marginBottom: '1.2rem' }}>
                    <div>
                        <label style={labelStyle}>Desde</label>
                        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="luxury-input" style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Hasta</label>
                        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="luxury-input" style={inputStyle} />
                    </div>
                    <button onClick={cargar} disabled={loading} className="luxury-button" style={{ background: 'var(--primary)', color: '#000', fontSize: '0.78rem', padding: '9px 18px', height: '38px' }}>
                        Aplicar
                    </button>
                    <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                        {['hoy', 'ayer', '7d', '30d', 'mes'].map(r => (
                            <button key={r} onClick={() => setRango(r)} style={chipStyle}>
                                {r === 'hoy' ? 'Hoy' : r === 'ayer' ? 'Ayer' : r === '7d' ? 'Últimos 7d' : r === '30d' ? 'Últimos 30d' : 'Este mes'}
                            </button>
                        ))}
                    </div>
                </div>

                {error && (
                    <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '0.8rem 1rem', marginBottom: '1rem', color: '#ef4444', fontSize: '0.82rem' }}>
                        ⚠ {error}
                    </div>
                )}

                {/* KPIs */}
                {resumen && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px', marginBottom: '1.2rem' }}>
                        <KpiCard label="Ventas en mesas" value={`Gs. ${fmt(resumen.totalVentas)}`} accent="var(--primary)" sub={`${resumen.totalCheques} cheques`} />
                        <KpiCard label="Ticket promedio" value={`Gs. ${fmt(resumen.ticketPromedio)}`} accent="#3b82f6" />
                        <KpiCard label="Capacidad del salón" value={`${resumen.capacidadSalon} asientos`} accent="#fff" sub={`${resumen.cantidadMesas} mesas`} />
                        <KpiCard label="Venta por asiento" value={`Gs. ${fmt(resumen.ventaPorAsientoGeneral)}`} accent="#22c55e" />
                        <KpiCard
                            label="🏆 Mesa top"
                            value={resumen.mesaTop ? `Mesa ${resumen.mesaTop.numero}` : '—'}
                            accent="#fbbf24"
                            sub={resumen.mesaTop ? `Gs. ${fmt(resumen.mesaTop.ventas)} · ${resumen.mesaTop.pct}%` : 'Sin datos'}
                        />
                        <KpiCard
                            label="🔄 Mayor rotación"
                            value={resumen.mesaMasRotacion ? `Mesa ${resumen.mesaMasRotacion.numero}` : '—'}
                            accent="#f59e0b"
                            sub={resumen.mesaMasRotacion ? `${resumen.mesaMasRotacion.rotacion} cheques/día` : 'Sin datos'}
                        />
                    </div>
                )}

                {/* Aviso de ventas presenciales */}
                {resumen?.presencial?.cheques > 0 && (
                    <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '10px', padding: '10px 16px', marginBottom: '1.2rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)' }}>
                        ℹ Adicionalmente hay <strong style={{ color: '#3b82f6' }}>Gs. {fmt(resumen.presencial.ventas)}</strong> de ventas presenciales (mostrador, sin mesa) en {resumen.presencial.cheques} {resumen.presencial.cheques === 1 ? 'cheque' : 'cheques'} — no incluidas en el reporte de mesas.
                    </div>
                )}

                {/* Grid visual de mesas */}
                {mesasGrid.length > 0 && (
                    <div style={panelStyle}>
                        <h3 style={panelTitle}>Plano del salón</h3>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                            Intensidad de color = volumen de ventas. Mesas grises = sin actividad en el período.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '10px' }}>
                            {mesasGrid.map(m => {
                                const intensity = m.tieneActividad ? Math.max(0.15, m.ventas / maxVentasMesa) : 0;
                                const bg = m.tieneActividad
                                    ? `rgba(0, 210, 190, ${0.1 + intensity * 0.55})`
                                    : 'rgba(255,255,255,0.03)';
                                const border = m.tieneActividad
                                    ? `1px solid rgba(0, 210, 190, ${0.3 + intensity * 0.5})`
                                    : '1px solid rgba(255,255,255,0.05)';
                                return (
                                    <div
                                        key={m.mesaId}
                                        title={m.tieneActividad
                                            ? `Mesa ${m.numero} (${m.capacidad} pers.)\n${m.cheques} cheques · Gs. ${fmt(m.ventas)}\nTicket prom.: Gs. ${fmt(m.ticketPromedio)}\nRotación: ${m.rotacionPorDia}/día`
                                            : `Mesa ${m.numero} (${m.capacidad} pers.) — sin actividad`}
                                        style={{ background: bg, border, borderRadius: '10px', padding: '10px 12px', transition: 'transform 0.15s', cursor: 'help' }}
                                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '0.95rem', fontWeight: '900', color: m.tieneActividad ? '#fff' : 'var(--text-muted)' }}>
                                                Mesa {m.numero}
                                            </span>
                                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                                                👥 {m.capacidad}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: '0.78rem', fontWeight: '800', color: m.tieneActividad ? 'var(--primary)' : 'rgba(255,255,255,0.2)', marginBottom: '2px' }}>
                                            Gs. {fmt(m.ventas)}
                                        </p>
                                        <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                                            {m.cheques} {m.cheques === 1 ? 'cheque' : 'cheques'}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Tabla detallada con toggle */}
                <div style={{ background: 'rgba(10,12,15,0.5)', borderRadius: '14px', border: '1px solid rgba(0,210,190,0.06)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <h3 style={{ fontSize: '0.8rem', fontWeight: '800', color: '#fff', margin: 0 }}>Detalle por mesa</h3>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', userSelect: 'none' }}>
                            <input type="checkbox" checked={soloActivas} onChange={e => setSoloActivas(e.target.checked)} style={{ width: '14px', height: '14px', accentColor: 'var(--primary)' }} />
                            Solo mesas con actividad
                        </label>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: '#0d0f14' }}>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                {COLUMNS.map(col => {
                                    const active = sortKey === col.key;
                                    return (
                                        <th
                                            key={col.key}
                                            onClick={() => cambiarOrden(col.key)}
                                            style={{ padding: '10px 14px', fontSize: '0.6rem', color: active ? 'var(--primary)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '800', textAlign: col.align, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                                        >
                                            {col.label}
                                            {active && <span style={{ marginLeft: '4px' }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={COLUMNS.length} style={cellEmpty}>Cargando datos...</td></tr>
                            ) : mesasOrdenadas.length === 0 ? (
                                <tr><td colSpan={COLUMNS.length} style={cellEmpty}>
                                    {soloActivas ? 'No hubo actividad en ninguna mesa en el período seleccionado.' : 'No hay mesas registradas.'}
                                </td></tr>
                            ) : mesasOrdenadas.map(m => (
                                <tr key={m.mesaId} style={{ borderBottom: '1px solid rgba(255,255,255,0.025)', opacity: m.tieneActividad ? 1 : 0.45 }}>
                                    <td style={{ ...cell, fontWeight: '700' }}>Mesa {m.numero}</td>
                                    <td style={cellNum}>{m.capacidad}</td>
                                    <td style={cellNum}>{fmt(m.cheques)}</td>
                                    <td style={cellNum}>{m.rotacionPorDia}</td>
                                    <td style={cellNum}>{m.diasConActividad}</td>
                                    <td style={{ ...cellNum, color: m.tieneActividad ? 'var(--primary)' : 'var(--text-muted)', fontWeight: '700' }}>Gs. {fmt(m.ventas)}</td>
                                    <td style={cellNum}>Gs. {fmt(m.ticketPromedio)}</td>
                                    <td style={cellNum}>Gs. {fmt(m.ventaPorAsiento)}</td>
                                    <td style={{ ...cellNum, fontWeight: '700' }}>{m.pctDelTotal}%</td>
                                </tr>
                            ))}
                        </tbody>
                        {resumen && mesasOrdenadas.length > 0 && (
                            <tfoot style={{ background: '#0d0f14', borderTop: '2px solid var(--primary)' }}>
                                <tr>
                                    <td style={{ ...cell, fontWeight: '900', textTransform: 'uppercase', fontSize: '0.7rem', color: 'var(--primary)' }}>TOTALES</td>
                                    <td style={{ ...cellNum, fontWeight: '900' }}>{resumen.capacidadSalon}</td>
                                    <td style={{ ...cellNum, fontWeight: '900' }}>{fmt(resumen.totalCheques)}</td>
                                    <td colSpan={2}></td>
                                    <td style={{ ...cellNum, fontWeight: '900', color: 'var(--primary)' }}>Gs. {fmt(resumen.totalVentas)}</td>
                                    <td style={{ ...cellNum, fontWeight: '900' }}>Gs. {fmt(resumen.ticketPromedio)}</td>
                                    <td style={{ ...cellNum, fontWeight: '900' }}>Gs. {fmt(resumen.ventaPorAsientoGeneral)}</td>
                                    <td style={{ ...cellNum, fontWeight: '900' }}>100%</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </main>
        </div>
    );
}

// ── Helpers ─────────────────────────────────────────────────────────
function KpiCard({ label, value, accent, sub }) {
    return (
        <div style={{ background: 'rgba(8,10,14,0.8)', border: '1px solid rgba(0,210,190,0.1)', borderRadius: '14px', padding: '14px 16px' }}>
            <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '700', marginBottom: '6px' }}>{label}</p>
            <p style={{ fontSize: '1.1rem', fontWeight: '900', color: accent, letterSpacing: '0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</p>
            {sub && <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '2px' }}>{sub}</p>}
        </div>
    );
}

// ── Estilos ─────────────────────────────────────────────────────────
const labelStyle = { fontSize: '0.6rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' };
const inputStyle = { padding: '8px 12px', fontSize: '0.85rem', height: '38px' };
const chipStyle = { padding: '7px 12px', fontSize: '0.68rem', fontWeight: '700', borderRadius: '8px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.5)' };

const panelStyle = { background: 'rgba(10,12,15,0.5)', borderRadius: '14px', border: '1px solid rgba(0,210,190,0.06)', padding: '1.2rem 1.4rem', marginBottom: '1.2rem' };
const panelTitle = { fontSize: '0.85rem', fontWeight: '800', color: '#fff', letterSpacing: '0.3px', marginBottom: '0.4rem' };

const cell = { padding: '10px 14px', fontSize: '0.82rem', color: '#fff' };
const cellNum = { padding: '10px 14px', fontSize: '0.82rem', color: '#fff', textAlign: 'right', whiteSpace: 'nowrap' };
const cellEmpty = { textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.85rem' };