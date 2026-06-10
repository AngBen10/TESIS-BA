import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';

// GET /api/pedidos — listar pedidos abiertos
export async function GET() {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT p.Id, p.Estado, p.FechaCreacion, p.Total,
             m.Numero AS MesaNumero
      FROM Pedidos p
      LEFT JOIN Mesas m ON p.MesaId = m.Id
      WHERE p.Estado = 'Abierto'
      ORDER BY p.FechaCreacion ASC
    `);
    return NextResponse.json({ pedidos: r.recordset });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/pedidos — crear pedido presencial o de mesa con sus ítems
//
// CAMBIOS:
//   - meseroId: ahora se acepta del payload. El cajero deja de "ser" el mesero.
//     Fallback en cadena: meseroId del payload → cajeroId → 1 (legacy).
//   - CostoUnitario: cada ítem se inserta con su snapshot vía fn_CostoProducto.
export async function POST(request) {
  try {
    const { tipo, cajeroId, meseroId, items, mesaNumero } = await request.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'El pedido no tiene ítems.' }, { status: 400 });
    }

    const pool = await getPool();
    const total = items.reduce((s, i) => s + (i.precioUnitario * i.cantidad), 0);

    // Resolver MesaId si mesaNumero está provisto
    let mesaId = null;
    if (mesaNumero) {
      const mesaRes = await pool.request()
        .input('mesaNum', sql.Int, mesaNumero)
        .query('SELECT Id FROM Mesas WHERE Numero = @mesaNum');
      if (mesaRes.recordset.length > 0) {
        mesaId = mesaRes.recordset[0].Id;
      }
    }

    // El mesero real (del payload) tiene prioridad sobre el cajero.
    // Para ventas presenciales, normalmente meseroId === cajeroId.
    const efectivoMeseroId = meseroId || cajeroId || 1;

    // Insertar pedido
    const pedRes = await pool.request()
      .input('mesaId', sql.Int, mesaId)
      .input('meseroId', sql.Int, efectivoMeseroId)
      .input('total', sql.Decimal(18, 2), total)
      .input('estado', sql.NVarChar(50), 'Abierto')
      .query(`
        INSERT INTO Pedidos (MesaId, MeseroId, Total, Estado, FechaCreacion)
        VALUES (@mesaId, @meseroId, @total, @estado, GETDATE());
        SELECT SCOPE_IDENTITY() AS PedidoId;
      `);

    const pedidoId = pedRes.recordset[0].PedidoId;

    // Insertar ítems CON snapshot de costo (vía fn_CostoProducto)
    for (const item of items) {
      await pool.request()
        .input('pedidoId', sql.Int, pedidoId)
        .input('productoId', sql.Int, item.productoId)
        .input('cantidad', sql.Int, item.cantidad)
        .input('precioUnitario', sql.Decimal(18, 2), item.precioUnitario)
        .query(`
          INSERT INTO ItemsPedido
            (PedidoId, ProductoId, Cantidad, PrecioUnitario, CostoUnitario, EstadoItemId)
          VALUES
            (@pedidoId, @productoId, @cantidad, @precioUnitario,
             dbo.fn_CostoProducto(@productoId), 3)
        `);
    }

    return NextResponse.json({ pedidoId, total });
  } catch (err) {
    console.error('Error al crear pedido:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}