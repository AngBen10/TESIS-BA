'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEmpresaConfig } from '../app/context/EmpresaConfigContext';

export default function Sidebar({ user }) {
  const router = useRouter();
  const pathname = usePathname();

  const { nombre, foto } = useEmpresaConfig();

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/login');
  };

  // Render logo: if foto available show image, else show initials
  const logoElement = foto ? (
    <img
      src={foto}
      alt="Logo"
      style={{ width: '44px', height: '44px', borderRadius: '10px', objectFit: 'cover', boxShadow: '0 4px 15px rgba(0, 210, 190, 0.3)' }}
    />
  ) : (
    <div style={{ width: '44px', height: '44px', background: 'var(--accent-gradient)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: '900', color: '#000', boxShadow: '0 4px 15px rgba(0, 210, 190, 0.3)' }}>
      {nombre?.charAt(0).toUpperCase()}
    </div>
  );

  const navItems = [
    { label: 'Dashboard', path: '/', icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></svg>) },
    { label: 'Mesas', path: '/mesas', icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="4" height="4" /><rect x="10" y="3" width="4" height="4" /><rect x="17" y="3" width="4" height="4" /><rect x="3" y="10" width="4" height="4" /><rect x="10" y="10" width="4" height="4" /><rect x="17" y="10" width="4" height="4" /><rect x="3" y="17" width="4" height="4" /><rect x="10" y="17" width="4" height="4" /><rect x="17" y="17" width="4" height="4" /></svg>) },
    { label: 'Pedidos (Cocina)', path: '/cocina', icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /><path d="M9 14h6" /><path d="M9 18h6" /><path d="M9 10h.01" /></svg>) },
    { label: 'Menú', path: '/menu', icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" /></svg>) },
    { label: 'Punto de Venta', path: '/caja', icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 18V6" /></svg>) },
  ];

  // Helper para items del sistema con el mismo estilo activo
  const renderSysItem = (path, label, iconSvg) => {
    // El item de Reportes se considera activo en cualquier subruta /reportes/*
    const isActive = path === '/reportes'
      ? pathname.startsWith('/reportes')
      : pathname === path;
    const targetPath = path === '/reportes' ? '/reportes/ventas-producto' : path;

    return (
      <div
        key={path}
        onClick={() => router.push(targetPath)}
        style={{
          padding: '0.55rem 0.8rem',
          borderRadius: '10px',
          background: isActive ? 'linear-gradient(90deg, rgba(0, 210, 190, 0.18) 0%, transparent 100%)' : 'transparent',
          color: isActive ? '#fff' : 'rgba(255,255,255,0.38)',
          fontWeight: isActive ? '700' : '500',
          fontSize: '0.75rem',
          borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          transition: 'all 0.25s ease'
        }}
      >
        <span style={{ fontSize: '0.8rem', opacity: isActive ? 1 : 0.5 }}>{iconSvg}</span>
        {label}
      </div>
    );
  };

  return (
    <aside className="sidebar-luxury luxury-shadow" style={{ width: '280px', minWidth: '280px', display: 'flex', flexDirection: 'column', padding: '1.5rem 1rem', height: '100vh', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: '2.5rem', paddingLeft: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
          {logoElement}
          <h2 style={{ fontSize: '0.95rem', fontWeight: '900', color: '#fff', letterSpacing: '0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</h2>
        </div>
        <p style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '2.5px', paddingLeft: '56px', fontWeight: '700', textTransform: 'uppercase' }}>Sistema</p>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <p style={{ fontSize: '0.55rem', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '6px', paddingLeft: '0.6rem', letterSpacing: '2px' }}>SALÓN</p>
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <div key={item.path} onClick={() => router.push(item.path)} style={{ padding: '0.55rem 0.8rem', borderRadius: '10px', background: isActive ? 'linear-gradient(90deg, rgba(0, 210, 190, 0.18) 0%, transparent 100%)' : 'transparent', color: isActive ? '#fff' : 'rgba(255,255,255,0.38)', fontWeight: isActive ? '700' : '500', fontSize: '0.75rem', borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.25s ease' }}>
              <span style={{ fontSize: '0.8rem', opacity: isActive ? 1 : 0.5 }}>{item.icon}</span>
              {item.label}
            </div>
          );
        })}
        {user && user.roleId === 1 && (
          <>
            <p style={{ fontSize: '0.55rem', color: 'var(--text-muted)', fontWeight: '700', marginTop: '1.2rem', marginBottom: '6px', paddingLeft: '0.6rem', letterSpacing: '2px' }}>SISTEMA</p>

            {renderSysItem(
              '/reportes',
              'Reportes',
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 5-5" /></svg>
            )}

            {renderSysItem(
              '/admin/mesas',
              'Gestión de Mesas',
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
            )}

            {renderSysItem(
              '/escandallo',
              'Escandallo',
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18" /></svg>
            )}

            {renderSysItem(
              '/admin/sifen',
              'Configuración',
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            )}
          </>
        )}
      </nav>
      <div style={{ flex: 1 }} />
      <div style={{ textAlign: 'center', marginBottom: '1.2rem', opacity: 0.9 }}>
        <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: '500', marginBottom: '4px' }}>Powered by <span style={{ color: 'var(--primary)', fontWeight: '800' }}>ANGLEX</span></p>
        <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontWeight: '500' }}>Software Solutions v2026</p>
      </div>
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.7rem 0.8rem', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '0.5rem' }}>
          <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #f0ad4e 0%, #dc3545 100%)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '1rem', color: '#fff', flexShrink: 0, boxShadow: '0 4px 10px rgba(0,0,0,0.3)', position: 'relative' }}>
            {user.nombre ? user.nombre.charAt(0).toUpperCase() : 'U'}
            <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '16px', height: '16px', background: '#000', borderRadius: '50%', border: '2px solid #1a1d24', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem' }}>N</div>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: '800', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.nombre}</p>
            <p style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px' }}>{user.roleId === 1 ? 'ADMINISTRADOR' : user.roleId === 2 ? 'CAJERO' : 'MESERO'}</p>
          </div>
          <button onClick={handleLogout} title="Cerrar Sesión" style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0, transition: 'all 0.2s' }}>⏻</button>
        </div>
      )}
    </aside>
  );
}