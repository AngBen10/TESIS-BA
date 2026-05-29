'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

const fmt = (n) => Number(n || 0).toLocaleString('es-PY');

const CATEGORIA_COLORS = [
  '#00D2BE', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#22c55e', '#ec4899', '#06b6d4'
];

const METODO_ICONS = {
  'Efectivo': '💵',
  'Tarjeta': '💳',
  'Transferencia': '📱',
  'Sin especificar': '❓',
};

// Loading skeleton component
function Skeleton({ width = '100%', height = '20px' }) {
  return <div className="skeleton" style={{ width, height, minHeight: height }} />;
}

export default function Home() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [hoveredBar, setHoveredBar] = useState(null);
  const [hoveredHour, setHoveredHour] = useState(null);

  // Local state from localStorage
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
    } catch (_) {}
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
    if (!storedUser) {
      router.push('/login');
    } else {
      setUser(JSON.parse(storedUser));
      fetchReportes();
      loadLocalData();
    }

    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      fetchReportes();
      loadLocalData();
    }, 60000);

    // Listen for local storage updates
    const handleUpdate = () => loadLocalData();
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('pedidos_updated', handleUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('pedidos_updated', handleUpdate);
    };
  }, [router, fetchReportes, loadLocalData]);

  if (!user) return null;

  const porcentajeOcupacion = totalMesas > 0 ? Math.round((mesasOcupadas / totalMesas) * 100) : 0;
  const maxSemana = data ? Math.max(...data.ventasSemana.map(d => d.total), 1) : 1;
  const maxHoraria = data ? Math.max(...data.distribucionHoraria.map(h => h.cantidad), 1) : 1;
  const maxTopProducto = data && data.topProductos.length > 0 ? data.topProductos[0].cantidadVendida : 1;

  return (
    <div className="desktop-app">
      <Sidebar user={user} />

      <main className="main-view">
        {/* ═══════ HEADER ═══════ */}
        <header style={{ marginBottom: '1.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: '900', color: '#fff', marginBottom: '0.15rem', lineHeight: 1.1 }}>
              Dashboard
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', letterSpacing: '1.5px', fontWeight: 'bold', textTransform: 'uppercase' }}>
              Centro de control · Reportes en tiempo real
            </p>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => { setLoading(true); fetchReportes(); loadLocalData(); }}
              style={{
                background: 'rgba(0,210,190,0.08)', border: '1px solid rgba(0,210,190,0.2)',
                color: 'var(--primary)', borderRadius: '10px', padding: '8px 16px',
                cursor: 'pointer', fontSize: '0.72rem', fontWeight: '700', transition: 'all 0.2s',
                fontFamily: 'inherit'
              }}
            >
              ↻ Actualizar
            </button>
            <div>
              <p style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'capitalize' }}>
                {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                {lastUpdate ? `Última actualización: ${lastUpdate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ''}
              </p>
            </div>
          </div>
        </header>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '12px', padding: '12px 18px', marginBottom: '1.5rem',
            color: '#ef4444', fontSize: '0.82rem', fontWeight: '600'
          }}>
            ⚠ {error} — Se mostrarán datos locales disponibles.
          </div>
        )}

        {/* ═══════ KPI CARDS ═══════ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          {/* Ventas Hoy */}
          <div className="dash-stat" style={{ animationDelay: '0s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                Ventas Hoy
              </p>
              <span style={{ fontSize: '1.4rem', lineHeight: 1, opacity: 0.7 }}>💰</span>
            </div>
            {loading ? <Skeleton height="36px" /> : (
              <>
                <p style={{ fontSize: '1.8rem', fontWeight: '900', color: '#fff', lineHeight: 1, marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-muted)', marginRight: '2px' }}>Gs.</span>
                  {fmt(data?.ventasHoy)}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {data?.porcentajeCambio !== 0 && (
                    <span style={{
                      color: data?.porcentajeCambio >= 0 ? 'var(--success)' : 'var(--error)',
                      fontWeight: '900', fontSize: '0.78rem',
                      display: 'flex', alignItems: 'center', gap: '2px'
                    }}>
                      {data?.porcentajeCambio >= 0 ? '▲' : '▼'} {Math.abs(data?.porcentajeCambio)}%
                    </span>
                  )}
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: '500' }}>vs. ayer</span>
                </div>
              </>
            )}
          </div>

          {/* Facturas Emitidas */}
          <div className="dash-stat" style={{ animationDelay: '0.08s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                Facturas Hoy
              </p>
              <span style={{ fontSize: '1.4rem', lineHeight: 1, opacity: 0.7 }}>🧾</span>
            </div>
            {loading ? <Skeleton height="36px" /> : (
              <>
                <p style={{ fontSize: '1.8rem', fontWeight: '900', color: '#fff', lineHeight: 1, marginBottom: '0.5rem' }}>
                  {data?.facturasHoy || 0}
                </p>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: '500' }}>
                  {data?.facturasMes || 0} este mes
                </span>
              </>
            )}
          </div>

          {/* Ticket Promedio */}
          <div className="dash-stat" style={{ animationDelay: '0.16s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                Ticket Promedio
              </p>
              <span style={{ fontSize: '1.4rem', lineHeight: 1, opacity: 0.7 }}>💵</span>
            </div>
            {loading ? <Skeleton height="36px" /> : (
              <>
                <p style={{ fontSize: '1.8rem', fontWeight: '900', color: '#fff', lineHeight: 1, marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-muted)', marginRight: '2px' }}>Gs.</span>
                  {fmt(data?.ticketPromedio)}
                </p>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: '500' }}>
                  por factura emitida
                </span>
              </>
            )}
          </div>

          {/* Ocupación Mesas */}
          <div className="dash-stat" style={{ animationDelay: '0.24s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                Ocupación Mesas
              </p>
              <span style={{ fontSize: '1.4rem', lineHeight: 1, opacity: 0.7 }}>🪑</span>
            </div>
            <p style={{ fontSize: '1.8rem', fontWeight: '900', color: '#fff', lineHeight: 1, marginBottom: '0.6rem' }}>
              {mesasOcupadas} <span style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-muted)' }}>/ {totalMesas}</span>
            </p>
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{
                width: `${porcentajeOcupacion}%`, height: '100%',
                background: porcentajeOcupacion > 75 ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : 'var(--accent-gradient)',
                borderRadius: '10px', transition: 'width 0.8s ease'
              }} />
            </div>
          </div>
        </div>

        {/* ═══════ ROW 2: Charts + Top Products ═══════ */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>

          {/* Weekly Sales Bar Chart */}
          <div className="dash-section">
            <div className="dash-section-title">
              📊 <span>Ventas Últimos 7 Días</span>
              {data && (
                <span style={{ marginLeft: 'auto', color: 'var(--primary)', fontWeight: '900', fontSize: '0.7rem' }}>
                  Mes: Gs. {fmt(data.ventasMes)}
                </span>
              )}
            </div>
            {loading ? (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', height: '160px' }}>
                {[...Array(7)].map((_, i) => <Skeleton key={i} width="100%" height={`${30 + Math.random() * 80}px`} />)}
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                {/* Tooltip */}
                {hoveredBar !== null && data?.ventasSemana[hoveredBar] && (
                  <div style={{
                    position: 'absolute', top: '-8px', left: '50%', transform: 'translateX(-50%)',
                    background: '#0d1117', border: '1px solid var(--primary)', borderRadius: '10px',
                    padding: '8px 14px', zIndex: 10, whiteSpace: 'nowrap',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
                    fontSize: '0.75rem', color: '#fff', fontWeight: '700'
                  }}>
                    <span style={{ color: 'var(--primary)' }}>Gs. {fmt(data.ventasSemana[hoveredBar].total)}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>{data.ventasSemana[hoveredBar].cantidad} facturas</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '160px', padding: '0 4px' }}>
                  {data?.ventasSemana.map((dia, i) => {
                    const heightPct = maxSemana > 0 ? (dia.total / maxSemana) * 100 : 0;
                    const isToday = i === data.ventasSemana.length - 1;
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', height: '100%', justifyContent: 'flex-end' }}>
                        <div
                          className="chart-bar"
                          style={{
                            width: '100%',
                            height: `${Math.max(heightPct, 3)}%`,
                            background: isToday
                              ? 'var(--accent-gradient)'
                              : `linear-gradient(180deg, rgba(0,210,190,0.4) 0%, rgba(0,210,190,0.15) 100%)`,
                            animationDelay: `${i * 0.08}s`,
                            boxShadow: isToday ? '0 0 15px rgba(0,210,190,0.2)' : 'none',
                          }}
                          onMouseEnter={() => setHoveredBar(i)}
                          onMouseLeave={() => setHoveredBar(null)}
                        />
                        <div style={{ textAlign: 'center' }}>
                          <p style={{
                            fontSize: '0.65rem', fontWeight: isToday ? '900' : '600',
                            color: isToday ? 'var(--primary)' : 'var(--text-muted)',
                            textTransform: 'capitalize'
                          }}>
                            {dia.diaNombre}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Top 5 Products */}
          <div className="dash-section">
            <div className="dash-section-title">🏆 <span>Top Productos</span></div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[...Array(5)].map((_, i) => <Skeleton key={i} height="32px" />)}
              </div>
            ) : data?.topProductos.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '2rem 0' }}>Sin datos de ventas aún</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data?.topProductos.map((prod, i) => {
                  const pct = maxTopProducto > 0 ? (prod.cantidadVendida / maxTopProducto) * 100 : 0;
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            width: '22px', height: '22px', borderRadius: '6px',
                            background: i === 0 ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.06)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.6rem', fontWeight: '900', color: i === 0 ? '#000' : 'var(--text-muted)',
                            flexShrink: 0
                          }}>
                            {i + 1}
                          </span>
                          <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }}>
                            {prod.nombre}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--primary)', flexShrink: 0 }}>
                          {prod.cantidadVendida}u
                        </span>
                      </div>
                      <div style={{ height: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', overflow: 'hidden' }}>
                        <div className="progress-fill" style={{ width: `${pct}%`, opacity: 1 - (i * 0.12) }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ═══════ ROW 3: Horaria + Categorías + Métodos de Pago ═══════ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>

          {/* Hourly Distribution */}
          <div className="dash-section">
            <div className="dash-section-title">⏰ <span>Actividad por Hora (Hoy)</span></div>
            {loading ? <Skeleton height="100px" /> : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '100px' }}>
                {data?.distribucionHoraria.filter((_, i) => i >= 6 && i <= 23).map((h, i) => {
                  const heightPct = maxHoraria > 0 ? (h.cantidad / maxHoraria) * 100 : 0;
                  const isActive = h.cantidad > 0;
                  const actualIdx = i + 6;
                  return (
                    <div
                      key={h.hora}
                      style={{
                        flex: 1, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end',
                        position: 'relative'
                      }}
                      onMouseEnter={() => setHoveredHour(actualIdx)}
                      onMouseLeave={() => setHoveredHour(null)}
                    >
                      {hoveredHour === actualIdx && isActive && (
                        <div style={{
                          position: 'absolute', top: '-22px',
                          background: '#0d1117', border: '1px solid var(--primary)', borderRadius: '6px',
                          padding: '2px 6px', fontSize: '0.6rem', color: 'var(--primary)', fontWeight: '800',
                          whiteSpace: 'nowrap', zIndex: 5
                        }}>
                          {h.cantidad} · Gs.{fmt(h.total)}
                        </div>
                      )}
                      <div style={{
                        width: '100%',
                        height: `${Math.max(heightPct, 2)}%`,
                        background: isActive
                          ? `rgba(0,210,190,${0.2 + (heightPct / 100) * 0.6})`
                          : 'rgba(255,255,255,0.03)',
                        borderRadius: '3px 3px 0 0',
                        transition: 'all 0.3s',
                        cursor: isActive ? 'pointer' : 'default'
                      }} />
                      {(h.hora % 3 === 0) && (
                        <span style={{ fontSize: '0.5rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                          {h.hora}h
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sales by Category (visual donut) */}
          <div className="dash-section">
            <div className="dash-section-title">📂 <span>Por Categoría</span></div>
            {loading ? <Skeleton height="120px" /> : data?.ventasPorCategoria.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '1.5rem 0' }}>Sin datos</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data?.ventasPorCategoria.map((cat, i) => (
                  <div key={cat.categoria}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          background: CATEGORIA_COLORS[i % CATEGORIA_COLORS.length], flexShrink: 0
                        }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'rgba(255,255,255,0.8)' }}>
                          {cat.categoria}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.68rem', fontWeight: '800', color: CATEGORIA_COLORS[i % CATEGORIA_COLORS.length] }}>
                        {cat.porcentaje}%
                      </span>
                    </div>
                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${cat.porcentaje}%`, height: '100%', borderRadius: '10px',
                        background: CATEGORIA_COLORS[i % CATEGORIA_COLORS.length],
                        transition: 'width 1s ease', opacity: 0.7
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment Methods */}
          <div className="dash-section">
            <div className="dash-section-title">💳 <span>Métodos de Pago</span></div>
            {loading ? <Skeleton height="120px" /> : data?.metodosPago.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '1.5rem 0' }}>Sin ventas hoy</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {data?.metodosPago.map((mp) => {
                  const totalMetodos = data.metodosPago.reduce((s, m) => s + m.total, 0);
                  const pct = totalMetodos > 0 ? Math.round((mp.total / totalMetodos) * 100) : 0;
                  return (
                    <div key={mp.metodo} style={{
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '12px', padding: '10px 12px',
                      display: 'flex', alignItems: 'center', gap: '10px'
                    }}>
                      <span style={{ fontSize: '1.2rem' }}>{METODO_ICONS[mp.metodo] || '💰'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#fff' }}>{mp.metodo}</span>
                          <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--primary)' }}>Gs. {fmt(mp.total)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{mp.cantidad} operaciones</span>
                          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: '700' }}>{pct}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ═══════ ROW 4: Live Stats + Stock Alerts ═══════ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          {/* Live: Pedidos en cocina */}
          <div className="dash-stat" style={{
            background: pedidosCocina > 0 ? 'rgba(245,158,11,0.04)' : 'var(--glass-bg)',
            borderColor: pedidosCocina > 0 ? 'rgba(245,158,11,0.15)' : 'var(--card-border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '12px',
                background: pedidosCocina > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem'
              }}>🍳</div>
              <div>
                <p style={{ fontSize: '1.4rem', fontWeight: '900', color: pedidosCocina > 0 ? '#f59e0b' : '#fff' }}>{pedidosCocina}</p>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pedidos en Cocina</p>
              </div>
            </div>
          </div>

          {/* Live: Mesas en limpieza */}
          <div className="dash-stat" style={{
            background: mesasLimpieza > 0 ? 'rgba(0,210,190,0.04)' : 'var(--glass-bg)',
            borderColor: mesasLimpieza > 0 ? 'rgba(0,210,190,0.15)' : 'var(--card-border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '12px',
                background: mesasLimpieza > 0 ? 'rgba(0,210,190,0.12)' : 'rgba(255,255,255,0.04)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem'
              }}>🧹</div>
              <div>
                <p style={{ fontSize: '1.4rem', fontWeight: '900', color: mesasLimpieza > 0 ? 'var(--primary)' : '#fff' }}>{mesasLimpieza}</p>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mesas en Limpieza</p>
              </div>
            </div>
          </div>

          {/* Ventas del mes */}
          <div className="dash-stat" style={{
            background: 'rgba(139,92,246,0.03)',
            borderColor: 'rgba(139,92,246,0.12)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '12px',
                background: 'rgba(139,92,246,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem'
              }}>📈</div>
              <div>
                <p style={{ fontSize: '1.1rem', fontWeight: '900', color: '#fff' }}>
                  <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginRight: '2px' }}>Gs.</span>
                  {loading ? '...' : fmt(data?.ventasMes)}
                </p>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ventas del Mes</p>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════ ROW 5: Stock Alerts (si hay) ═══════ */}
        {!loading && data?.stockBajo?.length > 0 && (
          <div className="dash-section stock-alert" style={{ marginBottom: '1.5rem', background: 'rgba(239,68,68,0.03)', borderColor: 'rgba(239,68,68,0.15)' }}>
            <div className="dash-section-title" style={{ color: '#ef4444' }}>
              ⚠️ <span style={{ color: '#ef4444' }}>Alertas de Stock Bajo ({data.stockBajo.length})</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
              {data.stockBajo.map(prod => (
                <div key={prod.id} style={{
                  background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)',
                  borderRadius: '12px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px'
                }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: 'rgba(239,68,68,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.9rem', fontWeight: '900', color: '#ef4444', flexShrink: 0
                  }}>
                    {prod.stockActual}
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <p style={{ fontSize: '0.78rem', fontWeight: '700', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {prod.nombre}
                    </p>
                    <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                      Mín: {prod.stockMinimo} · {prod.categoria}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════ ROW 6: Recent Invoices ═══════ */}
        <div className="dash-section" style={{ marginBottom: '2rem' }}>
          <div className="dash-section-title">
            🧾 <span>Últimas Facturas</span>
            {data && (
              <span style={{ marginLeft: 'auto', fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                Últimas 10
              </span>
            )}
          </div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[...Array(5)].map((_, i) => <Skeleton key={i} height="38px" />)}
            </div>
          ) : data?.ultimasFacturas.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '2rem 0' }}>
              No hay facturas emitidas todavía
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['N° Factura', 'Cliente', 'RUC', 'Total', 'Método', 'Fecha', 'SIFEN'].map(h => (
                      <th key={h} style={{
                        padding: '8px 12px', textAlign: 'left',
                        fontSize: '0.58rem', color: 'var(--text-muted)',
                        textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '800'
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.ultimasFacturas.map(f => (
                    <tr key={f.id} className="factura-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '9px 12px', fontWeight: '700', color: 'var(--primary)', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                        {f.numero}
                      </td>
                      <td style={{ padding: '9px 12px', fontWeight: '600', color: '#fff', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.cliente}
                      </td>
                      <td style={{ padding: '9px 12px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                        {f.ruc || '—'}
                      </td>
                      <td style={{ padding: '9px 12px', fontWeight: '800', color: '#fff' }}>
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginRight: '2px' }}>Gs.</span>
                        {fmt(f.total)}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{
                          fontSize: '0.62rem', padding: '3px 8px', borderRadius: '6px',
                          background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)',
                          fontWeight: '600', border: '1px solid rgba(255,255,255,0.06)'
                        }}>
                          {METODO_ICONS[f.metodo] || ''} {f.metodo || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                        {f.fecha ? new Date(f.fecha).toLocaleString('es-PY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{
                          fontSize: '0.6rem', padding: '3px 10px', borderRadius: '20px', fontWeight: '800',
                          background: f.estadoSifen === 'Aprobado' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                          color: f.estadoSifen === 'Aprobado' ? '#22c55e' : '#f59e0b',
                          border: `1px solid ${f.estadoSifen === 'Aprobado' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`
                        }}>
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
