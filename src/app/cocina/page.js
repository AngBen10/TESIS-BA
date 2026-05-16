'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

const STATE_COLUMNS = [
  { key: 'Pendiente',       label: 'Pendientes',       icon: '🕒', color: '#f59e0b', next: 'En Preparación', btnText: 'Iniciar' },
  { key: 'En Preparación',  label: 'En Preparación',   icon: '🍳', color: '#3b82f6', next: 'Listo',          btnText: 'Listo'   },
  { key: 'Listo',           label: 'Listos p/ Entregar', icon: '✅', color: '#22c55e', next: 'Entregado',    btnText: 'Entregar' },
];

export default function Cocina() {
  const [user, setUser] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [showEntregados, setShowEntregados] = useState(false);
  const router = useRouter();

  const loadPedidos = useCallback(() => {
    const raw = localStorage.getItem('restaurante_pedidos');
    setPedidos(raw ? JSON.parse(raw) : []);
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) { router.push('/login'); return; }
    setUser(JSON.parse(storedUser));
    loadPedidos();

    const handler = () => loadPedidos();
    window.addEventListener('storage', handler);
    window.addEventListener('pedidos_updated', handler);

    // Poll every 5s for same-window updates
    const poll = setInterval(loadPedidos, 5000);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('pedidos_updated', handler);
      clearInterval(poll);
    };
  }, [router, loadPedidos]);

  const savePedidos = (updated) => {
    setPedidos(updated);
    localStorage.setItem('restaurante_pedidos', JSON.stringify(updated));
    window.dispatchEvent(new Event('pedidos_updated'));
  };

  const changeState = (id, nextState) => {
    const updated = pedidos.map(p => p.id === id ? { ...p, estado: nextState } : p);
    savePedidos(updated);

    // If delivered, update mesa status
    if (nextState === 'Entregado') {
      const pedido = pedidos.find(p => p.id === id);
      if (pedido) {
        const rawMesas = localStorage.getItem('restaurante_mesas');
        if (rawMesas) {
          const mesas = JSON.parse(rawMesas);
          const mesaNum = pedido.mesa.replace('Mesa ', '');
          const idx = mesas.findIndex(m => m.numero.toString() === mesaNum);
          if (idx !== -1) {
            mesas[idx].pedidoActivo = false;
            localStorage.setItem('restaurante_mesas', JSON.stringify(mesas));
          }
        }
      }
    }
  };

  const deletePedido = (id) => {
    if (!confirm('¿Eliminar este pedido?')) return;
    savePedidos(pedidos.filter(p => p.id !== id));
  };

  const activePedidos = pedidos.filter(p => p.estado !== 'Entregado');
  const entregados = pedidos.filter(p => p.estado === 'Entregado');

  if (!user) return null;

  return (
    <div className="desktop-app">
      <Sidebar user={user} />
      <main className="main-view" style={{ padding: '1.5rem 2rem' }}>

        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#fff', marginBottom: '2px' }}>🍳 Cocina</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Control de pedidos activos — {activePedidos.length} pedido{activePedidos.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setShowEntregados(!showEntregados)}
              style={{ padding: '7px 14px', fontSize: '0.72rem', fontWeight: '700', borderRadius: '8px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: showEntregados ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)', color: showEntregados ? '#22c55e' : 'rgba(255,255,255,0.4)', transition: 'all 0.2s' }}
            >
              ✓ Entregados ({entregados.length})
            </button>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '7px 14px', borderRadius: '8px', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '600' }}>
              {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </header>

        {/* Kanban columns */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.2rem' }}>
          {STATE_COLUMNS.map(col => {
            const items = pedidos.filter(p => p.estado === col.key);
            return (
              <div key={col.key} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Column header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: `${col.color}12`, borderRadius: '12px', border: `1px solid ${col.color}30` }}>
                  <span style={{ fontSize: '1.1rem' }}>{col.icon}</span>
                  <span style={{ fontWeight: '800', fontSize: '0.85rem', color: col.color }}>{col.label}</span>
                  <span style={{ marginLeft: 'auto', background: `${col.color}20`, color: col.color, fontSize: '0.7rem', fontWeight: '900', padding: '2px 8px', borderRadius: '6px' }}>{items.length}</span>
                </div>

                {/* Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '200px' }}>
                  {items.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,0.12)', fontSize: '0.8rem', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '12px' }}>
                      Sin pedidos
                    </div>
                  ) : items.map(pedido => (
                    <div key={pedido.id} style={{ background: '#0d0f14', border: `1px solid ${col.color}25`, borderRadius: '14px', padding: '1.1rem', position: 'relative', borderLeft: `3px solid ${col.color}` }}>
                      {/* Card header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div>
                          <span style={{ fontWeight: '900', fontSize: '1rem', color: '#fff' }}>{pedido.mesa}</span>
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginLeft: '8px' }}>#{pedido.id}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)' }}>{pedido.fecha}</span>
                          <button onClick={() => deletePedido(pedido.id)} style={{ background: 'rgba(239,68,68,0.08)', border: 'none', color: 'rgba(239,68,68,0.5)', width: '22px', height: '22px', borderRadius: '5px', cursor: 'pointer', fontSize: '0.7rem' }}>✕</button>
                        </div>
                      </div>

                      {/* Items */}
                      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {pedido.items.map((item, i) => (
                          <li key={i} style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: '900', color: col.color, minWidth: '24px', fontSize: '0.8rem' }}>{item.cantidad}x</span>
                            <span style={{ color: 'rgba(255,255,255,0.85)' }}>{item.nombre}</span>
                          </li>
                        ))}
                      </ul>

                      {/* Nota */}
                      {pedido.nota && (
                        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '8px', padding: '7px 10px', fontSize: '0.78rem', marginBottom: '10px' }}>
                          <span style={{ color: '#f59e0b', fontWeight: '700' }}>📝 </span>
                          <span style={{ color: 'rgba(255,255,255,0.7)' }}>{pedido.nota}</span>
                        </div>
                      )}

                      {/* Footer */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)' }}>👤 {pedido.mesero}</span>
                        {col.next && (
                          <button
                            onClick={() => changeState(pedido.id, col.next)}
                            style={{ background: `${col.color}15`, color: col.color, border: `1px solid ${col.color}40`, padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '800', transition: 'all 0.2s' }}
                            onMouseEnter={e => { e.currentTarget.style.background = `${col.color}30`; }}
                            onMouseLeave={e => { e.currentTarget.style.background = `${col.color}15`; }}
                          >
                            {col.btnText} →
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Entregados (historial) */}
        {showEntregados && entregados.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              <h2 style={{ fontWeight: '800', fontSize: '1rem', color: '#22c55e' }}>✓ Historial — Pedidos Entregados</h2>
              <button onClick={() => { if (confirm('¿Limpiar historial de entregados?')) savePedidos(activePedidos); }} style={{ fontSize: '0.65rem', color: 'rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer' }}>
                Limpiar historial
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {entregados.map(p => (
                <div key={p.id} style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.1)', borderRadius: '12px', padding: '1rem', borderLeft: '3px solid #22c55e' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: '800', color: '#fff' }}>{p.mesa}</span>
                    <span style={{ fontSize: '0.6rem', background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '2px 8px', borderRadius: '5px', fontWeight: '700' }}>Entregado</span>
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {p.items.map((item, i) => (
                      <li key={i} style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', marginBottom: '3px' }}>
                        {item.cantidad}x {item.nombre}
                      </li>
                    ))}
                  </ul>
                  <div style={{ marginTop: '8px', fontSize: '0.68rem', color: 'rgba(255,255,255,0.2)' }}>Total: Gs. {p.items.reduce((a, i) => a + (i.precio || 0) * (i.cantidad || 1), 0).toLocaleString('es-PY')}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
