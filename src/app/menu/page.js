'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

const MOCK_CATEGORIAS = ['Todas', 'Bebidas', 'Entradas', 'Platos Principales', 'Postres'];

const MOCK_PRODUCTOS = [
  { id: 1, nombre: 'Agua Mineral 500ml', precio: 5000, categoria: 'Bebidas', requierePreparacion: false },
  { id: 2, nombre: 'Bavaria 500ml', precio: 12000, categoria: 'Bebidas', requierePreparacion: false },
  { id: 3, nombre: 'Bife de Chorizo', precio: 50000, categoria: 'Platos Principales', requierePreparacion: true },
  { id: 4, nombre: 'Brahma 1L', precio: 16000, categoria: 'Bebidas', requierePreparacion: false },
  { id: 5, nombre: 'Chipa Guazú', precio: 15000, categoria: 'Entradas', requierePreparacion: true },
  { id: 6, nombre: 'Chorizo Parrillero', precio: 18000, categoria: 'Entradas', requierePreparacion: true },
  { id: 7, nombre: 'Costilla de Cerdo', precio: 45000, categoria: 'Platos Principales', requierePreparacion: true },
  { id: 8, nombre: 'Dulce de Mamón', precio: 12000, categoria: 'Postres', requierePreparacion: false },
  { id: 9, nombre: 'Empanada de Carne', precio: 8000, categoria: 'Entradas', requierePreparacion: true },
  { id: 10, nombre: 'Empanada de Pollo', precio: 8000, categoria: 'Entradas', requierePreparacion: true },
  { id: 11, nombre: 'Flan Casero', precio: 15000, categoria: 'Postres', requierePreparacion: false },
  { id: 12, nombre: 'Gaseosa 500ml', precio: 8000, categoria: 'Bebidas', requierePreparacion: false },
  { id: 13, nombre: 'Surubí a la Plancha', precio: 45000, categoria: 'Platos Principales', requierePreparacion: true },
  { id: 14, nombre: 'Milanesa Napolitana', precio: 40000, categoria: 'Platos Principales', requierePreparacion: true },
  { id: 15, nombre: 'Jugo Natural', precio: 12000, categoria: 'Bebidas', requierePreparacion: true }
];

export default function Menu() {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCat, setSelectedCat] = useState('Todas');
  const [cart, setCart] = useState([]);
  const [selectedMesa, setSelectedMesa] = useState('2');
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

  const filteredProducts = MOCK_PRODUCTOS.filter(p => {
    const matchesSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCat === 'Todas' || p.categoria === selectedCat;
    return matchesSearch && matchesCat;
  });

  const addToCart = (product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item => item.id === product.id ? { ...item, cantidad: item.cantidad + 1 } : item));
    } else {
      setCart([...cart, { ...product, cantidad: 1 }]);
    }
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const total = cart.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);

  const enviarPedido = () => {
    if (cart.length === 0) return;
    alert(`Pedido enviado a la Mesa ${selectedMesa}. \nLos productos para preparar fueron a cocina.\nLas bebidas se añadieron a la cuenta directamente.`);
    setCart([]);
    router.push('/mesas');
  };

  return (
    <div className="desktop-app">
      <Sidebar user={user} />

      <main className="main-view" style={{ display: 'flex', gap: '2rem' }}>
        
        {/* Lado Izquierdo: Menú */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <header style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: '900', color: '#fff', marginBottom: '0.2rem' }}>Menú / Añadir Producto</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Seleccione productos para la mesa</p>
          </header>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
            <input 
              type="text" 
              placeholder="🔍 Buscar producto..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="luxury-input"
              style={{ flex: 1 }}
            />
            <select 
              className="luxury-input" 
              value={selectedCat} 
              onChange={(e) => setSelectedCat(e.target.value)}
              style={{ appearance: 'none', minWidth: '200px', cursor: 'pointer' }}
            >
              {MOCK_CATEGORIAS.map(cat => (
                <option key={cat} value={cat} style={{ background: '#000' }}>{cat}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', overflowY: 'auto', paddingRight: '10px', paddingBottom: '2rem' }}>
            {filteredProducts.map(prod => (
              <div 
                key={prod.id} 
                onClick={() => addToCart(prod)}
                className="glass-card gold-glow-hover"
                style={{ padding: '1.5rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '10px' }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '1rem', lineHeight: '1.2' }}>{prod.nombre}</div>
                <div style={{ color: 'var(--primary)', fontWeight: '900', fontSize: '1.1rem' }}>Gs. {prod.precio.toLocaleString('es-PY')}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {prod.requierePreparacion ? '👨‍🍳 Requiere cocina' : '🍾 Entrega directa'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lado Derecho: Ticket de Pedido */}
        <div className="glass-card" style={{ width: '350px', display: 'flex', flexDirection: 'column', padding: '1.5rem', borderLeft: '1px solid var(--border)', background: 'rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ color: 'var(--primary)', fontWeight: 'bold' }}>📄 Orden Actual</h3>
            <select className="luxury-input" value={selectedMesa} onChange={(e) => setSelectedMesa(e.target.value)} style={{ padding: '8px', fontSize: '0.9rem' }}>
              <option value="1">Mesa 1</option>
              <option value="2">Mesa 2</option>
              <option value="3">Mesa 3</option>
              <option value="4">Mesa 4</option>
            </select>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1rem' }}>
            {cart.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>El carrito está vacío</div>
            ) : (
              cart.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{item.nombre}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Gs. {item.precio.toLocaleString('es-PY')} x {item.cantidad}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 'bold' }}>Gs. {(item.precio * item.cantidad).toLocaleString('es-PY')}</span>
                    <button onClick={() => removeFromCart(item.id)} style={{ background: 'transparent', color: 'var(--error)', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Total:</span>
              <span style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--primary)' }}>Gs. {total.toLocaleString('es-PY')}</span>
            </div>
            
            <button 
              onClick={enviarPedido}
              disabled={cart.length === 0}
              className="luxury-button" 
              style={{ width: '100%', opacity: cart.length === 0 ? 0.5 : 1 }}
            >
              Enviar a Cocina / Mesa
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}
