'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import ReportesNav from '@/components/ReportesNav';

const fmt = (n) => Number(n || 0).toLocaleString('es-PY');
const todayISO = () => new Date().toISOString().slice(0, 10);

// ── Paleta de colores por método ─────────────────────────────────────
const COLORES = {
    'Efectivo': '#22c55e',
    'Tarjeta': '#3b82f6',
    'Transferencia': '#a855f7',
    'Sin especificar': '#6b7280',
};
const COLORES_FALLBACK = ['#f59e0b', '#ec4899', '#06b6d4', '#84cc16', '#ef4444'];

function colorMetodo(metodo, idx) {
    return COLORES[metodo] || COLORES_FALLBACK[idx % COLORES_FALLBACK.length];
}

function iconoMetodo(metodo) {
    if (metodo === 'Efectivo') return '💵';
    if (metodo === 'Tarjeta') return '💳';
    if (metodo === 'Transferencia') return '📱';
    if (metodo === 'Sin especificar') return '❓';
    return '💰';
}

export default function ReporteMetodoPago() {
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

    // ── Cargar reporte ───────────────────────────────────────────────
    const cargar = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({ desde, hasta });
            const r = await fetch(`/api/reportes/metodo-pago?${params}`);
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
        if (!data) return;
        const num = (n) => (n == null ? '' : Number(n).toString().replace('.', ','));
        const esc = (v) => {
            const s = String(v ?? '');
            return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };

        const lines = [];
        lines.push(['REPORTE DE VENTAS POR MÉTODO DE PAGO'].map(esc).join(';'));
        lines.push([`Período: ${data.filtros.desde} a ${data.filtros.hasta}`].map(esc).join(';'));
        lines.push('');
        lines.push(['RESUMEN POR MÉTODO'].map(esc).join(';'));
        lines.push(['Método', 'Cheques', 'Ventas', 'Ticket promedio', '% del total'].map(esc).join(';'));
        for (const m of data.porMetodo) {
            lines.push([m.metodo, num(m.cheques), num(m.ventas), num(m.ticketPromedio), num(m.pct)].map(esc).join(';'));
        }

        if (data.evolucionDiaria.length > 1) {
            lines.push('');
            lines.push(['EVOLUCIÓN DIARIA'].map(esc).join(';'));
            const header = ['Fecha', ...data.metodosPresentes, 'Total', 'Cheques'];
            lines.push(header.map(esc).join(';'));
            for (const d of data.evolucionDiaria) {
                const row = [d.fecha];
                for (const m of data.metodosPresentes) row.push(num(d.porMetodo[m] || 0));
                row.push(num(d.total));
                row.push(num(d.cheques));
                lines.push(row.map(esc).join(';'));
            }
        }

        const csv = lines.join('\r\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `metodo-pago_${data.filtros.desde}_${data.filtros.hasta}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!user) return null;
    const resumen = data?.resumen;
    const mostrarEvolucion = data && data.evolucionDiaria.length > 1;

    return (
        <div className="desktop-app">
            <Sidebar user={user} />
            <main className="main-view" style={{ padding: '1.5rem 2rem', overflowY: 'auto', height: '100vh' }}>

                {/* Header */}
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem', gap: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#fff' }}>💳 Ventas por Método de Pago</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                            Desglose de ingresos por efectivo, tarjeta y transferencia — clave para conciliación bancaria y detección de discrepancias.
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

                {/* Banner si hay facturas sin especificar */}
                {resumen?.sinEspecificar && resumen.sinEspecificar.cheques > 0 && (
                    <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', padding: '12px 16px', marginBottom: '1.2rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.3rem' }}>⚠</span>
                        <div>
                            Hay <strong style={{ color: '#f59e0b' }}>{resumen.sinEspecificar.cheques} facturas</strong> ({resumen.sinEspecificar.pct}% del total)
                            sin método de pago especificado. Son facturas emitidas <strong>antes</strong> del bugfix donde el campo no se persistía.
                            Las nuevas se registran correctamente.
                        </div>
                    </div>
                )}

                {/* KPIs */}
                {resumen && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px', marginBottom: '1.2rem' }}>
                        <KpiCard label="Ventas del período" value={`Gs. ${fmt(resumen.totalVentas)}`} accent="var(--primary)" sub={`${resumen.totalCheques} facturas`} />
                        <KpiCard label="Ticket promedio" value={`Gs. ${fmt(resumen.ticketPromedio)}`} accent="#3b82f6" />
                        <KpiCard label="Métodos usados" value={fmt(resumen.cantidadMetodos)} accent="#fff" />
                        <KpiCard
                            label="🏆 Método dominante"
                            value={resumen.metodoDominante ? `${iconoMetodo(resumen.metodoDominante.metodo)} ${resumen.metodoDominante.metodo}` : '—'}
                            accent={resumen.metodoDominante ? colorMetodo(resumen.metodoDominante.metodo, 0) : '#fff'}
                            sub={resumen.metodoDominante ? `Gs. ${fmt(resumen.metodoDominante.ventas)} · ${resumen.metodoDominante.pct}%` : 'Sin datos'}
                        />
                    </div>
                )}

                {/* Donut + leyenda + tabla resumen */}
                {data && data.porMetodo.length > 0 && (
                    <div style={{ ...panelStyle, display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: '2rem', alignItems: 'center' }}>
                        <DonutChart porMetodo={data.porMetodo} totalVentas={resumen.totalVentas} />
                        <TablaResumenMetodos porMetodo={data.porMetodo} />
                    </div>
                )}

                {/* Evolución diaria (solo si rango > 1 día) */}
                {mostrarEvolucion && (
                    <div style={panelStyle}>
                        <h3 style={panelTitle}>Evolución diaria por método</h3>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                            Barras apiladas — cada color representa un método. Hover para detalle.
                        </p>
                        <BarrasApiladas evolucionDiaria={data.evolucionDiaria} metodos={data.metodosPresentes} />
                    </div>
                )}

            </main>
        </div>
    );
}

