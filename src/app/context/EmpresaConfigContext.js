'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const EmpresaConfigContext = createContext({ nombre: 'Mi Restaurante', foto: null });

export const EmpresaConfigProvider = ({ children }) => {
  const [config, setConfig] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('empresaConfig');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {}
      }
    }
    return { nombre: 'Mi Restaurante', foto: null };
  });

  useEffect(() => {
    const fetchConfig = () => {
      fetch('/api/facturacion/configuracion')
        .then(r => r.json())
        .then(d => {
          if (d?.config) {
            const newConfig = { nombre: d.config.EMPRESA_NOMBRE || 'Mi Restaurante', foto: d.config.EMPRESA_FOTO || null };
            setConfig(newConfig);
            if (typeof window !== 'undefined') {
              localStorage.setItem('empresaConfig', JSON.stringify(newConfig));
            }
          } else {
            const fallback = { nombre: 'Mi Restaurante', foto: null };
            setConfig(fallback);
            if (typeof window !== 'undefined') {
              localStorage.setItem('empresaConfig', JSON.stringify(fallback));
            }
          }
        })
        .catch(() => {
          const errorConfig = { nombre: 'Mi Restaurante', foto: null };
          setConfig(errorConfig);
          if (typeof window !== 'undefined') {
            localStorage.setItem('empresaConfig', JSON.stringify(errorConfig));
          }
        });
    };
    // Fetch if config not loaded from storage
    if (!config.nombre || config.nombre === 'Mi Restaurante') {
      fetchConfig();
    }
    window.addEventListener('empresa_updated', fetchConfig);
    return () => window.removeEventListener('empresa_updated', fetchConfig);
  }, []);

  return (
    <EmpresaConfigContext.Provider value={config}>
      {children}
    </EmpresaConfigContext.Provider>
  );
};

export const useEmpresaConfig = () => useContext(EmpresaConfigContext);
