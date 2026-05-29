import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';
import crypto from 'crypto';

// UTILS PARA SIFEN (Simplificado para restauración)
function generarCDC(params) {
  const tipoDoc = '01';
  const rucLimpio = params.rucEmisor.split('-')[0].padStart(8, '0');
  const dvEmisor = params.rucEmisor.split('-')[1] || '0';
  const est = params.establecimiento.padStart(3, '0');
  const pe = params.puntoExpedicion.padStart(3, '0');
  const secuencia = params.secuencia.padStart(7, '0');
  const fecha = params.fechaEmision.replace(/-/g, '').substring(0, 8);
  const codSeg = String(params.codigoSeguridad).padStart(9, '0');
  const base = `${tipoDoc}${rucLimpio}${dvEmisor}${est}${pe}${secuencia}2${fecha}1${codSeg}`;
  return base + "0"; // DV simplificado
}

export async function POST(request) {
  try {
    const { pedidoId, rucCliente, nombreCliente, metodoPago } = await request.json();
    const pool = await getPool();

    // 1. Obtener Config SIFEN
    const configRes = await pool.request().query("SELECT Clave, Valor FROM Configuracion WHERE Clave LIKE 'SIFEN_%'");
    const config = {};
    configRes.recordset.forEach(r => config[r.Clave] = r.Valor);

    // 2. Consultar Pedido
    const pedidoRes = await pool.request().input('id', sql.Int, pedidoId).query('SELECT * FROM Pedidos WHERE Id = @id');
    if (pedidoRes.recordset.length === 0) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    const pedido = pedidoRes.recordset[0];

    const itemsRes = await pool.request().input('pid', sql.Int, pedidoId).query('SELECT * FROM ItemsPedido WHERE PedidoId = @pid');
    const total = itemsRes.recordset.reduce((s, i) => s + (i.PrecioUnitario * i.Cantidad), 0);

    // 3. Generar Número Factura
    const est = config.SIFEN_Establecimiento || '001';
    const pe = config.SIFEN_PuntoExpedicion || '001';
    const lastBill = await pool.request().query(`SELECT TOP 1 NumeroFactura FROM Facturas WHERE NumeroFactura LIKE '${est}-${pe}-%' ORDER BY Id DESC`);
    let sec = 1;
    if (lastBill.recordset.length > 0) {
      sec = parseInt(lastBill.recordset[0].NumeroFactura.split('-')[2]) + 1;
    }
    const nFactura = `${est}-${pe}-${String(sec).padStart(7, '0')}`;

    // 4. Lógica CDC (si aplica)
    let cdc = null;
    if (config.SIFEN_FacturadorElectronico !== '0') {
      cdc = generarCDC({
        rucEmisor: config.SIFEN_RUC,
        establecimiento: est,
        puntoExpedicion: pe,
        secuencia: String(sec),
        fechaEmision: new Date().toISOString(),
        codigoSeguridad: 123456789,
        timbrado: config.SIFEN_Timbrado
      });
    }

    // 5. Registrar Factura y cerrar pedido
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const requestTx = new sql.Request(transaction);
      await requestTx
        .input('pid', sql.Int, pedidoId)
        .input('tot', sql.Decimal(18,2), total)
        .input('nfact', sql.NVarChar(50), nFactura)
        .input('cdc', sql.NVarChar(44), cdc)
        .input('nom', sql.NVarChar(150), nombreCliente || 'Consumidor Final')
        .input('ruc', sql.NVarChar(50), rucCliente || 'X')
        .query(`
          INSERT INTO Facturas (PedidoId, Total, NumeroFactura, CDC, NombreCliente, RUCCliente, FechaEmision, EstadoSIFEN)
          VALUES (@pid, @tot, @nfact, @cdc, @nom, @ruc, GETDATE(), 'Aprobado');
          UPDATE Pedidos SET Estado = 'Cerrado' WHERE Id = @pid;
        `);
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    return NextResponse.json({ success: true, numeroFactura: nFactura, cdc });
  } catch (err) {
    return NextResponse.json({ error: 'Error al emitir: ' + err.message }, { status: 500 });
  }
}