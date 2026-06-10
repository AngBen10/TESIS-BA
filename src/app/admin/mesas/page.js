'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default function AdminMesas() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [mesas, setMesas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [aviso, setAviso] = useState('');

    // Buscador
    const [busqueda, setBusqueda] = useState('');

    // Modal individual (crear/editar)
    const [showModal, setShowModal] = useState(false);
    const [editando, setEditando] = useState(null);
    const [form, setForm] = useState({ numero: '', capacidad: 2 });

    // Modal creación masiva
    const [showMasivo, setShowMasivo] = useState(false);
    const [masivo, setMasivo] = useState({ desde: '', hasta: '', capacidad: 4 });

    // Modal eliminación masiva
    const [showDelMasivo, setShowDelMasivo] = useState(false);
    const [delRango, setDelRango] = useState({ desde: '', hasta: '' });

    // Resultado detallado de eliminación masiva
    const [resultadoDel, setResultadoDel] = useState(null);

    const [saving, setSaving] = useState(false);

    // ── Auth ─────────────────────────────────────────────────────────
    useEffect(() => {
        const stored = localStorage.getItem('user');
        if (!stored) { router.push('/login'); return; }
        const parsed = JSON.parse(stored);
        if (parsed.roleId !== 1) { router.push('/'); return; }
        setUser(parsed);
    }, [router]);

    // ── Cargar mesas ─────────────────────────────────────────────────
    const cargar = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const r = await fetch('/api/mesas');
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Error al cargar mesas');
            setMesas(d.mesas || []);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user) cargar();
    }, [user, cargar]);

    const flashAviso = (msg) => {
        setAviso(msg);
        setTimeout(() => setAviso(''), 5000);
    };

    // ── Filtrado ─────────────────────────────────────────────────────
    const mesasFiltradas = useMemo(() => {
        const q = busqueda.trim();
        if (!q) return mesas;
        return mesas.filter(m => String(m.Numero).includes(q));
    }, [mesas, busqueda]);

    // ── Crear/Editar individual ──────────────────────────────────────
    const abrirNueva = () => {
        const maxNum = mesas.reduce((mx, m) => Math.max(mx, m.Numero), 0);
        setEditando(null);
        setForm({ numero: maxNum + 1, capacidad: 2 });
        setShowModal(true);
    };

    const abrirEditar = (mesa) => {
        setEditando(mesa);
        setForm({ numero: mesa.Numero, capacidad: mesa.Capacidad });
        setShowModal(true);
    };

    const guardar = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const url = editando ? `/api/mesas/${editando.Id}` : '/api/mesas';
            const method = editando ? 'PUT' : 'POST';
            const r = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ numero: form.numero, capacidad: form.capacidad }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Error al guardar');
            setShowModal(false);
            flashAviso(editando ? `Mesa ${form.numero} actualizada.` : `Mesa ${form.numero} creada.`);
            cargar();
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    // ── Creación masiva ──────────────────────────────────────────────
    const guardarMasivo = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const r = await fetch('/api/mesas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ desde: masivo.desde, hasta: masivo.hasta, capacidad: masivo.capacidad }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Error en creación masiva');
            setShowMasivo(false);
            flashAviso(`${d.creadas} mesas creadas${d.omitidas > 0 ? `, ${d.omitidas} ya existían` : ''}.`);
            cargar();
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    // ── Eliminación individual ───────────────────────────────────────
    const eliminar = async (mesa) => {
        if (!confirm(`¿Eliminar la mesa N° ${mesa.Numero}?`)) return;
        setError('');
        try {
            const r = await fetch(`/api/mesas/${mesa.Id}`, { method: 'DELETE' });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Error al eliminar');
            flashAviso(`Mesa ${mesa.Numero} eliminada.`);
            cargar();
        } catch (e) {
            setError(e.message);
        }
    };

    // ── Eliminación masiva ──────────────────────────────────────────
    const eliminarMasivo = async (e) => {
        e.preventDefault();
        const desde = parseInt(delRango.desde);
        const hasta = parseInt(delRango.hasta);
        if (isNaN(desde) || isNaN(hasta) || desde < 1 || hasta < desde) {
            setError('Rango inválido. Verificá "desde" y "hasta".');
            return;
        }
        const total = hasta - desde + 1;
        if (!confirm(`¿Eliminar las mesas N° ${desde} a ${hasta}? Son ${total} mesas.\n\nLas que tengan pedidos en el histórico no se borrarán (se reportan al final).`)) return;

        setSaving(true);
        setError('');
        try {
            const r = await fetch('/api/mesas', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ desde, hasta }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Error al eliminar masivamente');
            setShowDelMasivo(false);
            setResultadoDel(d);
            cargar();
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    if (!user) return null;

    const capacidadTotal = mesas.reduce((s, m) => s + (m.Capacidad || 0), 0);
    const hayFiltro = busqueda.trim().length > 0;

    return (
        <div className="desktop-app">
            <Sidebar user={user} />
            <main className="main-view" style={{ padding: '1.5rem 2rem', overflowY: 'auto', height: '100vh' }}>

                {/* Header */}
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#fff' }}>🪑 Gestión de Mesas</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                            Creá, editá y eliminá mesas del salón. La configuración acá se refleja en el menú y en los reportes.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button onClick={() => { setDelRango({ desde: '', hasta: '' }); setShowDelMasivo(true); }} className="luxury-button" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.78rem', padding: '9px 18px' }}>
                            🗑 Eliminación masiva
                        </button>
                        <button onClick={() => { setMasivo({ desde: '', hasta: '', capacidad: 4 }); setShowMasivo(true); }} className="luxury-button" style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--border)', fontSize: '0.78rem', padding: '9px 18px' }}>
                            ⚡ Creación masiva
                        </button>
                        <button onClick={abrirNueva} className="luxury-button" style={{ background: 'var(--accent-gradient)', color: '#000', fontSize: '0.78rem', padding: '9px 18px' }}>
                            + Nueva mesa
                        </button>
                    </div>
                </header>

                {/* Avisos */}
                {aviso && (
                    <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '10px', padding: '0.8rem 1rem', marginBottom: '1rem', color: '#22c55e', fontSize: '0.82rem', fontWeight: '600' }}>
                        ✓ {aviso}
                    </div>
                )}
                {error && (
                    <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '0.8rem 1rem', marginBottom: '1rem', color: '#ef4444', fontSize: '0.82rem' }}>
                        ⚠ {error}
                    </div>
                )}

                {/* KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px', marginBottom: '1.2rem' }}>
                    <KpiCard label="Total de mesas" value={loading ? '…' : mesas.length} accent="var(--primary)" />
                    <KpiCard label="Capacidad total" value={loading ? '…' : `${capacidadTotal} personas`} accent="#3b82f6" />
                    <KpiCard label="Promedio por mesa" value={loading || mesas.length === 0 ? '…' : `${(capacidadTotal / mesas.length).toFixed(1)} pers.`} accent="#fff" />
                </div>

                {/* Buscador */}
                <div style={{ marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '420px' }}>
                        <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.95rem', pointerEvents: 'none' }}>🔍</span>
                        <input
                            type="text"
                            placeholder="Buscar por número (ej: 12, o 1 para ver 1, 10, 11...)"
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            className="luxury-input"
                            style={{ width: '100%', padding: '10px 14px 10px 40px', fontSize: '0.85rem' }}
                        />
                        {busqueda && (
                            <button onClick={() => setBusqueda('')} title="Limpiar"
                                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.6)', borderRadius: '6px', padding: '2px 8px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '700' }}>
                                ✕
                            </button>
                        )}
                    </div>
                    {hayFiltro && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                            Mostrando <strong style={{ color: 'var(--primary)' }}>{mesasFiltradas.length}</strong> de {mesas.length} mesas
                        </span>
                    )}
                </div>

                {/* Grid de mesas */}
                {loading ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>Cargando mesas...</p>
                ) : mesas.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🪑</div>
                        <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>No hay mesas configuradas todavía.</p>
                        <button onClick={abrirNueva} className="luxury-button" style={{ background: 'var(--accent-gradient)', color: '#000', fontSize: '0.8rem', padding: '10px 20px' }}>
                            + Crear la primera mesa
                        </button>
                    </div>
                ) : mesasFiltradas.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔍</div>
                        <p style={{ fontSize: '0.9rem' }}>Ninguna mesa coincide con &quot;{busqueda}&quot;.</p>
                        <button onClick={() => setBusqueda('')} style={{ background: 'rgba(0,210,190,0.1)', color: 'var(--primary)', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '700', marginTop: '12px' }}>
                            Limpiar búsqueda
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
                        {mesasFiltradas.map(m => (
                            <div key={m.Id} style={{ background: 'rgba(8,10,14,0.8)', border: '1px solid rgba(0,210,190,0.12)', borderRadius: '14px', padding: '1rem', position: 'relative' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                                    <div>
                                        <p style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '700' }}>Mesa</p>
                                        <p style={{ fontSize: '1.8rem', fontWeight: '900', color: '#fff', lineHeight: 1 }}>{m.Numero}</p>
                                    </div>
                                    <span style={{ fontSize: '1.3rem' }}>🪑</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.8rem' }}>
                                    👥 <strong style={{ color: 'var(--primary)' }}>{m.Capacidad}</strong> personas
                                </div>
                                {m.PedidosHistoricos > 0 && (
                                    <p style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                                        {m.PedidosHistoricos} pedido{m.PedidosHistoricos !== 1 ? 's' : ''} histórico{m.PedidosHistoricos !== 1 ? 's' : ''}
                                    </p>
                                )}
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <button onClick={() => abrirEditar(m)} style={{ flex: 1, background: 'rgba(0,210,190,0.1)', color: 'var(--primary)', border: 'none', padding: '6px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '700' }}>
                                        ✏️ Editar
                                    </button>
                                    <button onClick={() => eliminar(m)} title={m.PedidosHistoricos > 0 ? 'Tiene pedidos en el histórico' : 'Eliminar'} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', opacity: m.PedidosHistoricos > 0 ? 0.4 : 1 }}>
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── MODAL crear/editar individual ── */}
                {showModal && (
                    <div onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }} style={modalOverlay}>
                        <div style={modalBox}>
                            <h2 style={modalTitle}>{editando ? '✏️ Editar mesa' : '＋ Nueva mesa'}</h2>
                            <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label style={lbl}>Número de mesa *</label>
                                    <input className="luxury-input" type="number" min="1" value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} style={{ width: '100%', padding: '10px 14px' }} required autoFocus />
                                </div>
                                <div>
                                    <label style={lbl}>Capacidad (personas) *</label>
                                    <input className="luxury-input" type="number" min="1" value={form.capacidad} onChange={e => setForm({ ...form, capacidad: e.target.value })} style={{ width: '100%', padding: '10px 14px' }} required />
                                </div>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                                    <button type="button" onClick={() => setShowModal(false)} className="luxury-button" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '11px' }}>Cancelar</button>
                                    <button type="submit" disabled={saving} className="luxury-button" style={{ flex: 1, background: 'var(--accent-gradient)', color: '#000', padding: '11px', opacity: saving ? 0.6 : 1 }}>
                                        {saving ? 'Guardando...' : (editando ? 'Actualizar' : 'Crear')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── MODAL creación masiva ── */}
                {showMasivo && (
                    <div onClick={e => { if (e.target === e.currentTarget) setShowMasivo(false); }} style={modalOverlay}>
                        <div style={modalBox}>
                            <h2 style={modalTitle}>⚡ Creación masiva de mesas</h2>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.2rem', textAlign: 'center' }}>
                                Crea un rango de mesas de una sola vez. Las que ya existan se omiten automáticamente.
                            </p>
                            <form onSubmit={guardarMasivo} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <label style={lbl}>Desde el N° *</label>
                                        <input className="luxury-input" type="number" min="1" placeholder="13" value={masivo.desde} onChange={e => setMasivo({ ...masivo, desde: e.target.value })} style={{ width: '100%', padding: '10px 14px' }} required autoFocus />
                                    </div>
                                    <div>
                                        <label style={lbl}>Hasta el N° *</label>
                                        <input className="luxury-input" type="number" min="1" placeholder="50" value={masivo.hasta} onChange={e => setMasivo({ ...masivo, hasta: e.target.value })} style={{ width: '100%', padding: '10px 14px' }} required />
                                    </div>
                                </div>
                                <div>
                                    <label style={lbl}>Capacidad para todas (personas) *</label>
                                    <input className="luxury-input" type="number" min="1" value={masivo.capacidad} onChange={e => setMasivo({ ...masivo, capacidad: e.target.value })} style={{ width: '100%', padding: '10px 14px' }} required />
                                </div>
                                {masivo.desde && masivo.hasta && parseInt(masivo.hasta) >= parseInt(masivo.desde) && (
                                    <p style={{ fontSize: '0.72rem', color: 'var(--primary)', textAlign: 'center', fontWeight: '700' }}>
                                        Se crearán hasta {parseInt(masivo.hasta) - parseInt(masivo.desde) + 1} mesas (N° {masivo.desde} a {masivo.hasta})
                                    </p>
                                )}
                                <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                                    <button type="button" onClick={() => setShowMasivo(false)} className="luxury-button" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '11px' }}>Cancelar</button>
                                    <button type="submit" disabled={saving} className="luxury-button" style={{ flex: 1, background: 'var(--accent-gradient)', color: '#000', padding: '11px', opacity: saving ? 0.6 : 1 }}>
                                        {saving ? 'Creando...' : 'Crear lote'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── MODAL eliminación masiva ── */}
                {showDelMasivo && (
                    <div onClick={e => { if (e.target === e.currentTarget) setShowDelMasivo(false); }} style={modalOverlay}>
                        <div style={{ ...modalBox, border: '1px solid rgba(239,68,68,0.4)', boxShadow: '0 0 60px rgba(239,68,68,0.12)' }}>
                            <h2 style={{ ...modalTitle, color: '#ef4444' }}>🗑 Eliminación masiva</h2>
                            <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '10px 14px', marginBottom: '1.2rem', fontSize: '0.72rem', color: 'rgba(255,255,255,0.78)' }}>
                                <strong style={{ color: '#ef4444' }}>⚠ Acción irreversible.</strong> Las mesas que tengan pedidos en el histórico de ventas <strong>no se borrarán</strong> y se listarán al final.
                            </div>
                            <form onSubmit={eliminarMasivo} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <label style={lbl}>Desde el N° *</label>
                                        <input className="luxury-input" type="number" min="1" placeholder="50" value={delRango.desde} onChange={e => setDelRango({ ...delRango, desde: e.target.value })} style={{ width: '100%', padding: '10px 14px' }} required autoFocus />
                                    </div>
                                    <div>
                                        <label style={lbl}>Hasta el N° *</label>
                                        <input className="luxury-input" type="number" min="1" placeholder="100" value={delRango.hasta} onChange={e => setDelRango({ ...delRango, hasta: e.target.value })} style={{ width: '100%', padding: '10px 14px' }} required />
                                    </div>
                                </div>
                                {delRango.desde && delRango.hasta && parseInt(delRango.hasta) >= parseInt(delRango.desde) && (
                                    <p style={{ fontSize: '0.72rem', color: '#ef4444', textAlign: 'center', fontWeight: '700' }}>
                                        Se eliminarán hasta {parseInt(delRango.hasta) - parseInt(delRango.desde) + 1} mesas (N° {delRango.desde} a {delRango.hasta})
                                    </p>
                                )}
                                <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                                    <button type="button" onClick={() => setShowDelMasivo(false)} className="luxury-button" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '11px' }}>Cancelar</button>
                                    <button type="submit" disabled={saving} className="luxury-button" style={{ flex: 1, background: '#ef4444', color: '#fff', padding: '11px', opacity: saving ? 0.6 : 1 }}>
                                        {saving ? 'Eliminando...' : 'Eliminar lote'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── MODAL resultado de eliminación masiva ── */}
                {resultadoDel && (
                    <div onClick={e => { if (e.target === e.currentTarget) setResultadoDel(null); }} style={modalOverlay}>
                        <div style={modalBox}>
                            <h2 style={modalTitle}>📋 Resultado</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.82rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '10px' }}>
                                    <span style={{ color: 'rgba(255,255,255,0.8)' }}>✓ Mesas eliminadas</span>
                                    <strong style={{ color: '#22c55e' }}>{resultadoDel.eliminadas}</strong>
                                </div>
                                {resultadoDel.omitidasInexistentes > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>○ No existían</span>
                                        <strong style={{ color: 'var(--text-muted)' }}>{resultadoDel.omitidasInexistentes}</strong>
                                    </div>
                                )}
                                {resultadoDel.omitidasConPedidos && resultadoDel.omitidasConPedidos.length > 0 && (
                                    <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '700' }}>⚠ Omitidas (tienen pedidos)</span>
                                            <strong style={{ color: '#f59e0b' }}>{resultadoDel.omitidasConPedidos.length}</strong>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                                            {resultadoDel.omitidasConPedidos.map(m => (
                                                <span key={m.numero} style={{ fontSize: '0.7rem', padding: '4px 9px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderRadius: '6px', fontWeight: '700' }}>
                                                    Mesa {m.numero} ({m.pedidos} ped.)
                                                </span>
                                            ))}
                                        </div>
                                        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                                            Estas mesas no se borraron porque tienen pedidos en el histórico de ventas. Borrarlas rompería los reportes. Editalas en su lugar si necesitás cambiar algo.
                                        </p>
                                    </div>
                                )}
                                <button onClick={() => setResultadoDel(null)} className="luxury-button" style={{ marginTop: '0.5rem', background: 'var(--accent-gradient)', color: '#000', padding: '11px' }}>
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
}

function KpiCard({ label, value, accent }) {
    return (
        <div style={{ background: 'rgba(8,10,14,0.8)', border: '1px solid rgba(0,210,190,0.1)', borderRadius: '14px', padding: '14px 16px' }}>
            <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '700', marginBottom: '6px' }}>{label}</p>
            <p style={{ fontSize: '1.3rem', fontWeight: '900', color: accent }}>{value}</p>
        </div>
    );
}

const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.87)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalBox = { width: '460px', maxWidth: '95vw', background: '#0d0f14', border: '1px solid rgba(0,210,190,0.25)', borderRadius: '20px', padding: '2rem', boxShadow: '0 0 60px rgba(0,210,190,0.1)' };
const modalTitle = { color: 'var(--primary)', fontWeight: '900', marginBottom: '1.5rem', textAlign: 'center', fontSize: '1.1rem', letterSpacing: '1px', textTransform: 'uppercase' };
const lbl = { fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' };