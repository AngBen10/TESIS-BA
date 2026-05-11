'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

// Mock data for tables
const MOCK_MESAS = [
  { id: 1, numero: 1, capacidad: 2, estado: 'Ocupada', pedidoActivo: true },
  { id: 2, numero: 2, capacidad: 2, estado: 'En Limpieza', pedidoActivo: false, tiempoRestante: 3 },
  { id: 3, numero: 3, capacidad: 2, estado: 'Ocupada', pedidoActivo: true },
  { id: 4, numero: 4, capacidad: 2, estado: 'Ocupada', pedidoActivo: true },
  { id: 5, numero: 5, capacidad: 4, estado: 'Disponible', pedidoActivo: false },
  { id: 6, numero: 6, capacidad: 4, estado: 'Ocupada', pedidoActivo: true },
  { id: 7, numero: 7, capacidad: 4, estado: 'Disponible', pedidoActivo: false },
  { id: 8, numero: 8, capacidad: 4, estado: 'Disponible', pedidoActivo: false },
  { id: 9, numero: 9, capacidad: 6, estado: 'Disponible', pedidoActivo: false },
  { id: 10, numero: 10, capacidad: 6, estado: 'Disponible', pedidoActivo: false },
  { id: 11, numero: 11, capacidad: 6, estado: 'Disponible', pedidoActivo: false },
  { id: 12, numero: 12, capacidad: 6, estado: 'Ocupada', pedidoActivo: true },
];

const getStateColor = (estado) => {
  switch(estado) {
    case 'Disponible': return '#28a745';
    case 'Ocupada': return '#dc3545';
    case 'En Limpieza': return '#00D2BE';
    case 'Reservada': return '#ffc107';
    default: return '#6c757d';
  }
};

