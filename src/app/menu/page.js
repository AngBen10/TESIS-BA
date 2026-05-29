'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default function Menu() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCat, setSelectedCat] = useState('Todas');
  const [cart, setCart] = useState([]);
  const [selectedMesa, setSelectedMesa] = useState('1');
  const [showAdmin, setShowAdmin] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingProd, setEditingProd] = useState(null);
  const [formProd, setFormProd] = useState({ codigo: '', nombre: '', precio: '', categoriaId: '', requierePreparacion: true, stockActual: 0, stockMinimo: 0 });
  const [nota, setNota] = useState('');
  const [sending, setSending] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) { router.push('/login'); return; }
    setUser(JSON.parse(storedUser));
    fetchData();

    // Read mesa from URL query
    const params = new URLSearchParams(window.location.search);
    const mesaQ = params.get('mesa');
    if (mesaQ) setSelectedMesa(mesaQ);
  }, [router]);

  const fetchData = async () => {
    try {
      const [pRes, cRes] = await Promise.all([fetch('/api/productos'), fetch('/api/categorias')]);
      setProducts(await pRes.json());
      setCategories(await cRes.json());
    } catch (err) { console.error(err); }
  };

  const addToCart = (product) => {
    const isUnlimited = product.RequierePreparacion;
    // Eliminado: if (!isUnlimited && product.StockActual <= 0) { ... }
    const existing = cart.find(i => i.id === product.Id);
    if (existing) {
      // Eliminado: if (!isUnlimited && existing.cantidad >= product.StockActual) { ... }
      setCart(cart.map(i => i.id === product.Id ? { ...i, cantidad: i.cantidad + 1 } : i));
    } else {
      setCart([...cart, { 
        id: product.Id, 
        nombre: product.Nombre, 
        precio: product.Precio, 
        cantidad: 1, 
        requierePreparacion: product.RequierePreparacion 
      }]);
    }
  };

  const updateQty = (id, delta) => {
    // Eliminado: limitación de stock para permitir stock negativo
    setCart(prev => prev
      .map(i => i.id === id ? { ...i, cantidad: i.cantidad + delta } : i)
      .filter(i => i.cantidad > 0)
    );
  };

  const total = cart.reduce((a, i) => a + i.precio * i.cantidad, 0);

  const enviarPedido = async () => {
    if (cart.length === 0) return;
    setSending(true);
    try {
      const storedUser = localStorage.getItem('user');
      const u = storedUser ? JSON.parse(storedUser) : {};
      const mesaLabel = `Mesa ${selectedMesa}`;

      // Load current orders
      const raw = localStorage.getItem('restaurante_pedidos');
      let pedidos = raw ? JSON.parse(raw) : [];

      // Split the cart into items that require preparation and items that are ready immediately
      const prepItems = cart.filter(i => i.requierePreparacion);
      const readyItems = cart.filter(i => !i.requierePreparacion);
      const baseId = Date.now();

      if (prepItems.length > 0) {
        pedidos.push({
          id: baseId.toString().slice(-5),
          mesa: mesaLabel,
          fecha: new Date().toLocaleString('es-PY'),
          timestamp: baseId,
          items: prepItems.map(i => ({ ...i })),
          nota: nota,
          mesero: u.nombre || 'Mesero',
          estado: 'Pendiente',
        });
      }

      if (readyItems.length > 0) {
        // Offset ID by 1 to prevent collisions if both are submitted together
        pedidos.push({
          id: (baseId + 1).toString().slice(-5),
          mesa: mesaLabel,
          fecha: new Date().toLocaleString('es-PY'),
          timestamp: baseId + 1,
          items: readyItems.map(i => ({ ...i })),
          nota: prepItems.length > 0 ? '' : nota, // assign note to kitchen order if mixed
          mesero: u.nombre || 'Mesero',
          estado: 'Listo',
        });
      }

      localStorage.setItem('restaurante_pedidos', JSON.stringify(pedidos));

      // Deduct stock in DB
      for (const item of cart) {
        const prod = products.find(p => p.Id === item.id);
        // Only deduct if it's NOT unlimited (not requiring prep) and has stock tracking
        if (prod && !prod.RequierePreparacion) {
          try {
            const newStock = prod.StockActual - item.cantidad;
            await fetch(`/api/productos/${prod.Id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                codigo: prod.Codigo || '',
                nombre: prod.Nombre,
                precio: prod.Precio,
                categoriaId: prod.CategoriaId,
                requierePreparacion: prod.RequierePreparacion,
                stockActual: newStock,
                stockMinimo: prod.StockMinimo || 0
              })
            });
          } catch (err) { console.error("Error updating stock:", err); }
        }
      }

      // Update table state to Ocupada
      const rawMesas = localStorage.getItem('restaurante_mesas');
      if (rawMesas) {
        const mesas = JSON.parse(rawMesas);
        const idx = mesas.findIndex(m => m.numero.toString() === selectedMesa.toString());
        if (idx !== -1) {
          mesas[idx].estado = 'Ocupada';
          mesas[idx].pedidoActivo = true;
          localStorage.setItem('restaurante_mesas', JSON.stringify(mesas));
        }
      }

      window.dispatchEvent(new Event('pedidos_updated'));
      setCart([]);
      setNota('');
      router.push('/mesas');
    } catch (e) {
      console.error(e);
      alert('Error al enviar pedido');
    } finally { setSending(false); }
  };

  const openModal = (prod = null) => {
    if (prod) {
      setEditingProd(prod);
      setFormProd({ 
        codigo: prod.Codigo || '', 
        nombre: prod.Nombre, 
        precio: prod.Precio, 
        categoriaId: prod.CategoriaId, 
        requierePreparacion: prod.RequierePreparacion ?? true, 
        stockActual: prod.StockActual || 0, 
        stockMinimo: prod.StockMinimo || 0 
      });
    } else {
      setEditingProd(null);
      setFormProd({ 
        codigo: '', 
        nombre: '', 
        precio: '', 
        categoriaId: categories[0]?.Id || '', 
        requierePreparacion: true, 
        stockActual: 0, 
        stockMinimo: 0 
      });
    }
    setShowModal(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const method = editingProd ? 'PUT' : 'POST';
    const url = editingProd ? `/api/productos/${editingProd.Id}` : '/api/productos';
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formProd) });
      if (res.ok) { setShowModal(false); fetchData(); }
      else { const d = await res.json(); alert(`Error: ${d.error || 'Problema desconocido'}`); }
    } catch { alert('Error de conexión'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar producto?')) return;
    const res = await fetch(`/api/productos/${id}`, { method: 'DELETE' });
    if (res.ok) fetchData();
  };

  const filtered = products.filter(p => {
    const s = p.Nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const c = selectedCat === 'Todas' || p.CategoriaNombre === selectedCat;
    return s && c;
  });

  if (!user) return null;

  return (
    <div className="desktop-app">
      <Sidebar user={user} />
      <main className="main-view" style={{ display: 'flex', gap: '1.5rem', padding: '1.5rem 2rem' }}>

        {/* LEFT: Catalog */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Header */}
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#fff' }}>
                {showAdmin ? '⚙️ Gestión de Inventario' : '🍽️ Catálogo'}
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                {showAdmin ? 'Administre productos, precios y stock' : 'Seleccione productos para agregar al pedido'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {showAdmin && (
                <button onClick={() => openModal()} className="luxury-button" style={{ background: 'var(--accent-gradient)', color: '#000', fontSize: '0.78rem', padding: '9px 18px' }}>
                  + Nuevo
                </button>
              )}
              {user.roleId === 1 && (
                <button onClick={() => setShowAdmin(!showAdmin)} className="luxury-button" style={{ background: 'rgba(255,255,255,0.05)', color: showAdmin ? 'var(--primary)' : '#fff', border: '1px solid var(--border)', fontSize: '0.78rem', padding: '9px 18px' }}>
                  {showAdmin ? '← Menú' : '⚙️ Admin'}
                </button>
              )}
            </div>
          </header>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <input
              type="text" placeholder="🔍 Buscar producto..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="luxury-input"
              style={{ flex: 1, minWidth: '160px', padding: '9px 14px', fontSize: '0.85rem' }}
            />
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['Todas', ...categories.map(c => c.Nombre)].map(cat => (
                <button key={cat} onClick={() => setSelectedCat(cat)} style={{
                  padding: '7px 12px', fontSize: '0.7rem', fontWeight: '700', borderRadius: '8px', cursor: 'pointer',
                  border: selectedCat === cat ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)',
                  background: selectedCat === cat ? 'rgba(0,210,190,0.12)' : 'rgba(255,255,255,0.03)',
                  color: selectedCat === cat ? 'var(--primary)' : 'rgba(255,255,255,0.4)',
                  transition: 'all 0.2s',
                }}>{cat}</button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(10,12,15,0.5)', borderRadius: '14px', border: '1px solid rgba(0,210,190,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#0d0f14', zIndex: 1 }}>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Código', 'Producto', 'Categoría', 'Stock', 'Precio', 'Acción'].map((h, i) => (
                    <th key={h} style={{ padding: '10px 14px', fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '800', textAlign: i >= 3 ? 'center' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin resultados</td></tr>
                ) : filtered.map(prod => (
                  <tr key={prod.Id} style={{ borderBottom: '1px solid rgba(255,255,255,0.025)', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '9px 14px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{prod.Codigo || '—'}</td>
                    <td style={{ padding: '9px 14px', fontWeight: '600', color: '#fff', fontSize: '0.87rem', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prod.Nombre}</td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{ fontSize: '0.62rem', background: 'rgba(0,210,190,0.08)', color: 'var(--primary)', padding: '3px 8px', borderRadius: '5px', fontWeight: '700', border: '1px solid rgba(0,210,190,0.12)' }}>{prod.CategoriaNombre}</span>
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'center', fontWeight: '700', fontSize: '0.85rem' }}>
                      {prod.RequierePreparacion ? (
                        <span style={{ color: 'var(--primary)', fontSize: '0.6rem', opacity: 0.8 }}>ILIMITADO</span>
                      ) : (
                        <span style={{ color: prod.StockActual <= prod.StockMinimo ? '#ef4444' : 'rgba(255,255,255,0.5)' }}>{prod.StockActual ?? 0}</span>
                      )}
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'center', fontWeight: '800', color: 'var(--primary)', fontSize: '0.9rem' }}>
                      <span style={{ fontSize: '0.6rem', opacity: 0.5, marginRight: '3px' }}>Gs.</span>{prod.Precio.toLocaleString('es-PY')}
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'center' }}>
                      {showAdmin ? (
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                          <button onClick={() => openModal(prod)} style={{ background: 'rgba(0,210,190,0.1)', color: 'var(--primary)', border: 'none', padding: '5px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>✏️</button>
                          <button onClick={() => handleDelete(prod.Id)} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', padding: '5px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>🗑️</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(prod)}
                          style={{ 
                            background: 'var(--primary)', 
                            color: '#000', 
                            border: 'none', width: '30px', height: '30px', borderRadius: '8px', fontWeight: '900', 
                            cursor: 'pointer', 
                            fontSize: '1.1rem', transition: 'all 0.15s' 
                          }}
                        >+</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: Order Panel */}
        {!showAdmin && (
          <div style={{ width: '300px', minWidth: '280px', display: 'flex', flexDirection: 'column', background: 'rgba(8,10,14,0.8)', border: '1px solid rgba(0,210,190,0.1)', borderRadius: '18px', padding: '1.3rem', height: 'calc(100vh - 3rem)', position: 'sticky', top: '1.5rem' }}>
            {/* Mesa selector */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: 'var(--primary)', fontWeight: '800', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '7px' }}>🧾 Orden actual</h3>
              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '3px 8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <select value={selectedMesa} onChange={e => setSelectedMesa(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.78rem', fontWeight: '700', outline: 'none', cursor: 'pointer' }}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n} style={{ background: '#111' }}>Mesa {n}</option>)}
                </select>
              </div>
            </div>

            {/* Cart items */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1rem' }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', marginTop: '40%', color: 'rgba(255,255,255,0.15)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📭</div>
                  <p style={{ fontSize: '0.72rem', fontWeight: '700', letterSpacing: '1px' }}>CARRITO VACÍO</p>
                </div>
              ) : cart.map(item => (
                <div key={item.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '9px 12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#fff', flex: 1, marginRight: '8px', wordBreak: 'break-word' }}>{item.nombre}</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--primary)', whiteSpace: 'nowrap' }}>Gs. {(item.precio * item.cantidad).toLocaleString('es-PY')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => updateQty(item.id, -1)} style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                    <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#fff', minWidth: '20px', textAlign: 'center' }}>{item.cantidad}</span>
                    <button onClick={() => updateQty(item.id, 1)} style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid rgba(0,210,190,0.3)', background: 'rgba(0,210,190,0.08)', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginLeft: '4px' }}>× Gs. {item.precio.toLocaleString('es-PY')}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Nota */}
            {cart.length > 0 && (
              <textarea
                placeholder="Nota para cocina (opcional)..."
                value={nota} onChange={e => setNota(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '8px 12px', color: '#fff', fontSize: '0.78rem', resize: 'none', height: '55px', outline: 'none', marginBottom: '10px', fontFamily: 'inherit' }}
              />
            )}

            {/* Total + Confirm */}
            <div style={{ borderTop: '1px dashed rgba(0,210,190,0.15)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Total</span>
                <span style={{ fontSize: '1.3rem', fontWeight: '900', color: 'var(--primary)' }}>Gs. {total.toLocaleString('es-PY')}</span>
              </div>
              <button
                onClick={enviarPedido}
                disabled={cart.length === 0 || sending}
                className="luxury-button"
                style={{ width: '100%', background: cart.length > 0 ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)', color: cart.length > 0 ? '#000' : 'rgba(255,255,255,0.2)', opacity: sending ? 0.7 : 1, fontSize: '0.8rem', padding: '12px', borderRadius: '10px' }}
              >
                {sending ? '⏳ Enviando...' : '🍳 CONFIRMAR PEDIDO'}
              </button>
            </div>
          </div>
        )}

        {/* MODAL Producto */}
        {showModal && (
          <div onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.87)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ width: '480px', maxWidth: '95vw', background: '#0d0f14', border: '1px solid rgba(0,210,190,0.25)', borderRadius: '20px', padding: '2rem', boxShadow: '0 0 60px rgba(0,210,190,0.1)', maxHeight: '90vh', overflowY: 'auto' }}>
              <h2 style={{ color: 'var(--primary)', fontWeight: '900', marginBottom: '1.5rem', textAlign: 'center', fontSize: '1.1rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
                {editingProd ? '✏️ Editar Producto' : '＋ Nuevo Producto'}
              </h2>
              <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  { label: 'Código (SKU)', key: 'codigo', placeholder: 'Ej: BEB-001', type: 'text' },
                  { label: 'Nombre del Producto *', key: 'nombre', placeholder: 'Ej: Bife de Chorizo', type: 'text', required: true },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>{f.label}</label>
                    <input className="luxury-input" type={f.type} placeholder={f.placeholder} value={formProd[f.key]} onChange={e => setFormProd({ ...formProd, [f.key]: e.target.value })} style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem' }} required={f.required} />
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Precio (Gs) *</label>
                    <input className="luxury-input" type="number" placeholder="0" value={formProd.precio} onChange={e => setFormProd({ ...formProd, precio: e.target.value })} style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem' }} required />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Categoría *</label>
                    <select className="luxury-input" value={formProd.categoriaId} onChange={e => setFormProd({ ...formProd, categoriaId: e.target.value })} style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem', cursor: 'pointer' }} required>
                      <option value="">Seleccione</option>
                      {categories.map(c => <option key={c.Id} value={c.Id} style={{ background: '#000' }}>{c.Nombre}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Stock Actual</label>
                    <input className="luxury-input" type="number" placeholder="0" value={formProd.stockActual} onChange={e => setFormProd({ ...formProd, stockActual: e.target.value })} style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Stock Mínimo</label>
                    <input className="luxury-input" type="number" placeholder="0" value={formProd.stockMinimo} onChange={e => setFormProd({ ...formProd, stockMinimo: e.target.value })} style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem' }} />
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#fff', cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={!!formProd.requierePreparacion} onChange={e => setFormProd({ ...formProd, requierePreparacion: e.target.checked })} style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }} />
                  Requiere preparación en cocina (Stock ilimitado)
                </label>
                <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setShowModal(false)} className="luxury-button" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '11px' }}>Cancelar</button>
                  <button type="submit" className="luxury-button" style={{ flex: 1, background: 'var(--accent-gradient)', color: '#000', padding: '11px' }}>{editingProd ? 'Actualizar' : 'Guardar'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
