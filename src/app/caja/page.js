'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import TicketFactura from '@/components/TicketFactura';

const fmt = (n) => Number(n || 0).toLocaleString('es-PY');

export default function CajaPage() {
  const router = useRouter();
  const ticketRef = useRef(null);

  const [user, setUser] = useState(null);
  const [modo, setModo] = useState('mesa'); // 'mesa' | 'presencial'
  const [pedidos, setPedidos] = useState([]);
  const [pedidoSel, setPedidoSel] = useState(null);
  const [itemsPresencial, setItemsPresencial] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loadingPedidos, setLoadingPedidos] = useState(false);

  // Cliente
  const [rucInput, setRucInput] = useState('');
  const [razonSocial, setRazonSocial] = useState('Consumidor Final');
  const [sugerencias, setSugerencias] = useState([]);
  const [loadingRuc, setLoadingRuc] = useState(false);
  const [emailCliente, setEmailCliente] = useState('');
  const [metodoPago, setMetodoPago] = useState('Efectivo');

  // Estado de la emisión
  const [tipoComprobante, setTipoComprobante] = useState('electronica'); // 'electronica' | 'normal'
  const [tipoDocumento, setTipoDocumento] = useState('factura'); // 'factura' | 'nota_credito'
  const [isConfigFixed, setIsConfigFixed] = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);
  const [resultado, setResultado] = useState(null); // { ok, factura }
  const [error, setError] = useState('');
  const [showTicket, setShowTicket] = useState(false);

  // Búsqueda de productos para presencial
  const [busqProd, setBusqProd] = useState('');
  const [categorias, setCategorias] = useState([]);
  const [catSel, setCatSel] = useState('todas');
  const busqProdRef = useRef(null);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (!u) { router.push('/login'); return; }
    const parsed = JSON.parse(u);
    if (![1, 2].includes(parsed.roleId)) { router.push('/'); return; }
    setUser(parsed);
    cargarPedidos();
    cargarProductos();

    // Cargar config global
    fetch('/api/facturacion/configuracion')
      .then(r => r.json())
      .then(d => {
        if (d.config && d.config.SIFEN_FacturadorElectronico !== undefined) {
          setTipoComprobante(d.config.SIFEN_FacturadorElectronico === '1' ? 'electronica' : 'normal');
          setIsConfigFixed(true); // Ocultar el selector porque ya está fijo
        }
      })
      .catch(() => { });

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
            meseroId: p.meseroId || null,   // ← NUEVO: ID real del mesero para reporte
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
        return { ...g, total };
      });

      setPedidos(groupedPedidos);

      const params = new URLSearchParams(window.location.search);
      const mesaQ = params.get('mesa');
      if (mesaQ) {
        const found = groupedPedidos.find(g => g.mesaNumero.toString() === mesaQ.toString());
        if (found) setPedidoSel(found);
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
      if (r.ok) { const d = await r.json(); setProductos(Array.isArray(d) ? d : (d.productos || [])); }
      const rc = await fetch('/api/categorias');
      if (rc.ok) { const dc = await rc.json(); setCategorias(Array.isArray(dc) ? dc : (dc.categorias || [])); }
    } catch (_) { }
  };

  const debounceRef = useRef(null);
  const buscarRUC = (val) => {
    setRucInput(val);
    if (!val || val === 'X') { setSugerencias([]); if (!val) setRazonSocial('Consumidor Final'); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoadingRuc(true);
      try {
        const r = await fetch(`/api/facturacion/buscar-ruc?q=${encodeURIComponent(val)}`);
        if (r.ok) {
          const d = await r.json();
          const resultados = d.resultados || [];
          setSugerencias(resultados);

          const cleanInput = val.trim().replace(/-/g, '');
          const exactMatch = resultados.find(c =>
            c.ruc === cleanInput ||
            c.rucCompleto === val.trim() ||
            c.rucCompleto.replace(/-/g, '') === cleanInput
          );
          if (exactMatch) {
            setRucInput(exactMatch.rucCompleto);
            setRazonSocial(exactMatch.razonSocial);
            setSugerencias([]);
          }
        }
      } catch (_) { } finally { setLoadingRuc(false); }
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

  const setCantidadExacta = (prodId, val) => {
    const n = Math.max(0, parseInt(val) || 0);
    setItemsPresencial(prev => prev
      .map(i => i.productoId === prodId ? { ...i, cantidad: n, subtotal: n * i.precioUnitario } : i)
      .filter(i => i.cantidad > 0)
    );
  };

  const quitarItem = (prodId) => setItemsPresencial(prev => prev.filter(i => i.productoId !== prodId));
  const vaciarCarrito = () => setItemsPresencial([]);

  // Buscar producto por código exacto (para lector de código de barras / Enter)
  const onBuscarKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const q = busqProd.toLowerCase().trim();
    if (!q) return;
    // Prioridad 1: match exacto por código (lo que tipea un escáner)
    let prod = productos.find(p => p.Activo !== false && p.Codigo && String(p.Codigo).toLowerCase() === q);
    // Prioridad 2: primer resultado del filtro actual
    if (!prod && productosFiltrados.length > 0) prod = productosFiltrados[0];
    if (prod) {
      agregarProductoPresencial(prod);
      setBusqProd('');
      setTimeout(() => busqProdRef.current?.focus(), 10);
    }
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
        const rPed = await fetch('/api/pedidos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tipo: 'Presencial', cajeroId: user.id, meseroId: user.id, items })  // ← NUEVO: en presencial el cajero es el mesero
        });
        if (!rPed.ok) throw new Error('No se pudo crear el pedido presencial.');
        const dPed = await rPed.json();
        pedidoId = dPed.pedidoId;
      } else if (modo === 'mesa') {
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
            meseroId: pedidoSel.meseroId || user.id,   // ← NUEVO: mesero real (fallback al cajero si pedido viejo)
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
          rucCliente: rucInput || 'X',
          nombreCliente: razonSocial,
          metodoPago,
          cajeroId: user.id,
          isElectronica: tipoComprobante === 'electronica',
          isNotaCredito: tipoDocumento === 'nota_credito'
        })
      });

      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error al emitir la factura.');

      const facturaData = {
        ...d,
        razonSocial: razonSocial,
        rucCliente: rucInput,
        metodoPago,
        items,
        totalFactura: total,
        fechaEmision: new Date().toISOString(),
        nombreCliente: razonSocial,
        isNotaCredito: tipoDocumento === 'nota_credito',
        isElectronica: tipoComprobante === 'electronica'
      };

      setResultado(facturaData);
      setShowTicket(true);

      if (emailCliente) {
        fetch('/api/facturacion/enviar-correo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emailCliente,
            numeroFactura: d.numeroFactura,
            cdc: d.cdc,
            enlaceQR: d.enlaceQR,
            nombreCliente: razonSocial,
            totalFactura: total,
            items
          })
        }).catch(() => { });
      }

      if (modo === 'mesa' && pedidoSel) {
        const rawPedidos = localStorage.getItem('restaurante_pedidos');
        if (rawPedidos) {
          const localPedidos = JSON.parse(rawPedidos);
          const updatedLocalPedidos = localPedidos.map(p =>
            pedidoSel.originalOrderIds.includes(p.id) ? { ...p, estado: 'Pagado' } : p
          );
          localStorage.setItem('restaurante_pedidos', JSON.stringify(updatedLocalPedidos));
        }

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

        window.dispatchEvent(new Event('pedidos_updated'));
      }

      cargarPedidos();
      setPedidoSel(null);
      setItemsPresencial([]);

    } catch (err) {
      setError(err.message);
    } finally {
      setEmitiendo(false);
    }
  };

  const _q = busqProd.toLowerCase().trim();
  const productosFiltrados = productos.filter(p => {
    if (p.Activo === false) return false;
    const matchCat = catSel === 'todas' || String(p.CategoriaId) === String(catSel);
    const matchTexto = !_q ||
      p.Nombre.toLowerCase().includes(_q) ||
      (p.Codigo && String(p.Codigo).toLowerCase().includes(_q));
    return matchCat && matchTexto;
  });

  if (!user) return null;

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
  const labelStyle = { display: 'block', fontSize: '0.65rem', color: 'var(--primary)', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' };
  const cardStyle = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '1.2rem', marginBottom: '1rem' };
  const chipCat = (active) => ({
    padding: '5px 12px', fontSize: '0.68rem', fontWeight: '700', borderRadius: '7px', cursor: 'pointer',
    border: active ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)',
    background: active ? 'rgba(0,210,190,0.12)' : 'rgba(255,255,255,0.03)',
    color: active ? 'var(--primary)' : 'rgba(255,255,255,0.45)', transition: 'all 0.2s',
  });

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
              style={{
                flex: 1, padding: '14px', borderRadius: '12px', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s',
                background: modo === val ? 'rgba(0,210,190,0.12)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${modo === val ? 'var(--primary)' : 'rgba(255,255,255,0.07)'}`,
                color: modo === val ? 'var(--primary)' : 'rgba(255,255,255,0.4)'
              }}>{lbl}</button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'start' }}>

          {/* PANEL IZQUIERDO */}
          <div>
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
                      style={{
                        padding: '12px 16px', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s',
                        background: pedidoSel?.pedidoId === p.pedidoId ? 'rgba(0,210,190,0.1)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${pedidoSel?.pedidoId === p.pedidoId ? 'var(--primary)' : 'rgba(255,255,255,0.06)'}`
                      }}>
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

            {modo === 'presencial' && (
              <div style={cardStyle}>
                <p style={labelStyle}>Agregar Productos</p>
                <div style={{ position: 'relative', marginBottom: '10px' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.9rem', pointerEvents: 'none' }}>🔍</span>
                  <input
                    ref={busqProdRef}
                    value={busqProd}
                    onChange={e => setBusqProd(e.target.value)}
                    onKeyDown={onBuscarKeyDown}
                    autoFocus
                    placeholder="Buscar por nombre o código · Enter agrega (lector de barras)"
                    style={{ ...inputStyle, paddingLeft: '36px' }}
                  />
                  {busqProd && (
                    <button onClick={() => { setBusqProd(''); busqProdRef.current?.focus(); }} title="Limpiar"
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.6)', borderRadius: '5px', padding: '2px 7px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '700' }}>✕</button>
                  )}
                </div>

                {/* Chips de categoría */}
                {categorias.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <button onClick={() => setCatSel('todas')} style={chipCat(catSel === 'todas')}>Todas</button>
                    {categorias.map(c => (
                      <button key={c.Id} onClick={() => setCatSel(c.Id)} style={chipCat(String(catSel) === String(c.Id))}>
                        {c.Nombre}
                      </button>
                    ))}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
                  {productosFiltrados.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', gridColumn: '1/-1', textAlign: 'center', padding: '1.5rem' }}>
                      Sin productos que coincidan{_q ? ` con "${busqProd}"` : ''}.
                    </p>
                  ) : productosFiltrados.map(p => {
                    const trackStock = !p.RequierePreparacion;
                    const stock = Number(p.StockActual) || 0;
                    const agotado = trackStock && stock <= 0;
                    return (
                      <div key={p.Id} onClick={() => agregarProductoPresencial(p)}
                        style={{ padding: '12px', borderRadius: '10px', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.2s', position: 'relative' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}>
                        {p.Codigo && (
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: '3px', fontWeight: '700' }}>#{p.Codigo}</div>
                        )}
                        <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#fff', marginBottom: '4px', lineHeight: 1.2 }}>{p.Nombre}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '800' }}>Gs. {fmt(p.Precio)}</span>
                          {trackStock && (
                            <span style={{
                              fontSize: '0.6rem', fontWeight: '700', padding: '2px 6px', borderRadius: '5px',
                              background: agotado ? 'rgba(239,68,68,0.12)' : stock <= (Number(p.StockMinimo) || 0) ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.05)',
                              color: agotado ? '#ef4444' : stock <= (Number(p.StockMinimo) || 0) ? '#f59e0b' : 'var(--text-muted)'
                            }}>
                              {agotado ? 'agotado' : `stock ${stock}`}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {items.length > 0 && (
              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <p style={{ ...labelStyle, marginBottom: 0 }}>
                    Detalle del Consumo · {items.reduce((s, i) => s + i.cantidad, 0)} u
                  </p>
                  {modo === 'presencial' && (
                    <button onClick={vaciarCarrito} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', borderRadius: '7px', padding: '4px 10px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: '800' }}>
                      🗑 Vaciar
                    </button>
                  )}
                </div>
                {items.map((it, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ color: '#fff', fontSize: '0.85rem' }}>{it.nombre}</span>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Gs. {fmt(it.precioUnitario)} c/u</div>
                    </div>
                    {modo === 'presencial' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button onClick={() => cambiarCantidad(it.productoId, -1)} style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: '900' }}>−</button>
                        <input
                          type="number" min="1" value={it.cantidad}
                          onChange={e => setCantidadExacta(it.productoId, e.target.value)}
                          style={{ width: '38px', textAlign: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '6px', color: 'var(--primary)', fontWeight: '800', fontSize: '0.8rem', padding: '3px 2px', fontFamily: 'inherit', outline: 'none' }}
                        />
                        <button onClick={() => cambiarCantidad(it.productoId, 1)} style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(0,210,190,0.15)', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: '900' }}>+</button>
                        <button onClick={() => quitarItem(it.productoId)} title="Quitar" style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: '900', marginLeft: '2px' }}>✕</button>
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

          {/* PANEL DERECHO */}
          <div>
            <div style={cardStyle}>
              <p style={labelStyle}>RUC del Cliente (DNIT)</p>
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input value={rucInput} onChange={e => buscarRUC(e.target.value)} placeholder="RUC o Razón Social..." style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={() => { setRucInput(''); setRazonSocial('Consumidor Final'); setSugerencias([]); }} title="Limpiar / Consumidor Final"
                    style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
                </div>

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

              <div style={{ background: 'rgba(0,210,190,0.05)', border: '1px solid rgba(0,210,190,0.15)', borderRadius: '8px', padding: '8px 12px', marginTop: '8px' }}>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '2px' }}>CLIENTE (EDITABLE)</p>
                <input
                  value={razonSocial}
                  onChange={e => setRazonSocial(e.target.value)}
                  style={{ width: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: '700', outline: 'none', padding: '2px 0' }}
                />
              </div>
            </div>

            <div style={cardStyle}>
              <p style={labelStyle}>Tipo de Documento</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setTipoDocumento('factura')}
                  style={{
                    flex: 1, padding: '10px 6px', borderRadius: '10px', fontWeight: '700', fontSize: '0.72rem', cursor: 'pointer', transition: 'all 0.2s',
                    background: tipoDocumento === 'factura' ? 'rgba(0,210,190,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${tipoDocumento === 'factura' ? 'var(--primary)' : 'rgba(255,255,255,0.06)'}`,
                    color: tipoDocumento === 'factura' ? 'var(--primary)' : 'rgba(255,255,255,0.4)'
                  }}>
                  📄 Factura
                </button>
                <button onClick={() => setTipoDocumento('nota_credito')}
                  style={{
                    flex: 1, padding: '10px 6px', borderRadius: '10px', fontWeight: '700', fontSize: '0.72rem', cursor: 'pointer', transition: 'all 0.2s',
                    background: tipoDocumento === 'nota_credito' ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${tipoDocumento === 'nota_credito' ? '#ef4444' : 'rgba(255,255,255,0.06)'}`,
                    color: tipoDocumento === 'nota_credito' ? '#ef4444' : 'rgba(255,255,255,0.4)'
                  }}>
                  ↩️ Nota de Crédito
                </button>
              </div>
            </div>

            {!isConfigFixed && (
              <div style={cardStyle}>
                <p style={labelStyle}>Tipo de Comprobante</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setTipoComprobante('electronica')}
                    style={{
                      flex: 1, padding: '10px 6px', borderRadius: '10px', fontWeight: '700', fontSize: '0.72rem', cursor: 'pointer', transition: 'all 0.2s',
                      background: tipoComprobante === 'electronica' ? 'rgba(0,210,190,0.12)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${tipoComprobante === 'electronica' ? 'var(--primary)' : 'rgba(255,255,255,0.06)'}`,
                      color: tipoComprobante === 'electronica' ? 'var(--primary)' : 'rgba(255,255,255,0.4)'
                    }}>
                    🌐 Electrónica (SIFEN)
                  </button>
                  <button onClick={() => setTipoComprobante('normal')}
                    style={{
                      flex: 1, padding: '10px 6px', borderRadius: '10px', fontWeight: '700', fontSize: '0.72rem', cursor: 'pointer', transition: 'all 0.2s',
                      background: tipoComprobante === 'normal' ? 'rgba(0,210,190,0.12)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${tipoComprobante === 'normal' ? 'var(--primary)' : 'rgba(255,255,255,0.06)'}`,
                      color: tipoComprobante === 'normal' ? 'var(--primary)' : 'rgba(255,255,255,0.4)'
                    }}>
                    🧾 Factura / Ticket
                  </button>
                </div>
              </div>
            )}

            {tipoComprobante === 'electronica' && (
              <div style={cardStyle}>
                <label style={labelStyle}>Correo para envío de factura</label>
                <input type="email" value={emailCliente} onChange={e => setEmailCliente(e.target.value)} placeholder="cliente@ejemplo.com (opcional)" style={inputStyle} />
              </div>
            )}

            <div style={cardStyle}>
              <p style={labelStyle}>Método de Pago</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {[['Efectivo', '💵'], ['Tarjeta', '💳'], ['Transferencia', '📱']].map(([m, ico]) => (
                  <button key={m} onClick={() => setMetodoPago(m)}
                    style={{
                      padding: '10px 6px', borderRadius: '10px', fontWeight: '700', fontSize: '0.72rem', cursor: 'pointer', transition: 'all 0.2s',
                      background: metodoPago === m ? 'rgba(0,210,190,0.12)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${metodoPago === m ? 'var(--primary)' : 'rgba(255,255,255,0.06)'}`,
                      color: metodoPago === m ? 'var(--primary)' : 'rgba(255,255,255,0.4)'
                    }}>
                    {ico}<br />{m}
                  </button>
                ))}
              </div>
            </div>

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

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '10px 14px', color: '#ef4444', fontSize: '0.8rem', marginBottom: '10px' }}>
                ⚠ {error}
              </div>
            )}

            <button onClick={emitirFactura} disabled={emitiendo || items.length === 0}
              className="luxury-button"
              style={{ width: '100%', padding: '16px', fontSize: '0.9rem', background: tipoDocumento === 'nota_credito' ? 'linear-gradient(to right, #ef4444, #dc2626)' : 'var(--accent-gradient)', color: tipoDocumento === 'nota_credito' ? '#fff' : '#000', opacity: (emitiendo || items.length === 0) ? 0.5 : 1, cursor: items.length === 0 ? 'not-allowed' : 'pointer', border: 'none', fontWeight: '900' }}>
              {emitiendo ? '⏳ Procesando...' : `✅ EMITIR ${tipoDocumento === 'nota_credito' ? 'NOTA DE CRÉDITO' : (tipoComprobante === 'electronica' ? 'FACTURA ELECTRÓNICA' : 'COMPROBANTE')}`}
            </button>
          </div>
        </div>

        {/* ── MODAL DE RESULTADO CON VISTA PREVIA Y ACCIONES ── */}
        {showTicket && resultado && (
          <div onClick={e => { if (e.target === e.currentTarget) setShowTicket(false); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '2rem', overflowY: 'auto', flexWrap: 'wrap' }}>

            {/* Columna Izquierda: Mensaje de éxito y Botones de control */}
            <div style={{ background: '#0d1117', border: '1px solid rgba(0,210,190,0.2)', borderRadius: '20px', padding: '2rem', maxWidth: '380px', width: '100%', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>✅</div>
                <h3 style={{ color: '#fff', fontWeight: '900', fontSize: '1.2rem' }}>Factura Emitida</h3>
                <p style={{ color: 'var(--primary)', fontWeight: '800', fontSize: '1rem', marginTop: '4px' }}>{resultado.numeroFactura}</p>
                <p style={{ color: resultado.estadoSifen === 'Aprobado' ? 'var(--success)' : 'var(--warning)', fontSize: '0.8rem', marginTop: '4px' }}>
                  SIFEN: {resultado.estadoSifen} · {resultado.mensajeSifen?.substring(0, 60)}
                </p>
              </div>

              {emailCliente && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '1.5rem' }}>
                  📧 Factura enviada a <strong style={{ color: '#fff' }}>{emailCliente}</strong>
                </p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button onClick={() => ticketRef.current?.imprimir()}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(0,210,190,0.12)', border: '1px solid var(--primary)', color: 'var(--primary)', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  🖨️ Imprimir Factura
                </button>

                <button onClick={() => ticketRef.current?.imprimir()}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  📄 Guardar como PDF
                </button>

                <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '10px 0' }} />

                <button onClick={() => { setShowTicket(false); setResultado(null); setRucInput(''); setRazonSocial('Consumidor Final'); setEmailCliente(''); }}
                  style={{ width: '100%', padding: '14px', borderRadius: '10px', background: 'var(--accent-gradient)', color: '#000', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', border: 'none' }}>
                  ✨ Nueva Venta
                </button>
              </div>
            </div>

            {/* Columna Derecha: Contenedor con la Vista Previa del Ticket */}
            <div style={{ background: '#fff', color: '#000', borderRadius: '16px', padding: '1.5rem', maxWidth: '400px', width: '100%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 15px 40px rgba(0,0,0,0.6)' }}>
              <div style={{ borderBottom: '2px dashed #ccc', paddingBottom: '6px', marginBottom: '14px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#666', letterSpacing: '1px' }}>VISTA PREVIA DEL COMPROBANTE</span>
              </div>
              <TicketFactura ref={ticketRef} datos={resultado} />
            </div>

          </div>
        )}
      </main>
    </div>
  );
}