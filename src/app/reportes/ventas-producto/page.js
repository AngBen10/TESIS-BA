'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import ReportesNav from '@/components/ReportesNav';

const fmt = (n) => Number(n || 0).toLocaleString('es-PY');
const todayISO = () => new Date().toISOString().slice(0, 10);

// ── Columnas configurables para sorting ─────────────────────────────
const COLUMNS = [
    { key: 'codigo', label: 'Código', align: 'left', numeric: false },
    { key: 'producto', label: 'Producto', align: 'left', numeric: false },
    { key: 'categoria', label: 'Categoría', align: 'left', numeric: false },
    { key: 'unidadesVendidas', label: 'Uds.', align: 'right', numeric: true },
    { key: 'precioPromedio', label: 'Precio prom.', align: 'right', numeric: true },
    { key: 'costoUnitarioPromedio', label: 'Costo unit.', align: 'right', numeric: true },
    { key: 'ingresos', label: 'Ingresos', align: 'right', numeric: true },
    { key: 'costoTotal', label: 'Costo total', align: 'right', numeric: true },
    { key: 'margenGs', label: 'Margen Gs.', align: 'right', numeric: true },
    { key: 'margenPct', label: 'Margen %', align: 'right', numeric: true },
    { key: 'pctDelTotal', label: '% del total', align: 'right', numeric: true },
];

