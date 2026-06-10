'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import ReportesNav from '@/components/ReportesNav';

const fmt = (n) => Number(n || 0).toLocaleString('es-PY');
const todayISO = () => new Date().toISOString().slice(0, 10);

// ── Clasificación y semáforo ────────────────────────────────────────
const CLASIFICACIONES = {
    excelente: { label: 'EXCELENTE', color: '#22c55e', desc: 'Food Cost saludable', umbral: '≤ 28%' },
    normal: { label: 'NORMAL', color: '#84cc16', desc: 'Dentro del rango típico', umbral: '28-35%' },
    alerta: { label: 'ALERTA', color: '#f59e0b', desc: 'Por encima del rango ideal', umbral: '35-40%' },
    critico: { label: 'CRÍTICO', color: '#ef4444', desc: 'Riesgo serio de rentabilidad', umbral: '> 40%' },
    sin_datos: { label: 'SIN DATOS', color: '#6b7280', desc: 'No hay ventas o no hay costos cargados', umbral: '—' },
};

export default function ReporteFoodCost() {
    const router = useRouter();
    const [user, setUser] = useState(null);

    const [desde, setDesde] = useState(todayISO());
    const [hasta, setHasta] = useState(todayISO());

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // ── Auth ─────────────────────────────────────────────────────────
    useEffect(() => {
        const stored = localStorage.getItem('user');
        if (!stored) { router.push('/login'); return; }
        const parsed = JSON.parse(stored);
        if (parsed.roleId !== 1) { router.push('/'); return; }
        setUser(parsed);
    }, [router]);

    // ── Cargar ───────────────────────────────────────────────────────
    const cargar = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({ desde, hasta });
            const r = await fetch(`/api/reportes/food-cost?${params}`);
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

    const setRango = (tipo) => {
        const hoy = new Date();
        const iso = (d) => d.toISOString().slice(0, 10);
        if (tipo === 'hoy') { setDesde(iso(hoy)); setHasta(iso(hoy)); }
        else if (tipo === 'ayer') { const a = new Date(hoy); a.setDate(a.getDate() - 1); setDesde(iso(a)); setHasta(iso(a)); }
        else if (tipo === '7d') { const a = new Date(hoy); a.setDate(a.getDate() - 6); setDesde(iso(a)); setHasta(iso(hoy)); }
        else if (tipo === '30d') { const a = new Date(hoy); a.setDate(a.getDate() - 29); setDesde(iso(a)); setHasta(iso(hoy)); }
        else if (tipo === 'mes') { const a = new Date(hoy.getFullYear(), hoy.getMonth(), 1); setDesde(iso(a)); setHasta(iso(hoy)); }
    };

    const exportarCSV = () => {
        if (!data) return;
        const num = (n) => (n == null ? '' : Number(n).toString().replace('.', ','));
        const esc = (v) => {
            const s = String(v ?? '');
            return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };

        const lines = [];
        lines.push(['REPORTE DE FOOD COST TEÓRICO'].map(esc).join(';'));
        lines.push([`Período: ${data.filtros.desde} a ${data.filtros.hasta}`].map(esc).join(';'));
        lines.push([`Food Cost Global: ${num(data.resumen.foodCostPct)}%`].map(esc).join(';'));
        lines.push('');
        lines.push(['POR CATEGORÍA'].map(esc).join(';'));
        lines.push(['Categoría', 'Productos', 'Ingresos', 'Costo', 'Margen Gs.', 'Food Cost %', '% del total'].map(esc).join(';'));
        for (const c of data.porCategoria) {
            lines.push([c.categoria, num(c.productos), num(c.ingresos), num(c.costo), num(c.margenGs), num(c.foodCostPct), num(c.pctDelTotal)].map(esc).join(';'));
        }
        lines.push('');
        lines.push(['TOP 10 PEOR FOOD COST'].map(esc).join(';'));
        lines.push(['Producto', 'Categoría', 'Unidades', 'Ingresos', 'Costo', 'Margen Gs.', 'Food Cost %'].map(esc).join(';'));
        for (const p of data.peorMargen) {
            lines.push([p.producto, p.categoria, num(p.unidades), num(p.ingresos), num(p.costo), num(p.margenGs), num(p.foodCostPct)].map(esc).join(';'));
        }
        lines.push('');
        lines.push(['TOP 10 MEJOR FOOD COST'].map(esc).join(';'));
        lines.push(['Producto', 'Categoría', 'Unidades', 'Ingresos', 'Costo', 'Margen Gs.', 'Food Cost %'].map(esc).join(';'));
        for (const p of data.mejorMargen) {
            lines.push([p.producto, p.categoria, num(p.unidades), num(p.ingresos), num(p.costo), num(p.margenGs), num(p.foodCostPct)].map(esc).join(';'));
        }

        if (data.evolucionDiaria.length > 1) {
            lines.push('');
            lines.push(['EVOLUCIÓN DIARIA'].map(esc).join(';'));
            lines.push(['Fecha', 'Ingresos', 'Costo', 'Food Cost %'].map(esc).join(';'));
            for (const d of data.evolucionDiaria) {
                lines.push([d.fecha, num(d.ingresos), num(d.costo), num(d.foodCostPct)].map(esc).join(';'));
            }
        }

        const csv = lines.join('\r\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `food-cost_${data.filtros.desde}_${data.filtros.hasta}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!user) return null;
    const resumen = data?.resumen;
    const clasif = resumen ? CLASIFICACIONES[resumen.clasificacion] : null;
    const mostrarEvolucion = data && data.evolucionDiaria.length > 1;

    return (
        <div className="desktop-app">
            <Sidebar user={user} />
            <main className="main-view" style={{ padding: '1.5rem 2rem', overflowY: 'auto', height: '100vh' }}>

                {/* Header */}
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem', gap: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#fff' }}>📉 Food Cost <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600', marginLeft: '8px' }}>(Teórico)</span></h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                            % de ventas destinado a materia prima según recetas. No incluye merma real, robo ni errores de porcionado.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={cargar} disabled={loading} className="luxury-button" style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--border)', fontSize: '0.78rem', padding: '9px 18px' }}>
                            {loading ? '⏳ Cargando...' : '🔄 Refrescar'}
                        </button>
                        <button onClick={exportarCSV} disabled={!data} className="luxury-button" style={{ background: 'var(--accent-gradient)', color: '#000', fontSize: '0.78rem', padding: '9px 18px', opacity: data ? 1 : 0.4 }}>
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

                {/* Banner productos sin receta */}
                {resumen?.sinReceta?.cantidad > 0 && (
                    <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', padding: '12px 16px', marginBottom: '1.2rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.3rem' }}>⚠</span>
                        <div>
                            Hay <strong style={{ color: '#f59e0b' }}>{resumen.sinReceta.cantidad} productos sin receta cargada</strong> que representan
                            <strong style={{ color: '#f59e0b' }}> Gs. {fmt(resumen.sinReceta.ingresos)} ({resumen.sinReceta.pctDelTotal}% de las ventas)</strong>.
                            Esos productos cuentan con costo = 0, así que tu Food Cost real es probablemente más alto que el que ves acá.
                            Cargá sus recetas en el módulo Escandallo para mejorar la precisión.
                        </div>
                    </div>
                )}

                {/* Panel principal: Gauge + KPIs */}
                {resumen && clasif && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) 1fr', gap: '1.2rem', marginBottom: '1.2rem' }}>

                        {/* Gauge */}
                        <div style={{ background: 'rgba(8,10,14,0.8)', border: `1px solid ${clasif.color}40`, borderRadius: '14px', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <Gauge value={resumen.foodCostPct} clasif={clasif} />
                            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                                <div style={{ display: 'inline-block', background: `${clasif.color}20`, color: clasif.color, padding: '4px 14px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '900', letterSpacing: '1.5px', border: `1px solid ${clasif.color}40` }}>
                                    {clasif.label}
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', marginTop: '8px', fontWeight: '600' }}>{clasif.desc}</p>
                                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>Rango: {clasif.umbral}</p>
                            </div>
                        </div>

                        {/* KPIs */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
                            <KpiCard label="Ingresos del período" value={`Gs. ${fmt(resumen.totalIngresos)}`} accent="var(--primary)" />
                            <KpiCard label="Costo de insumos" value={`Gs. ${fmt(resumen.totalCosto)}`} accent="#f59e0b" sub="(según recetas)" />
                            <KpiCard label="Margen bruto Gs." value={`Gs. ${fmt(resumen.margenGs)}`} accent="#22c55e" />
                            <KpiCard label="Margen bruto %" value={`${resumen.margenPct}%`} accent="#3b82f6" />
                            <KpiCard
                                label="Umbrales típicos"
                                value="28% / 35% / 40%"
                                accent="#fff"
                                sub="excelente / normal / alerta"
                            />
                            <KpiCard
                                label="Productos analizados"
                                value={fmt(resumen.cantidadProductos)}
                                accent="#fff"
                                sub={resumen.sinReceta.cantidad > 0 ? `${resumen.sinReceta.cantidad} sin receta` : 'Todos con receta'}
                            />
                        </div>

                    </div>
                )}

                {/* Evolución diaria */}
                {mostrarEvolucion && (
                    <div style={panelStyle}>
                        <h3 style={panelTitle}>Evolución del Food Cost %</h3>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                            Cada barra es un día. El color cambia según el rango (verde = saludable, rojo = crítico). Línea punteada = objetivo 35%.
                        </p>
                        <EvolucionDiariaChart datos={data.evolucionDiaria} />
                    </div>
                )}

                {/* Por categoría */}
                {data?.porCategoria?.length > 0 && (
                    <div style={panelStyle}>
                        <h3 style={panelTitle}>Food Cost por categoría</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.6rem' }}>
                            <thead style={{ background: '#0d0f14' }}>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                    <th style={thLeft}>Categoría</th>
                                    <th style={thRight}>Productos</th>
                                    <th style={thRight}>Ingresos</th>
                                    <th style={thRight}>Costo</th>
                                    <th style={thRight}>Margen Gs.</th>
                                    <th style={thRight}>Food Cost %</th>
                                    <th style={thRight}>% del total</th>
                                    <th style={thLeft}>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.porCategoria.map(c => {
                                    const cc = CLASIFICACIONES[c.clasificacion];
                                    return (
                                        <tr key={c.categoriaId} style={{ borderBottom: '1px solid rgba(255,255,255,0.025)' }}>
                                            <td style={{ ...cell, fontWeight: '700' }}>{c.categoria}</td>
                                            <td style={cellNum}>{c.productos}</td>
                                            <td style={{ ...cellNum, color: 'var(--primary)', fontWeight: '700' }}>Gs. {fmt(c.ingresos)}</td>
                                            <td style={cellNum}>Gs. {fmt(c.costo)}</td>
                                            <td style={{ ...cellNum, color: '#22c55e' }}>Gs. {fmt(c.margenGs)}</td>
                                            <td style={{ ...cellNum, color: cc.color, fontWeight: '900', fontSize: '0.95rem' }}>{c.foodCostPct}%</td>
                                            <td style={cellNum}>{c.pctDelTotal}%</td>
                                            <td style={cell}>
                                                <span style={{ fontSize: '0.6rem', background: `${cc.color}15`, color: cc.color, padding: '3px 8px', borderRadius: '5px', fontWeight: '700', border: `1px solid ${cc.color}30`, letterSpacing: '1px' }}>
                                                    {cc.label}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Top peor / mejor margen */}
                {data && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>

                        {/* PEOR */}
                        <div style={panelStyle}>
                            <h3 style={{ ...panelTitle, color: '#ef4444' }}>🔻 Top 10 — Peor Food Cost</h3>
                            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>
                                Productos con mayor % de costo sobre venta. Candidatos a subir precio o ajustar porción.
                            </p>
                            <TopProductos productos={data.peorMargen} colorFc={pct => CLASIFICACIONES[fcCategoria(pct)].color} />
                        </div>

                        {/* MEJOR */}
                        <div style={panelStyle}>
                            <h3 style={{ ...panelTitle, color: '#22c55e' }}>🟢 Top 10 — Mejor Food Cost</h3>
                            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>
                                Productos con menor % de costo. Tu vaca lechera — promocionalos más.
                            </p>
                            <TopProductos productos={data.mejorMargen} colorFc={pct => CLASIFICACIONES[fcCategoria(pct)].color} />
                        </div>

                    </div>
                )}

            </main>
        </div>
    );
}

// ── Subcomponentes ─────────────────────────────────────────────────

function Gauge({ value, clasif }) {
    // Semicírculo SVG, de 0 a 50%. Cap visual al 50% (todo lo que exceda se muestra a 50%).
    const max = 50;
    const v = Math.min(max, Math.max(0, value));
    const angle = (v / max) * 180 - 180; // -180 = inicio izquierda, 0 = arriba derecha
    const radians = (angle * Math.PI) / 180;
    const radius = 95;
    const cx = 120;
    const cy = 120;
    const x = cx + radius * Math.cos(radians);
    const y = cy + radius * Math.sin(radians);

    return (
        <svg width="240" height="150" viewBox="0 0 240 150">
            {/* Arcos de colores (background del gauge) */}
            <path d={arc(cx, cy, radius, 180, 180 + (28 / 50) * 180)} stroke="#22c55e" strokeWidth="22" fill="none" strokeLinecap="butt" />
            <path d={arc(cx, cy, radius, 180 + (28 / 50) * 180, 180 + (35 / 50) * 180)} stroke="#84cc16" strokeWidth="22" fill="none" strokeLinecap="butt" />
            <path d={arc(cx, cy, radius, 180 + (35 / 50) * 180, 180 + (40 / 50) * 180)} stroke="#f59e0b" strokeWidth="22" fill="none" strokeLinecap="butt" />
            <path d={arc(cx, cy, radius, 180 + (40 / 50) * 180, 360)} stroke="#ef4444" strokeWidth="22" fill="none" strokeLinecap="butt" />

            {/* Marcas */}
            {[0, 28, 35, 40, 50].map(mark => {
                const a = ((mark / 50) * 180 - 180) * Math.PI / 180;
                const x1 = cx + (radius - 14) * Math.cos(a);
                const y1 = cy + (radius - 14) * Math.sin(a);
                const x2 = cx + (radius + 14) * Math.cos(a);
                const y2 = cy + (radius + 14) * Math.sin(a);
                const xt = cx + (radius + 26) * Math.cos(a);
                const yt = cy + (radius + 26) * Math.sin(a);
                return (
                    <g key={mark}>
                        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                        <text x={xt} y={yt + 3} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9" fontWeight="700">
                            {mark}{mark === 50 ? '+' : ''}
                        </text>
                    </g>
                );
            })}

            {/* Aguja */}
            <line x1={cx} y1={cy} x2={x} y2={y} stroke={clasif.color} strokeWidth="3" strokeLinecap="round" />
            <circle cx={cx} cy={cy} r="8" fill={clasif.color} />
            <circle cx={cx} cy={cy} r="3" fill="#0d0f14" />

            {/* Valor central */}
            <text x={cx} y={cy + 32} textAnchor="middle" fill="#fff" fontSize="28" fontWeight="900">
                {value}%
            </text>
            <text x={cx} y={cy + 48} textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontWeight="700" letterSpacing="1.5px">
                FOOD COST
            </text>
        </svg>
    );
}

// Helper para generar paths de arco SVG
function arc(cx, cy, r, startDeg, endDeg) {
    const start = (startDeg * Math.PI) / 180;
    const end = (endDeg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

function EvolucionDiariaChart({ datos }) {
    const max = Math.max(50, ...datos.map(d => d.foodCostPct));
    const altoMax = 180;

    return (
        <div>
            {/* Líneas guía */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: '6px', height: `${altoMax + 20}px`, paddingTop: '8px', overflowX: 'auto' }}>
                {/* Línea objetivo 35% */}
                <div style={{ position: 'absolute', left: 0, right: 0, top: `${altoMax - (35 / max) * altoMax + 8}px`, borderTop: '1px dashed rgba(245,158,11,0.4)', pointerEvents: 'none', zIndex: 1 }}>
                    <span style={{ position: 'absolute', right: 0, top: '-10px', fontSize: '0.55rem', color: '#f59e0b', fontWeight: '700' }}>35% objetivo</span>
                </div>

                {datos.map(d => {
                    const cat = fcCategoria(d.foodCostPct);
                    const color = CLASIFICACIONES[cat].color;
                    const altura = (d.foodCostPct / max) * altoMax;
                    return (
                        <div key={d.fecha} style={{ flex: '1 1 0', minWidth: '38px', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
                            <div
                                title={`${formatearFechaCorta(d.fecha)}\nFood Cost: ${d.foodCostPct}%\nIngresos: Gs. ${fmt(d.ingresos)}\nCosto: Gs. ${fmt(d.costo)}`}
                                style={{
                                    width: '100%',
                                    height: `${Math.max(2, altura)}px`,
                                    background: d.foodCostPct > 0 ? color : 'rgba(255,255,255,0.04)',
                                    borderRadius: '4px 4px 0 0',
                                    cursor: 'pointer',
                                    transition: 'transform 0.15s, opacity 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.opacity = '0.85'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.opacity = '1'; }}
                            />
                        </div>
                    );
                })}
            </div>

            {/* Eje X */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                {datos.map(d => (
                    <div key={d.fecha} style={{ flex: '1 1 0', minWidth: '38px', textAlign: 'center', fontSize: '0.55rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                        <div>{formatearFechaCorta(d.fecha)}</div>
                        <div style={{ color: d.foodCostPct > 0 ? CLASIFICACIONES[fcCategoria(d.foodCostPct)].color : 'var(--text-muted)', fontSize: '0.62rem', fontWeight: '800', marginTop: '2px' }}>
                            {d.foodCostPct > 0 ? `${d.foodCostPct}%` : '—'}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function TopProductos({ productos, colorFc }) {
    if (!productos.length) {
        return <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', padding: '1rem 0' }}>Sin productos con receta cargada en este período.</p>;
    }
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {productos.map((p, i) => (
                <div key={p.productoId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ minWidth: '20px', textAlign: 'center', fontSize: '0.7rem', fontWeight: '900', color: 'var(--text-muted)' }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.producto}</div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                            {p.categoria} · {p.unidades} uds · Gs. {fmt(p.ingresos)} ingresos
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.05rem', fontWeight: '900', color: colorFc(p.foodCostPct), lineHeight: 1 }}>{p.foodCostPct}%</div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '2px' }}>food cost</div>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Helpers ─────────────────────────────────────────────────────────
function fcCategoria(pct) {
    if (pct === 0) return 'sin_datos';
    if (pct <= 28) return 'excelente';
    if (pct <= 35) return 'normal';
    if (pct <= 40) return 'alerta';
    return 'critico';
}

function formatearFechaCorta(iso) {
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' });
}

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

const thLeft = { padding: '8px 10px', fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '800', textAlign: 'left' };
const thRight = { padding: '8px 10px', fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '800', textAlign: 'right' };
const cell = { padding: '10px', fontSize: '0.82rem', color: '#fff' };
const cellNum = { padding: '10px', fontSize: '0.82rem', color: '#fff', textAlign: 'right', whiteSpace: 'nowrap' };