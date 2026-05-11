'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

const MOCK_PEDIDOS = [
  {
    id: 1,
    mesa: 'Mesa 2',
    fecha: '03/05/2026',
    items: [
      { id: 1, cantidad: 1, nombre: 'Surubí a la Plancha' },
      { id: 2, cantidad: 1, nombre: 'Milanesa Napolitana' },
      { id: 3, cantidad: 2, nombre: 'Jugo Natural' }
    ],
    nota: 'Jugo de Naranja y Pomelo',
    mesero: 'Carlos',
    estado: 'Pendiente' // Pendiente, En Preparación, Listo
  }
];

export default function Cocina() {
  const [user, setUser] = useState(null);
  const [pedidos, setPedidos] = useState(MOCK_PEDIDOS);
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

  const handleStateChange = (id, nuevoEstado) => {
    setPedidos(pedidos.map(p => p.id === id ? { ...p, estado: nuevoEstado } : p));
  };

  const renderColumn = (title, icon, color, stateFilter, nextState, buttonText) => {
    const filteredPedidos = pedidos.filter(p => p.estado === stateFilter);
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: color, fontSize: '1.1rem', marginBottom: '10px' }}>
          {icon} {title} ({filteredPedidos.length})
        </h3>
        
        <div className="glass-card" style={{ flex: 1, padding: '1rem', minHeight: '500px', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.3)' }}>
          {filteredPedidos.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>No hay pedidos</div>
          ) : (
            filteredPedidos.map(pedido => (
              <div key={pedido.id} className="glass-card luxury-shadow" style={{ padding: '1.5rem', border: `1px solid ${color}40`, position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: color, borderTopLeftRadius: '24px', borderBottomLeftRadius: '24px' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{pedido.mesa}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{pedido.fecha}</span>
                </div>
                
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: '1rem' }}>
                  {pedido.items.map(item => (
                    <li key={item.id} style={{ marginBottom: '8px', fontSize: '0.95rem' }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--primary)', display: 'inline-block', width: '25px' }}>{item.cantidad}x</span>
                      {item.nombre}
                    </li>
                  ))}
                </ul>

                {pedido.nota && (
                  <div style={{ background: 'rgba(212, 175, 55, 0.1)', padding: '10px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Nota:</span> {pedido.nota}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Mesero: {pedido.mesero}</span>
                  {nextState && (
                    <button 
                      onClick={() => handleStateChange(pedido.id, nextState)}
                      style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--border)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.3s' }}
                      onMouseOver={(e) => { e.currentTarget.style.background = `${color}20`; e.currentTarget.style.borderColor = color; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                    >
                      {buttonText} {'>'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="desktop-app">
      <Sidebar user={user} />

      <main className="main-view">
        <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: '900', color: '#fff', marginBottom: '0.2rem' }}>Pedidos</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Gestión de pedidos activos</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: '20px', fontSize: '0.8rem' }}>
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </header>

        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Pedidos Activos</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Control de flujo de cocina y entrega</p>
        </div>

        <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
          {renderColumn('Pendientes', '🕒', 'var(--warning)', 'Pendiente', 'En Preparación', 'Preparar')}
          {renderColumn('En Preparación', '🕒', 'var(--info)', 'En Preparación', 'Listo', 'Terminar')}
          {renderColumn('Listos p/ Entregar', '✅', 'var(--success)', 'Listo', 'Entregado', 'Entregar')}
        </div>

      </main>
    </div>
  );
}
