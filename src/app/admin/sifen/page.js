'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { 
  Settings, 
  ShieldCheck, 
  FileText, 
  FileLock, 
  User, 
  Calendar, 
  Building, 
  Upload, 
  Eye, 
  EyeOff, 
  Save, 
  AlertTriangle, 
  CheckCircle2, 
  Lock, 
  Globe, 
  Smartphone, 
  FileCheck2,
  HelpCircle
} from 'lucide-react';

export default function SifenConfigPage() {
  const [user, setUser] = useState(null);
  const router = useRouter();

  // Estados de configuración
  const [config, setConfig] = useState({
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
    SIFEN_Ambiente: '1', // '1' = Test, '2' = Producción
    SIFEN_CSC: '',
    SIFEN_IdCSC: '0001',
    SIFEN_CertificadoBase64: '',
    SIFEN_CertificadoPassword: '',
    SIFEN_FacturadorElectronico: '1'
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('emisor'); // emisor | timbrado | certificado
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
          setConfig(prev => ({
            ...prev,
            ...data.config
          }));
          if (data.config.SIFEN_CertificadoBase64) {
            setFileName('Certificado cargado (.pfx/.p12)');
          }
        }
      } else {
        showStatus('error', 'No se pudieron cargar los parámetros desde la base de datos.');
      }
    } catch (err) {
      console.error(err);
      showStatus('error', 'Error de conexión al cargar la configuración.');
    } finally {
      setLoading(false);
    }
  };

  const showStatus = (type, text) => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage({ type: '', text: '' });
    }, 5000);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const arrayBuffer = event.target.result;
      const base64String = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      );
      setConfig(prev => ({
        ...prev,
        SIFEN_CertificadoBase64: base64String
      }));
      showStatus('success', `Archivo "${file.name}" convertido a Base64 con éxito.`);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage({ type: '', text: '' });

    // Validaciones básicas
    if (!config.SIFEN_RUC.includes('-')) {
      showStatus('error', 'El RUC debe incluir el Dígito Verificador separado por un guión (ej: 80001234-5).');
      setSaving(false);
      return;
    }
    if (config.SIFEN_Timbrado.length !== 8 || isNaN(Number(config.SIFEN_Timbrado))) {
      showStatus('error', 'El Número de Timbrado debe tener exactamente 8 caracteres numéricos.');
      setSaving(false);
      return;
    }
    if (config.SIFEN_Establecimiento.length !== 3 || config.SIFEN_PuntoExpedicion.length !== 3) {
      showStatus('error', 'Establecimiento y Punto de Expedición deben tener 3 dígitos (ej: 001).');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/facturacion/configuracion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (res.ok) {
        showStatus('success', 'Configuración de facturación electrónica guardada correctamente en SQL Server.');
      } else {
        const errData = await res.json();
        showStatus('error', errData.error || 'Error al guardar la configuración.');
      }
    } catch (err) {
      console.error(err);
      showStatus('error', 'Error al conectarse con el endpoint del backend.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)', color: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid rgba(0, 210, 190, 0.2)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }}></div>
          <p style={{ fontSize: '0.9rem', fontWeight: '600', letterSpacing: '1px', color: 'var(--text-muted)' }}>CARGANDO PARÁMETROS SIFEN...</p>
        </div>
        <style jsx global>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  // Verificar rol de Administrador
  if (user && user.roleId !== 1) {
    return (
      <div className="desktop-app">
        <Sidebar user={user} />
        <main className="main-view" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-card luxury-shadow" style={{ padding: '3rem', maxWidth: '500px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(15, 6, 6, 0.4)' }}>
            <AlertTriangle size={48} color="var(--error)" style={{ margin: '0 auto 1.5rem', filter: 'drop-shadow(0 0 10px rgba(239, 68, 68, 0.3))' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#fff', marginBottom: '0.8rem' }}>Acceso Restringido</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
              Este módulo contiene credenciales de firma digital y parámetros fiscales de la SET ante SIFEN. Solo los usuarios con rol de <strong style={{ color: 'var(--primary)' }}>Administrador</strong> pueden modificar la configuración.
            </p>
            <button onClick={() => router.push('/')} className="luxury-button" style={{ width: '100%' }}>VOLVER AL INICIO</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="desktop-app">
      <Sidebar user={user} />
      
      <main className="main-view">
        {/* Header */}
        <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <ShieldCheck size={20} color="var(--primary)" />
              <p style={{ color: 'var(--primary)', fontSize: '0.7rem', letterSpacing: '2px', fontWeight: 'bold', textTransform: 'uppercase' }}>PANEL FISCAL SET</p>
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: '900', color: '#fff' }}>Facturación Electrónica SIFEN</h1>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ 
              fontSize: '0.65rem', 
              fontWeight: '900', 
              padding: '6px 12px', 
              borderRadius: '8px', 
              background: config.SIFEN_Ambiente === '1' ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)', 
              color: config.SIFEN_Ambiente === '1' ? 'var(--warning)' : 'var(--success)',
              border: `1px solid ${config.SIFEN_Ambiente === '1' ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)'}`,
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              Ambiente: {config.SIFEN_Ambiente === '1' ? 'Pruebas / Sandbox' : 'Producción'}
            </span>
          </div>
        </header>

        {/* Notificaciones de Estado */}
        {statusMessage.text && (
          <div style={{ 
            marginBottom: '1.5rem', 
            padding: '1rem', 
            borderRadius: '12px', 
            background: statusMessage.type === 'success' ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            border: `1px solid ${statusMessage.type === 'success' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.85rem',
            animation: 'fadeInUp 0.3s ease'
          }}>
            {statusMessage.type === 'success' ? <CheckCircle2 size={18} color="var(--success)" /> : <AlertTriangle size={18} color="var(--error)" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '2rem', alignItems: 'start' }}>
          
          {/* Navegación Lateral Interna */}
          <div className="glass-card luxury-shadow" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 'bold', padding: '0.5rem', letterSpacing: '1px', textTransform: 'uppercase' }}>SECCIONES</p>
            {[
              { id: 'emisor', label: 'Datos del Emisor', icon: <Building size={16} /> },
              { id: 'timbrado', label: 'Timbrado y Puntos', icon: <FileText size={16} /> },
              { id: 'certificado', label: 'Firma y Seguridad', icon: <FileLock size={16} /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '0.8rem 1rem',
                  borderRadius: '10px',
                  background: activeTab === tab.id ? 'rgba(0, 210, 190, 0.1)' : 'transparent',
                  border: 'none',
                  borderLeft: activeTab === tab.id ? '3px solid var(--primary)' : '3px solid transparent',
                  color: activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.45)',
                  fontSize: '0.8rem',
                  fontWeight: activeTab === tab.id ? '700' : '500',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}

            <div style={{ marginTop: '2rem', padding: '1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              <Globe size={14} color="var(--primary)" style={{ marginBottom: '8px' }} />
              <p style={{ fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>e-Kuatia (SET)</p>
              El sistema genera el XML firmado con certificados estándar de Paraguay y se comunica via SOAP HTTPS.
            </div>
          </div>

          {/* Formulario Principal */}
          <form onSubmit={handleSave} className="glass-card luxury-shadow" style={{ padding: '2rem', border: '1px solid rgba(0, 210, 190, 0.08)' }}>
            
            {activeTab === 'emisor' && (
              <div style={{ animation: 'fadeInUp 0.3s ease' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#fff', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building size={20} color="var(--primary)" />
                  Datos del Contribuyente (Emisor)
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem', marginBottom: '1.2rem' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 'bold', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>TIPO DE FACTURACIÓN *</label>
                    <select
                      name="SIFEN_FacturadorElectronico"
                      value={config.SIFEN_FacturadorElectronico || '1'}
                      onChange={handleInputChange}
                      className="luxury-input"
                      style={{ width: '100%', background: 'rgba(255,255,255,0.04)', color: '#fff', border: '1px solid rgba(255,255,255,0.09)' }}
                    >
                      <option value="1" style={{ background: '#0d1117', color: '#fff' }}>Facturación Electrónica (SIFEN)</option>
                      <option value="0" style={{ background: '#0d1117', color: '#fff' }}>Facturación Normal (Tradicional - Impresa)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem', marginBottom: '1.2rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 'bold', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>RUC DEL EMISOR *</label>
                    <input
                      type="text"
                      name="SIFEN_RUC"
                      value={config.SIFEN_RUC}
                      onChange={handleInputChange}
                      placeholder="Ej: 80001234-5"
                      className="luxury-input"
                      style={{ width: '100%' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 'bold', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>RAZÓN SOCIAL (SET) *</label>
                    <input
                      type="text"
                      name="SIFEN_RazonSocial"
                      value={config.SIFEN_RazonSocial}
                      onChange={handleInputChange}
                      placeholder="Ej: La Parada Bar S.A."
                      className="luxury-input"
                      style={{ width: '100%' }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem', marginBottom: '1.2rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>NOMBRE DE FANTASÍA</label>
                    <input
                      type="text"
                      name="SIFEN_NombreFantasia"
                      value={config.SIFEN_NombreFantasia}
                      onChange={handleInputChange}
                      placeholder="Ej: La Parada Bar"
                      className="luxury-input"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 'bold', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>DIRECCIÓN DEL ESTABLECIMIENTO *</label>
                    <input
                      type="text"
                      name="SIFEN_Direccion"
                      value={config.SIFEN_Direccion}
                      onChange={handleInputChange}
                      placeholder="Ej: Avda. Principal 123, Asunción"
                      className="luxury-input"
                      style={{ width: '100%' }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>TELÉFONO DE CONTACTO</label>
                    <input
                      type="text"
                      name="SIFEN_Telefono"
                      value={config.SIFEN_Telefono}
                      onChange={handleInputChange}
                      placeholder="Ej: 021-123456"
                      className="luxury-input"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 'bold', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>CORREO PARA ENVÍO DE XML/PDF *</label>
                    <input
                      type="email"
                      name="SIFEN_Email"
                      value={config.SIFEN_Email}
                      onChange={handleInputChange}
                      placeholder="Ej: facturas@laparadabar.com.py"
                      className="luxury-input"
                      style={{ width: '100%' }}
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'timbrado' && (
              <div style={{ animation: 'fadeInUp 0.3s ease' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#fff', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={20} color="var(--primary)" />
                  Timbrado de Facturación Electrónica
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.2rem', marginBottom: '1.2rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 'bold', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>NÚMERO DE TIMBRADO (8 DÍGITOS) *</label>
                    <input
                      type="text"
                      name="SIFEN_Timbrado"
                      value={config.SIFEN_Timbrado}
                      onChange={handleInputChange}
                      placeholder="Ej: 12345678"
                      maxLength={8}
                      className="luxury-input"
                      style={{ width: '100%' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 'bold', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>INICIO VIGENCIA / VENCIMIENTO *</label>
                    <input
                      type="date"
                      name="SIFEN_TimbradoVigencia"
                      value={config.SIFEN_TimbradoVigencia}
                      onChange={handleInputChange}
                      className="luxury-input"
                      style={{ width: '100%', colorScheme: 'dark' }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 'bold', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>CÓDIGO DE ESTABLECIMIENTO (3 DÍGITOS) *</label>
                    <input
                      type="text"
                      name="SIFEN_Establecimiento"
                      value={config.SIFEN_Establecimiento}
                      onChange={handleInputChange}
                      placeholder="Ej: 001"
                      maxLength={3}
                      className="luxury-input"
                      style={{ width: '100%' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 'bold', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>PUNTO DE EXPEDICIÓN (3 DÍGITOS) *</label>
                    <input
                      type="text"
                      name="SIFEN_PuntoExpedicion"
                      value={config.SIFEN_PuntoExpedicion}
                      onChange={handleInputChange}
                      placeholder="Ej: 001"
                      maxLength={3}
                      className="luxury-input"
                      style={{ width: '100%' }}
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'certificado' && (
              <div style={{ animation: 'fadeInUp 0.3s ease' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#fff', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileLock size={20} color="var(--primary)" />
                  Firma Digital & Credenciales de SET
                </h3>

                <div style={{ marginBottom: '1.2rem' }}>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 'bold', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>AMBIENTE SIFEN *</label>
                  <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                      <input
                        type="radio"
                        name="SIFEN_Ambiente"
                        value="1"
                        checked={config.SIFEN_Ambiente === '1'}
                        onChange={handleInputChange}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span style={{ color: config.SIFEN_Ambiente === '1' ? '#fff' : 'rgba(255,255,255,0.4)' }}>Pruebas / Sandbox (Test)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                      <input
                        type="radio"
                        name="SIFEN_Ambiente"
                        value="2"
                        checked={config.SIFEN_Ambiente === '2'}
                        onChange={handleInputChange}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span style={{ color: config.SIFEN_Ambiente === '2' ? '#fff' : 'rgba(255,255,255,0.4)' }}>Producción (Fiscal Real)</span>
                    </label>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem', marginBottom: '1.2rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 'bold', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>CERTIFICADO DIGITAL DE PARAGUAY (.PFX / .P12) *</label>
                    <div style={{ position: 'relative', display: 'flex', gap: '10px' }}>
                      <label style={{ 
                        flex: 1,
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px dashed rgba(0, 210, 190, 0.3)',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        color: 'rgba(255,255,255,0.6)',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.25s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(0, 210, 190, 0.3)'}
                      >
                        <Upload size={14} color="var(--primary)" />
                        <span>{fileName || 'Subir Certificado (.p12)'}</span>
                        <input
                          type="file"
                          accept=".p12,.pfx"
                          onChange={handleFileChange}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 'bold', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>CONTRASEÑA DEL CERTIFICADO {config.SIFEN_FacturadorElectronico !== '0' && '*'}</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="SIFEN_CertificadoPassword"
                        value={config.SIFEN_CertificadoPassword}
                        onChange={handleInputChange}
                        placeholder="••••••••"
                        className="luxury-input"
                        style={{ width: '100%', paddingRight: '40px' }}
                        required={config.SIFEN_FacturadorElectronico !== '0'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'transparent',
                          border: 'none',
                          color: 'rgba(255,255,255,0.4)',
                          cursor: 'pointer'
                        }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.2rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.2rem', marginTop: '1.2rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>CSC / LLAVE PARA EL CÓDIGO QR (SET) {config.SIFEN_FacturadorElectronico !== '0' && '*'}</label>
                    <input
                      type="text"
                      name="SIFEN_CSC"
                      value={config.SIFEN_CSC}
                      onChange={handleInputChange}
                      placeholder="Ej: ABCD1234EFGH5678IJKL9012MNOP3456"
                      className="luxury-input"
                      style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8rem' }}
                      required={config.SIFEN_FacturadorElectronico !== '0'}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>IDENTIFICADOR CSC (ID DE LLAVE) {config.SIFEN_FacturadorElectronico !== '0' && '*'}</label>
                    <input
                      type="text"
                      name="SIFEN_IdCSC"
                      value={config.SIFEN_IdCSC}
                      onChange={handleInputChange}
                      placeholder="Ej: 0001"
                      maxLength={4}
                      className="luxury-input"
                      style={{ width: '100%', fontFamily: 'monospace' }}
                      required={config.SIFEN_IdCSC !== '0' && config.SIFEN_FacturadorElectronico !== '0'}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Footer Form - Botón de Guardar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: '2rem', paddingTop: '1.5rem' }}>
              <button
                type="submit"
                disabled={saving}
                className="luxury-button"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--accent-gradient)',
                  color: '#000',
                  padding: '12px 30px'
                }}
              >
                <Save size={16} />
                {saving ? 'GUARDANDO EN BASE DE DATOS...' : 'GUARDAR CONFIGURACIÓN'}
              </button>
            </div>
          </form>

        </div>
      </main>
    </div>
  );
}
