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
  const [selectedMesa, setSelectedMesa] = useState('2');
  
  // UI States
  const [showAdmin, setShowAdmin] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  // Form state
  const [editingProd, setEditingProd] = useState(null);
  const [formProd, setFormProd] = useState({ codigo: '', nombre: '', precio: '', categoriaId: '', requierePreparacion: true, stockActual: 0, stockMinimo: 0 });

  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/login');
    } else {
      setUser(JSON.parse(storedUser));
      fetchData();
    }
  }, [router]);

  const fetchData = async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        fetch('/api/productos'),
        fetch('/api/categorias')
      ]);
      const prodData = await prodRes.json();
      const catData = await catRes.json();
      setProducts(prodData);
      setCategories(catData);
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  const addToCart = (product) => {
    if (product.StockActual <= 0) {
      alert(`El producto ${product.Nombre} no tiene stock disponible.`);
      return;
    }

    const existing = cart.find(item => item.id === product.Id);
    if (existing) {
      if (existing.cantidad >= product.StockActual) {
        alert('No hay suficiente stock para añadir más unidades.');
        return;
      }
      setCart(cart.map(item => item.id === product.Id ? { ...item, cantidad: item.cantidad + 1 } : item));
    } else {
      setCart([...cart, { id: product.Id, nombre: product.Nombre, precio: product.Precio, cantidad: 1 }]);
    }
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const total = cart.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);

  const enviarPedido = () => {
    if (cart.length === 0) return;
    alert(`Pedido enviado a la Mesa ${selectedMesa}.`);
    setCart([]);
    router.push('/mesas');
  };

  const openModal = (prod = null) => {
    if (prod) {
      setEditingProd(prod);
      setFormProd({ 
        codigo: prod.Codigo || '',
        nombre: prod.Nombre, 
        precio: prod.Precio, 
        categoriaId: prod.CategoriaId, 
        requierePreparacion: prod.RequierePreparacion,
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
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formProd)
      });
      if (res.ok) {
        setShowModal(false);
        fetchData();
      } else {
        const errorData = await res.json();
        alert(`Error al guardar: ${errorData.error || 'Ocurrió un problema'}`);
      }
    } catch (err) {
      console.error('Error saving product:', err);
      alert('Error de conexión al servidor.');
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!confirm('¿Seguro que desea eliminar este producto?')) return;
    try {
      const res = await fetch(`/api/productos/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.Nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCat === 'Todas' || p.CategoriaNombre === selectedCat;
    return matchesSearch && matchesCat;
  });

  if (!user) return null;

  return (
    <div className="desktop-app">
      <Sidebar user={user} />

      <main className="main-view" style={{ display: 'flex', gap: '2rem' }}>
        
        {/* Lado Izquierdo: Menú o Admin */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fff', marginBottom: '0.2rem', letterSpacing: '0px' }}>
                {showAdmin ? '⚙️ Gestión de Inventario' : '🍽️ Menú / Añadir Producto'}
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {showAdmin ? 'Administre los productos, precios y stock del catálogo' : 'Seleccione productos para la mesa actual'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {showAdmin && (
                <button 
                  onClick={() => openModal()}
                  className="luxury-button"
                  style={{ background: 'var(--accent-gradient)', color: '#000', fontSize: '0.85rem', padding: '10px 20px' }}
                >
                  + Nuevo Producto
                </button>
              )}
              {user.roleId === 1 && (
                <button 
                  onClick={() => setShowAdmin(!showAdmin)}
                  className="luxury-button"
                  style={{ background: 'rgba(255,255,255,0.05)', color: showAdmin ? 'var(--primary)' : '#fff', border: '1px solid var(--border)', fontSize: '0.85rem', padding: '10px 20px' }}
                >
                  {showAdmin ? 'Volver al Menú' : '⚙️ Administrar'}
                </button>
              )}
            </div>
          </header>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <input 
              type="text" 
              placeholder="🔍 Buscar en el catálogo..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="luxury-input"
              style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', fontSize: '0.9rem' }}
            />
            <select 
              className="luxury-input" 
              value={selectedCat} 
              onChange={(e) => setSelectedCat(e.target.value)}
              style={{ appearance: 'none', minWidth: '180px', cursor: 'pointer', padding: '12px 16px', borderRadius: '12px', fontSize: '0.9rem' }}
            >
              <option value="Todas">Todas las categorías</option>
              {categories.map(cat => (
                <option key={cat.Id} value={cat.Nombre} style={{ background: '#000' }}>{cat.Nombre}</option>
              ))}
            </select>
          </div>

          {/* Tabla Única (Menu o Admin) */}
          <div className="glass-card" style={{ flex: 1, overflowY: 'auto', background: 'rgba(10,12,15,0.4)', borderRadius: '16px', border: '1px solid rgba(0, 210, 190, 0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0, 210, 190, 0.1)', color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  <th style={{ padding: '1.2rem' }}>Código</th>
                  <th style={{ padding: '1.2rem' }}>Detalle del Producto</th>
                  <th style={{ padding: '1.2rem' }}>Categoría</th>
                  <th style={{ padding: '1.2rem', textAlign: 'center' }}>Stock</th>
                  <th style={{ padding: '1.2rem', textAlign: 'right' }}>Precio Unitario</th>
                  <th style={{ padding: '1.2rem', textAlign: 'center' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(prod => (
                  <tr 
                    key={prod.Id} 
                    className="teal-glow-hover"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'all 0.2s' }}
                  >
                    <td style={{ padding: '1rem 1.2rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {prod.Codigo || '-'}
                    </td>
                    <td style={{ padding: '1rem 1.2rem' }}>
                      <div style={{ fontWeight: '600', color: '#fff', fontSize: '0.95rem' }}>{prod.Nombre}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{prod.RequierePreparacion ? 'Requiere Cocina' : 'Entrega Inmediata'}</div>
                    </td>
                    <td style={{ padding: '1rem 1.2rem' }}>
                      <span style={{ fontSize: '0.7rem', background: 'rgba(0, 210, 190, 0.08)', color: 'var(--primary)', padding: '4px 10px', borderRadius: '8px', fontWeight: '700', border: '1px solid rgba(0, 210, 190, 0.1)' }}>
                        {prod.CategoriaNombre}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.2rem', textAlign: 'center', fontWeight: 'bold' }}>
                      <span style={{ color: (prod.StockActual <= prod.StockMinimo) ? '#ff4d4d' : 'var(--text-muted)' }}>
                        {prod.StockActual || 0}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.2rem', textAlign: 'right', fontWeight: '800', color: 'var(--primary)', fontSize: '1rem' }}>
                      <span style={{ fontSize: '0.65rem', opacity: 0.6, marginRight: '4px' }}>Gs.</span>
                      {prod.Precio.toLocaleString('es-PY')}
                    </td>
                    <td style={{ padding: '1rem 1.2rem', textAlign: 'center' }}>
                      {showAdmin ? (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button 
                            onClick={() => openModal(prod)}
                            style={{ background: 'rgba(0,210,190,0.1)', color: 'var(--primary)', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}
                          >
                            ✏️
                          </button>
                          <button 
                            onClick={() => handleDeleteProduct(prod.Id)}
                            style={{ background: 'rgba(255,77,77,0.1)', color: 'var(--error)', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}
                          >
                            🗑️
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => addToCart(prod)}
                          style={{ background: 'var(--primary)', color: '#000', border: 'none', width: '30px', height: '30px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'transform 0.2s' }}
                          onMouseEnter={(e) => e.target.style.transform = 'scale(1.1)'}
                          onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                        >
                          +
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lado Derecho: Ticket de Pedido (Solo visible si no estamos en Admin) */}
        {!showAdmin && (
          <div className="glass-card" style={{ width: '350px', display: 'flex', flexDirection: 'column', padding: '1.5rem', background: 'rgba(5,7,10,0.8)', border: '1px solid rgba(0, 210, 190, 0.1)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ color: 'var(--primary)', fontWeight: '800', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.5rem' }}>🧾</span> ORDEN ACTUAL
              </h3>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <select 
                  className="luxury-input" 
                  value={selectedMesa} 
                  onChange={(e) => setSelectedMesa(e.target.value)} 
                  style={{ background: 'transparent', border: 'none', padding: '4px', fontSize: '0.85rem', fontWeight: 'bold', outline: 'none' }}
                >
                  {[1,2,3,4,5,6,7,8,9,10].map(m => <option key={m} value={m} style={{ background: '#000' }}>Mesa {m}</option>)}
                </select>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.5rem', paddingRight: '5px' }}>
              {cart.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '4rem', opacity: 0.3 }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                  <p style={{ letterSpacing: '1px', fontWeight: 'bold', fontSize: '0.85rem' }}>CARRITO VACÍO</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '700', fontSize: '0.85rem', color: '#fff' }}>{item.nombre}</div>
                      <div style={{ color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 'bold', marginTop: '2px' }}>Gs. {item.precio.toLocaleString('es-PY')} × {item.cantidad}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontWeight: '800', fontSize: '0.9rem', color: '#fff' }}>Gs. {(item.precio * item.cantidad).toLocaleString('es-PY')}</span>
                      <button onClick={() => removeFromCart(item.id)} style={{ background: 'rgba(255,77,77,0.15)', color: 'var(--error)', border: 'none', width: '24px', height: '24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ borderTop: '2px dashed rgba(0, 210, 190, 0.2)', paddingTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Estimado:</span>
                <span style={{ fontSize: '1.6rem', fontWeight: '900', color: 'var(--primary)', textShadow: '0 0 15px rgba(0,210,190,0.3)' }}>Gs. {total.toLocaleString('es-PY')}</span>
              </div>
              
              <button 
                onClick={enviarPedido}
                disabled={cart.length === 0}
                className="luxury-button" 
                style={{ width: '100%', opacity: cart.length === 0 ? 0.3 : 1, background: 'var(--accent-gradient)', height: '50px', fontSize: '1rem', borderRadius: '12px', boxShadow: cart.length > 0 ? '0 10px 20px rgba(0,210,190,0.2)' : 'none' }}
              >
                CONFIRMAR PEDIDO
              </button>
            </div>
          </div>
        )}

        {/* MODAL PARA AÑADIR/EDITAR PRODUCTO */}
        {showModal && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            animation: 'fadeIn 0.3s ease'
          }}>
            <div className="glass-card" style={{ 
              width: '100%', 
              maxWidth: '480px', 
              padding: '2rem', 
              background: '#0a0a0a', 
              border: '1px solid var(--primary)',
              boxShadow: '0 0 40px rgba(0,210,190,0.15)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}>
              <h2 style={{ color: 'var(--primary)', fontWeight: '800', marginBottom: '1.5rem', textAlign: 'center', fontSize: '1.3rem', letterSpacing: '1px' }}>
                {editingProd ? 'EDITAR PRODUCTO' : 'NUEVO PRODUCTO'}
              </h2>
              
              <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>CÓDIGO (SKU)</label>
                  <input 
                    className="luxury-input" 
                    placeholder="Ej: BEB-001" 
                    value={formProd.codigo || ''} 
                    onChange={e => setFormProd({...formProd, codigo: e.target.value})} 
                    style={{ width: '100%', padding: '10px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>NOMBRE DEL PRODUCTO *</label>
                  <input 
                    className="luxury-input" 
                    placeholder="Ej: Bife de Chorizo" 
                    value={formProd.nombre} 
                    onChange={e => setFormProd({...formProd, nombre: e.target.value})} 
                    style={{ width: '100%', padding: '10px' }}
                    required 
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>PRECIO (GS) *</label>
                    <input 
                      className="luxury-input" 
                      type="number" 
                      placeholder="0" 
                      value={formProd.precio} 
                      onChange={e => setFormProd({...formProd, precio: e.target.value})} 
                      style={{ width: '100%', padding: '10px' }}
                      required 
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>CATEGORÍA *</label>
                    <select 
                      className="luxury-input" 
                      value={formProd.categoriaId} 
                      onChange={e => setFormProd({...formProd, categoriaId: e.target.value})}
                      style={{ width: '100%', cursor: 'pointer', padding: '10px' }}
                      required
                    >
                      <option value="" disabled>Seleccione</option>
                      {categories.map(cat => (
                        <option key={cat.Id} value={cat.Id} style={{ background: '#000' }}>{cat.Nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>STOCK ACTUAL</label>
                    <input 
                      className="luxury-input" 
                      type="number" 
                      placeholder="0" 
                      value={formProd.stockActual || ''} 
                      onChange={e => setFormProd({...formProd, stockActual: e.target.value})} 
                      style={{ width: '100%', padding: '10px' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>STOCK MÍNIMO (ALERTA)</label>
                    <input 
                      className="luxury-input" 
                      type="number" 
                      placeholder="0" 
                      value={formProd.stockMinimo || ''} 
                      onChange={e => setFormProd({...formProd, stockMinimo: e.target.value})} 
                      style={{ width: '100%', padding: '10px' }}
                    />
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', cursor: 'pointer', color: '#fff', userSelect: 'none', marginTop: '0.5rem' }}>
                  <input 
                    type="checkbox" 
                    checked={formProd.requierePreparacion} 
                    onChange={e => setFormProd({...formProd, requierePreparacion: e.target.checked})}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                  />
                  Requiere Preparación (Cocina)
                </label>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button type="button" onClick={() => setShowModal(false)} className="luxury-button" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '12px' }}>
                    CANCELAR
                  </button>
                  <button type="submit" className="luxury-button" style={{ flex: 1, background: 'var(--accent-gradient)', color: '#000', padding: '12px' }}>
                    {editingProd ? 'ACTUALIZAR' : 'GUARDAR'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
