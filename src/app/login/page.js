'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const router = useRouter();

  // Estado para la configuración de la empresa
  const [empresaConfig, setEmpresaConfig] = useState({ nombre: 'Sistema de Gestión', foto: null });

  useEffect(() => {
    const handleMouseMove = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handleMouseMove);

    // Obtener configuración visual de la empresa
    fetch('/api/facturacion/configuracion')
      .then(r => r.json())
      .then(d => {
        if (d.config) {
          setEmpresaConfig({
            nombre: d.config.EMPRESA_NOMBRE || 'Sistema de Gestión',
            foto: d.config.EMPRESA_FOTO || null
          });
        }
      })
      .catch(() => { });

    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

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
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(0, 210, 190, 0.15), transparent 40%)`, zIndex: 0 }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url("/restaurant_login_bg_1778447534514.png")', backgroundSize: 'cover', opacity: 0.2, zIndex: 0 }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, transparent 0%, #000 90%)', zIndex: 1, pointerEvents: 'none' }} />

      <div className="glass-card luxury-shadow" style={{ width: '100%', maxWidth: '450px', padding: '3rem', zIndex: 2, border: '1px solid rgba(0, 210, 190, 0.2)', background: 'rgba(5, 5, 5, 0.6)', backdropFilter: 'blur(16px)' }}>

        {/* Renderizado Dinámico del Logo y Nombre de Empresa */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          {empresaConfig.foto ? (
            <img
              src={empresaConfig.foto}
              alt="Logo Empresa"
              style={{ width: '80px', height: '80px', borderRadius: '20px', objectFit: 'cover', margin: '0 auto 1rem', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
            />
          ) : (
            <div style={{ width: '80px', height: '80px', background: 'var(--accent-gradient)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: '900', color: '#000', margin: '0 auto 1rem', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
              {empresaConfig.nombre.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: '900', letterSpacing: '1px' }}>
            {empresaConfig.nombre}
          </h1>
          <p style={{ color: 'var(--primary)', fontSize: '0.75rem', fontWeight: '800', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '2px' }}>
            Acceso al Sistema
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.6rem', fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Usuario de Acceso</label>
            <input type="text" value={usuario} onChange={(e) => setUsuario(e.target.value)} required className="luxury-input" placeholder="Ej: admin" style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.6rem', fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Contraseña</label>
            <input type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} required className="luxury-input" placeholder="••••••••" style={{ width: '100%' }} />
          </div>
          {error && <p style={{ color: 'var(--error)', fontSize: '0.85rem', textAlign: 'center', fontWeight: '600', padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}>{error}</p>}
          <button type="submit" disabled={loading} className="luxury-button" style={{ marginTop: '1rem', width: '100%' }}>
            {loading ? 'VERIFICANDO...' : 'INGRESAR'}
          </button>
        </form>
      </div>
    </div>
  );
}