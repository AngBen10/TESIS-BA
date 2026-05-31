'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import {
  Settings, ShieldCheck, FileText, FileLock, Building, Upload, AlertTriangle, CheckCircle2
} from 'lucide-react';

export default function SifenConfigPage() {
  const [user, setUser] = useState(null);
  const router = useRouter();

  const [config, setConfig] = useState({
    EMPRESA_NOMBRE: '',
    EMPRESA_FOTO: '',
    EMPRESA_DIRECCION: '',
    EMPRESA_TELEFONO: '',
    SIFEN_RUC: '',
    SIFEN_RazonSocial: '',
    SIFEN_NombreFantasia: '',
    SIFEN_Direccion: '',
    SIFEN_Telefono: '',
    SIFEN_Email: '',
    SIFEN_Timbrado: '',
    SIFEN_TimbradoVigencia: '',
    SIFEN_Establecimiento: '001',
    SIFEN_PuntoExpedicion: '001',
    SIFEN_Ambiente: '1',
    SIFEN_CSC: '',
    SIFEN_IdCSC: '0001',
    SIFEN_CertificadoBase64: '',
    SIFEN_CertificadoPassword: '',
    SIFEN_FacturadorElectronico: '1'
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('empresa');
  const [showPassword, setShowPassword] = useState(false);
  const [fileName, setFileName] = useState('');
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/login');
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);

    if (parsedUser.roleId === 1) {
      loadConfig();
    } else {
      setLoading(false);
    }
  }, [router]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/facturacion/configuracion');
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setConfig(prev => ({ ...prev, ...data.config }));
          if (data.config.SIFEN_CertificadoBase64) {
            setFileName('Certificado cargado (.pfx/.p12)');
          }
        }
      } else {
        showStatus('error', 'No se pudieron cargar los parámetros.');
      }
    } catch (err) {
      showStatus('error', 'Error de conexión al cargar la configuración.');
    } finally {
      setLoading(false);
    }
  };

  const showStatus = (type, text) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage({ type: '', text: '' }), 5000);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const arrayBuffer = event.target.result;
      const base64String = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
      setConfig(prev => ({ ...prev, SIFEN_CertificadoBase64: base64String }));
      showStatus('success', `Archivo "${file.name}" cargado.`);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showStatus('error', 'El logo no debe superar los 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setConfig(prev => ({ ...prev, EMPRESA_FOTO: event.target.result }));
      showStatus('success', 'Logo cargado. No olvides guardar.');
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage({ type: '', text: '' });

    if (activeTab !== 'empresa' && !config.SIFEN_RUC.includes('-')) {
      showStatus('error', 'El RUC debe incluir el Dígito Verificador separado por un guión.');
      setSaving(false); return;
    }

    try {
      const res = await fetch('/api/facturacion/configuracion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        showStatus('success', 'Configuración guardada correctamente.');
        window.dispatchEvent(new Event('empresa_updated'));
      } else {
        const errData = await res.json();
        showStatus('error', errData.error || 'Error al guardar.');
      }
    } catch (err) {
      showStatus('error', 'Error al conectarse con el servidor.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff' }}>Cargando...</div>;

  if (user && user.roleId !== 1) {
    return (
      <div className="desktop-app">
        <Sidebar user={user} />
        <main className="main-view" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-card luxury-shadow" style={{ padding: '3rem', maxWidth: '500px', textAlign: 'center' }}>
            <AlertTriangle size={48} color="var(--error)" style={{ margin: '0 auto 1.5rem' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#fff' }}>Acceso Restringido</h2>
            <button onClick={() => router.push('/')} className="luxury-button" style={{ width: '100%', marginTop: '1.5rem' }}>VOLVER AL INICIO</button>
          </div>
        </main>
      </div>
    );
  }

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.04)', color: '#fff', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '10px', padding: '10px 14px', outline: 'none' };
  const labelStyle = { display: 'block', fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 'bold', marginBottom: '0.5rem', letterSpacing: '0.5px', textTransform: 'uppercase' };

  return (
    <div className="desktop-app">
      <Sidebar user={user} />
      <main className="main-view">
        <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Settings size={20} color="var(--primary)" />
              <p style={{ color: 'var(--primary)', fontSize: '0.7rem', letterSpacing: '2px', fontWeight: 'bold', textTransform: 'uppercase' }}>PANEL DE ADMINISTRACIÓN</p>
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: '900', color: '#fff' }}>Configuración del Sistema</h1>
          </div>
        </header>

        {statusMessage.text && (
          <div style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: '12px', background: statusMessage.type === 'success' ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            {statusMessage.type === 'success' ? <CheckCircle2 size={18} color="var(--success)" /> : <AlertTriangle size={18} color="var(--error)" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <div style={{ maxWidth: '1000px' }}>

          {/* Selector de Pestañas estilo Botones (Igual que en CajaPage) */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {[
              { id: 'empresa', label: 'Datos de la Empresa', icon: <Building size={18} /> },
              { id: 'emisor', label: 'Datos Fiscales (SET)', icon: <ShieldCheck size={18} /> },
              { id: 'timbrado', label: 'Timbrado y Puntos', icon: <FileText size={18} /> },
              { id: 'certificado', label: 'Firma y Seguridad', icon: <FileLock size={18} /> }
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1, minWidth: '180px', padding: '14px', borderRadius: '12px', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  background: activeTab === tab.id ? 'rgba(0,210,190,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${activeTab === tab.id ? 'var(--primary)' : 'rgba(255,255,255,0.07)'}`,
                  color: activeTab === tab.id ? 'var(--primary)' : 'rgba(255,255,255,0.4)'
                }}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSave} className="glass-card luxury-shadow" style={{ padding: '2.5rem', border: '1px solid rgba(0, 210, 190, 0.08)' }}>

            {/* ── PESTAÑA EMPRESA ── */}
            {activeTab === 'empresa' && (
              <div style={{ animation: 'fadeInUp 0.3s ease' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#fff', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building size={20} color="var(--primary)" /> Perfil del Restaurante
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={labelStyle}>NOMBRE DE LA EMPRESA / RESTAURANTE</label>
                    <input type="text" name="EMPRESA_NOMBRE" value={config.EMPRESA_NOMBRE} onChange={handleInputChange} placeholder="Ej: Mi Restaurante" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: 'rgba(255,255,255,0.5)' }}>TELÉFONO PÚBLICO</label>
                    <input type="text" name="EMPRESA_TELEFONO" value={config.EMPRESA_TELEFONO} onChange={handleInputChange} placeholder="Ej: 0981 123 456" style={inputStyle} />
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ ...labelStyle, color: 'rgba(255,255,255,0.5)' }}>DIRECCIÓN PÚBLICA</label>
                  <input type="text" name="EMPRESA_DIRECCION" value={config.EMPRESA_DIRECCION} onChange={handleInputChange} placeholder="Ej: Calle Principal 123" style={inputStyle} />
                </div>

                <div style={{ marginBottom: '1.2rem' }}>
                  <label style={labelStyle}>LOGO DE LA EMPRESA (Recomendado 1:1 Cuadrado)</label>
                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginTop: '10px' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {config.EMPRESA_FOTO ? (
                        <img src={config.EMPRESA_FOTO} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : <Building size={32} color="rgba(255,255,255,0.2)" />}
                    </div>
                    <label style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 16px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}>
                      <Upload size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                      Subir Nuevo Logo
                      <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
                    </label>
                    {config.EMPRESA_FOTO && (
                      <button type="button" onClick={() => setConfig(p => ({ ...p, EMPRESA_FOTO: '' }))} style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', fontWeight: '700', textDecoration: 'underline' }}>Quitar Logo</button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── PESTAÑA EMISOR (FACTURACIÓN) ── */}
            {activeTab === 'emisor' && (
              <div style={{ animation: 'fadeInUp 0.3s ease' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#fff', marginBottom: '1.5rem' }}>Datos del Contribuyente (SET)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={labelStyle}>TIPO DE FACTURACIÓN</label>
                    <select name="SIFEN_FacturadorElectronico" value={config.SIFEN_FacturadorElectronico || '1'} onChange={handleInputChange} style={inputStyle}>
                      <option value="1">Facturación Electrónica (SIFEN)</option>
                      <option value="0">Facturación Normal (Tradicional)</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>RUC DEL EMISOR *</label>
                    <input type="text" name="SIFEN_RUC" value={config.SIFEN_RUC} onChange={handleInputChange} style={inputStyle} required={activeTab === 'emisor'} />
                  </div>
                  <div>
                    <label style={labelStyle}>RAZÓN SOCIAL *</label>
                    <input type="text" name="SIFEN_RazonSocial" value={config.SIFEN_RazonSocial} onChange={handleInputChange} style={inputStyle} required={activeTab === 'emisor'} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: 'rgba(255,255,255,0.4)' }}>NOMBRE DE FANTASÍA</label>
                    <input type="text" name="SIFEN_NombreFantasia" value={config.SIFEN_NombreFantasia} onChange={handleInputChange} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>DIRECCIÓN DEL ESTABLECIMIENTO *</label>
                    <input type="text" name="SIFEN_Direccion" value={config.SIFEN_Direccion} onChange={handleInputChange} style={inputStyle} required={activeTab === 'emisor'} />
                  </div>
                </div>
              </div>
            )}

            {/* ── PESTAÑA TIMBRADO ── */}
            {activeTab === 'timbrado' && (
              <div style={{ animation: 'fadeInUp 0.3s ease' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#fff', marginBottom: '1.5rem' }}>Timbrado y Puntos</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={labelStyle}>NÚMERO DE TIMBRADO (8 DÍGITOS) *</label>
                    <input type="text" name="SIFEN_Timbrado" value={config.SIFEN_Timbrado} onChange={handleInputChange} maxLength={8} style={inputStyle} required={activeTab === 'timbrado'} />
                  </div>
                  <div>
                    <label style={labelStyle}>VIGENCIA *</label>
                    <input type="date" name="SIFEN_TimbradoVigencia" value={config.SIFEN_TimbradoVigencia} onChange={handleInputChange} style={{ ...inputStyle, colorScheme: 'dark' }} required={activeTab === 'timbrado'} />
                  </div>
                  <div>
                    <label style={labelStyle}>ESTABLECIMIENTO (3 DÍGITOS) *</label>
                    <input type="text" name="SIFEN_Establecimiento" value={config.SIFEN_Establecimiento} onChange={handleInputChange} maxLength={3} style={inputStyle} required={activeTab === 'timbrado'} />
                  </div>
                  <div>
                    <label style={labelStyle}>PUNTO DE EXPEDICIÓN (3 DÍGITOS) *</label>
                    <input type="text" name="SIFEN_PuntoExpedicion" value={config.SIFEN_PuntoExpedicion} onChange={handleInputChange} maxLength={3} style={inputStyle} required={activeTab === 'timbrado'} />
                  </div>
                </div>
              </div>
            )}

            {/* ── PESTAÑA CERTIFICADO ── */}
            {activeTab === 'certificado' && (
              <div style={{ animation: 'fadeInUp 0.3s ease' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#fff', marginBottom: '1.5rem' }}>Firma Digital & Credenciales</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={labelStyle}>CERTIFICADO (.P12) *</label>
                    <label style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(0, 210, 190, 0.3)', borderRadius: '10px', padding: '10px', justifyContent: 'center', cursor: 'pointer', fontSize: '0.75rem', color: '#fff' }}>
                      <Upload size={14} color="var(--primary)" style={{ marginRight: '8px' }} /> {fileName || 'Subir Certificado'}
                      <input type="file" accept=".p12,.pfx" onChange={handleFileChange} style={{ display: 'none' }} />
                    </label>
                  </div>
                  <div>
                    <label style={labelStyle}>CONTRASEÑA CERTIFICADO</label>
                    <input type={showPassword ? 'text' : 'password'} name="SIFEN_CertificadoPassword" value={config.SIFEN_CertificadoPassword} onChange={handleInputChange} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: 'rgba(255,255,255,0.4)' }}>CSC / LLAVE QR</label>
                    <input type="text" name="SIFEN_CSC" value={config.SIFEN_CSC} onChange={handleInputChange} style={{ ...inputStyle, fontFamily: 'monospace' }} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: 'rgba(255,255,255,0.4)' }}>ID CSC</label>
                    <input type="text" name="SIFEN_IdCSC" value={config.SIFEN_IdCSC} onChange={handleInputChange} maxLength={4} style={{ ...inputStyle, fontFamily: 'monospace' }} />
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: '2.5rem', paddingTop: '1.5rem' }}>
              <button type="submit" disabled={saving} className="luxury-button" style={{ background: 'var(--accent-gradient)', color: '#000', padding: '14px 35px', fontWeight: '800' }}>
                {saving ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
              </button>
            </div>
          </form>

        </div>
      </main>
    </div>
  );
}