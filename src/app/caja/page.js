'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import TicketFactura from '@/components/TicketFactura';

const fmt = (n) => Number(n || 0).toLocaleString('es-PY');

export default function CajaPage() {
  const router = useRouter();
  const ticketRef = useRef(null);

  const [user, setUser]           = useState(null);
  const [modo, setModo]           = useState('mesa'); // 'mesa' | 'presencial'
  const [pedidos, setPedidos]     = useState([]);
  const [pedidoSel, setPedidoSel] = useState(null);
  const [itemsPresencial, setItemsPresencial] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loadingPedidos, setLoadingPedidos] = useState(false);

  // Cliente
  const [rucInput, setRucInput]           = useState('');
  const [razonSocial, setRazonSocial]     = useState('Consumidor Final');
  const [sugerencias, setSugerencias]     = useState([]);
  const [loadingRuc, setLoadingRuc]       = useState(false);
  const [emailCliente, setEmailCliente]   = useState('');
  const [metodoPago, setMetodoPago]       = useState('Efectivo');

  // Estado de la emisión
  const [emitiendo, setEmitiendo]   = useState(false);
  const [resultado, setResultado]   = useState(null); // { ok, factura }
  const [error, setError]           = useState('');
  const [showTicket, setShowTicket] = useState(false);

  // Búsqueda de productos para presencial
  const [busqProd, setBusqProd]   = useState('');

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (!u) { router.push('/login'); return; }
    const parsed = JSON.parse(u);
    if (![1, 2].includes(parsed.roleId)) { router.push('/'); return; }
    setUser(parsed);
    cargarPedidos();
    cargarProductos();

    // Listen for storage changes or custom event to keep point of sale synced
    const handleStorageChange = () => cargarPedidos();
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('pedidos_updated', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('pedidos_updated', handleStorageChange);
    };
  }, []);

  const cargarPedidos = async () => {
    setLoadingPedidos(true);
    try {
      const rawPedidos = localStorage.getItem('restaurante_pedidos');
      const allPedidos = rawPedidos ? JSON.parse(rawPedidos) : [];
      const activePedidos = allPedidos.filter(p => p.estado !== 'Pagado');
      
      const groups = {};
      activePedidos.forEach(p => {
        const match = p.mesa.match(/Mesa\s+(\d+)/i);
        const mesaNum = match ? parseInt(match[1], 10) : p.mesa;
        
        if (!groups[p.mesa]) {
          groups[p.mesa] = {
            pedidoId: p.id,
            mesaNumero: mesaNum,
            mesaId: mesaNum,
            mesero: p.mesero || 'Mesero',
            fechaCreacion: p.fecha,
            items: [],
            total: 0,
            originalOrderIds: []
          };
        }
        
        groups[p.mesa].originalOrderIds.push(p.id);
        
        p.items.forEach(item => {
          const prodId = item.id;
          const existing = groups[p.mesa].items.find(it => it.productoId === prodId);
          if (existing) {
            existing.cantidad += item.cantidad;
            existing.subtotal = existing.cantidad * existing.precioUnitario;
          } else {
            groups[p.mesa].items.push({
              itemId: item.id,
              productoId: item.id,
              nombre: item.nombre,
              cantidad: item.cantidad,
              precioUnitario: item.precio,
              subtotal: item.cantidad * item.precio,
              observaciones: p.nota || ''
            });
          }
        });
      });
      
      const groupedPedidos = Object.values(groups).map(g => {
        const total = g.items.reduce((sum, item) => sum + item.subtotal, 0);
        return {
          ...g,
          total
        };
      });
      
      setPedidos(groupedPedidos);

      // Pre-select if query param 'mesa' matches
      const params = new URLSearchParams(window.location.search);
      const mesaQ = params.get('mesa');
      if (mesaQ) {
        const found = groupedPedidos.find(g => g.mesaNumero.toString() === mesaQ.toString());
        if (found) {
          setPedidoSel(found);
        }
      }
    } catch (e) {
      console.error("Error loading local orders:", e);
    } finally {
      setLoadingPedidos(false);
    }
  };

  const cargarProductos = async () => {
    try {
      const r = await fetch('/api/productos');
      if (r.ok) { const d = await r.json(); setProductos(d.productos || []); }
    } catch (_) {}
  };

  // Autocomplete RUC con debounce
  const debounceRef = useRef(null);
  const buscarRUC = (val) => {
    setRucInput(val);
    if (!val || val === 'X') { setSugerencias([]); if (!val) setRazonSocial('Consumidor Final'); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoadingRuc(true);
      try {
        const r = await fetch(`/api/facturacion/buscar-ruc?q=${encodeURIComponent(val)}`);
        if (r.ok) { const d = await r.json(); setSugerencias(d.resultados || []); }
      } catch (_) {} finally { setLoadingRuc(false); }
    }, 350);
  };

  const seleccionarContrib = (c) => {
    setRucInput(c.rucCompleto);
    setRazonSocial(c.razonSocial);
    setSugerencias([]);
  };

  const agregarProductoPresencial = (prod) => {
    setItemsPresencial(prev => {
      const ex = prev.find(i => i.productoId === prod.Id);
      if (ex) return prev.map(i => i.productoId === prod.Id ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precioUnitario } : i);
      return [...prev, { productoId: prod.Id, nombre: prod.Nombre, cantidad: 1, precioUnitario: prod.Precio, subtotal: prod.Precio }];
    });
  };

  const cambiarCantidad = (prodId, delta) => {
    setItemsPresencial(prev => prev
      .map(i => i.productoId === prodId ? { ...i, cantidad: i.cantidad + delta, subtotal: (i.cantidad + delta) * i.precioUnitario } : i)
      .filter(i => i.cantidad > 0)
    );
  };

  const items = modo === 'mesa' ? (pedidoSel?.items || []) : itemsPresencial;
  const total = items.reduce((s, i) => s + i.subtotal, 0);
  const totalIVA = Math.round(total / 11);

  const emitirFactura = async () => {
    if (modo === 'mesa' && !pedidoSel) { setError('Seleccione un pedido de mesa.'); return; }
    if (modo === 'presencial' && items.length === 0) { setError('Agregue al menos un producto.'); return; }
    setError(''); setEmitiendo(true);

    try {
      let pedidoId = pedidoSel?.pedidoId;

      if (modo === 'presencial') {
        // Crear pedido efímero de mostrador en la BD
        const rPed = await fetch('/api/pedidos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tipo: 'Presencial', cajeroId: user.id, items })
        });
        if (!rPed.ok) throw new Error('No se pudo crear el pedido presencial.');
        const dPed = await rPed.json();
        pedidoId = dPed.pedidoId;
      } else if (modo === 'mesa') {
        // Registrar consumo de la mesa en la BD antes de facturar
        const backendItems = items.map(it => ({
          productoId: it.productoId,
          cantidad: it.cantidad,
          precioUnitario: it.precioUnitario
        }));
        const rPed = await fetch('/api/pedidos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: 'Mesa',
            cajeroId: user.id,
            mesaNumero: pedidoSel.mesaNumero,
            items: backendItems
          })
        });
        if (!rPed.ok) throw new Error('No se pudo registrar el pedido de la mesa en el servidor.');
        const dPed = await rPed.json();
        pedidoId = dPed.pedidoId;
      }

      const r = await fetch('/api/facturacion/emitir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedidoId,
          rucCliente:    rucInput || 'X',
          nombreCliente: razonSocial,
          metodoPago,
          cajeroId:      user.id
        })
      });

      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error al emitir la factura.');

      const facturaData = {
        ...d,
        razonSocial:     razonSocial,
        rucCliente:      rucInput,
        metodoPago,
        items,
        totalFactura:    total,
        fechaEmision:    new Date().toISOString(),
        nombreCliente:   razonSocial
      };

      setResultado(facturaData);
      setShowTicket(true);

      // Enviar correo si hay email
      if (emailCliente) {
        fetch('/api/facturacion/enviar-correo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emailCliente,
            numeroFactura: d.numeroFactura,
            cdc:           d.cdc,
            enlaceQR:      d.enlaceQR,
            nombreCliente: razonSocial,
            totalFactura:  total,
            items
          })
        }).catch(() => {});
      }

      // Sincronizar localStorage si el cobro fue de mesa
      if (modo === 'mesa' && pedidoSel) {
        // 1. Marcar órdenes de mesa asociadas como pagadas en localStorage
        const rawPedidos = localStorage.getItem('restaurante_pedidos');
        if (rawPedidos) {
          const localPedidos = JSON.parse(rawPedidos);
          const updatedLocalPedidos = localPedidos.map(p =>
            pedidoSel.originalOrderIds.includes(p.id) ? { ...p, estado: 'Pagado' } : p
          );
          localStorage.setItem('restaurante_pedidos', JSON.stringify(updatedLocalPedidos));
        }

        // 2. Establecer mesa como 'En Limpieza' con temporizador
        const rawMesas = localStorage.getItem('restaurante_mesas');
        if (rawMesas) {
          const localMesas = JSON.parse(rawMesas);
          const updatedLocalMesas = localMesas.map(m =>
            m.numero.toString() === pedidoSel.mesaNumero.toString()
              ? { ...m, estado: 'En Limpieza', pedidoActivo: false, limpiezaFinAt: Date.now() + (300 * 1000) }
              : m
          );
          localStorage.setItem('restaurante_mesas', JSON.stringify(updatedLocalMesas));
        }

        // 3. Notificar a otras ventanas/pantallas
        window.dispatchEvent(new Event('pedidos_updated'));
      }

      // Refrescar pedidos
      cargarPedidos();
      setPedidoSel(null);
      setItemsPresencial([]);

    } catch (err) {
      setError(err.message);
    } finally {
      setEmitiendo(false);
    }
  };

  const productosFiltrados = productos.filter(p =>
    p.Activo !== false && p.Nombre.toLowerCase().includes(busqProd.toLowerCase())
  );

  if (!user) return null;

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
  const labelStyle = { display: 'block', fontSize: '0.65rem', color: 'var(--primary)', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' };
  const cardStyle  = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '1.2rem', marginBottom: '1rem' };

  return (
    <div className="desktop-app">
      <Sidebar user={user} />
      <main className="main-view">

        {/* Header */}
        <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <p style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase' }}>PUNTO DE VENTA</p>
            <h1 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#fff' }}>Caja & Facturación</h1>
          </div>
          <button onClick={cargarPedidos} style={{ background: 'rgba(0,210,190,0.08)', border: '1px solid rgba(0,210,190,0.2)', color: 'var(--primary)', borderRadius: '10px', padding: '8px 16px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700' }}>
            ↻ Actualizar Pedidos
          </button>
        </header>

        {/* Selector Modo */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem' }}>
          {[['mesa', '🍽️ Cobro de Mesa'], ['presencial', '🏪 Venta Presencial']].map(([val, lbl]) => (
            <button key={val} onClick={() => { setModo(val); setPedidoSel(null); setItemsPresencial([]); setError(''); }}
              style={{ flex: 1, padding: '14px', borderRadius: '12px', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s',
                background: modo === val ? 'rgba(0,210,190,0.12)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${modo === val ? 'var(--primary)' : 'rgba(255,255,255,0.07)'}`,
                color: modo === val ? 'var(--primary)' : 'rgba(255,255,255,0.4)'
              }}>{lbl}</button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'start' }}>

          {/* ── PANEL IZQUIERDO ── */}
          <div>

            {/* MODO MESA: Lista de pedidos activos */}
            {modo === 'mesa' && (
              <div style={cardStyle}>
                <p style={labelStyle}>Pedidos Abiertos en Mesas</p>
                {loadingPedidos && <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Cargando pedidos...</p>}
                {!loadingPedidos && pedidos.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '1rem' }}>No hay pedidos abiertos en este momento.</p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {pedidos.map(p => (
                    <div key={p.pedidoId} onClick={() => setPedidoSel(p)}
                      style={{ padding: '12px 16px', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s',
                        background: pedidoSel?.pedidoId === p.pedidoId ? 'rgba(0,210,190,0.1)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${pedidoSel?.pedidoId === p.pedidoId ? 'var(--primary)' : 'rgba(255,255,255,0.06)'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontWeight: '800', color: '#fff', fontSize: '0.9rem' }}>Mesa {p.mesaNumero}</span>
                          <span style={{ marginLeft: '10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.items.length} ítems · {p.mesero}</span>
                        </div>
                        <span style={{ fontWeight: '900', color: 'var(--primary)', fontSize: '0.95rem' }}>Gs. {fmt(p.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MODO PRESENCIAL: Buscador de productos */}
            {modo === 'presencial' && (
              <div style={cardStyle}>
                <p style={labelStyle}>Agregar Productos</p>
                <input value={busqProd} onChange={e => setBusqProd(e.target.value)} placeholder="Buscar producto..." style={{ ...inputStyle, marginBottom: '12px' }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                  {productosFiltrados.map(p => (
                    <div key={p.Id} onClick={() => agregarProductoPresencial(p)}
                      style={{ padding: '12px', borderRadius: '10px', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}>
                      <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>{p.Nombre}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '800' }}>Gs. {fmt(p.Precio)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resumen de Ítems */}
            {items.length > 0 && (
              <div style={cardStyle}>
                <p style={labelStyle}>Detalle del Consumo</p>
                {items.map((it, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ color: '#fff', fontSize: '0.85rem' }}>{it.nombre}</span>
                    </div>
                    {modo === 'presencial' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button onClick={() => cambiarCantidad(it.productoId, -1)} style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: '900' }}>−</button>
                        <span style={{ color: 'var(--primary)', fontWeight: '800', width: '24px', textAlign: 'center' }}>{it.cantidad}</span>
                        <button onClick={() => cambiarCantidad(it.productoId, 1)} style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(0,210,190,0.15)', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: '900' }}>+</button>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginRight: '12px' }}>x{it.cantidad}</span>
                    )}
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', minWidth: '80px', textAlign: 'right' }}>Gs. {fmt(it.subtotal)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(0,210,190,0.2)' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: '700' }}>TOTAL</span>
                  <span style={{ color: 'var(--primary)', fontWeight: '900', fontSize: '1.1rem' }}>Gs. {fmt(total)}</span>
                </div>
              </div>
            )}
          </div>

          {/* ── PANEL DERECHO: Datos del cobro ── */}
          <div>
            {/* RUC con autocomplete */}
            <div style={cardStyle}>
              <p style={labelStyle}>RUC del Cliente (DNIT)</p>
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input value={rucInput} onChange={e => buscarRUC(e.target.value)} placeholder="RUC o Razón Social..." style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={() => { setRucInput(''); setRazonSocial('Consumidor Final'); setSugerencias([]); }} title="Limpiar / Consumidor Final"
                    style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
                </div>

                {/* Dropdown de sugerencias */}
                {sugerencias.length > 0 && (
                  <div style={{ position: 'absolute', top: '42px', left: 0, right: '44px', background: '#0d1117', border: '1px solid rgba(0,210,190,0.2)', borderRadius: '10px', zIndex: 50, overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}>
                    {sugerencias.map((s, i) => (
                      <div key={i} onClick={() => seleccionarContrib(s)}
                        style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,210,190,0.08)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ fontWeight: '700', color: '#fff', fontSize: '0.82rem' }}>{s.razonSocial}</div>
                        <div style={{ color: 'var(--primary)', fontSize: '0.75rem' }}>RUC: {s.rucCompleto}</div>
                      </div>
                    ))}
                  </div>
                )}

                {loadingRuc && <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>Buscando en DNIT...</p>}
              </div>

              {/* Razón Social resuelta */}
              <div style={{ background: 'rgba(0,210,190,0.05)', border: '1px solid rgba(0,210,190,0.15)', borderRadius: '8px', padding: '8px 12px', marginTop: '8px' }}>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '2px' }}>CLIENTE IDENTIFICADO</p>
                <p style={{ fontSize: '0.85rem', fontWeight: '700', color: '#fff' }}>{razonSocial}</p>
              </div>
            </div>

            {/* Email */}
            <div style={cardStyle}>
              <label style={labelStyle}>Correo para envío de factura</label>
              <input type="email" value={emailCliente} onChange={e => setEmailCliente(e.target.value)} placeholder="cliente@ejemplo.com (opcional)" style={inputStyle} />
            </div>

            {/* Método de pago */}
            <div style={cardStyle}>
              <p style={labelStyle}>Método de Pago</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {[['Efectivo', '💵'], ['Tarjeta', '💳'], ['Transferencia', '📱']].map(([m, ico]) => (
                  <button key={m} onClick={() => setMetodoPago(m)}
                    style={{ padding: '10px 6px', borderRadius: '10px', fontWeight: '700', fontSize: '0.72rem', cursor: 'pointer', transition: 'all 0.2s',
                      background: metodoPago === m ? 'rgba(0,210,190,0.12)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${metodoPago === m ? 'var(--primary)' : 'rgba(255,255,255,0.06)'}`,
                      color: metodoPago === m ? 'var(--primary)' : 'rgba(255,255,255,0.4)' }}>
                    {ico}<br />{m}
                  </button>
                ))}
              </div>
            </div>

            {/* Resumen de totales */}
            <div style={{ ...cardStyle, background: 'rgba(0,210,190,0.03)' }}>
              {[['Base Gravada 10%', Math.round(total - totalIVA)], ['IVA 10%', totalIVA], ['Exentas', 0]].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px', color: 'rgba(255,255,255,0.5)' }}>
                  <span>{k}</span><span>Gs. {fmt(v)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0,210,190,0.2)', paddingTop: '10px', marginTop: '8px' }}>
                <span style={{ fontWeight: '900', fontSize: '0.9rem', color: '#fff' }}>TOTAL A COBRAR</span>
                <span style={{ fontWeight: '900', fontSize: '1.3rem', color: 'var(--primary)' }}>Gs. {fmt(total)}</span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '10px 14px', color: '#ef4444', fontSize: '0.8rem', marginBottom: '10px' }}>
                ⚠ {error}
              </div>
            )}

            {/* Botón Emitir */}
            <button onClick={emitirFactura} disabled={emitiendo || items.length === 0}
              className="luxury-button"
              style={{ width: '100%', padding: '16px', fontSize: '0.9rem', background: 'var(--accent-gradient)', color: '#000', opacity: (emitiendo || items.length === 0) ? 0.5 : 1, cursor: items.length === 0 ? 'not-allowed' : 'pointer' }}>
              {emitiendo ? '⏳ Emitiendo factura SIFEN...' : '✅ EMITIR FACTURA ELECTRÓNICA'}
            </button>
          </div>
        </div>

        {/* ── MODAL DE RESULTADO ── */}
        {showTicket && resultado && (
          <div onClick={e => { if (e.target === e.currentTarget) setShowTicket(false); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem' }}>

            <div style={{ background: '#0d1117', border: '1px solid rgba(0,210,190,0.2)', borderRadius: '20px', padding: '2rem', maxWidth: '400px', width: '100%' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>✅</div>
                <h3 style={{ color: '#fff', fontWeight: '900', fontSize: '1.2rem' }}>Factura Emitida</h3>
                <p style={{ color: 'var(--primary)', fontWeight: '800', fontSize: '1rem', marginTop: '4px' }}>{resultado.numeroFactura}</p>
                <p style={{ color: resultado.estadoSifen === 'Aprobado' ? 'var(--success)' : 'var(--warning)', fontSize: '0.8rem', marginTop: '4px' }}>
                  SIFEN: {resultado.estadoSifen} · {resultado.mensajeSifen?.substring(0, 60)}
                </p>
              </div>

              {emailCliente && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '1rem' }}>
                  📧 Factura enviada a <strong style={{ color: '#fff' }}>{emailCliente}</strong>
                </p>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => ticketRef.current?.imprimir()} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'rgba(0,210,190,0.1)', border: '1px solid var(--primary)', color: 'var(--primary)', fontWeight: '800', fontSize: '0.8rem', cursor: 'pointer' }}>
                  🖨️ Imprimir Ticket
                </button>
                <button onClick={() => { setShowTicket(false); setResultado(null); setRucInput(''); setRazonSocial('Consumidor Final'); setEmailCliente(''); }}
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--accent-gradient)', color: '#000', fontWeight: '800', fontSize: '0.8rem', cursor: 'pointer', border: 'none' }}>
                  Nueva Venta
                </button>
              </div>
            </div>

            {/* Ticket preview (oculto hasta imprimir) */}
            <div style={{ display: 'none' }}>
              <TicketFactura ref={ticketRef} datos={resultado} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
