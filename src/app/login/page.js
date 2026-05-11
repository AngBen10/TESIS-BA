'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, contrasena }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('user', JSON.stringify(data.user));
        if (data.user.roleId === 1) router.push('/');
        else if (data.user.roleId === 2) router.push('/caja');
        else router.push('/mesas');
      } else {
        setError(data.error || 'Credenciales incorrectas');
      }
    } catch (err) {
      setError('Sin conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: '#000',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Imagen de fondo con overlay */}
      <div style={{ 
        position: 'absolute', 
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: 'url("/restaurant_login_bg_1778447534514.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 0.4,
        zIndex: 0
      }} />

      <div style={{ 
        position: 'absolute', 
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(circle at center, transparent 0%, #000 90%)',
        zIndex: 1
      }} />
      
      <div className="glass-card luxury-shadow" style={{ 
        width: '100%', 
        maxWidth: '450px', 
        padding: '3rem',
        zIndex: 2,
        animation: 'fadeIn 1s ease-out',
        border: '1px solid rgba(0, 210, 190, 0.1)',
        background: 'rgba(10, 10, 10, 0.85)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h1 style={{ 
            fontSize: '2.5rem', 
            fontWeight: '900', 
            color: 'var(--primary)',
            letterSpacing: '8px',
            marginBottom: '0.2rem',
            textShadow: '0 0 20px rgba(0, 210, 190, 0.3)'
          }}>
            LA PARADA
          </h1>
          <p style={{ 
            color: 'var(--text-muted)', 
            fontSize: '0.7rem', 
            textTransform: 'uppercase', 
            letterSpacing: '4px',
            fontWeight: 'bold'
          }}>
            Restaurante & Bar
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.6rem', 
              fontSize: '0.7rem', 
              color: 'var(--primary)',
              fontWeight: 'bold',
              letterSpacing: '1px',
              textTransform: 'uppercase'
            }}>Usuario de Acceso</label>
            <input 
              type="text" 
              className="luxury-input"
              style={{ width: '100%', borderColor: 'rgba(0, 210, 190, 0.2)' }}
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Ej: Administrador"
              required
            />
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.6rem', 
              fontSize: '0.7rem', 
              color: 'var(--primary)',
              fontWeight: 'bold',
              letterSpacing: '1px',
              textTransform: 'uppercase'
            }}>Contraseña</label>
            <input 
              type="password" 
              className="luxury-input"
              style={{ width: '100%', borderColor: 'rgba(0, 210, 190, 0.2)' }}
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div style={{ 
              color: 'var(--error)', 
              fontSize: '0.75rem', 
              textAlign: 'center',
              padding: '10px',
              background: 'rgba(255, 77, 77, 0.05)',
              border: '1px solid rgba(255, 77, 77, 0.2)',
              borderRadius: '8px'
            }}>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="luxury-button"
            disabled={loading}
            style={{ 
              width: '100%', 
              marginTop: '1rem',
              background: 'var(--accent-gradient)',
              color: '#000',
              fontWeight: '900',
              padding: '14px'
            }}
          >
            {loading ? 'VALIDANDO...' : 'INICIAR SESIÓN'}
          </button>
        </form>

        <div style={{ marginTop: '2.5rem', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.6rem', letterSpacing: '1px', opacity: 0.6 }}>
            © 2026 LA PARADA BAR - SISTEMA ELITE V2.0
          </p>
        </div>
      </div>
    </div>
  );
}
