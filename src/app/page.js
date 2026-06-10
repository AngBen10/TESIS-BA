'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

const fmt = (n) => Number(n || 0).toLocaleString('es-PY');
const fmtK = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}K`;
  return String(v);
};

const CATEGORIA_COLORS = ['#00D2BE', '#3b82f6', '#f59e0b', '#a855f7', '#22c55e', '#ec4899', '#06b6d4', '#ef4444'];
const METODO_COLORS = { 'Efectivo': '#22c55e', 'Tarjeta': '#3b82f6', 'Transferencia': '#a855f7', 'Sin especificar': '#6b7280' };
const METODO_ICONS = { 'Efectivo': '💵', 'Tarjeta': '💳', 'Transferencia': '📱', 'Sin especificar': '❓' };

const REPORTES_LINKS = [
  { path: '/reportes/ventas-producto', label: 'Por Producto', icon: '📦' },
  { path: '/reportes/rango-horario', label: 'Rango Horario', icon: '🕐' },
  { path: '/reportes/ventas-mesero', label: 'Por Mesero', icon: '👥' },
  { path: '/reportes/ventas-mesa', label: 'Por Mesa', icon: '🍽️' },
  { path: '/reportes/metodo-pago', label: 'Método Pago', icon: '💳' },
  { path: '/reportes/food-cost', label: 'Food Cost', icon: '📉' },
];

function Skeleton({ width = '100%', height = '20px' }) {
  return <div className="skeleton" style={{ width, height, minHeight: height }} />;
}

export default function Home() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [now, setNow] = useState(new Date());

  const [mesasOcupadas, setMesasOcupadas] = useState(0);
  const [totalMesas, setTotalMesas] = useState(12);
  const [pedidosCocina, setPedidosCocina] = useState(0);
  const [mesasLimpieza, setMesasLimpieza] = useState(0);

  const router = useRouter();

  const loadLocalData = useCallback(() => {
    try {
      const rawMesas = localStorage.getItem('restaurante_mesas');
      if (rawMesas) {
        const mesas = JSON.parse(rawMesas);
        setTotalMesas(mesas.length);
        setMesasOcupadas(mesas.filter(m => m.estado === 'Ocupada').length);
        setMesasLimpieza(mesas.filter(m => m.estado === 'En Limpieza').length);
      }
      const rawPedidos = localStorage.getItem('restaurante_pedidos');
      if (rawPedidos) {
        const pedidos = JSON.parse(rawPedidos);
        setPedidosCocina(pedidos.filter(p => p.estado === 'Pendiente' || p.estado === 'En Preparación').length);
      }
    } catch (_) { }
  }, []);

  const fetchReportes = useCallback(async () => {
    try {
      const r = await fetch('/api/reportes');
      if (!r.ok) throw new Error('Error al cargar reportes');
      const d = await r.json();
      setData(d);
      setLastUpdate(new Date());
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) { router.push('/login'); return; }
    setUser(JSON.parse(storedUser));
    fetchReportes();
    loadLocalData();

    const interval = setInterval(() => { fetchReportes(); loadLocalData(); }, 60000);
    const clock = setInterval(() => setNow(new Date()), 1000);
    const handleUpdate = () => loadLocalData();
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('pedidos_updated', handleUpdate);

    return () => {
      clearInterval(interval);
      clearInterval(clock);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('pedidos_updated', handleUpdate);
    };
  }, [router, fetchReportes, loadLocalData]);

  const porcentajeOcupacion = totalMesas > 0 ? Math.round((mesasOcupadas / totalMesas) * 100) : 0;

  const saludo = useMemo(() => {
    const h = now.getHours();
    if (h < 6) return 'Buenas noches';
    if (h < 13) return 'Buenos días';
    if (h < 20) return 'Buenas tardes';
    return 'Buenas noches';
  }, [now]);

  const primerNombre = user?.nombre ? user.nombre.split(' ')[0] : '';

  if (!user) return null;

  return (
    <div className="desktop-app">
      <Sidebar user={user} />
      <main className="main-view">
        <style>{`
          @keyframes dashLiveDot { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.4; transform:scale(.7); } }
          @keyframes dashDraw { from { stroke-dashoffset: var(--len); } to { stroke-dashoffset: 0; } }
          @keyframes dashRise { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
          .dash-rise { animation: dashRise .5s ease both; }
          .dash-live-dot { width:8px; height:8px; border-radius:50%; background:#22c55e; animation: dashLiveDot 1.6s infinite; box-shadow:0 0 8px #22c55e; }
          .qr-link { transition: all .2s ease; }
          .qr-link:hover { transform: translateY(-3px); border-color: var(--primary) !important; background: rgba(0,210,190,0.08) !important; }
          .kpi-hero { transition: all .3s ease; }
          .kpi-hero:hover { transform: translateY(-3px); box-shadow: 0 14px 44px rgba(0,0,0,.5), 0 0 18px rgba(0,210,190,.06); border-color: rgba(0,210,190,.22) !important; }
        `}</style>

        <header style={{ marginBottom: '1.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <span className="dash-live-dot" />
              <span style={{ fontSize: '0.6rem', color: '#22c55e', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase' }}>En vivo</span>
            </div>
            <h1 style={{ fontSize: '1.9rem', fontWeight: '900', color: '#fff', lineHeight: 1.1 }}>
              {saludo}{primerNombre ? `, ${primerNombre}` : ''} 👋
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.74rem', fontWeight: '600', textTransform: 'capitalize', marginTop: '2px' }}>
              {now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '1.6rem', fontWeight: '900', color: '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                <span style={{ fontSize: '0.8rem', color: 'var(--primary)', marginLeft: '4px' }}>
                  {now.toLocaleTimeString('es-ES', { second: '2-digit' }).padStart(2, '0')}s
                </span>
              </p>
              <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                {lastUpdate ? `Actualizado ${lastUpdate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ''}
              </p>
            </div>
            <button
              onClick={() => { setLoading(true); fetchReportes(); loadLocalData(); }}
              style={{ background: 'rgba(0,210,190,0.08)', border: '1px solid rgba(0,210,190,0.2)', color: 'var(--primary)', borderRadius: '12px', padding: '10px 16px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '800', fontFamily: 'inherit' }}
            >
              ↻ Actualizar
            </button>
          </div>
        </header>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '12px 18px', marginBottom: '1.5rem', color: '#ef4444', fontSize: '0.82rem', fontWeight: '600' }}>
            ⚠ {error} — Mostrando datos locales disponibles.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.3rem' }}>

          <div className="kpi-hero dash-rise" style={{ ...heroCard, gridColumn: 'span 1' }}>
            <div style={heroTop}>
              <span style={heroLabel}>Ventas de hoy</span>
              <span style={{ fontSize: '1.2rem', opacity: 0.6 }}>💰</span>
            </div>
            {loading ? <Skeleton height="38px" /> : (
              <>
                <p style={heroValue}><span style={heroCurr}>Gs.</span> {fmt(data?.ventasHoy)}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  {data?.porcentajeCambio !== 0 && (
                    <span style={{ color: data?.porcentajeCambio >= 0 ? '#22c55e' : '#ef4444', fontWeight: '900', fontSize: '0.74rem' }}>
                      {data?.porcentajeCambio >= 0 ? '▲' : '▼'} {Math.abs(data?.porcentajeCambio)}%
                    </span>
                  )}
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: '600' }}>vs. ayer</span>
                </div>
                {data?.ventas14dias && (
                  <div style={{ marginTop: '10px' }}>
                    <Sparkline data={data.ventas14dias.map(d => d.total)} color="#00D2BE" height={34} />
                  </div>
                )}
              </>
            )}
          </div>

          <div className="kpi-hero dash-rise" style={{ ...heroCard, animationDelay: '0.05s' }}>
            <div style={heroTop}>
              <span style={heroLabel}>Margen de hoy</span>
              <span style={{ fontSize: '1.2rem', opacity: 0.6 }}>📊</span>
            </div>
            {loading ? <Skeleton height="38px" /> : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <p style={{ ...heroValue, fontSize: '1.5rem' }}><span style={heroCurr}>Gs.</span> {fmt(data?.margenHoy)}</p>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: '600' }}>
                    bruto (ventas − costo)
                  </span>
                  <div style={{ marginTop: '6px' }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: '800', color: fcColor(data?.foodCostHoy), background: `${fcColor(data?.foodCostHoy)}18`, padding: '2px 8px', borderRadius: '6px' }}>
                      Food Cost {data?.foodCostHoy || 0}%
                    </span>
                  </div>
                </div>
                <MiniGauge value={data?.foodCostHoy || 0} />
              </div>
            )}
          </div>

          <div className="kpi-hero dash-rise" style={{ ...heroCard, animationDelay: '0.1s' }}>
            <div style={heroTop}>
              <span style={heroLabel}>Ticket promedio</span>
              <span style={{ fontSize: '1.2rem', opacity: 0.6 }}>🎟️</span>
            </div>
            {loading ? <Skeleton height="38px" /> : (
              <>
                <p style={heroValue}><span style={heroCurr}>Gs.</span> {fmt(data?.ticketPromedio)}</p>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: '600' }}>
                  {data?.facturasHoy || 0} facturas hoy · {data?.facturasMes || 0} este mes
                </span>
                {data?.horaPico?.hora != null && (
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.66rem', color: 'rgba(255,255,255,0.55)' }}>
                    <span>⏰ Hora pico:</span>
                    <strong style={{ color: 'var(--primary)' }}>{String(data.horaPico.hora).padStart(2, '0')}:00</strong>
                    <span>· Gs. {fmtK(data.horaPico.total)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="kpi-hero dash-rise" style={{ ...heroCard, animationDelay: '0.15s' }}>
            <div style={heroTop}>
              <span style={heroLabel}>Ocupación</span>
              <span style={{ fontSize: '1.2rem', opacity: 0.6 }}>🪑</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <div>
                <p style={heroValue}>{mesasOcupadas}<span style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-muted)' }}> / {totalMesas}</span></p>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: '600' }}>mesas ocupadas</span>
                {mesasLimpieza > 0 && (
                  <div style={{ marginTop: '6px', fontSize: '0.62rem', color: 'var(--primary)', fontWeight: '700' }}>
                    🧹 {mesasLimpieza} en limpieza
                  </div>
                )}
              </div>
              <MiniDonut pct={porcentajeOcupacion} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {REPORTES_LINKS.map(r => (
            <div key={r.path} className="qr-link" onClick={() => router.push(r.path)}
              style={{ flex: '1 1 130px', minWidth: '120px', display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', cursor: 'pointer' }}>
              <span style={{ fontSize: '1.1rem' }}>{r.icon}</span>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '0.74rem', fontWeight: '800', color: '#fff', whiteSpace: 'nowrap' }}>{r.label}</p>
                <p style={{ fontSize: '0.56rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ver reporte →</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1.3rem' }}>

          {/* Área chart 14 días */}
          <div className="dash-section">
            <div className="dash-section-title">
              📈 <span>Ventas últimos 14 días</span>
              {data && (
                <span style={{ marginLeft: 'auto', display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                    Semana: <strong style={{ color: 'var(--primary)' }}>Gs. {fmtK(data.ventasSemanaActual)}</strong>
                  </span>
                  {data.cambioSemanal !== undefined && (
                    <span style={{ fontSize: '0.62rem', color: data.cambioSemanal >= 0 ? '#22c55e' : '#ef4444', fontWeight: '800' }}>
                      {data.cambioSemanal >= 0 ? '▲' : '▼'} {Math.abs(data.cambioSemanal)}% vs sem. previa
                    </span>
                  )}
                </span>
              )}
            </div>
            {loading ? <Skeleton height="200px" /> : (
              <AreaChart data={data?.ventas14dias || []} />
            )}
          </div>

          {/* Donut categorías */}
          <div className="dash-section">
            <div className="dash-section-title">📂 <span>Ventas por categoría</span></div>
            {loading ? <Skeleton height="200px" /> : (data?.ventasPorCategoria?.length === 0 ? (
              <Empty texto="Sin datos de categorías" />
            ) : (
              <CategoriaDonut categorias={data.ventasPorCategoria} />
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: '1rem', marginBottom: '1.3rem' }}>

          {/* Top productos */}
          <div className="dash-section">
            <div className="dash-section-title">🏆 <span>Top productos</span></div>
            {loading ? <Skeleton height="160px" /> : (data?.topProductos?.length === 0 ? (
              <Empty texto="Sin ventas aún" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {data.topProductos.map((prod, i) => {
                  const max = data.topProductos[0]?.cantidadVendida || 1;
                  const pct = (prod.cantidadVendida / max) * 100;
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <span style={{ width: '20px', height: '20px', borderRadius: '6px', background: i === 0 ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: '900', color: i === 0 ? '#000' : 'var(--text-muted)', flexShrink: 0 }}>{i + 1}</span>
                          <span style={{ fontSize: '0.76rem', fontWeight: '700', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prod.nombre}</span>
                        </div>
                        <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--primary)', flexShrink: 0 }}>{prod.cantidadVendida}u</span>
                      </div>
                      <div style={{ height: '5px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: '10px', background: 'var(--accent-gradient)', opacity: 1 - (i * 0.12), transition: 'width 1s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="dash-section">
            <div className="dash-section-title">💳 <span>Métodos de pago (hoy)</span></div>
            {loading ? <Skeleton height="160px" /> : (data?.metodosPago?.length === 0 ? (
              <Empty texto="Sin ventas hoy" />
            ) : (
              <MetodosDonut metodos={data.metodosPago} />
            ))}
          </div>

          {/* Actividad horaria — área */}
          <div className="dash-section">
            <div className="dash-section-title">⏰ <span>Actividad por hora (hoy)</span></div>
            {loading ? <Skeleton height="160px" /> : (
              <HorariaChart distribucion={data?.distribucionHoraria || []} />
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.3rem' }}>
          <LiveCard icon="🍳" valor={pedidosCocina} label="Pedidos en cocina" color="#f59e0b" activo={pedidosCocina > 0} />
          <LiveCard icon="🪑" valor={mesasOcupadas} label="Mesas ocupadas" color="#3b82f6" activo={mesasOcupadas > 0} />
          <LiveCard icon="🧹" valor={mesasLimpieza} label="Mesas en limpieza" color="#00D2BE" activo={mesasLimpieza > 0} />
          <LiveCard icon="📋" valor={data?.pedidosActivosBD || 0} label="Pedidos abiertos (BD)" color="#a855f7" activo={(data?.pedidosActivosBD || 0) > 0} />
        </div>

        {!loading && data?.stockBajo?.length > 0 && (
          <div className="dash-section stock-alert" style={{ marginBottom: '1.3rem', background: 'rgba(239,68,68,0.03)', borderColor: 'rgba(239,68,68,0.15)' }}>
            <div className="dash-section-title" style={{ color: '#ef4444' }}>
              ⚠️ <span style={{ color: '#ef4444' }}>Alertas de stock bajo ({data.stockBajo.length})</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '10px' }}>
              {data.stockBajo.map(prod => (
                <div key={prod.id} style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: '12px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: '900', color: '#ef4444', flexShrink: 0 }}>{prod.stockActual}</div>
                  <div style={{ overflow: 'hidden' }}>
                    <p style={{ fontSize: '0.78rem', fontWeight: '700', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prod.nombre}</p>
                    <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Mín: {prod.stockMinimo} · {prod.categoria}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="dash-section" style={{ marginBottom: '2rem' }}>
          <div className="dash-section-title">
            🧾 <span>Últimas facturas</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.58rem', color: 'var(--text-muted)', fontWeight: '600' }}>Últimas 10</span>
          </div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[...Array(5)].map((_, i) => <Skeleton key={i} height="38px" />)}
            </div>
          ) : data?.ultimasFacturas?.length === 0 ? (
            <Empty texto="No hay facturas emitidas todavía" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['N° Factura', 'Cliente', 'RUC', 'Total', 'Método', 'Fecha', 'SIFEN'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '800' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.ultimasFacturas.map(f => (
                    <tr key={f.id} className="factura-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '9px 12px', fontWeight: '700', color: 'var(--primary)', fontFamily: 'monospace', fontSize: '0.72rem' }}>{f.numero}</td>
                      <td style={{ padding: '9px 12px', fontWeight: '600', color: '#fff', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.cliente}</td>
                      <td style={{ padding: '9px 12px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.72rem' }}>{f.ruc || '—'}</td>
                      <td style={{ padding: '9px 12px', fontWeight: '800', color: '#fff' }}><span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginRight: '2px' }}>Gs.</span>{fmt(f.total)}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ fontSize: '0.62rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', fontWeight: '600', border: '1px solid rgba(255,255,255,0.06)' }}>
                          {METODO_ICONS[f.metodo] || ''} {f.metodo || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                        {f.fecha ? new Date(f.fecha).toLocaleString('es-PY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ fontSize: '0.6rem', padding: '3px 10px', borderRadius: '20px', fontWeight: '800', background: f.estadoSifen === 'Aprobado' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: f.estadoSifen === 'Aprobado' ? '#22c55e' : '#f59e0b', border: `1px solid ${f.estadoSifen === 'Aprobado' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
                          {f.estadoSifen || 'Pendiente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}


function Sparkline({ data, color = '#00D2BE', height = 34 }) {
  const w = 200;
  const h = height;
  if (!data || data.length === 0) return <div style={{ height: h }} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = w / (data.length - 1 || 1);
  const pts = data.map((v, i) => [i * step, h - ((v - min) / range) * (h - 4) - 2]);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;
  const id = `spark${color.replace('#', '')}`;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.length > 0 && <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={color} />}
    </svg>
  );
}

function AreaChart({ data }) {
  const [hover, setHover] = useState(null);
  if (!data || data.length === 0) return <Empty texto="Sin datos" />;
  const w = 700, h = 200, padB = 28, padT = 12;
  const max = Math.max(...data.map(d => d.total), 1);
  const step = w / (data.length - 1 || 1);
  const y = (v) => padT + (1 - v / max) * (h - padB - padT);
  const pts = data.map((d, i) => [i * step, y(d.total)]);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L ${(data.length - 1) * step} ${h - padB} L 0 ${h - padB} Z`;

  return (
    <div style={{ position: 'relative' }}>
      {hover !== null && data[hover] && (
        <div style={{ position: 'absolute', top: 0, left: `${(hover / (data.length - 1)) * 100}%`, transform: 'translateX(-50%)', background: '#0d1117', border: '1px solid var(--primary)', borderRadius: '8px', padding: '6px 12px', zIndex: 10, whiteSpace: 'nowrap', fontSize: '0.72rem', pointerEvents: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
          <strong style={{ color: 'var(--primary)' }}>Gs. {fmt(data[hover].total)}</strong>
          <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>{data[hover].cantidad} fact.</span>
        </div>
      )}
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00D2BE" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#00D2BE" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(g => (
          <line key={g} x1="0" y1={padT + g * (h - padB - padT)} x2={w} y2={padT + g * (h - padB - padT)} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        ))}
        <path d={area} fill="url(#areaFill)" />
        <path d={line} fill="none" stroke="#00D2BE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => {
          const isToday = i === data.length - 1;
          return <circle key={i} cx={p[0]} cy={p[1]} r={isToday ? 4 : 2.5} fill={isToday ? '#00D2BE' : '#0d0f14'} stroke="#00D2BE" strokeWidth="2" />;
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, cursor: 'pointer' }} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}
      </div>
      <div style={{ display: 'flex', marginTop: '6px' }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '0.52rem', color: i === data.length - 1 ? 'var(--primary)' : 'var(--text-muted)', fontWeight: i === data.length - 1 ? '900' : '600' }}>
            {new Date(`${d.fecha}T12:00:00`).toLocaleDateString('es-ES', { day: '2-digit' })}
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoriaDonut({ categorias }) {
  const total = categorias.reduce((s, c) => s + c.total, 0);
  const size = 150, cx = size / 2, cy = size / 2, r = 58, ir = 38;
  let ang = -Math.PI / 2;
  const slices = categorias.map((c, i) => {
    const a = (c.total / total) * Math.PI * 2;
    const start = ang, end = ang + a;
    ang = end;
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
    const ix1 = cx + ir * Math.cos(end), iy1 = cy + ir * Math.sin(end);
    const ix2 = cx + ir * Math.cos(start), iy2 = cy + ir * Math.sin(start);
    const large = a > Math.PI ? 1 : 0;
    return { d: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${ir} ${ir} 0 ${large} 0 ${ix2} ${iy2} Z`, color: CATEGORIA_COLORS[i % CATEGORIA_COLORS.length], cat: c };
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => (
          <path key={i} d={s.d} fill={s.color} stroke="#0d0f14" strokeWidth="2">
            <title>{`${s.cat.categoria}: Gs. ${fmt(s.cat.total)} (${s.cat.porcentaje}%)`}</title>
          </path>
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--text-muted)" fontSize="8" fontWeight="700" letterSpacing="1px">TOTAL</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="900">{fmtK(total)}</text>
      </svg>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {categorias.slice(0, 5).map((c, i) => (
          <div key={c.categoria} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: CATEGORIA_COLORS[i % CATEGORIA_COLORS.length], flexShrink: 0 }} />
            <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: '600', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.categoria}</span>
            <span style={{ color: CATEGORIA_COLORS[i % CATEGORIA_COLORS.length], fontWeight: '800' }}>{c.porcentaje}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetodosDonut({ metodos }) {
  const total = metodos.reduce((s, m) => s + m.total, 0);
  const size = 130, cx = size / 2, cy = size / 2, r = 50, ir = 32;
  let ang = -Math.PI / 2;
  const slices = metodos.map((m) => {
    const a = (m.total / total) * Math.PI * 2;
    const start = ang, end = ang + a;
    ang = end;
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
    const ix1 = cx + ir * Math.cos(end), iy1 = cy + ir * Math.sin(end);
    const ix2 = cx + ir * Math.cos(start), iy2 = cy + ir * Math.sin(start);
    const large = a > Math.PI ? 1 : 0;
    return { d: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${ir} ${ir} 0 ${large} 0 ${ix2} ${iy2} Z`, color: METODO_COLORS[m.metodo] || '#06b6d4', m };
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => (
          <path key={i} d={s.d} fill={s.color} stroke="#0d0f14" strokeWidth="2">
            <title>{`${s.m.metodo}: Gs. ${fmt(s.m.total)} · ${s.m.cantidad} ops`}</title>
          </path>
        ))}
        <text x={cx} y={cy + 4} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="900">{fmtK(total)}</text>
      </svg>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {metodos.map(m => {
          const pct = total > 0 ? Math.round((m.total / total) * 100) : 0;
          return (
            <div key={m.metodo} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.68rem' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: METODO_COLORS[m.metodo] || '#06b6d4', flexShrink: 0 }} />
              <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: '600', flex: 1 }}>{METODO_ICONS[m.metodo] || ''} {m.metodo}</span>
              <span style={{ color: '#fff', fontWeight: '700' }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HorariaChart({ distribucion }) {
  const visible = distribucion.filter(h => h.hora >= 6 && h.hora <= 23);
  const max = Math.max(...visible.map(h => h.cantidad), 1);
  const [hover, setHover] = useState(null);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '130px', position: 'relative' }}>
        {visible.map((h) => {
          const pct = (h.cantidad / max) * 100;
          const active = h.cantidad > 0;
          return (
            <div key={h.hora} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', position: 'relative' }}
              onMouseEnter={() => setHover(h.hora)} onMouseLeave={() => setHover(null)}>
              {hover === h.hora && active && (
                <div style={{ position: 'absolute', top: '-24px', background: '#0d1117', border: '1px solid var(--primary)', borderRadius: '6px', padding: '2px 7px', fontSize: '0.58rem', color: 'var(--primary)', fontWeight: '800', whiteSpace: 'nowrap', zIndex: 5 }}>
                  {h.cantidad} · Gs.{fmtK(h.total)}
                </div>
              )}
              <div style={{ width: '100%', height: `${Math.max(pct, 2)}%`, background: active ? `rgba(0,210,190,${0.25 + (pct / 100) * 0.6})` : 'rgba(255,255,255,0.03)', borderRadius: '3px 3px 0 0', transition: 'all 0.3s', cursor: active ? 'pointer' : 'default' }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: '3px', marginTop: '5px' }}>
        {visible.map(h => (
          <div key={h.hora} style={{ flex: 1, textAlign: 'center', fontSize: '0.5rem', color: 'var(--text-muted)', fontWeight: '600' }}>
            {h.hora % 3 === 0 ? `${h.hora}h` : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniGauge({ value }) {
  const v = Math.min(50, Math.max(0, value));
  const color = fcColor(value);
  const size = 72, cx = size / 2, cy = size / 2, r = 28;
  const circ = Math.PI * r; // semicírculo
  const pct = v / 50;
  return (
    <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`}>
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" strokeLinecap="round" />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} />
      <text x={cx} y={cy - 2} textAnchor="middle" fill={color} fontSize="14" fontWeight="900">{value}%</text>
    </svg>
  );
}

function MiniDonut({ pct }) {
  const size = 64, cx = size / 2, cy = size / 2, r = 26;
  const circ = 2 * Math.PI * r;
  const color = pct > 75 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#00D2BE';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: 'stroke-dashoffset 1s ease' }} />
      <text x={cx} y={cy + 4} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="900">{pct}%</text>
    </svg>
  );
}

function LiveCard({ icon, valor, label, color, activo }) {
  return (
    <div className="dash-stat" style={{ background: activo ? `${color}0a` : 'var(--glass-bg)', borderColor: activo ? `${color}28` : 'var(--card-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: activo ? `${color}1f` : 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>{icon}</div>
        <div>
          <p style={{ fontSize: '1.5rem', fontWeight: '900', color: activo ? color : '#fff', lineHeight: 1 }}>{valor}</p>
          <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '3px' }}>{label}</p>
        </div>
      </div>
    </div>
  );
}

function Empty({ texto }) {
  return <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '2rem 0' }}>{texto}</p>;
}

function fcColor(pct) {
  if (!pct) return '#6b7280';
  if (pct <= 28) return '#22c55e';
  if (pct <= 35) return '#84cc16';
  if (pct <= 40) return '#f59e0b';
  return '#ef4444';
}

const heroCard = { background: 'var(--glass-bg)', border: '1px solid var(--card-border)', borderRadius: '18px', padding: '1.2rem 1.3rem', position: 'relative', overflow: 'hidden' };
const heroTop = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.7rem' };
const heroLabel = { color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1.5px' };
const heroValue = { fontSize: '1.7rem', fontWeight: '900', color: '#fff', lineHeight: 1 };
const heroCurr = { fontSize: '0.65rem', fontWeight: '600', color: 'var(--text-muted)', marginRight: '2px' };