// ── Donut chart en SVG puro ─────────────────────────────────────────
function DonutChart({ porMetodo, totalVentas }) {
    // Filtrar métodos con ventas > 0
    const slices = porMetodo.filter(m => m.ventas > 0);
    if (slices.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                Sin ventas en el período seleccionado.
            </div>
        );
    }

    const size = 280;
    const cx = size / 2;
    const cy = size / 2;
    const radius = 110;
    const innerRadius = 70;
    const total = slices.reduce((s, m) => s + m.ventas, 0);

    // Calcular paths de cada slice
    let cumulativeAngle = -Math.PI / 2; // empezar arriba
    const paths = slices.map((m, i) => {
        const sliceAngle = (m.ventas / total) * Math.PI * 2;
        const startAngle = cumulativeAngle;
        const endAngle = cumulativeAngle + sliceAngle;
        cumulativeAngle = endAngle;

        const x1 = cx + radius * Math.cos(startAngle);
        const y1 = cy + radius * Math.sin(startAngle);
        const x2 = cx + radius * Math.cos(endAngle);
        const y2 = cy + radius * Math.sin(endAngle);
        const ix1 = cx + innerRadius * Math.cos(endAngle);
        const iy1 = cy + innerRadius * Math.sin(endAngle);
        const ix2 = cx + innerRadius * Math.cos(startAngle);
        const iy2 = cy + innerRadius * Math.sin(startAngle);

        const largeArc = sliceAngle > Math.PI ? 1 : 0;

        const d = [
            `M ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
            `L ${ix1} ${iy1}`,
            `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2}`,
            'Z'
        ].join(' ');

        return {
            d,
            color: colorMetodo(m.metodo, i),
            metodo: m.metodo,
            ventas: m.ventas,
            pct: m.pct,
        };
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {paths.map((p, i) => (
                    <path
                        key={i}
                        d={p.d}
                        fill={p.color}
                        stroke="#0d0f14"
                        strokeWidth="2"
                        style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                        <title>{`${p.metodo}\nGs. ${fmt(p.ventas)} · ${p.pct}%`}</title>
                    </path>
                ))}

                {/* Texto central */}
                <text x={cx} y={cy - 8} textAnchor="middle" fill="var(--text-muted)" fontSize="11" fontWeight="700" letterSpacing="1.5px">
                    TOTAL
                </text>
                <text x={cx} y={cy + 14} textAnchor="middle" fill="#fff" fontSize="18" fontWeight="900">
                    Gs. {fmt(totalVentas)}
                </text>
            </svg>
        </div>
    );
}

// ── Tabla resumen (al lado del donut) ───────────────────────────────
function TablaResumenMetodos({ porMetodo }) {
    return (
        <div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <th style={{ ...thLeft, paddingLeft: 0 }}>Método</th>
                        <th style={thRight}>Cheques</th>
                        <th style={thRight}>Ticket prom.</th>
                        <th style={thRight}>Ventas</th>
                        <th style={thRight}>%</th>
                    </tr>
                </thead>
                <tbody>
                    {porMetodo.map((m, i) => (
                        <tr key={m.metodo} style={{ borderBottom: '1px solid rgba(255,255,255,0.025)' }}>
                            <td style={{ ...cell, paddingLeft: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: colorMetodo(m.metodo, i), flexShrink: 0 }} />
                                <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>
                                    {iconoMetodo(m.metodo)} {m.metodo}
                                </span>
                            </td>
                            <td style={cellNum}>{fmt(m.cheques)}</td>
                            <td style={cellNum}>Gs. {fmt(m.ticketPromedio)}</td>
                            <td style={{ ...cellNum, color: 'var(--primary)', fontWeight: '700' }}>Gs. {fmt(m.ventas)}</td>
                            <td style={{ ...cellNum, fontWeight: '700' }}>{m.pct}%</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ── Gráfico de barras apiladas por día ──────────────────────────────
function BarrasApiladas({ evolucionDiaria, metodos }) {
    // Altura máxima en valor para escalar
    const maxTotal = Math.max(1, ...evolucionDiaria.map(d => d.total));
    const altoMax = 200;

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: `${altoMax + 20}px`, overflowX: 'auto', paddingBottom: '4px' }}>
                {evolucionDiaria.map(d => {
                    const alturaTotal = (d.total / maxTotal) * altoMax;
                    return (
                        <div key={d.fecha} style={{ flex: '1 1 0', minWidth: '38px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div
                                title={`${formatearFechaCorta(d.fecha)}\nTotal: Gs. ${fmt(d.total)} · ${d.cheques} facturas\n` +
                                    metodos.map(m => `${m}: Gs. ${fmt(d.porMetodo[m] || 0)}`).join('\n')}
                                style={{
                                    width: '100%',
                                    height: `${alturaTotal}px`,
                                    display: 'flex',
                                    flexDirection: 'column-reverse',
                                    borderRadius: '4px 4px 0 0',
                                    overflow: 'hidden',
                                    cursor: 'pointer',
                                    transition: 'transform 0.15s',
                                    background: alturaTotal > 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                                    minHeight: '2px',
                                }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                {metodos.map((m, idx) => {
                                    const v = d.porMetodo[m] || 0;
                                    if (v === 0) return null;
                                    const h = (v / d.total) * alturaTotal;
                                    return (
                                        <div
                                            key={m}
                                            style={{
                                                width: '100%',
                                                height: `${h}px`,
                                                background: colorMetodo(m, idx),
                                                borderTop: idx > 0 ? '1px solid rgba(0,0,0,0.3)' : 'none',
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Eje X: fechas */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                {evolucionDiaria.map(d => (
                    <div key={d.fecha} style={{ flex: '1 1 0', minWidth: '38px', fontSize: '0.55rem', color: 'var(--text-muted)', textAlign: 'center', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {formatearFechaCorta(d.fecha)}
                    </div>
                ))}
            </div>

            {/* Leyenda */}
            <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
                {metodos.map((m, i) => (
                    <div key={m} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)' }}>
                        <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', background: colorMetodo(m, i) }} />
                        {iconoMetodo(m)} {m}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Helpers ─────────────────────────────────────────────────────────
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