export default function Mesas() {
  const [user, setUser] = useState(null);
  const [mesas, setMesas] = useState(MOCK_MESAS);
  const [selectedMesa, setSelectedMesa] = useState(null);
  const [showCobrarModal, setShowCobrarModal] = useState(false);
  const [ruc, setRuc] = useState('');
  const [nombreCliente, setNombreCliente] = useState('');
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/login');
    } else {
      setUser(JSON.parse(storedUser));
    }
  }, [router]);

  if (!user) return null;

  return (
    <div className="desktop-app">
      <Sidebar user={user} />

      <main className="main-view">
        <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '2.2rem', fontWeight: '900', color: '#fff', marginBottom: '0.2rem' }}>Gestión de Mesas</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'bold', letterSpacing: '1px' }}>MAPA Y ESTADO DE LAS MESAS</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 16px', borderRadius: '15px', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </header>

        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '900', color: '#fff', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Plano de Mesas</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>Gestión en tiempo real de mesas y capacidades</p>
          </div>
          <button style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.8, fontWeight: 'bold' }}>
            ⚙️ Configuración
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.8rem' }}>

          {mesas.map((mesa) => {
            const color = getStateColor(mesa.estado);
            const bgColor = mesa.estado === 'Ocupada' ? '#1f1316' : 
                            mesa.estado === 'En Limpieza' ? '#171a25' : 
                            mesa.estado === 'Reservada' ? '#1f1a14' : 
                            '#1a1d28'; // Navy blue for Disponible
            
            return (
              <div
                key={mesa.id}
                onClick={() => setSelectedMesa(mesa)}
                className={`luxury-shadow teal-glow-hover ${mesa.estado === 'En Limpieza' ? 'cleaning-pulse' : ''}`}
                style={{
                  background: bgColor,
                  border: `1px solid ${color}30`,
                  borderRadius: '16px',
                  padding: '1.25rem',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '150px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: 'inset 0 0 10px rgba(0,0,0,0.2)'
                }}
              >
                {/* Estado badge */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  fontSize: '0.55rem',
                  fontWeight: '800',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  background: `${color}15`,
                  color: color,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}>
                  {mesa.estado}
                </div>

                {/* Número de mesa */}
                <div style={{ fontSize: '2.2rem', fontWeight: '700', color: '#fff', marginBottom: '0.8rem', marginTop: '0.5rem' }}>
                  {mesa.numero}
                </div>

                {/* Capacidad */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontWeight: '500', marginBottom: '0.6rem'
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                  Capacidad: {mesa.capacidad} pers.
                </div>

                {/* Pedido Activo */}
                <div style={{ minHeight: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {mesa.pedidoActivo && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '600', color: '#fff' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f0ad4e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                      Pedido Activo
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '2px' }}>
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>
                    </div>
                  )}
                  {mesa.estado === 'En Limpieza' && (
                    <div style={{ color: 'var(--info)', fontSize: '0.75rem', fontWeight: '700' }}>
                      ⏳ {mesa.tiempoRestante}m
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Detalles de Mesa */}
        {selectedMesa && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
            <div className="glass-card luxury-shadow" style={{ width: '500px', maxWidth: '90%', padding: '2.5rem', background: '#080808', border: '1px solid rgba(0, 210, 190, 0.15)', borderRadius: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h3 style={{ textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '800', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>DETALLES DE MESA</h3>
                <button onClick={() => setSelectedMesa(null)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '1.5rem', cursor: 'pointer', transition: 'color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.color='#fff'} onMouseOut={(e) => e.currentTarget.style.color='rgba(255,255,255,0.3)'}>✕</button>
              </div>

              {/* Info Box Top */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1.5rem', borderRadius: '18px', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ textAlign: 'center', borderRight: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 'bold' }}>CAPACIDAD</div>
                  <div style={{ fontWeight: '800', fontSize: '1.4rem', color: '#fff' }}>{selectedMesa.capacidad} <span style={{ fontSize: '0.9rem', fontWeight: '400', color: 'rgba(255,255,255,0.3)' }}>Personas</span></div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 'bold' }}>ESTADO ACTUAL</div>
                  <div style={{ fontWeight: '900', fontSize: '1.4rem', color: getStateColor(selectedMesa.estado) }}>{selectedMesa.estado}</div>
                </div>
              </div>

              {/* Estado Rapido */}
              <div style={{ marginBottom: '2.5rem' }}>
                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '15px', fontWeight: '800' }}>CAMBIAR ESTADO RÁPIDO</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  {['Disponible', 'Ocupada', 'Reservada', 'En Limpieza'].map((st) => (
                    <button 
                      key={st}
                      onClick={() => {
                        setMesas(mesas.map(m => m.id === selectedMesa.id ? { ...m, estado: st } : m));
                        setSelectedMesa({...selectedMesa, estado: st});
                      }}
                      style={{ 
                        padding: '12px 0', 
                        background: selectedMesa.estado === st ? `${getStateColor(st)}20` : 'rgba(255,255,255,0.03)',
                        color: selectedMesa.estado === st ? getStateColor(st) : 'rgba(255,255,255,0.4)',
                        border: `1px solid ${selectedMesa.estado === st ? getStateColor(st) : 'rgba(255,255,255,0.08)'}`,
                        borderRadius: '12px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    >
                      {st === 'En Limpieza' ? 'Limpieza' : st}
                    </button>
                  ))}
                </div>
              </div>

              {selectedMesa.estado === 'Ocupada' && (
                <div style={{ marginBottom: '2.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="9" cy="21" r="1"></circle>
                        <circle cx="20" cy="21" r="1"></circle>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                      </svg>
                      <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>CONSUMO ACTUAL</span>
                    </div>
                    <span style={{ fontSize: '0.65rem', background: 'rgba(0, 210, 190, 0.1)', color: 'var(--primary)', padding: '4px 10px', borderRadius: '6px', fontWeight: '800', border: '1px solid rgba(0, 210, 190, 0.2)' }}>ORDEN #284</span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '0 5px' }}>
                    {[
                      { q: 1, n: 'Surubí a la Plancha', p: 45000 },
                      { q: 1, n: 'Milanesa Napolitana', p: 40000 },
                      { q: 2, n: 'Jugo Natural', p: 24000 }
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', alignItems: 'center' }}>
                        <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: '500' }}>
                          <span style={{ color: 'var(--primary)', fontWeight: '900', marginRight: '10px' }}>{item.q}x</span> 
                          {item.n}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums', fontWeight: '600' }}>Gs. {item.p.toLocaleString('es-PY')}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0, 210, 190, 0.05)', padding: '1.25rem', borderRadius: '16px', border: '1px solid rgba(0, 210, 190, 0.1)' }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', fontWeight: '700' }}>TOTAL:</span>
                    <span style={{ fontWeight: '900', fontSize: '1.8rem', color: 'var(--primary)', letterSpacing: '-1px' }}>Gs. 109.000</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <button 
                  onClick={() => router.push('/menu')}
                  style={{ 
                    padding: '16px', 
                    fontSize: '0.85rem', 
                    fontWeight: '800',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', 
                    background: 'var(--primary)', 
                    color: '#000',
                    border: 'none',
                    borderRadius: '14px',
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 5px 15px rgba(0, 210, 190, 0.3)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  AÑADIR PRODUCTO
                </button>
                <button 
                  onClick={() => setShowCobrarModal(true)}
                  style={{ 
                    padding: '16px', 
                    fontSize: '0.85rem', 
                    fontWeight: '800',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', 
                    background: 'rgba(255,255,255,0.05)', 
                    color: 'var(--primary)',
                    border: '1px solid rgba(0, 210, 190, 0.3)',
                    borderRadius: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background='rgba(0, 210, 190, 0.1)'; e.currentTarget.style.transform='translateY(-2px)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.transform='translateY(0)'; }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                    <line x1="2" y1="10" x2="22" y2="10"></line>
                  </svg>
                  COBRAR MESA
                </button>
              </div>
              <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                <a href="#" style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', textDecoration: 'none', fontWeight: '600' }}>Ver Detalle del Pedido</a>
              </div>
            </div>
          </div>
        )}

        {/* Modal Cobrar Mesa */}
        {showCobrarModal && selectedMesa && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-card" style={{ width: '400px', maxWidth: '90%', padding: '2rem', background: '#0a0a0a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', fontSize: '1rem', color: 'var(--primary)' }}>Cobrar Mesa {selectedMesa.numero}</h3>
                <button onClick={() => setShowCobrarModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>RUC / Documento</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="text" 
                    value={ruc} 
                    onChange={(e) => {
                      setRuc(e.target.value);
                      if(e.target.value.toUpperCase() === 'X') setNombreCliente('Cliente sin nombre');
                    }}
                    placeholder="Ej. 1234567-8 (o X para Sin Factura)" 
                    className="luxury-input" 
                    style={{ flex: 1, padding: '10px' }} 
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Razón Social / Nombre</label>
                <input 
                  type="text" 
                  value={nombreCliente} 
                  onChange={(e) => setNombreCliente(e.target.value)}
                  placeholder="Nombre del cliente" 
                  className="luxury-input" 
                  style={{ width: '100%', padding: '10px' }} 
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Método de Pago</label>
                <select 
                  value={metodoPago} 
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="luxury-input" 
                  style={{ width: '100%', padding: '10px', appearance: 'none', cursor: 'pointer' }}
                >
                  <option value="Efectivo" style={{ background: '#000' }}>Efectivo</option>
                  <option value="Tarjeta" style={{ background: '#000' }}>Tarjeta (POS)</option>
                  <option value="QR" style={{ background: '#000' }}>Transferencia / QR</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
                <span style={{ fontWeight: 'bold' }}>Total a Cobrar:</span>
                <span style={{ fontWeight: '900', fontSize: '1.5rem', color: 'var(--primary)' }}>Gs. 109.000</span>
              </div>

              <button 
                onClick={() => {
                  alert(`Factura ${ruc === 'X' || ruc === 'x' ? 'Ticket' : 'Legal'} impresa para: ${nombreCliente}.\nTotal: Gs. 109.000\nMétodo: ${metodoPago}`);
                  setShowCobrarModal(false);
                  setSelectedMesa(null);
                  setMesas(mesas.map(m => m.id === selectedMesa.id ? { ...m, estado: 'En Limpieza', pedidoActivo: false } : m));
                }}
                className="luxury-button" 
                style={{ width: '100%' }}
              >
                Confirmar y Emitir
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
