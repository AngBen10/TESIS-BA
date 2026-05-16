'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

const INITIAL_MESAS = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  numero: i + 1,
  capacidad: i < 4 ? 2 : i < 8 ? 4 : 6,
  estado: 'Disponible',
  pedidoActivo: false,
  limpiezaFinAt: null,
  reservaAt: null,
  nombreReserva: '',
}));

const STATE_CONFIG = {
  'Disponible': { color: '#22c55e', bg: '#052e16', badge: '#14532d', icon: '✓' },
  'Ocupada':    { color: '#ef4444', bg: '#2d0a0a', badge: '#450a0a', icon: '●' },
  'Reservada':  { color: '#f59e0b', bg: '#2d1f02', badge: '#451a03', icon: '◆' },
  'En Limpieza':{ color: '#00D2BE', bg: '#021f1e', badge: '#033d3a', icon: '◎' },
};

export default function Mesas() {
  const [user, setUser] = useState(null);
  const [mesas, setMesas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [selectedMesa, setSelectedMesa] = useState(null);
  const [showCobrarModal, setShowCobrarModal] = useState(false);
  const [showReservaInputs, setShowReservaInputs] = useState(false);
  
  // Tick to force re-render every second for timers
  const [, setTick] = useState(0);

  // Inputs reserva
  const [reservaFecha, setReservaFecha] = useState('');
  const [reservaHora, setReservaHora] = useState('');
  const [reservaNombre, setReservaNombre] = useState('');
  
  const [ruc, setRuc] = useState('');
  const [nombreCliente, setNombreCliente] = useState('');
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [filterEstado, setFilterEstado] = useState('Todas');
  const router = useRouter();

  const loadData = useCallback(() => {
    const storedMesas = localStorage.getItem('restaurante_mesas');
    setMesas(storedMesas ? JSON.parse(storedMesas) : INITIAL_MESAS);
    const storedPedidos = localStorage.getItem('restaurante_pedidos');
    setPedidos(storedPedidos ? JSON.parse(storedPedidos) : []);
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) { router.push('/login'); return; }
    setUser(JSON.parse(storedUser));
    loadData();

    const handleStorageChange = () => loadData();
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('pedidos_updated', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('pedidos_updated', handleStorageChange);
    };
  }, [router, loadData]);

  useEffect(() => {
    if (mesas.length > 0) localStorage.setItem('restaurante_mesas', JSON.stringify(mesas));
  }, [mesas]);

  // Master Timer Loop (Background check + Re-render trigger)
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1); // Force re-render for real-time timer display
      
      setMesas(prev => {
        let changed = false;
        const next = prev.map(m => {
          let updatedM = { ...m };
          
          // 1. Cleaning logic (Persistent via timestamp)
          if (m.estado === 'En Limpieza' && m.limpiezaFinAt) {
            if (Date.now() >= m.limpiezaFinAt) {
              changed = true;
              updatedM.estado = 'Disponible';
              updatedM.limpiezaFinAt = null;
            }
          }

          // 2. Reservation logic (Automate to 'Reservada' 3 hours before)
          if (m.reservaAt && m.estado === 'Disponible') {
            const tresHoras = 3 * 3600 * 1000;
            if (Date.now() >= (m.reservaAt - tresHoras)) {
              changed = true;
              updatedM.estado = 'Reservada';
            }
          }
          
          // 3. Clear old reservations (1 hour after time)
          if (m.reservaAt && Date.now() > m.reservaAt + (1 * 3600 * 1000)) {
              if (m.estado === 'Reservada' || m.estado === 'Disponible') {
                  changed = true;
                  updatedM.reservaAt = null;
                  updatedM.nombreReserva = '';
                  if (m.estado === 'Reservada') updatedM.estado = 'Disponible';
              }
          }

          return updatedM;
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimeRemaining = (endAt) => {
    if (!endAt) return "00:00";
    const s = Math.max(0, Math.floor((endAt - Date.now()) / 1000));
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const cambiarEstado = (nuevoEstado) => {
    const updated = mesas.map(m => {
      if (m.id !== selectedMesa.id) return m;
      const u = { ...m, estado: nuevoEstado };
      if (nuevoEstado === 'En Limpieza') { 
        u.limpiezaFinAt = Date.now() + (300 * 1000); 
        u.pedidoActivo = false; 
      }
      else if (nuevoEstado !== 'Ocupada') u.pedidoActivo = false;
      return u;
    });
    setMesas(updated);
    const sel = updated.find(m => m.id === selectedMesa.id);
    setSelectedMesa(sel);
  };

  const programarReserva = () => {
    if (!reservaFecha || !reservaHora || !reservaNombre) return;
    const dt = new Date(`${reservaFecha}T${reservaHora}`);
    if (isNaN(dt.getTime())) return;

    const updated = mesas.map(m => 
      m.id === selectedMesa.id ? { ...m, reservaAt: dt.getTime(), nombreReserva: reservaNombre } : m
    );
    setMesas(updated);
    const sel = updated.find(m => m.id === selectedMesa.id);
    setSelectedMesa(sel);
    setShowReservaInputs(false);
    setReservaFecha(''); setReservaHora(''); setReservaNombre('');
  };

  const cancelarReserva = () => {
    const updated = mesas.map(m => 
      m.id === selectedMesa.id ? { ...m, reservaAt: null, nombreReserva: '', estado: m.estado === 'Reservada' ? 'Disponible' : m.estado } : m
    );
    setMesas(updated);
    const sel = updated.find(m => m.id === selectedMesa.id);
    setSelectedMesa(sel);
  };

  const confirmarCobro = () => {
    const pedidosMesa = pedidos.filter(p => p.mesa === `Mesa ${selectedMesa.numero}` && p.estado !== 'Pagado');
    
    // Mark ALL orders for this table as paid
    if (pedidosMesa.length > 0) {
      const idsToPay = pedidosMesa.map(p => p.id);
      const updated = pedidos.map(p =>
        idsToPay.includes(p.id) ? { ...p, estado: 'Pagado' } : p
      );
      localStorage.setItem('restaurante_pedidos', JSON.stringify(updated));
      setPedidos(updated);
    }

    // Set table to cleaning
    const updatedMesas = mesas.map(m =>
      m.id === selectedMesa.id ? { ...m, estado: 'En Limpieza', pedidoActivo: false, limpiezaFinAt: Date.now() + (300 * 1000) } : m
    );
    setMesas(updatedMesas);
    setShowCobrarModal(false);
    setSelectedMesa(null);
    setRuc(''); setNombreCliente('');
  };

  // Get aggregated items for the table
  const getConsumoMesa = (mesaNum) => {
    const mesaPedidos = pedidos.filter(p => p.mesa === `Mesa ${mesaNum}` && p.estado !== 'Pagado');
    const items = [];
    mesaPedidos.forEach(p => {
      p.items.forEach(i => {
        const existing = items.find(ex => ex.id === i.id);
        if (existing) existing.cantidad += i.cantidad;
        else items.push({ ...i });
      });
    });
    return items;
  };

  // Check if table has ANY active order that is NOT delivered
  const hasPendingOrder = (mesaNum) => {
    return pedidos.some(p => p.mesa === `Mesa ${mesaNum}` && p.estado !== 'Pagado' && p.estado !== 'Entregado');
  };

  // Check if table has ANY active order that is already delivered
  const hasServedOrder = (mesaNum) => {
    return pedidos.some(p => p.mesa === `Mesa ${mesaNum}` && p.estado === 'Entregado');
  };

  const isReady = (mesaNum) => {
    return pedidos.some(p => p.mesa === `Mesa ${mesaNum}` && p.estado === 'Listo');
  };

  const mesasFiltradas = filterEstado === 'Todas' ? mesas : mesas.filter(m => m.estado === filterEstado);

  const stats = {
    total: mesas.length,
    disponibles: mesas.filter(m => m.estado === 'Disponible').length,
    ocupadas: mesas.filter(m => m.estado === 'Ocupada').length,
    reservadas: mesas.filter(m => m.estado === 'Reservada').length,
  };

  if (!user) return null;

  const consumoActual = selectedMesa ? getConsumoMesa(selectedMesa.numero) : [];
  const totalConsumo = consumoActual.reduce((a, i) => a + (i.precio || 0) * (i.cantidad || 1), 0);

  return (
    <div className="desktop-app">
      <Sidebar user={user} />
      <main className="main-view">

        {/* Header */}
        <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#fff', marginBottom: '2px' }}>
              Gestión de Mesas
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' }}>
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {[
              { label: 'Total', val: stats.total, color: 'rgba(255,255,255,0.6)' },
              { label: 'Libres', val: stats.disponibles, color: '#22c55e' },
              { label: 'Ocupadas', val: stats.ocupadas, color: '#ef4444' },
              { label: 'Reservadas', val: stats.reservadas, color: '#f59e0b' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.04)', padding: '8px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: '900', color: s.color }}>{s.val}</div>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </header>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '1.2rem' }}>
          {['Todas', 'Disponible', 'Ocupada', 'Reservada', 'En Limpieza'].map(f => (
            <button
              key={f}
              onClick={() => setFilterEstado(f)}
              style={{
                padding: '6px 14px', fontSize: '0.72rem', fontWeight: '700', borderRadius: '8px', cursor: 'pointer',
                border: filterEstado === f ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)',
                background: filterEstado === f ? 'rgba(0,210,190,0.12)' : 'rgba(255,255,255,0.03)',
                color: filterEstado === f ? 'var(--primary)' : 'rgba(255,255,255,0.4)',
                transition: 'all 0.2s',
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Grid Mesas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
          {mesasFiltradas.map(mesa => {
            const cfg = STATE_CONFIG[mesa.estado] || STATE_CONFIG['Disponible'];
            const pending = hasPendingOrder(mesa.numero);
            const served = hasServedOrder(mesa.numero);
            const ready = isReady(mesa.numero);

            return (
              <div
                key={mesa.id}
                onClick={() => setSelectedMesa(mesa)}
                style={{
                  background: cfg.bg,
                  border: `1px solid ${cfg.color}25`,
                  borderRadius: '16px',
                  padding: '1.2rem',
                  position: 'relative',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  minHeight: '140px', cursor: 'pointer',
                  transition: 'all 0.25s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.border = `1px solid ${cfg.color}70`; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                onMouseLeave={e => { e.currentTarget.style.border = `1px solid ${cfg.color}25`; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <span style={{
                  position: 'absolute', top: '10px', right: '10px',
                  fontSize: '0.55rem', fontWeight: '800', padding: '3px 8px',
                  borderRadius: '6px', background: cfg.badge, color: cfg.color,
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>
                  {mesa.estado === 'En Limpieza' ? 'Limpieza' : mesa.estado}
                </span>

                <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#fff', lineHeight: 1, marginTop: '0.5rem', marginBottom: '0.4rem' }}>
                  {mesa.numero}
                </div>

                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', fontWeight: '500', marginBottom: '0.6rem' }}>
                  👥 {mesa.capacidad} personas
                </div>

                {mesa.estado === 'En Limpieza' ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '700' }}>
                    ⏳ {formatTimeRemaining(mesa.limpiezaFinAt)}
                  </div>
                ) : mesa.reservaAt && mesa.estado !== 'Ocupada' ? (
                   <div style={{ textAlign: 'center' }}>
                     <div style={{ fontSize: '0.65rem', color: '#f59e0b', fontWeight: '800' }}>📅 {new Date(mesa.reservaAt).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}</div>
                     <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)', fontWeight: '700', textTransform: 'uppercase' }}>{mesa.nombreReserva}</div>
                   </div>
                ) : pending ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    fontSize: '0.7rem', fontWeight: '700',
                    color: ready ? '#22c55e' : '#f59e0b',
                    background: ready ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                    padding: '3px 8px', borderRadius: '6px'
                  }}>
                    {ready ? '✅ Listo' : '🍳 En Cocina'}
                  </div>
                ) : served ? (
                   <div style={{ 
                     display: 'flex', alignItems: 'center', gap: '5px',
                     fontSize: '0.7rem', fontWeight: '800', color: '#22c55e',
                     background: 'rgba(34,197,94,0.1)', padding: '3px 8px', borderRadius: '6px'
                   }}>
                     🍽️ Servido
                   </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* ===== MODAL DETALLES DE MESA ===== */}
        {selectedMesa && (
          <div
            onClick={e => { if (e.target === e.currentTarget) setSelectedMesa(null); }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)',
              backdropFilter: 'blur(6px)', zIndex: 100,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div style={{
              width: '500px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
              background: '#0d0f14', border: '1px solid rgba(0,210,190,0.2)',
              borderRadius: '20px', padding: '2rem',
              boxShadow: '0 0 60px rgba(0,0,0,0.9)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '700' }}>Detalles</p>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: '900', color: '#fff' }}>Mesa {selectedMesa.numero}</h3>
                </div>
                <button
                  onClick={() => setSelectedMesa(null)}
                  style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', width: '34px', height: '34px', borderRadius: '50%', cursor: 'pointer', fontSize: '1rem' }}
                >✕</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '14px', padding: '1rem', textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Capacidad</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#fff' }}>{selectedMesa.capacidad} <span style={{ fontSize: '0.9rem', fontWeight: '400', color: 'rgba(255,255,255,0.3)' }}>pers.</span></div>
                </div>
                <div style={{ background: `${STATE_CONFIG[selectedMesa.estado]?.bg || '#111'}`, borderRadius: '14px', padding: '1rem', textAlign: 'center', border: `1px solid ${STATE_CONFIG[selectedMesa.estado]?.color || '#fff'}30` }}>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Estado</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '900', color: STATE_CONFIG[selectedMesa.estado]?.color || '#fff' }}>{selectedMesa.estado}</div>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '800', marginBottom: '10px' }}>Cambiar estado</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {Object.entries(STATE_CONFIG).map(([estado, cfg]) => (
                    <button
                      key={estado}
                      onClick={() => cambiarEstado(estado)}
                      style={{
                        padding: '9px 4px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.68rem', fontWeight: '700',
                        border: `1px solid ${selectedMesa.estado === estado ? cfg.color : 'rgba(255,255,255,0.07)'}`,
                        background: selectedMesa.estado === estado ? cfg.badge : 'rgba(255,255,255,0.02)',
                        color: selectedMesa.estado === estado ? cfg.color : 'rgba(255,255,255,0.35)',
                        transition: 'all 0.2s',
                      }}
                    >
                      {estado === 'En Limpieza' ? 'Limpieza' : estado}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ background: 'rgba(245,158,11,0.03)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '14px', padding: '1.2rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                   <p style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: '800', textTransform: 'uppercase' }}>📅 Reserva Programada</p>
                   {selectedMesa.reservaAt && (
                     <button onClick={cancelarReserva} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.6rem', fontWeight: '800', cursor: 'pointer' }}>ELIMINAR RESERVA</button>
                   )}
                </div>
                
                {selectedMesa.reservaAt ? (
                  <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '700' }}>
                    {new Date(selectedMesa.reservaAt).toLocaleString('es-PY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '4px' }}>A nombre de: {selectedMesa.nombreReserva}</div>
                  </div>
                ) : showReservaInputs ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input type="text" placeholder="Nombre de quien reserva..." value={reservaNombre} onChange={e => setReservaNombre(e.target.value)} className="luxury-input" style={{ width: '100%', padding: '8px' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <input type="date" value={reservaFecha} onChange={e => setReservaFecha(e.target.value)} className="luxury-input" style={{ padding: '8px' }} />
                      <input type="time" value={reservaHora} onChange={e => setReservaHora(e.target.value)} className="luxury-input" style={{ padding: '8px' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setShowReservaInputs(false)} style={{ flex: 1, padding: '8px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.7rem' }}>Cancelar</button>
                      <button onClick={programarReserva} style={{ flex: 1, padding: '8px', background: '#f59e0b', color: '#000', border: 'none', borderRadius: '8px', fontSize: '0.7rem', fontWeight: '800' }}>Confirmar</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowReservaInputs(true)} style={{ width: '100%', padding: '10px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px dashed #f59e0b', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}>
                    ＋ Programar Nueva Reserva
                  </button>
                )}
              </div>

              {consumoActual.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '800', marginBottom: '10px' }}>🧾 Consumo Acumulado</p>
                  <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '1rem', border: '1px solid rgba(255,255,255,0.05)', maxHeight: '160px', overflowY: 'auto' }}>
                    {consumoActual.map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < consumoActual.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>
                          <span style={{ color: 'var(--primary)', fontWeight: '900', marginRight: '8px' }}>{item.cantidad}x</span>
                          {item.nombre}
                        </span>
                        <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', fontWeight: '600' }}>
                          Gs. {((item.precio || 0) * (item.cantidad || 1)).toLocaleString('es-PY')}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', background: 'rgba(0,210,190,0.05)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(0,210,190,0.1)' }}>
                    <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: '700' }}>TOTAL:</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--primary)' }}>Gs. {totalConsumo.toLocaleString('es-PY')}</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <button onClick={() => { setSelectedMesa(null); router.push(`/menu?mesa=${selectedMesa.numero}`); }} style={{ padding: '13px', fontSize: '0.75rem', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', background: 'var(--primary)', color: '#000', border: 'none', borderRadius: '12px', cursor: 'pointer' }}>＋ AÑADIR PRODUCTO</button>
                <button onClick={() => setShowCobrarModal(true)} style={{ padding: '13px', fontSize: '0.75rem', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', background: 'rgba(255,255,255,0.05)', color: 'var(--primary)', border: '1px solid rgba(0,210,190,0.3)', borderRadius: '12px', cursor: 'pointer' }}>💳 COBRAR MESA</button>
              </div>
              <button onClick={() => setSelectedMesa(null)} style={{ width: '100%', padding: '11px', fontSize: '0.75rem', fontWeight: '700', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', cursor: 'pointer' }}>CERRAR</button>
            </div>
          </div>
        )}

        {showCobrarModal && selectedMesa && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '420px', maxWidth: '95vw', background: '#0d0f14', border: '1px solid rgba(0,210,190,0.2)', borderRadius: '20px', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontWeight: '900', fontSize: '1.1rem', color: 'var(--primary)' }}>💳 Cobrar Mesa {selectedMesa.numero}</h3>
                <button onClick={() => setShowCobrarModal(false)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: '700' }}>RUC / Documento</label>
                  <input type="text" value={ruc} onChange={e => { setRuc(e.target.value); if (e.target.value.toUpperCase() === 'X') setNombreCliente('Consumidor Final'); }} placeholder="Ej: 1234567-8" className="luxury-input" style={{ width: '100%', padding: '10px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: '700' }}>Nombre del Cliente</label>
                  <input type="text" value={nombreCliente} onChange={e => setNombreCliente(e.target.value)} placeholder="Nombre o razón social" className="luxury-input" style={{ width: '100%', padding: '10px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: '700' }}>Método de Pago</label>
                  <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)} className="luxury-input" style={{ width: '100%', padding: '10px' }}>
                    <option value="Efectivo" style={{ background: '#000' }}>💵 Efectivo</option>
                    <option value="Tarjeta" style={{ background: '#000' }}>💳 Tarjeta (POS)</option>
                    <option value="QR" style={{ background: '#000' }}>📱 Transferencia / QR</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.07)', margin: '1.5rem 0 1rem', paddingTop: '1rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'rgba(255,255,255,0.5)' }}>Total a Cobrar:</span>
                <span style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--primary)' }}>Gs. {totalConsumo.toLocaleString('es-PY')}</span>
              </div>
              <button onClick={confirmarCobro} className="luxury-button" style={{ width: '100%', background: 'var(--accent-gradient)', color: '#000' }}>✅ Confirmar y Emitir</button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
