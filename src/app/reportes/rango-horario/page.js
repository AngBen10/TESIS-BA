'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import ReportesNav from '@/components/ReportesNav';

const fmt = (n) => Number(n || 0).toLocaleString('es-PY');
const todayISO = () => new Date().toISOString().slice(0, 10);
const hh = (h) => `${String(h).padStart(2, '0')}:00`;

export default function ReporteRangoHorario() {
    const router = useRouter();
    const [user, setUser] = useState(null);

    const [desde, setDesde] = useState(todayISO());
    const [hasta, setHasta] = useState(todayISO());

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [vistaHeatmap, setVistaHeatmap] = useState('ingresos'); // 'ingresos' | 'facturas'

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
            const r = await fetch(`/api/reportes/rango-horario?${params}`);
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

    // ── Atajos de rango ──────────────────────────────────────────────
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
        } else if (tipo === '30d') {
            const a = new Date(hoy); a.setDate(a.getDate() - 29);
            setDesde(iso(a)); setHasta(iso(hoy));
        } else if (tipo === 'mes') {
            const a = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            setDesde(iso(a)); setHasta(iso(hoy));
        }
    };

    // ── Export CSV (separador ; estilo ES) ───────────────────────────
    const exportarCSV = () => {
        if (!data) return;
        const num = (n) => (n == null ? '' : Number(n).toString().replace('.', ','));
        const esc = (v) => {
            const s = String(v ?? '');
            return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };

        const lines = [];

        // Sección 1: porHora
        lines.push(['REPORTE DE VENTAS POR RANGO HORARIO'].map(esc).join(';'));
        lines.push([`Período: ${data.filtros.desde} a ${data.filtros.hasta}`].map(esc).join(';'));
        lines.push([`Días en rango: ${data.filtros.diasEnRango}`].map(esc).join(';'));
        lines.push('');
        lines.push(['DETALLE POR HORA DEL DÍA'].map(esc).join(';'));
        lines.push(['Hora', 'Ingresos', 'Ingresos prom. diario', 'Facturas', 'Facturas prom. diario', '% del total'].map(esc).join(';'));
        for (const h of data.porHora) {
            lines.push([
                hh(h.hora),
                num(h.ingresos),
                num(h.ingresosPromedio),
                num(h.facturas),
                num(h.facturasPromedio),
                num(h.pctIngresos),
            ].map(esc).join(';'));
        }

        lines.push('');
        lines.push(['DETALLE POR TURNO'].map(esc).join(';'));
        lines.push(['Turno', 'Rango', 'Ingresos', 'Facturas', 'Ticket promedio', '% del total'].map(esc).join(';'));
        for (const t of data.porTurno) {
            lines.push([t.nombre, t.rango, num(t.ingresos), num(t.facturas), num(t.ticketPromedio), num(t.pctIngresos)].map(esc).join(';'));
        }

        const csv = lines.join('\r\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rango-horario_${data.filtros.desde}_${data.filtros.hasta}.csv`;
        a.click();
        URL.revokeObjectURL(url);
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
                        <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#fff' }}>🕐 Ventas por Rango Horario</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                            Distribución de ventas por franja horaria — útil para programación de turnos y mise en place.
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
                        <KpiCard label="Ingresos del período" value={`Gs. ${fmt(resumen.totalIngresos)}`} accent="var(--primary)" sub={`${data.filtros.diasEnRango} día${data.filtros.diasEnRango > 1 ? 's' : ''}`} />
                        <KpiCard label="Promedio diario" value={`Gs. ${fmt(resumen.ingresoPromedioDiario)}`} accent="#3b82f6" />
                        <KpiCard label="Facturas" value={fmt(resumen.totalFacturas)} accent="#fff" sub={`Ticket prom.: Gs. ${fmt(resumen.ticketPromedio)}`} />
                        <KpiCard label="Hora pico" value={resumen.horaPico.hora != null ? hh(resumen.horaPico.hora) : '—'} accent="#22c55e" sub={resumen.horaPico.hora != null ? `Gs. ${fmt(resumen.horaPico.ingresos)} · ${resumen.horaPico.facturas} fact.` : 'Sin datos'} />
                        <KpiCard label="Día pico" value={resumen.diaPico.fecha ? formatearFecha(resumen.diaPico.fecha) : '—'} accent="#f59e0b" sub={resumen.diaPico.fecha ? `Gs. ${fmt(resumen.diaPico.ingresos)}` : 'Sin datos'} />
                    </div>
                )}

                {/* Heatmap día-semana × hora */}
                {data && (
                    <div style={panelStyle}>
                        <div style={panelHeader}>
                            <h3 style={panelTitle}>Mapa de calor: día de semana × hora</h3>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button onClick={() => setVistaHeatmap('ingresos')} style={vistaHeatmap === 'ingresos' ? toggleActive : toggleIdle}>Ingresos</button>
                                <button onClick={() => setVistaHeatmap('facturas')} style={vistaHeatmap === 'facturas' ? toggleActive : toggleIdle}>Facturas</button>
                            </div>
                        </div>
                        <Heatmap heatmap={data.heatmap} vista={vistaHeatmap} />
                    </div>
                )}

                {/* Gráfico de barras por hora */}
                {data && (
                    <div style={panelStyle}>
                        <div style={panelHeader}>
                            <h3 style={panelTitle}>Ingresos por hora (promedio diario)</h3>
                        </div>
                        <BarrasPorHora porHora={data.porHora} />
                    </div>
                )}

                {/* Tabla de turnos */}
                {data && (
                    <div style={panelStyle}>
                        <div style={panelHeader}>
                            <h3 style={panelTitle}>Distribución por turno</h3>
                        </div>
                        <TablaTurnos porTurno={data.porTurno} />
                    </div>
                )}

            </main>
        </div>
    );
}

