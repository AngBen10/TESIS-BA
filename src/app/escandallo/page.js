'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

// ── Utilidades de formato ──────────────────────────────────────────
const fmtGs  = (n) => `Gs. ${Number(n || 0).toLocaleString('es-PY')}`;
const fmtPct = (n) => `${Number(n || 0).toFixed(1)}%`;
const fmtNum = (n, dec = 4) => Number(n || 0).toFixed(dec);

// ── Componente de skeleton ─────────────────────────────────────────
function Sk({ w = '100%', h = '20px' }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: '8px' }} />;
}

// ── Badge de rentabilidad ──────────────────────────────────────────
function RentBadge({ label }) {
  const map = {
    Alta:    { bg: 'rgba(34,197,94,0.12)',  color: '#22c55e',  border: 'rgba(34,197,94,0.25)' },
    Media:   { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6',  border: 'rgba(59,130,246,0.25)' },
    Baja:    { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b',  border: 'rgba(245,158,11,0.25)' },
    Crítica: { bg: 'rgba(239,68,68,0.12)',  color: '#ef4444',  border: 'rgba(239,68,68,0.25)' },
  };
  const s = map[label] || map['Media'];
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      padding: '4px 14px', borderRadius: '20px', fontWeight: '800',
      fontSize: '0.72rem', letterSpacing: '0.5px'
    }}>{label}</span>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export default function Escandallo() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  // ── Tabs internos ─────────────────────────────────────────────
  const [tab, setTab] = useState('ingredientes'); // 'ingredientes' | 'recetario' | 'costos'

  // ── Estado: Ingredientes ──────────────────────────────────────
  const [ingredientes,      setIngredientes]      = useState([]);
  const [loadingIngr,       setLoadingIngr]       = useState(true);
  const [showModalIngr,     setShowModalIngr]     = useState(false);
  const [editingIngr,       setEditingIngr]       = useState(null);
  const [formIngr, setFormIngr] = useState({
    nombre: '', unidadCompra: '', costoPorUnidadCompra: '',
    unidadReceta: '', factorConversion: '', porcentajeMerma: '0',
    stockActual: '0', proveedor: '', notas: '',
  });
  const [savingIngr,  setSavingIngr]  = useState(false);
  const [errorIngr,   setErrorIngr]   = useState('');

  // ── Estado: Recetario ─────────────────────────────────────────
  const [productos,        setProductos]        = useState([]);
  const [selectedProdRec,  setSelectedProdRec]  = useState('');
  const [receta,           setReceta]           = useState([]);
  const [loadingRec,       setLoadingRec]       = useState(false);
  const [addIngredienteId, setAddIngredienteId] = useState('');
  const [addCantidad,      setAddCantidad]      = useState('');
  const [savingRec,        setSavingRec]        = useState(false);
  const [errorRec,         setErrorRec]         = useState('');

  // ── Estado: Costos ───────────────────────────────────────────
  const [selectedProdCosto, setSelectedProdCosto] = useState('');
  const [costos,            setCostos]            = useState(null);
  const [loadingCosto,      setLoadingCosto]      = useState(false);
  const [errorCosto,        setErrorCosto]        = useState('');
  const [margenSlider,      setMargenSlider]      = useState(70); // 0-99 %

  // ══════════════════════════════════════════════════════════════
  //  INICIALIZACIÓN
  // ══════════════════════════════════════════════════════════════
  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    const u = JSON.parse(stored);
    if (u.roleId !== 1) { router.push('/'); return; } // Solo admin
    setUser(u);
    fetchIngredientes();
    fetchProductos();
  }, [router]);

  // ══════════════════════════════════════════════════════════════
  //  DATA FETCHING
  // ══════════════════════════════════════════════════════════════
  const fetchIngredientes = useCallback(async () => {
    setLoadingIngr(true);
    try {
      const r = await fetch('/api/escandallo/ingredientes');
      setIngredientes(await r.json());
    } catch { setErrorIngr('Error al cargar ingredientes'); }
    finally { setLoadingIngr(false); }
  }, []);

  const fetchProductos = useCallback(async () => {
    try {
      const r = await fetch('/api/productos');
      const data = await r.json();
      // Sólo productos que requieren preparación (platos)
      setProductos(Array.isArray(data) ? data.filter(p => p.RequierePreparacion) : []);
    } catch {}
  }, []);

  const fetchReceta = useCallback(async (pid) => {
    if (!pid) return;
    setLoadingRec(true);
    setErrorRec('');
    try {
      const r = await fetch(`/api/escandallo/recetas?productoId=${pid}`);
      const d = await r.json();
      setReceta(d.receta || []);
    } catch { setErrorRec('Error al cargar receta'); }
    finally { setLoadingRec(false); }
  }, []);

  const fetchCostos = useCallback(async (pid, margen) => {
    if (!pid) return;
    setLoadingCosto(true);
    setErrorCosto('');
    setCostos(null);
    try {
      const m = (margen / 100).toFixed(2);
      const r = await fetch(`/api/escandallo/costos?productoId=${pid}&margen=${m}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setCostos(d);
    } catch (e) { setErrorCosto(e.message); }
    finally { setLoadingCosto(false); }
  }, []);

  // ══════════════════════════════════════════════════════════════
  //  INGREDIENTES — CRUD
  // ══════════════════════════════════════════════════════════════
  const openModalIngr = (ingr = null) => {
    setErrorIngr('');
    if (ingr) {
      setEditingIngr(ingr);
      setFormIngr({
        nombre:               ingr.Nombre,
        unidadCompra:         ingr.UnidadCompra,
        costoPorUnidadCompra: String(ingr.CostoPorUnidadCompra),
        unidadReceta:         ingr.UnidadReceta,
        factorConversion:     String(ingr.FactorConversion),
        porcentajeMerma:      String(ingr.PorcentajeMerma),
        stockActual:          String(ingr.StockActual),
        proveedor:            ingr.Proveedor || '',
        notas:                ingr.Notas || '',
      });
    } else {
      setEditingIngr(null);
      setFormIngr({ nombre: '', unidadCompra: 'Kg', costoPorUnidadCompra: '', unidadReceta: 'g', factorConversion: '1000', porcentajeMerma: '0', stockActual: '0', proveedor: '', notas: '' });
    }
    setShowModalIngr(true);
  };

  const handleSaveIngr = async (e) => {
    e.preventDefault();
    setSavingIngr(true);
    setErrorIngr('');
    const method = editingIngr ? 'PUT' : 'POST';
    const url    = editingIngr ? `/api/escandallo/ingredientes/${editingIngr.Id}` : '/api/escandallo/ingredientes';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formIngr),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setShowModalIngr(false);
      fetchIngredientes();
    } catch (err) { setErrorIngr(err.message); }
    finally { setSavingIngr(false); }
  };

  const handleDeleteIngr = async (id) => {
    if (!confirm('¿Eliminar este ingrediente? Solo se puede si no está en ninguna receta.')) return;
    const res = await fetch(`/api/escandallo/ingredientes/${id}`, { method: 'DELETE' });
    const d   = await res.json();
    if (!res.ok) return alert(`Error: ${d.error}`);
    fetchIngredientes();
  };

  // ══════════════════════════════════════════════════════════════
  //  RECETARIO — CRUD
  // ══════════════════════════════════════════════════════════════
  const handleAddToReceta = async () => {
    if (!selectedProdRec || !addIngredienteId || !addCantidad) return;
    setSavingRec(true);
    setErrorRec('');
    try {
      const res = await fetch('/api/escandallo/recetas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productoId:    parseInt(selectedProdRec),
          ingredienteId: parseInt(addIngredienteId),
          cantidad:      parseFloat(addCantidad),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setAddIngredienteId('');
      setAddCantidad('');
      fetchReceta(selectedProdRec);
    } catch (err) { setErrorRec(err.message); }
    finally { setSavingRec(false); }
  };

  const handleDeleteReceta = async (ingredienteId) => {
    if (!confirm('¿Quitar este ingrediente de la receta?')) return;
    await fetch(`/api/escandallo/recetas?productoId=${selectedProdRec}&ingredienteId=${ingredienteId}`, {
      method: 'DELETE',
    });
    fetchReceta(selectedProdRec);
  };

  // ══════════════════════════════════════════════════════════════
  //  COSTOS — Recalcular precio sugerido en el frontend
  //  (sin llamada extra al API, solo matemática local)
  // ══════════════════════════════════════════════════════════════
  const precioSugeridoLocal = costos && costos.costoTotal > 0
    ? Math.round(costos.costoTotal / (1 - margenSlider / 100))
    : 0;

  const margenRealLocal = costos && costos.precioVenta > 0
    ? ((costos.precioVenta - costos.costoTotal) / costos.precioVenta * 100).toFixed(1)
    : '0.0';

  if (!user) return null;

  // ══════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="desktop-app">
      <Sidebar user={user} />

      <main className="main-view">
        {/* ── HEADER ───────────────────────────────────────────── */}
        <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#fff', lineHeight: 1.1 }}>
              Escandallo
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '1.5px', fontWeight: '700', textTransform: 'uppercase', marginTop: '2px' }}>
              Control de Ingredientes · Recetario · Análisis de Costos
            </p>
          </div>
        </header>

        {/* ── TABS ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', width: 'fit-content' }}>
          {[
            { id: 'ingredientes', label: '🥕 Ingredientes' },
            { id: 'recetario',   label: '📋 Recetario' },
            { id: 'costos',      label: '💰 Análisis de Costos' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '7px 18px', borderRadius: '9px', border: 'none', cursor: 'pointer',
              fontWeight: '700', fontSize: '0.78rem', fontFamily: 'inherit',
              background: tab === t.id ? 'var(--accent-gradient)' : 'transparent',
              color: tab === t.id ? '#000' : 'rgba(255,255,255,0.4)',
              transition: 'all 0.2s',
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════ */}
        {/* TAB 1: INGREDIENTES                                   */}
        {/* ══════════════════════════════════════════════════════ */}
        {tab === 'ingredientes' && (
          <div style={{ animation: 'fadeInScale 0.35s ease both' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                {ingredientes.length} ingrediente{ingredientes.length !== 1 ? 's' : ''} registrado{ingredientes.length !== 1 ? 's' : ''}
              </p>
              <button onClick={() => openModalIngr()} className="luxury-button" style={{ fontSize: '0.78rem', padding: '9px 18px' }}>
                + Nuevo Ingrediente
              </button>
            </div>

            <div className="dash-section" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['Ingrediente', 'U. Compra', 'Costo/U. Compra', 'U. Receta', 'Factor Conv.', 'Costo/U. Receta', 'Merma %', 'Stock Actual', 'Acciones'].map((h, i) => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: i >= 2 ? 'center' : 'left', fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '800', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingIngr ? (
                    [1,2,3,4,5].map(i => (
                      <tr key={i}><td colSpan={9} style={{ padding: '10px 14px' }}><Sk /></td></tr>
                    ))
                  ) : ingredientes.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      Sin ingredientes. Haz clic en "+ Nuevo Ingrediente" para comenzar.
                    </td></tr>
                  ) : ingredientes.map(ing => {
                    const costoUnitReceta = ing.FactorConversion > 0
                      ? (ing.CostoPorUnidadCompra / ing.FactorConversion).toFixed(4)
                      : '—';
                    return (
                      <tr key={ing.Id}
                        className="factura-row"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                      >
                        <td style={{ padding: '10px 14px', fontWeight: '700', color: '#fff' }}>{ing.Nombre}</td>
                        <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>{ing.UnidadCompra}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '700', color: 'var(--primary)' }}>
                          {fmtGs(ing.CostoPorUnidadCompra)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>{ing.UnidadReceta}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                          {Number(ing.FactorConversion).toLocaleString('es-PY')}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '700', color: '#22c55e', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                          Gs. {Number(costoUnitReceta).toFixed(2)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <span style={{
                            background: ing.PorcentajeMerma > 10 ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
                            color: ing.PorcentajeMerma > 10 ? '#ef4444' : 'rgba(255,255,255,0.5)',
                            padding: '2px 8px', borderRadius: '6px', fontWeight: '700', fontSize: '0.72rem'
                          }}>
                            {fmtPct(ing.PorcentajeMerma)}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem' }}>
                          {Number(ing.StockActual).toFixed(1)} {ing.UnidadCompra}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                            <button onClick={() => openModalIngr(ing)} style={{ background: 'rgba(0,210,190,0.1)', color: 'var(--primary)', border: 'none', padding: '5px 9px', borderRadius: '7px', cursor: 'pointer', fontSize: '0.78rem' }}>✏️</button>
                            <button onClick={() => handleDeleteIngr(ing.Id)} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', padding: '5px 9px', borderRadius: '7px', cursor: 'pointer', fontSize: '0.78rem' }}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* TAB 2: RECETARIO                                      */}
        {/* ══════════════════════════════════════════════════════ */}
        {tab === 'recetario' && (
          <div style={{ animation: 'fadeInScale 0.35s ease both' }}>
            {/* Selector de Producto */}
            <div className="dash-section" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '220px' }}>
                <label style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '6px' }}>
                  Plato / Producto
                </label>
                <select
                  className="luxury-input"
                  value={selectedProdRec}
                  onChange={e => { setSelectedProdRec(e.target.value); fetchReceta(e.target.value); }}
                  style={{ width: '100%', cursor: 'pointer' }}
                >
                  <option value="">— Seleccionar plato —</option>
                  {productos.map(p => <option key={p.Id} value={p.Id}>{p.Nombre}</option>)}
                </select>
              </div>
              {selectedProdRec && (
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', paddingBottom: '12px' }}>
                  {receta.length} ingrediente{receta.length !== 1 ? 's' : ''} en la receta
                </p>
              )}
            </div>

            {selectedProdRec && (
              <>
                {/* Agregar ingrediente a la receta */}
                <div className="dash-section" style={{ marginBottom: '1rem', display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '6px' }}>Ingrediente</label>
                    <select
                      className="luxury-input"
                      value={addIngredienteId}
                      onChange={e => setAddIngredienteId(e.target.value)}
                      style={{ width: '220px', cursor: 'pointer' }}
                    >
                      <option value="">— Seleccionar —</option>
                      {ingredientes
                        .filter(i => !receta.find(r => r.IngredienteId === i.Id))
                        .map(i => <option key={i.Id} value={i.Id}>{i.Nombre} ({i.UnidadReceta})</option>)
                      }
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '6px' }}>
                      Cantidad {addIngredienteId && `(${ingredientes.find(i => i.Id == addIngredienteId)?.UnidadReceta || ''})`}
                    </label>
                    <input
                      className="luxury-input"
                      type="number" step="0.01" min="0.01"
                      placeholder="Ej: 250"
                      value={addCantidad}
                      onChange={e => setAddCantidad(e.target.value)}
                      style={{ width: '140px' }}
                    />
                  </div>
                  <button
                    onClick={handleAddToReceta}
                    disabled={!addIngredienteId || !addCantidad || savingRec}
                    className="luxury-button"
                    style={{ fontSize: '0.78rem', padding: '11px 20px', opacity: (!addIngredienteId || !addCantidad) ? 0.4 : 1 }}
                  >
                    {savingRec ? '⏳' : '+ Agregar'}
                  </button>
                  {errorRec && <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>{errorRec}</span>}
                </div>

                {/* Tabla de Receta */}
                <div className="dash-section" style={{ padding: 0, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        {['Ingrediente', 'Cantidad', 'Unidad', 'Costo/U. Receta', 'Costo sin Merma', 'Costo con Merma ✓', 'Acción'].map((h, i) => (
                          <th key={h} style={{ padding: '11px 14px', textAlign: i >= 3 ? 'center' : 'left', fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '800' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loadingRec ? (
                        [1,2,3].map(i => <tr key={i}><td colSpan={7} style={{ padding: '10px 14px' }}><Sk /></td></tr>)
                      ) : receta.length === 0 ? (
                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                          Sin ingredientes en esta receta. Agrega el primero arriba.
                        </td></tr>
                      ) : receta.map(r => (
                        <tr key={r.IngredienteId} className="factura-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '10px 14px', fontWeight: '700', color: '#fff' }}>{r.NombreIngrediente}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.8)', fontWeight: '700' }}>{fmtNum(r.Cantidad, 2)}</td>
                          <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{r.UnidadReceta}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', fontSize: '0.76rem' }}>
                            Gs. {(r.CostoPorUnidadCompra / r.FactorConversion).toFixed(4)}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                            {fmtGs(r.CostoLinea / (1 + r.PorcentajeMerma / 100))}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '800', color: '#22c55e' }}>
                            {fmtGs(r.CostoLinea)}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <button
                              onClick={() => handleDeleteReceta(r.IngredienteId)}
                              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', padding: '5px 9px', borderRadius: '7px', cursor: 'pointer', fontSize: '0.78rem' }}
                            >🗑️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {receta.length > 0 && (
                      <tfoot>
                        <tr style={{ borderTop: '1px solid rgba(0,210,190,0.15)', background: 'rgba(0,210,190,0.03)' }}>
                          <td colSpan={5} style={{ padding: '10px 14px', fontWeight: '800', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            COSTO TOTAL DE INGREDIENTES
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '900', color: 'var(--primary)', fontSize: '0.95rem' }}>
                            {fmtGs(receta.reduce((s, r) => s + parseFloat(r.CostoLinea), 0))}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </>
            )}

            {!selectedProdRec && (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
                <p style={{ fontWeight: '700', fontSize: '0.9rem' }}>Selecciona un plato para ver o editar su receta</p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* TAB 3: ANÁLISIS DE COSTOS                             */}
        {/* ══════════════════════════════════════════════════════ */}
        {tab === 'costos' && (
          <div style={{ animation: 'fadeInScale 0.35s ease both' }}>
            {/* Selector de Producto */}
            <div className="dash-section" style={{ marginBottom: '1.2rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '220px' }}>
                <label style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '6px' }}>Plato a Analizar</label>
                <select
                  className="luxury-input"
                  value={selectedProdCosto}
                  onChange={e => { setSelectedProdCosto(e.target.value); if (e.target.value) fetchCostos(e.target.value, margenSlider); }}
                  style={{ width: '100%', cursor: 'pointer' }}
                >
                  <option value="">— Seleccionar plato —</option>
                  {productos.map(p => <option key={p.Id} value={p.Id}>{p.Nombre}</option>)}
                </select>
              </div>
              {selectedProdCosto && (
                <button
                  onClick={() => fetchCostos(selectedProdCosto, margenSlider)}
                  disabled={loadingCosto}
                  className="luxury-button"
                  style={{ background: 'rgba(0,210,190,0.1)', color: 'var(--primary)', border: '1px solid rgba(0,210,190,0.2)', fontSize: '0.78rem', padding: '11px 18px' }}
                >
                  ↻ Recalcular
                </button>
              )}
            </div>

            {loadingCosto && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', marginBottom: '1.2rem' }}>
                {[1,2,3,4].map(i => <div key={i} className="dash-stat"><Sk h="60px" /></div>)}
              </div>
            )}

            {errorCosto && (
              <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '12px 18px', marginBottom: '1rem', color: '#ef4444', fontSize: '0.82rem', fontWeight: '600' }}>
                ⚠ {errorCosto}
              </div>
            )}

            {costos && !loadingCosto && (
              <>
                {/* ── KPI Cards ─────────────────────────────────── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', marginBottom: '1.2rem' }}>
                  {/* Costo Total */}
                  <div className="dash-stat">
                    <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '0.6rem' }}>Costo Total</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: '900', color: '#fff' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginRight: '2px' }}>Gs.</span>
                      {Number(costos.costoTotal).toLocaleString('es-PY')}
                    </p>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Ingredientes + Indirectos
                    </p>
                  </div>

                  {/* Precio de Venta Actual */}
                  <div className="dash-stat">
                    <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '0.6rem' }}>Precio de Venta</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--primary)' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginRight: '2px' }}>Gs.</span>
                      {Number(costos.precioVenta).toLocaleString('es-PY')}
                    </p>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>Precio actual en el menú</p>
                  </div>

                  {/* Margen Real */}
                  <div className="dash-stat" style={{
                    background: parseFloat(margenRealLocal) >= 60 ? 'rgba(34,197,94,0.04)' : parseFloat(margenRealLocal) >= 30 ? 'rgba(245,158,11,0.04)' : 'rgba(239,68,68,0.04)',
                    borderColor: parseFloat(margenRealLocal) >= 60 ? 'rgba(34,197,94,0.15)' : parseFloat(margenRealLocal) >= 30 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                  }}>
                    <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '0.6rem' }}>Margen Real</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: '900', color: parseFloat(margenRealLocal) >= 60 ? '#22c55e' : parseFloat(margenRealLocal) >= 30 ? '#f59e0b' : '#ef4444' }}>
                      {margenRealLocal}%
                    </p>
                    <div style={{ marginTop: '6px' }}><RentBadge label={costos.rentabilidad} /></div>
                  </div>

                  {/* Precio Sugerido (slider) */}
                  <div className="dash-stat" style={{ background: 'rgba(139,92,246,0.04)', borderColor: 'rgba(139,92,246,0.15)' }}>
                    <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '0.6rem' }}>Precio Sugerido</p>
                    <p style={{ fontSize: '1.3rem', fontWeight: '900', color: '#a855f7' }}>
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginRight: '2px' }}>Gs.</span>
                      {Number(precioSugeridoLocal).toLocaleString('es-PY')}
                    </p>
                    <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      al {margenSlider}% de margen
                    </p>
                  </div>
                </div>

                {/* ── Slider de Margen ──────────────────────────── */}
                <div className="dash-section" style={{ marginBottom: '1.2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                      🎚️ Margen de Ganancia Deseado
                    </p>
                    <span style={{ fontWeight: '900', color: 'var(--primary)', fontSize: '1.1rem' }}>{margenSlider}%</span>
                  </div>
                  <input
                    type="range" min="10" max="95" step="1"
                    value={margenSlider}
                    onChange={e => setMargenSlider(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--primary)', height: '6px', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    <span>10% (Bajo)</span>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Fórmula: Gs. {Number(costos.costoTotal).toLocaleString('es-PY')} / (1 - {margenSlider}%) = <strong style={{ color: '#a855f7' }}>Gs. {Number(precioSugeridoLocal).toLocaleString('es-PY')}</strong>
                    </span>
                    <span>95% (Alto)</span>
                  </div>
                </div>

                {/* ── Desglose de Ingredientes ──────────────────── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1rem', marginBottom: '1.2rem' }}>
                  <div className="dash-section" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="dash-section-title" style={{ padding: '1rem 1.2rem 0.5rem' }}>
                      🥕 Desglose de Ingredientes ({costos.cantidadIngredientes})
                    </div>
                    {!costos.tieneReceta ? (
                      <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem', fontSize: '0.82rem' }}>
                        Este plato no tiene receta configurada. Ve al tab "Recetario" para agregar ingredientes.
                      </p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                        <thead>
                          <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            {['Ingrediente', 'Cantidad', 'Costo Línea', '% del Costo'].map((h, i) => (
                              <th key={h} style={{ padding: '9px 12px', textAlign: i >= 2 ? 'center' : 'left', fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '800' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {costos.lineasIngredientes.map((l, idx) => (
                            <tr key={l.ingredienteId} className="factura-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding: '9px 12px', fontWeight: '600', color: '#fff' }}>{l.ingrediente}</td>
                              <td style={{ padding: '9px 12px', color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                                {fmtNum(l.cantidad, 1)} {l.unidadReceta}
                                {l.porcentajeMerma > 0 && (
                                  <span style={{ color: '#f59e0b', marginLeft: '4px', fontSize: '0.65rem' }}>
                                    +{l.porcentajeMerma}% merma
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: '700', color: '#22c55e' }}>
                                {fmtGs(l.costoLinea)}
                              </td>
                              <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                  <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', overflow: 'hidden', maxWidth: '80px' }}>
                                    <div style={{ width: `${l.pctDelCosto}%`, height: '100%', background: 'var(--accent-gradient)', borderRadius: '10px' }} />
                                  </div>
                                  <span style={{ fontSize: '0.7rem', fontWeight: '700', color: 'rgba(255,255,255,0.6)', minWidth: '36px' }}>
                                    {l.pctDelCosto.toFixed(1)}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: '1px solid rgba(0,210,190,0.15)', background: 'rgba(0,210,190,0.03)' }}>
                            <td colSpan={2} style={{ padding: '9px 12px', fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase' }}>Subtotal Ingredientes</td>
                            <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: '900', color: 'var(--primary)' }}>
                              {fmtGs(costos.costoIngredientes)}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </div>

                  {/* Costos Indirectos + Resumen */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="dash-section">
                      <div className="dash-section-title">⚙️ Costos Indirectos</div>
                      {costos.costosIndirectos.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Sin costos indirectos configurados.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {costos.costosIndirectos.map(ci => (
                            <div key={ci.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                              <div>
                                <p style={{ fontSize: '0.78rem', fontWeight: '700', color: '#fff' }}>{ci.descripcion}</p>
                                <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                                  {ci.tipo === 'fijo' ? `Monto fijo` : `${ci.valor}% sobre ingredientes`}
                                </p>
                              </div>
                              <span style={{ fontWeight: '800', color: '#f59e0b', fontSize: '0.85rem' }}>{fmtGs(ci.monto)}</span>
                            </div>
                          ))}
                          <div style={{ borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase' }}>Subtotal Indirectos</span>
                            <span style={{ fontWeight: '900', color: '#f59e0b' }}>{fmtGs(costos.costoIndirectoTotal)}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="dash-section" style={{ background: 'rgba(0,210,190,0.04)', borderColor: 'rgba(0,210,190,0.15)' }}>
                      <div className="dash-section-title">📊 Resumen Financiero</div>
                      {[
                        { label: 'Costo Ingredientes',  value: fmtGs(costos.costoIngredientes), color: '#22c55e' },
                        { label: 'Costos Indirectos',   value: fmtGs(costos.costoIndirectoTotal), color: '#f59e0b' },
                        { label: 'Costo Total',         value: fmtGs(costos.costoTotal), color: '#fff', big: true },
                        { label: 'Precio de Venta',     value: fmtGs(costos.precioVenta), color: 'var(--primary)' },
                        { label: 'Ganancia Real',       value: fmtGs(costos.gananciaReal), color: costos.gananciaReal >= 0 ? '#22c55e' : '#ef4444' },
                        { label: 'Margen Real',         value: fmtPct(costos.margenReal), color: costos.margenReal >= 60 ? '#22c55e' : costos.margenReal >= 30 ? '#f59e0b' : '#ef4444', big: true },
                      ].map(row => (
                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: row.big ? '800' : '600' }}>{row.label}</span>
                          <span style={{ fontWeight: row.big ? '900' : '700', color: row.color, fontSize: row.big ? '0.95rem' : '0.82rem' }}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {!selectedProdCosto && !loadingCosto && (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💰</div>
                <p style={{ fontWeight: '700', fontSize: '0.9rem' }}>Selecciona un plato para ver su análisis de costos</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* MODAL: INGREDIENTE (Crear / Editar)                       */}
      {/* ══════════════════════════════════════════════════════════ */}
      {showModalIngr && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowModalIngr(false); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
        >
          <div style={{ width: '580px', maxWidth: '95vw', background: '#0d0f14', border: '1px solid rgba(0,210,190,0.25)', borderRadius: '20px', padding: '2rem', boxShadow: '0 0 60px rgba(0,210,190,0.1)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ color: 'var(--primary)', fontWeight: '900', marginBottom: '1.5rem', textAlign: 'center', fontSize: '1rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
              {editingIngr ? '✏️ Editar Ingrediente' : '+ Nuevo Ingrediente'}
            </h2>

            <form onSubmit={handleSaveIngr} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Nombre */}
              <div>
                <label style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Nombre del Ingrediente *
                </label>
                <input className="luxury-input" type="text" placeholder="Ej: Carne de Res" required value={formIngr.nombre} onChange={e => setFormIngr({...formIngr, nombre: e.target.value})} style={{ width: '100%' }} />
              </div>

              {/* Unidad de Compra + Costo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>Unidad de Compra *</label>
                  <input className="luxury-input" type="text" placeholder="Ej: Kg, Lt, Unidad, Docena" required value={formIngr.unidadCompra} onChange={e => setFormIngr({...formIngr, unidadCompra: e.target.value})} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>Costo por U. Compra (Gs.) *</label>
                  <input className="luxury-input" type="number" step="1" min="0" placeholder="Ej: 35000" required value={formIngr.costoPorUnidadCompra} onChange={e => setFormIngr({...formIngr, costoPorUnidadCompra: e.target.value})} style={{ width: '100%' }} />
                </div>
              </div>

              {/* Unidad de Receta + Factor de Conversión */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>Unidad de Receta *</label>
                  <input className="luxury-input" type="text" placeholder="Ej: g, ml, unidad" required value={formIngr.unidadReceta} onChange={e => setFormIngr({...formIngr, unidadReceta: e.target.value})} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>Factor de Conversión *</label>
                  <input className="luxury-input" type="number" step="0.000001" min="0.000001" placeholder="Ej: 1000 (1 Kg = 1000 g)" required value={formIngr.factorConversion} onChange={e => setFormIngr({...formIngr, factorConversion: e.target.value})} style={{ width: '100%' }} />
                </div>
              </div>

              {/* Merma + Stock */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>% de Merma</label>
                  <input className="luxury-input" type="number" step="0.1" min="0" max="99" placeholder="0" value={formIngr.porcentajeMerma} onChange={e => setFormIngr({...formIngr, porcentajeMerma: e.target.value})} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>Stock Actual (U. Compra)</label>
                  <input className="luxury-input" type="number" step="0.001" min="0" placeholder="0" value={formIngr.stockActual} onChange={e => setFormIngr({...formIngr, stockActual: e.target.value})} style={{ width: '100%' }} />
                </div>
              </div>

              {/* Proveedor */}
              <div>
                <label style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>Proveedor</label>
                <input className="luxury-input" type="text" placeholder="Ej: Frigorífico Central" value={formIngr.proveedor} onChange={e => setFormIngr({...formIngr, proveedor: e.target.value})} style={{ width: '100%' }} />
              </div>

              {/* Vista previa del costo por unidad de receta */}
              {formIngr.costoPorUnidadCompra && formIngr.factorConversion && parseFloat(formIngr.factorConversion) > 0 && (
                <div style={{ background: 'rgba(0,210,190,0.06)', border: '1px solid rgba(0,210,190,0.15)', borderRadius: '10px', padding: '10px 14px' }}>
                  <p style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: '700' }}>
                    📐 Vista previa: Costo por {formIngr.unidadReceta || 'unidad de receta'} ={' '}
                    <strong>
                      Gs. {(parseFloat(formIngr.costoPorUnidadCompra || 0) / parseFloat(formIngr.factorConversion || 1)).toFixed(4)}
                    </strong>
                    {parseFloat(formIngr.porcentajeMerma) > 0 && (
                      <span style={{ color: '#f59e0b', marginLeft: '6px' }}>
                        → Con merma: Gs. {(parseFloat(formIngr.costoPorUnidadCompra || 0) / parseFloat(formIngr.factorConversion || 1) * (1 + parseFloat(formIngr.porcentajeMerma || 0) / 100)).toFixed(4)}
                      </span>
                    )}
                  </p>
                </div>
              )}

              {errorIngr && <p style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: '600' }}>⚠ {errorIngr}</p>}

              <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowModalIngr(false)} className="luxury-button" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={savingIngr} className="luxury-button" style={{ flex: 1 }}>
                  {savingIngr ? '⏳ Guardando...' : editingIngr ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
