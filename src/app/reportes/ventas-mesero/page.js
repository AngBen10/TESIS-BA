'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import ReportesNav from '@/components/ReportesNav';

const fmt = (n) => Number(n || 0).toLocaleString('es-PY');
const todayISO = () => new Date().toISOString().slice(0, 10);

const COLUMNS = [
    { key: 'rank', label: '#', align: 'left', numeric: true },
    { key: 'nombre', label: 'Mesero', align: 'left', numeric: false },
    { key: 'rol', label: 'Rol', align: 'left', numeric: false },
    { key: 'cheques', label: 'Cheques', align: 'right', numeric: true },
    { key: 'mesasAtendidas', label: 'Mesas', align: 'right', numeric: true },
    { key: 'unidadesVendidas', label: 'Uds.', align: 'right', numeric: true },
    { key: 'ventas', label: 'Ventas', align: 'right', numeric: true },
    { key: 'ticketPromedio', label: 'Ticket prom.', align: 'right', numeric: true },
    { key: 'pctDelTotal', label: '% del total', align: 'right', numeric: true },
];

export default function ReporteVentasMesero() {
    const router = useRouter();
    const [user, setUser] = useState(null);

    const [desde, setDesde] = useState(todayISO());
    const [hasta, setHasta] = useState(todayISO());

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [sortKey, setSortKey] = useState('ventas');
    const [sortDir, setSortDir] = useState('desc');

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
            const r = await fetch(`/api/reportes/ventas-mesero?${params}`);
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

    // ── Sorting ──────────────────────────────────────────────────────
    const meserosOrdenados = useMemo(() => {
        if (!data?.meseros) return [];
        const arr = [...data.meseros];
        arr.sort((a, b) => {
            if (sortKey === 'rank') {
                return sortDir === 'asc' ? a.ventas - b.ventas : b.ventas - a.ventas;
            }
            const va = a[sortKey];
            const vb = b[sortKey];
            if (typeof va === 'string' && typeof vb === 'string') {
                const cmp = va.localeCompare(vb, 'es');
                return sortDir === 'asc' ? cmp : -cmp;
            }
            const na = Number(va) || 0;
            const nb = Number(vb) || 0;
            return sortDir === 'asc' ? na - nb : nb - na;
        });
        return arr;
    }, [data, sortKey, sortDir]);

    const cambiarOrden = (key) => {
        if (sortKey === key) {
            setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            const col = COLUMNS.find(c => c.key === key);
            setSortKey(key);
            setSortDir(col?.numeric ? 'desc' : 'asc');
        }
    };

    // ── Atajos de rango ──────────────────────────────────────────────
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
        if (!meserosOrdenados.length) return;
        const num = (n) => (n == null ? '' : Number(n).toString().replace('.', ','));
        const esc = (v) => {
            const s = String(v ?? '');
            return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };

        const headers = ['Mesero', 'Usuario', 'Rol', 'Cheques', 'Mesas atendidas', 'Unidades', 'Ventas', 'Ticket promedio', '% del total'];
        const rows = meserosOrdenados.map(m => [
            m.nombre, m.usuario, m.rol,
            num(m.cheques), num(m.mesasAtendidas), num(m.unidadesVendidas),
            num(m.ventas), num(m.ticketPromedio), num(m.pctDelTotal),
        ]);
        const csv = [headers, ...rows].map(r => r.map(esc).join(';')).join('\r\n');

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ventas-mesero_${desde}_${hasta}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!user) return null;
    const resumen = data?.resumen;

    // Para el ranking visual
    const maxVentas = Math.max(1, ...meserosOrdenados.map(m => m.ventas));

    return (
        <div className="desktop-app">
            <Sidebar user={user} />
            <main className="main-view" style={{ padding: '1.5rem 2rem', overflowY: 'auto', height: '100vh' }}>

                {/* Header */}
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem', gap: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#fff' }}>👥 Ventas por Mesero</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                            Productividad del personal de sala — base para cálculo de comisiones, bonificaciones y asignación de zonas.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={cargar} disabled={loading} className="luxury-button" style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--border)', fontSize: '0.78rem', padding: '9px 18px' }}>
                            {loading ? '⏳ Cargando...' : '🔄 Refrescar'}
                        </button>
                        <button onClick={exportarCSV} disabled={!meserosOrdenados.length} className="luxury-button" style={{ background: 'var(--accent-gradient)', color: '#000', fontSize: '0.78rem', padding: '9px 18px', opacity: meserosOrdenados.length ? 1 : 0.4 }}>
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
                        <KpiCard label="Ventas del período" value={`Gs. ${fmt(resumen.totalVentas)}`} accent="var(--primary)" />
                        <KpiCard label="Cheques cerrados" value={fmt(resumen.totalCheques)} accent="#3b82f6" sub={`${resumen.cantidadMeseros} usuario${resumen.cantidadMeseros !== 1 ? 's' : ''}`} />
                        <KpiCard label="Ticket promedio gral." value={`Gs. ${fmt(resumen.ticketPromedioGeneral)}`} accent="#22c55e" />
                        <KpiCard label="Mesas atendidas" value={fmt(resumen.totalMesas)} accent="#f59e0b" sub="(no incluye presenciales)" />
                        <KpiCard
                            label="🏆 Top mesero"
                            value={resumen.topMesero ? resumen.topMesero.nombre : '—'}
                            accent="#fff"
                            sub={resumen.topMesero ? `Gs. ${fmt(resumen.topMesero.ventas)} · ${resumen.topMesero.pct}%` : 'Sin datos'}
                        />
                    </div>
                )}

                {/* Ranking visual */}
                {meserosOrdenados.length > 0 && (
                    <div style={panelStyle}>
                        <h3 style={panelTitle}>Ranking de ventas</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {meserosOrdenados.slice(0, 10).map((m, i) => {
                                const pct = (m.ventas / maxVentas) * 100;
                                return (
                                    <div key={m.meseroId} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ minWidth: '28px', textAlign: 'center', fontWeight: '900', fontSize: '0.8rem', color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : 'var(--text-muted)' }}>
                                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                        </div>
                                        <div style={{ minWidth: '160px', fontSize: '0.82rem', fontWeight: '700', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {m.nombre}
                                        </div>
                                        <div style={{ flex: 1, height: '24px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', position: 'relative', overflow: 'hidden' }}>
                                            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent-gradient)', transition: 'width 0.5s ease' }} />
                                            <div style={{ position: 'absolute', left: '10px', top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: '800', color: pct > 30 ? '#000' : '#fff', textShadow: pct > 30 ? 'none' : '0 1px 2px rgba(0,0,0,0.5)' }}>
                                                Gs. {fmt(m.ventas)} · {m.pctDelTotal}%
                                            </div>
                                        </div>
                                        <div style={{ minWidth: '90px', textAlign: 'right', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                            {m.cheques} cheques
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Tabla detallada */}
                <div style={{ background: 'rgba(10,12,15,0.5)', borderRadius: '14px', border: '1px solid rgba(0,210,190,0.06)', overflow: 'hidden' }}>
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
                            ) : meserosOrdenados.length === 0 ? (
                                <tr><td colSpan={COLUMNS.length} style={cellEmpty}>Sin ventas registradas en el período seleccionado.</td></tr>
                            ) : meserosOrdenados.map((m, i) => (
                                <tr key={m.meseroId} style={{ borderBottom: '1px solid rgba(255,255,255,0.025)' }}>
                                    <td style={{ ...cell, fontWeight: '700', color: 'var(--text-muted)', width: '40px' }}>{i + 1}</td>
                                    <td style={{ ...cell, fontWeight: '700' }}>
                                        {m.nombre}
                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '500', marginTop: '2px' }}>@{m.usuario}</div>
                                    </td>
                                    <td style={cell}>
                                        <span style={{ fontSize: '0.62rem', background: rolColorBg(m.rol), color: rolColorFg(m.rol), padding: '3px 8px', borderRadius: '5px', fontWeight: '700', border: `1px solid ${rolColorBd(m.rol)}` }}>
                                            {m.rol}
                                        </span>
                                    </td>
                                    <td style={cellNum}>{fmt(m.cheques)}</td>
                                    <td style={cellNum}>{fmt(m.mesasAtendidas)}</td>
                                    <td style={cellNum}>{fmt(m.unidadesVendidas)}</td>
                                    <td style={{ ...cellNum, color: 'var(--primary)', fontWeight: '700' }}>Gs. {fmt(m.ventas)}</td>
                                    <td style={cellNum}>Gs. {fmt(m.ticketPromedio)}</td>
                                    <td style={{ ...cellNum, fontWeight: '700' }}>{m.pctDelTotal}%</td>
                                </tr>
                            ))}
                        </tbody>
                        {resumen && meserosOrdenados.length > 0 && (
                            <tfoot style={{ background: '#0d0f14', borderTop: '2px solid var(--primary)' }}>
                                <tr>
                                    <td colSpan={3} style={{ ...cell, fontWeight: '900', textTransform: 'uppercase', fontSize: '0.7rem', color: 'var(--primary)' }}>TOTALES</td>
                                    <td style={{ ...cellNum, fontWeight: '900' }}>{fmt(resumen.totalCheques)}</td>
                                    <td style={{ ...cellNum, fontWeight: '900' }}>{fmt(resumen.totalMesas)}</td>
                                    <td style={{ ...cellNum, fontWeight: '900' }}>{fmt(resumen.totalUnidades)}</td>
                                    <td style={{ ...cellNum, fontWeight: '900', color: 'var(--primary)' }}>Gs. {fmt(resumen.totalVentas)}</td>
                                    <td style={{ ...cellNum, fontWeight: '900' }}>Gs. {fmt(resumen.ticketPromedioGeneral)}</td>
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

function rolColorBg(rol) {
    if (rol === 'Administrador') return 'rgba(245,158,11,0.1)';
    if (rol === 'Cajero') return 'rgba(59,130,246,0.1)';
    if (rol === 'Mesero') return 'rgba(0,210,190,0.08)';
    return 'rgba(255,255,255,0.05)';
}
function rolColorFg(rol) {
    if (rol === 'Administrador') return '#f59e0b';
    if (rol === 'Cajero') return '#3b82f6';
    if (rol === 'Mesero') return 'var(--primary)';
    return 'rgba(255,255,255,0.5)';
}
function rolColorBd(rol) {
    if (rol === 'Administrador') return 'rgba(245,158,11,0.2)';
    if (rol === 'Cajero') return 'rgba(59,130,246,0.2)';
    if (rol === 'Mesero') return 'rgba(0,210,190,0.12)';
    return 'rgba(255,255,255,0.08)';
}

// ── Estilos ─────────────────────────────────────────────────────────
const labelStyle = { fontSize: '0.6rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' };
const inputStyle = { padding: '8px 12px', fontSize: '0.85rem', height: '38px' };
const chipStyle = { padding: '7px 12px', fontSize: '0.68rem', fontWeight: '700', borderRadius: '8px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.5)' };

const panelStyle = { background: 'rgba(10,12,15,0.5)', borderRadius: '14px', border: '1px solid rgba(0,210,190,0.06)', padding: '1.2rem 1.4rem', marginBottom: '1.2rem' };
const panelTitle = { fontSize: '0.85rem', fontWeight: '800', color: '#fff', letterSpacing: '0.3px', marginBottom: '1rem' };

const cell = { padding: '10px 14px', fontSize: '0.82rem', color: '#fff' };
const cellNum = { padding: '10px 14px', fontSize: '0.82rem', color: '#fff', textAlign: 'right', whiteSpace: 'nowrap' };
const cellEmpty = { textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.85rem' };