'use client';

import { forwardRef } from 'react';

/**
 * TicketFactura — Componente de impresión para rollo de 80mm (KuDE básico)
 *
 * Se usa como ref para window.print() o Electron's webContents.print()
 * Ejemplo de uso:
 *   const ticketRef = useRef();
 *   <TicketFactura ref={ticketRef} datos={datosFactura} />
 *   ticketRef.current.imprimir();
 */
const TicketFactura = forwardRef(({ datos }, ref) => {
  if (!datos) return null;

  const {
    // Emisor (desde config)
    razonSocial      = 'La Parada Bar',
    nombreFantasia   = 'La Parada Bar',
    rucEmisor        = '',
    timbrado         = '',
    timbradoVigencia = '',
    establecimiento  = '001',
    puntoExpedicion  = '001',
    direccion        = '',
    telefono         = '',
    email            = '',
    // Factura
    numeroFactura    = '',
    fechaEmision     = new Date().toISOString(),
    cdc              = '',
    enlaceQR         = '',
    estadoSifen      = 'Aprobado',
    // Cliente
    nombreCliente    = 'Consumidor Final',
    rucCliente       = '',
    metodoPago       = 'Efectivo',
    // Items
    items            = [],
    // Totales
    totalFactura     = 0,
  } = datos;

  const totalIVA10 = Math.round(totalFactura / 11);
  const baseIVA10  = totalFactura - totalIVA10;
  const fecha      = new Date(fechaEmision);

  // Exponer método imprimir() al padre via ref
  if (ref) {
    ref.current = {
      imprimir: () => {
        const printWindow = window.open('', '_blank', 'width=400,height=700');
        const ticketEl    = document.getElementById('ticket-factura-80mm');
        if (!ticketEl || !printWindow) return;

        printWindow.document.write(`
          <!DOCTYPE html>
          <html lang="es">
          <head>
            <meta charset="UTF-8">
            <title>Factura ${numeroFactura}</title>
            <style>
              * { box-sizing:border-box; margin:0; padding:0; }
              body {
                font-family: 'Courier New', Courier, monospace;
                font-size: 10pt;
                width: 72mm;
                margin: 0 auto;
                padding: 4mm;
                background: #fff;
                color: #000;
              }
              .center { text-align: center; }
              .bold   { font-weight: bold; }
              .small  { font-size: 8pt; }
              .line   { border-top: 1px dashed #000; margin: 4px 0; }
              .row    { display: flex; justify-content: space-between; }
              .mono   { font-family: monospace; font-size: 7pt; word-break: break-all; }
              @media print {
                body { width: 72mm; }
                @page { size: 80mm auto; margin: 2mm; }
              }
            </style>
          </head>
          <body>${ticketEl.innerHTML}</body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 300);
      },

      getHTML: () => {
        const el = document.getElementById('ticket-factura-80mm');
        return el ? el.outerHTML : '';
      }
    };
  }

  return (
    <>
      {/* Estilos de impresión */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #ticket-factura-80mm,
          #ticket-factura-80mm * { visibility: visible !important; }
          #ticket-factura-80mm {
            position: fixed !important;
            top: 0; left: 0;
            width: 72mm !important;
            font-size: 10pt !important;
          }
        }
      `}</style>

      {/* Ticket visible en pantalla */}
      <div
        id="ticket-factura-80mm"
        style={{
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: '11px',
          width: '288px',       // 72mm a 96dpi ≈ 288px
          padding: '10px',
          background: '#fff',
          color: '#000',
          lineHeight: '1.4',
        }}
      >
        {/* ── CABECERA ── */}
        <div style={{ textAlign: 'center', marginBottom: '6px' }}>
          <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>{nombreFantasia}</div>
          <div style={{ fontSize: '9px' }}>{razonSocial}</div>
          <div style={{ fontSize: '9px' }}>RUC: {rucEmisor}</div>
          <div style={{ fontSize: '9px' }}>{direccion}</div>
          {telefono && <div style={{ fontSize: '9px' }}>Tel: {telefono}</div>}
          {email    && <div style={{ fontSize: '9px' }}>{email}</div>}
        </div>

        <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

        {/* ── DATOS DE LA FACTURA ── */}
        <div style={{ textAlign: 'center', marginBottom: '4px' }}>
          <div style={{ fontSize: '10px', fontWeight: 'bold' }}>FACTURA ELECTRÓNICA</div>
          <div style={{ fontSize: '12px', fontWeight: 'bold' }}>N° {numeroFactura}</div>
          <div style={{ fontSize: '9px' }}>
            Timbrado: {timbrado} — Vigencia: {timbradoVigencia}
          </div>
          <div style={{ fontSize: '9px' }}>
            Est: {establecimiento} — Pto: {puntoExpedicion}
          </div>
        </div>

        <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

        {/* ── DATOS DEL CLIENTE ── */}
        <div style={{ marginBottom: '4px' }}>
          <div style={{ fontSize: '9px' }}>
            <strong>Cliente:</strong> {nombreCliente}
          </div>
          {rucCliente && rucCliente !== 'X' && (
            <div style={{ fontSize: '9px' }}>
              <strong>RUC:</strong> {rucCliente}
            </div>
          )}
          <div style={{ fontSize: '9px' }}>
            <strong>Fecha:</strong> {fecha.toLocaleDateString('es-PY')} {fecha.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div style={{ fontSize: '9px' }}>
            <strong>Pago:</strong> {metodoPago}
          </div>
        </div>

        <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

        {/* ── ENCABEZADO COLUMNAS ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 'bold', marginBottom: '2px' }}>
          <span style={{ flex: 3 }}>PRODUCTO</span>
          <span style={{ flex: 1, textAlign: 'center' }}>CANT</span>
          <span style={{ flex: 2, textAlign: 'right' }}>IMPORTE</span>
        </div>

        <div style={{ borderTop: '1px solid #000', marginBottom: '4px' }} />

        {/* ── DETALLE DE ÍTEMS ── */}
        {items.map((item, i) => (
          <div key={i} style={{ marginBottom: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
              <span style={{ flex: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.nombre}
              </span>
              <span style={{ flex: 1, textAlign: 'center' }}>{item.cantidad}</span>
              <span style={{ flex: 2, textAlign: 'right' }}>
                {Number(item.subtotal).toLocaleString('es-PY')}
              </span>
            </div>
            <div style={{ fontSize: '8px', color: '#444' }}>
              {Number(item.precioUnitario).toLocaleString('es-PY')} c/u
            </div>
          </div>
        ))}

        <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

        {/* ── TOTALES ── */}
        <div style={{ fontSize: '9px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Base Gravada (10%)</span>
            <span>Gs. {baseIVA10.toLocaleString('es-PY')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>IVA 10%</span>
            <span>Gs. {totalIVA10.toLocaleString('es-PY')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Exentas</span>
            <span>Gs. 0</span>
          </div>
        </div>

        <div style={{ borderTop: '2px solid #000', margin: '4px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px' }}>
          <span>TOTAL</span>
          <span>Gs. {Number(totalFactura).toLocaleString('es-PY')}</span>
        </div>

        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

        {/* ── CDC (Código de Control) ── */}
        {cdc && (
          <div style={{ marginBottom: '6px' }}>
            <div style={{ fontSize: '8px', textAlign: 'center', marginBottom: '3px' }}>
              CÓDIGO DE CONTROL (CDC)
            </div>
            <div style={{
              fontSize: '7px',
              fontFamily: 'monospace',
              wordBreak: 'break-all',
              textAlign: 'center',
              background: '#f0f0f0',
              padding: '3px',
              borderRadius: '2px'
            }}>
              {cdc}
            </div>
          </div>
        )}

        {/* ── CÓDIGO QR (KuDE) ── */}
        <div style={{ textAlign: 'center', marginBottom: '6px' }}>
          {/* Placeholder visual del QR — En producción usar <QRCode> con la librería qrcode.react */}
          <div style={{
            width: '90px', height: '90px',
            border: '2px solid #000',
            margin: '0 auto 4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '7px',
            textAlign: 'center',
            color: '#666',
            background: '#fff',
            padding: '4px'
          }}>
            {enlaceQR ? (
              // El QR real se renderiza en la versión con react-qr-code instalado
              // Por ahora mostramos la URL truncada como guía
              <span style={{ wordBreak: 'break-all', fontSize: '5.5px' }}>
                {enlaceQR.substring(0, 80)}...
              </span>
            ) : (
              <span>Código QR<br />SIFEN</span>
            )}
          </div>
          <div style={{ fontSize: '8px' }}>Escanee para verificar en e-Kuatia SET</div>
          <div style={{ fontSize: '8px', fontWeight: 'bold', marginTop: '2px' }}>
            Estado: {estadoSifen}
          </div>
        </div>

        <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

        {/* ── PIE ── */}
        <div style={{ textAlign: 'center', fontSize: '9px', marginTop: '4px' }}>
          <div>¡Gracias por su preferencia!</div>
          <div style={{ fontSize: '7px', color: '#666', marginTop: '4px' }}>
            Powered by ANGLEX Software · e-Kuatia Paraguay
          </div>
        </div>
      </div>
    </>
  );
});

TicketFactura.displayName = 'TicketFactura';

export default TicketFactura;
