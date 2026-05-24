import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getPool } from '@/lib/db';

/**
 * POST /api/facturacion/enviar-correo
 * 
 * Body esperado:
 * {
 *   emailCliente:  "cliente@ejemplo.com",
 *   numeroFactura: "001-001-0000001",
 *   cdc:           "44 dígitos...",
 *   enlaceQR:      "https://ekuatia...",
 *   nombreCliente: "Juan Pérez",
 *   totalFactura:  150000,
 *   items: [{ nombre, cantidad, precioUnitario, subtotal }],
 *   ticketHtml:    "<html>...</html>"   // opcional: HTML del ticket para adjuntar
 * }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      emailCliente,
      numeroFactura,
      cdc,
      enlaceQR,
      nombreCliente,
      totalFactura,
      items = [],
      ticketHtml
    } = body;

    if (!emailCliente || !numeroFactura) {
      return NextResponse.json(
        { error: 'Se requiere emailCliente y numeroFactura.' },
        { status: 400 }
      );
    }

    // Validar formato de email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCliente)) {
      return NextResponse.json(
        { error: 'El correo electrónico proporcionado no tiene un formato válido.' },
        { status: 400 }
      );
    }

    // ── Obtener configuración SMTP y datos del emisor desde la BD ──
    const pool = await getPool();
    const configResult = await pool.request().query(
      "SELECT Clave, Valor FROM Configuracion WHERE Clave LIKE 'SIFEN_%' OR Clave LIKE 'SMTP_%'"
    );
    const config = {};
    configResult.recordset.forEach(r => { config[r.Clave] = r.Valor; });

    const smtpHost  = config['SMTP_Host']     || process.env.SMTP_HOST     || 'smtp.gmail.com';
    const smtpPort  = parseInt(config['SMTP_Port']  || process.env.SMTP_PORT  || '587');
    const smtpUser  = config['SMTP_User']     || process.env.SMTP_USER     || '';
    const smtpPass  = config['SMTP_Password'] || process.env.SMTP_PASSWORD || '';
    const smtpFrom  = config['SMTP_From']     || smtpUser;

    if (!smtpUser || !smtpPass) {
      return NextResponse.json(
        { error: 'El servidor de correo SMTP no está configurado. Agrega SMTP_Host, SMTP_User y SMTP_Password en la tabla Configuracion o en .env.local.' },
        { status: 503 }
      );
    }

    // ── Armar transporter ──────────────────────────────────────────
    const transporter = nodemailer.createTransport({
      host:   smtpHost,
      port:   smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      },
      tls: { rejectUnauthorized: false }
    });

    // ── Generar tabla de ítems en HTML ──────────────────────────────
    const filasTotales = items.map(item => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #1e2633;">${item.nombre}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #1e2633;text-align:center;">${item.cantidad}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #1e2633;text-align:right;">
          Gs. ${Number(item.precioUnitario).toLocaleString('es-PY')}
        </td>
        <td style="padding:6px 8px;border-bottom:1px solid #1e2633;text-align:right;">
          Gs. ${Number(item.subtotal).toLocaleString('es-PY')}
        </td>
      </tr>
    `).join('');

    const razonSocialEmisor = config['SIFEN_RazonSocial'] || 'La Parada Bar';
    const rucEmisor         = config['SIFEN_RUC']         || '';
    const timbrado          = config['SIFEN_Timbrado']     || '';
    const direccion         = config['SIFEN_Direccion']    || '';

    const totalIVA10 = Math.round(totalFactura / 11);
    const baseIVA10  = totalFactura - totalIVA10;

    // ── Plantilla HTML del correo ───────────────────────────────────
    const htmlEmail = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Factura Electrónica ${numeroFactura}</title>
</head>
<body style="margin:0;padding:0;background:#0a0d14;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0d14;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#0d1117;border-radius:16px;overflow:hidden;border:1px solid #00D2BE22;">

        <!-- Cabecera -->
        <tr>
          <td style="background:linear-gradient(135deg,#008f82,#00D2BE);padding:28px 32px;">
            <table width="100%"><tr>
              <td>
                <div style="font-size:22px;font-weight:900;color:#000;letter-spacing:2px;">${razonSocialEmisor.toUpperCase()}</div>
                <div style="font-size:11px;color:rgba(0,0,0,0.6);margin-top:4px;">RUC: ${rucEmisor} · Timbrado: ${timbrado}</div>
                <div style="font-size:10px;color:rgba(0,0,0,0.5);margin-top:2px;">${direccion}</div>
              </td>
              <td align="right">
                <div style="font-size:11px;color:rgba(0,0,0,0.5);text-transform:uppercase;letter-spacing:1px;">FACTURA ELECTRÓNICA</div>
                <div style="font-size:20px;font-weight:900;color:#000;">${numeroFactura}</div>
              </td>
            </tr></table>
          </td>
        </tr>

        <!-- Datos del cliente -->
        <tr>
          <td style="padding:20px 32px;border-bottom:1px solid #1e2633;">
            <div style="font-size:11px;color:#5a6373;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">CLIENTE</div>
            <div style="font-size:15px;font-weight:700;color:#fff;">${nombreCliente || 'Consumidor Final'}</div>
            <div style="font-size:12px;color:#00D2BE;margin-top:2px;">${emailCliente}</div>
          </td>
        </tr>

        <!-- Detalle de ítems -->
        <tr>
          <td style="padding:20px 32px;">
            <div style="font-size:11px;color:#5a6373;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">DETALLE DE CONSUMO</div>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr style="background:#111827;">
                <th style="padding:8px;text-align:left;font-size:11px;color:#5a6373;font-weight:700;text-transform:uppercase;">Producto</th>
                <th style="padding:8px;text-align:center;font-size:11px;color:#5a6373;font-weight:700;text-transform:uppercase;">Cant.</th>
                <th style="padding:8px;text-align:right;font-size:11px;color:#5a6373;font-weight:700;text-transform:uppercase;">Precio</th>
                <th style="padding:8px;text-align:right;font-size:11px;color:#5a6373;font-weight:700;text-transform:uppercase;">Subtotal</th>
              </tr>
              ${filasTotales}
            </table>
          </td>
        </tr>

        <!-- Totales -->
        <tr>
          <td style="padding:16px 32px;background:#0a0d14;border-top:1px solid #1e2633;">
            <table width="100%">
              <tr>
                <td style="color:#5a6373;font-size:12px;padding:3px 0;">Base Gravada IVA 10%</td>
                <td align="right" style="color:#fff;font-size:12px;">Gs. ${baseIVA10.toLocaleString('es-PY')}</td>
              </tr>
              <tr>
                <td style="color:#5a6373;font-size:12px;padding:3px 0;">IVA 10%</td>
                <td align="right" style="color:#fff;font-size:12px;">Gs. ${totalIVA10.toLocaleString('es-PY')}</td>
              </tr>
              <tr>
                <td style="padding-top:10px;font-weight:900;font-size:15px;color:#00D2BE;">TOTAL</td>
                <td align="right" style="padding-top:10px;font-weight:900;font-size:20px;color:#00D2BE;">
                  Gs. ${Number(totalFactura).toLocaleString('es-PY')}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CDC y QR -->
        ${cdc ? `
        <tr>
          <td style="padding:20px 32px;background:#080b11;border-top:1px solid #1e2633;">
            <div style="font-size:10px;color:#5a6373;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">CÓDIGO DE CONTROL (CDC) — e-Kuatia SET</div>
            <div style="font-size:11px;color:#00D2BE;font-family:monospace;word-break:break-all;background:#0d1117;padding:10px;border-radius:8px;border:1px solid #00D2BE22;">${cdc}</div>
            ${enlaceQR ? `
            <div style="margin-top:12px;">
              <a href="${enlaceQR}" style="display:inline-block;background:linear-gradient(135deg,#008f82,#00D2BE);color:#000;font-weight:800;font-size:12px;padding:10px 20px;border-radius:8px;text-decoration:none;">
                🔍 Verificar en e-Kuatia (SET)
              </a>
            </div>` : ''}
          </td>
        </tr>` : ''}

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;text-align:center;border-top:1px solid #1e2633;">
            <div style="font-size:11px;color:#5a6373;">Gracias por su preferencia · ${razonSocialEmisor}</div>
            <div style="font-size:10px;color:#2a3040;margin-top:4px;">Powered by ANGLEX Software Solutions · Sistema e-Kuatia</div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // ── Adjuntos ──────────────────────────────────────────────────
    const attachments = [];
    if (ticketHtml) {
      attachments.push({
        filename: `Factura-${numeroFactura}.html`,
        content:  ticketHtml,
        contentType: 'text/html'
      });
    }

    // ── Envío ─────────────────────────────────────────────────────
    await transporter.sendMail({
      from:        `"${razonSocialEmisor}" <${smtpFrom}>`,
      to:          emailCliente,
      subject:     `✅ Factura Electrónica ${numeroFactura} — ${razonSocialEmisor}`,
      html:        htmlEmail,
      attachments
    });

    return NextResponse.json({
      success: true,
      message: `Factura enviada exitosamente a ${emailCliente}`
    });

  } catch (err) {
    console.error('Error al enviar correo de factura:', err);
    return NextResponse.json(
      { error: 'No se pudo enviar el correo.', detalle: err.message },
      { status: 500 }
    );
  }
}