// ── Heatmap ─────────────────────────────────────────────────────────
function Heatmap({ heatmap, vista }) {
    const { diasSemana, celdas, apariciones } = heatmap;

    // Recalcular máximo según vista
    const max = useMemo(() => {
        if (vista === 'ingresos') {
            return Math.max(1, ...celdas.map(c => c.ingresosPromedio));
        }
        return Math.max(1, ...celdas.map(c => c.facturas));
    }, [celdas, vista]);

    // Acomodar en matriz 7×24
    const matriz = useMemo(() => {
        const m = Array.from({ length: 7 }, () => Array(24).fill(null));
        for (const c of celdas) {
            m[c.diaSemanaIdx][c.hora] = c;
        }
        return m;
    }, [celdas]);

    const cellStyle = (val, max) => {
        if (!val || (vista === 'ingresos' ? val.ingresosPromedio : val.facturas) === 0) {
            return { background: 'rgba(255,255,255,0.02)' };
        }
        const intensity = (vista === 'ingresos' ? val.ingresosPromedio : val.facturas) / max;
        const alpha = 0.08 + intensity * 0.85;
        return { background: `rgba(0, 210, 190, ${alpha})` };
    };

    return (
        <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'inline-grid', gridTemplateColumns: '50px repeat(24, minmax(28px, 1fr))', gap: '2px', minWidth: '100%' }}>
                {/* Header row: horas */}
                <div />
                {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textAlign: 'center', fontWeight: '700', padding: '4px 0' }}>
                        {h}
                    </div>
                ))}

                {/* Filas: día de semana × 24 horas */}
                {diasSemana.map((nombreDia, idx) => (
                    <DiaFila key={idx} nombreDia={nombreDia} idx={idx} matriz={matriz} apariciones={apariciones} vista={vista} cellStyle={cellStyle} max={max} />
                ))}
            </div>

            {/* Leyenda */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                <span>Menos</span>
                <div style={{ display: 'flex', gap: '2px' }}>
                    {[0.08, 0.25, 0.45, 0.65, 0.93].map((a, i) => (
                        <div key={i} style={{ width: '20px', height: '12px', background: `rgba(0, 210, 190, ${a})`, borderRadius: '2px' }} />
                    ))}
                </div>
                <span>Más</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.65rem' }}>
                    Pasa el mouse sobre una celda para ver detalles
                </span>
            </div>
        </div>
    );
}

