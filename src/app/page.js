'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';


export default function Home() {
  const [user, setUser] = useState(null);
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
        <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: '2.2rem', fontWeight: '900', color: '#fff', marginBottom: '0.1rem' }}>Bienvenido</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', letterSpacing: '1.5px', fontWeight: 'bold' }}>RESUMEN OPERATIVO DE HOY</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase' }}>
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '500' }}>{new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} PM</p>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
          <div className="glass-card luxury-shadow" style={{ padding: '1.5rem', border: '1px solid rgba(0, 210, 190, 0.1)' }}>
            <h3 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 'bold' }}>Ventas Totales</h3>
            <p style={{ fontSize: '2.5rem', fontWeight: '900', color: '#fff', textShadow: '0 0 20px rgba(0, 210, 190, 0.15)' }}>
              Gs. 0
            </p>
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--success)', fontWeight: '900', fontSize: '0.9rem' }}>+12.5%</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '500' }}>vs. promedio anterior</span>
            </div>
          </div>

          <div className="glass-card luxury-shadow" style={{ padding: '1.5rem', border: '1px solid rgba(0, 210, 190, 0.1)' }}>
            <h3 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 'bold' }}>Ocupación de Mesas</h3>
            <p style={{ fontSize: '2.5rem', fontWeight: '900', color: '#fff' }}>0 / 12</p>
            <div style={{ marginTop: '1.5rem', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ width: '0%', height: '100%', background: 'var(--accent-gradient)' }} />
            </div>
          </div>

          <div className="glass-card luxury-shadow" style={{ padding: '1.5rem', border: '1px solid rgba(0, 210, 190, 0.1)' }}>
            <h3 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 'bold' }}>Órdenes Activas</h3>
            <p style={{ fontSize: '2.5rem', fontWeight: '900', color: '#fff' }}>0</p>
            <div style={{ marginTop: '1rem', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: '600' }}>Pendientes en cocina</div>
          </div>
        </div>
      </main>
    </div>
  );
}
