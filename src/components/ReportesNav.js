'use client';

import { useRouter, usePathname } from 'next/navigation';

// ─── Registro de reportes disponibles ────────────────────────────────
const REPORTES = [
    { path: '/reportes/ventas-producto', label: 'Ventas por Producto', icon: '📦' },
    { path: '/reportes/rango-horario', label: 'Rango Horario', icon: '🕐' },
    { path: '/reportes/ventas-mesero', label: 'Ventas por Mesero', icon: '👥' },
    { path: '/reportes/ventas-mesa', label: 'Ventas por Mesa', icon: '🍽️' },
    { path: '/reportes/metodo-pago', label: 'Método de Pago', icon: '💳' },
    { path: '/reportes/food-cost', label: 'Food Cost', icon: '📉' },
];

export default function ReportesNav() {
    const router = useRouter();
    const pathname = usePathname();

    return (
        <div
            style={{
                display: 'flex',
                gap: '6px',
                flexWrap: 'wrap',
                marginBottom: '1.2rem',
                paddingBottom: '0.8rem',
                borderBottom: '1px solid rgba(0,210,190,0.08)',
            }}
        >
            {REPORTES.map(r => {
                const active = pathname === r.path;
                return (
                    <button
                        key={r.path}
                        onClick={() => router.push(r.path)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            fontSize: '0.78rem',
                            fontWeight: active ? '800' : '600',
                            borderRadius: '10px',
                            border: active ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)',
                            background: active ? 'rgba(0,210,190,0.12)' : 'rgba(255,255,255,0.03)',
                            color: active ? 'var(--primary)' : 'rgba(255,255,255,0.55)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            letterSpacing: '0.3px',
                        }}
                    >
                        <span style={{ fontSize: '0.85rem' }}>{r.icon}</span>
                        {r.label}
                    </button>
                );
            })}
        </div>
    );
}