export default function ReporteVentasProducto() {
    const router = useRouter();
    const [user, setUser] = useState(null);

    // Filtros
    const [desde, setDesde] = useState(todayISO());
    const [hasta, setHasta] = useState(todayISO());
    const [categorias, setCategorias] = useState([]);
    const [categoriaId, setCategoriaId] = useState('');

    // Datos
    const [data, setData] = useState(null);  // { resumen, productos }
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Sorting
    const [sortKey, setSortKey] = useState('ingresos');
    const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'

    // ── Auth + carga inicial de categorías ───────────────────────────
    useEffect(() => {
        const stored = localStorage.getItem('user');
        if (!stored) { router.push('/login'); return; }
        const parsed = JSON.parse(stored);
        if (parsed.roleId !== 1) { router.push('/'); return; } // solo admin
        setUser(parsed);

        fetch('/api/categorias')
            .then(r => r.json())
            .then(d => setCategorias(Array.isArray(d) ? d : []))
            .catch(() => { });
    }, [router]);

    // ── Cargar reporte ───────────────────────────────────────────────
    const cargar = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({ desde, hasta });
            if (categoriaId) params.set('categoriaId', categoriaId);

            const r = await fetch(`/api/reportes/ventas-producto?${params}`);
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Error al cargar el reporte');
            setData(d);
        } catch (e) {
            setError(e.message);
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [desde, hasta, categoriaId]);

    useEffect(() => {
        if (user) cargar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // ── Sorting derivado ─────────────────────────────────────────────
    const productosOrdenados = useMemo(() => {
        if (!data?.productos) return [];
        const arr = [...data.productos];
        arr.sort((a, b) => {
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

    // ── Exportar CSV ─────────────────────────────────────────────────
    // Formato pensado para Excel en español (Windows/Office regional ES):
    //   - Separador: punto y coma (;)
    //   - Decimales con coma (1234,56)
    //   - BOM UTF-8 para que los acentos no se rompan
    //   - CRLF entre filas
    const exportarCSV = () => {
        if (!productosOrdenados.length) return;

        const num = (n) => {
            if (n == null || n === '') return '';
            return Number(n).toString().replace('.', ',');
        };
        const esc = (v) => {
            const s = String(v ?? '');
            return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };

        const headers = ['Código', 'Producto', 'Categoría', 'Unidades', 'Precio prom.', 'Costo unit. prom.', 'Ingresos', 'Costo total', 'Margen Gs.', 'Margen %', '% del total'];

        const rows = productosOrdenados.map(p => [
            p.codigo, p.producto, p.categoria,
            num(p.unidadesVendidas), num(p.precioPromedio), num(p.costoUnitarioPromedio),
            num(p.ingresos), num(p.costoTotal), num(p.margenGs), num(p.margenPct), num(p.pctDelTotal),
        ]);

        const csv = [headers, ...rows].map(r => r.map(esc).join(';')).join('\r\n');

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ventas-producto_${desde}_${hasta}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const setRango = (tipo) => {
        const hoy = new Date();
        const iso = (d) => d.toISOString().slice(0, 10);
        if (tipo === 'hoy') {
            setDesde(iso(hoy)); setHasta(iso(hoy));
        } else if (tipo === 'ayer') {
            const a = new Date(hoy); a.setDate(a.getDate() - 1);
            setDesde(iso(a)); setHasta(iso(a));
        } else if (tipo === '7d') {
            const a = new Date(hoy); a.setDate(a.getDate() - 6);
            setDesde(iso(a)); setHasta(iso(hoy));
        } else if (tipo === 'mes') {
            const a = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            setDesde(iso(a)); setHasta(iso(hoy));
        }
    };

    if (!user) return null;

    const resumen = data?.resumen;

    return (
        <div className="desktop-app">
            <Sidebar user={user} />
            <main className="main-view" style={{ padding: '1.5rem 2rem', overflowY: 'auto', height: '100vh' }}>

                {/* Header */}
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem', gap: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#fff' }}>📊 Ventas Diarias por Producto</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                            Unidades vendidas, ingresos y margen estimado por producto en el período seleccionado.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={cargar} disabled={loading} className="luxury-button" style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--border)', fontSize: '0.78rem', padding: '9px 18px' }}>
                            {loading ? '⏳ Cargando...' : '🔄 Refrescar'}
                        </button>
                        <button onClick={exportarCSV} disabled={!productosOrdenados.length} className="luxury-button" style={{ background: 'var(--accent-gradient)', color: '#000', fontSize: '0.78rem', padding: '9px 18px', opacity: productosOrdenados.length ? 1 : 0.4 }}>
                            ⬇️ Exportar CSV
                        </button>
                    </div>
                </header>

                {/* Barra de navegación entre reportes */}
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
                    <div>
                        <label style={labelStyle}>Categoría</label>
                        <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)} className="luxury-input" style={{ ...inputStyle, cursor: 'pointer', minWidth: '160px' }}>
                            <option value="" style={{ background: '#000' }}>Todas</option>
                            {categorias.map(c => (
                                <option key={c.Id} value={c.Id} style={{ background: '#000' }}>{c.Nombre}</option>
                            ))}
                        </select>
                    </div>
                    <button onClick={cargar} disabled={loading} className="luxury-button" style={{ background: 'var(--primary)', color: '#000', fontSize: '0.78rem', padding: '9px 18px', height: '38px' }}>
                        Aplicar
                    </button>
                    <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                        {['hoy', 'ayer', '7d', 'mes'].map(r => (
                            <button key={r} onClick={() => setRango(r)} style={chipStyle}>
                                {r === 'hoy' ? 'Hoy' : r === 'ayer' ? 'Ayer' : r === '7d' ? 'Últimos 7d' : 'Este mes'}
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
                        <KpiCard label="Ingresos del período" value={`Gs. ${fmt(resumen.totalIngresos)}`} accent="var(--primary)" />
                        <KpiCard label="Costo total" value={`Gs. ${fmt(resumen.totalCosto)}`} accent="#f59e0b" />
                        <KpiCard label="Margen Gs." value={`Gs. ${fmt(resumen.margenTotalGs)}`} accent="#22c55e" />
                        <KpiCard label="Margen %" value={`${resumen.margenTotalPct}%`} accent="#3b82f6" />
                        <KpiCard label="Unidades" value={fmt(resumen.totalUnidades)} accent="#fff" />
                        <KpiCard label="Ticket promedio" value={`Gs. ${fmt(resumen.ticketPromedio)}`} accent="#fff" sub={`${resumen.cantidadFacturas} facturas`} />
                    </div>
                )}

                {/* Tabla */}
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
                            ) : productosOrdenados.length === 0 ? (
                                <tr><td colSpan={COLUMNS.length} style={cellEmpty}>Sin ventas en el período seleccionado.</td></tr>
                            ) : productosOrdenados.map(p => (
                                <tr key={p.productoId} style={{ borderBottom: '1px solid rgba(255,255,255,0.025)' }}>
                                    <td style={cellMuted}>{p.codigo || '—'}</td>
                                    <td style={{ ...cell, fontWeight: '600' }}>
                                        {p.producto}
                                        {!p.tieneCosto && (
                                            <span title="Producto sin receta cargada — el margen no incluye costo de insumos"
                                                style={{ marginLeft: '6px', fontSize: '0.55rem', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                                                SIN RECETA
                                            </span>
                                        )}
                                    </td>
                                    <td style={cell}>
                                        <span style={{ fontSize: '0.62rem', background: 'rgba(0,210,190,0.08)', color: 'var(--primary)', padding: '3px 8px', borderRadius: '5px', fontWeight: '700', border: '1px solid rgba(0,210,190,0.12)' }}>
                                            {p.categoria}
                                        </span>
                                    </td>
                                    <td style={cellNum}>{fmt(p.unidadesVendidas)}</td>
                                    <td style={cellNum}>Gs. {fmt(p.precioPromedio)}</td>
                                    <td style={cellNumMuted}>Gs. {fmt(p.costoUnitarioPromedio)}</td>
                                    <td style={{ ...cellNum, color: 'var(--primary)', fontWeight: '700' }}>Gs. {fmt(p.ingresos)}</td>
                                    <td style={cellNumMuted}>Gs. {fmt(p.costoTotal)}</td>
                                    <td style={{ ...cellNum, color: p.margenGs >= 0 ? '#22c55e' : '#ef4444', fontWeight: '700' }}>Gs. {fmt(p.margenGs)}</td>
                                    <td style={{ ...cellNum, color: margenColor(p.margenPct), fontWeight: '700' }}>{p.margenPct}%</td>
                                    <td style={cellNum}><BarPct value={p.pctDelTotal} /></td>
                                </tr>
                            ))}
                        </tbody>
                        {resumen && productosOrdenados.length > 0 && (
                            <tfoot style={{ background: '#0d0f14', borderTop: '2px solid var(--primary)' }}>
                                <tr>
                                    <td colSpan={3} style={{ ...cell, fontWeight: '900', textTransform: 'uppercase', fontSize: '0.7rem', color: 'var(--primary)' }}>TOTALES</td>
                                    <td style={{ ...cellNum, fontWeight: '900' }}>{fmt(resumen.totalUnidades)}</td>
                                    <td colSpan={2}></td>
                                    <td style={{ ...cellNum, fontWeight: '900', color: 'var(--primary)' }}>Gs. {fmt(resumen.totalIngresos)}</td>
                                    <td style={{ ...cellNum, fontWeight: '900', color: '#f59e0b' }}>Gs. {fmt(resumen.totalCosto)}</td>
                                    <td style={{ ...cellNum, fontWeight: '900', color: '#22c55e' }}>Gs. {fmt(resumen.margenTotalGs)}</td>
                                    <td style={{ ...cellNum, fontWeight: '900', color: margenColor(resumen.margenTotalPct) }}>{resumen.margenTotalPct}%</td>
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

function KpiCard({ label, value, accent, sub }) {
    return (
        <div style={{ background: 'rgba(8,10,14,0.8)', border: '1px solid rgba(0,210,190,0.1)', borderRadius: '14px', padding: '14px 16px' }}>
            <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '700', marginBottom: '6px' }}>{label}</p>
            <p style={{ fontSize: '1.1rem', fontWeight: '900', color: accent, letterSpacing: '0.3px' }}>{value}</p>
            {sub && <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '2px' }}>{sub}</p>}
        </div>
    );
}

function BarPct({ value }) {
    const pct = Math.max(0, Math.min(100, Number(value) || 0));
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#fff', minWidth: '42px', textAlign: 'right' }}>{pct}%</span>
            <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent-gradient)' }} />
            </div>
        </div>
    );
}

const labelStyle = { fontSize: '0.6rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' };
const inputStyle = { padding: '8px 12px', fontSize: '0.85rem', height: '38px' };
const chipStyle = { padding: '7px 12px', fontSize: '0.68rem', fontWeight: '700', borderRadius: '8px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.5)' };

const cell = { padding: '10px 14px', fontSize: '0.82rem', color: '#fff' };
const cellMuted = { padding: '10px 14px', fontSize: '0.75rem', color: 'var(--text-muted)' };
const cellNum = { padding: '10px 14px', fontSize: '0.82rem', color: '#fff', textAlign: 'right', whiteSpace: 'nowrap' };
const cellNumMuted = { padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' };
const cellEmpty = { textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.85rem' };

function margenColor(pct) {
    if (pct >= 60) return '#22c55e';
    if (pct >= 40) return '#84cc16';
    if (pct >= 20) return '#f59e0b';
    return '#ef4444';
}