function DiaFila({ nombreDia, idx, matriz, apariciones, vista, cellStyle, max }) {
    return (
        <>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', fontWeight: '800', display: 'flex', alignItems: 'center', padding: '0 4px', justifyContent: 'space-between' }}>
                <span>{nombreDia}</span>
                <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>({apariciones[idx]})</span>
            </div>
            {matriz[idx].map((cell, h) => {
                const val = vista === 'ingresos' ? (cell?.ingresosPromedio || 0) : (cell?.facturas || 0);
                const titulo = cell && val > 0
                    ? `${nombreDia} ${hh(h)}\n${vista === 'ingresos' ? `Gs. ${fmt(cell.ingresosPromedio)} prom. (${apariciones[idx]} días)` : `${cell.facturas} facturas`}\nTotal: ${vista === 'ingresos' ? `Gs. ${fmt(cell.ingresos)}` : `${cell.facturas} fact.`}`
                    : `${nombreDia} ${hh(h)} — sin ventas`;

                return (
                    <div
                        key={h}
                        title={titulo}
                        style={{
                            ...cellStyle(cell, max),
                            height: '28px',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            transition: 'transform 0.12s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    />
                );
            })}
        </>
    );
}

// ── Gráfico de barras por hora ──────────────────────────────────────
function BarrasPorHora({ porHora }) {
    const max = Math.max(1, ...porHora.map(h => h.ingresosPromedio));
    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '180px', padding: '8px 0' }}>
                {porHora.map(h => {
                    const altura = (h.ingresosPromedio / max) * 100;
                    return (
                        <div key={h.hora} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                            <div
                                title={`${hh(h.hora)}\nIngresos prom. diario: Gs. ${fmt(h.ingresosPromedio)}\nFacturas prom.: ${h.facturasPromedio}\n% del total: ${h.pctIngresos}%`}
                                style={{
                                    width: '100%',
                                    height: `${altura}%`,
                                    background: altura > 0 ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.03)',
                                    borderRadius: '4px 4px 0 0',
                                    minHeight: altura > 0 ? '2px' : '1px',
                                    cursor: 'pointer',
                                    transition: 'opacity 0.15s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                            />
                        </div>
                    );
                })}
            </div>
            {/* Eje X: horas */}
            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                {porHora.map(h => (
                    <div key={h.hora} style={{ flex: 1, fontSize: '0.55rem', color: 'var(--text-muted)', textAlign: 'center', fontWeight: '700' }}>
                        {h.hora}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Tabla de turnos ─────────────────────────────────────────────────
function TablaTurnos({ porTurno }) {
    const maxIng = Math.max(1, ...porTurno.map(t => t.ingresos));

    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#0d0f14' }}>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <th style={th}>Turno</th>
                        <th style={th}>Horario</th>
                        <th style={{ ...th, textAlign: 'right' }}>Ingresos</th>
                        <th style={{ ...th, textAlign: 'right' }}>Facturas</th>
                        <th style={{ ...th, textAlign: 'right' }}>Ticket prom.</th>
                        <th style={{ ...th, textAlign: 'right' }}>% del total</th>
                        <th style={{ ...th, width: '140px' }}>Distribución</th>
                    </tr>
                </thead>
                <tbody>
                    {porTurno.map(t => (
                        <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.025)' }}>
                            <td style={{ ...td, fontWeight: '700' }}>{t.nombre}</td>
                            <td style={{ ...td, color: 'var(--text-muted)', fontSize: '0.78rem' }}>{t.rango}</td>
                            <td style={{ ...tdNum, color: 'var(--primary)', fontWeight: '700' }}>Gs. {fmt(t.ingresos)}</td>
                            <td style={tdNum}>{fmt(t.facturas)}</td>
                            <td style={tdNum}>Gs. {fmt(t.ticketPromedio)}</td>
                            <td style={{ ...tdNum, fontWeight: '700' }}>{t.pctIngresos}%</td>
                            <td style={td}>
                                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: `${(t.ingresos / maxIng) * 100}%`, height: '100%', background: 'var(--accent-gradient)' }} />
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ── Helpers ─────────────────────────────────────────────────────────
function formatearFecha(iso) {
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString('es-PY', { weekday: 'short', day: '2-digit', month: 'short' });
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

// ── Estilos ─────────────────────────────────────────────────────────
const labelStyle = { fontSize: '0.6rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' };
const inputStyle = { padding: '8px 12px', fontSize: '0.85rem', height: '38px' };
const chipStyle = { padding: '7px 12px', fontSize: '0.68rem', fontWeight: '700', borderRadius: '8px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.5)' };

const panelStyle = { background: 'rgba(10,12,15,0.5)', borderRadius: '14px', border: '1px solid rgba(0,210,190,0.06)', padding: '1.2rem 1.4rem', marginBottom: '1.2rem' };
const panelHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' };
const panelTitle = { fontSize: '0.85rem', fontWeight: '800', color: '#fff', letterSpacing: '0.3px' };

const toggleActive = { padding: '6px 10px', fontSize: '0.7rem', fontWeight: '700', borderRadius: '6px', border: '1px solid var(--primary)', background: 'rgba(0,210,190,0.12)', color: 'var(--primary)', cursor: 'pointer' };
const toggleIdle = { padding: '6px 10px', fontSize: '0.7rem', fontWeight: '700', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' };

const th = { padding: '10px 14px', fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '800', textAlign: 'left' };
const td = { padding: '10px 14px', fontSize: '0.82rem', color: '#fff' };
const tdNum = { padding: '10px 14px', fontSize: '0.82rem', color: '#fff', textAlign: 'right', whiteSpace: 'nowrap' };