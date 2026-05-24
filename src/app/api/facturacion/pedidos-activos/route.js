import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';

/**
 * GET /api/facturacion/pedidos-activos
 * 
 * Devuelve todos los pedidos en estado 'Abierto' con sus ítems,
 * agrupados por mesa. Usado por la pantalla de caja para seleccionar
 * qué mesa/pedido cobrar.
 */
export async function GET() {
  try {
    const pool = await getPool();

    // Pedidos abiertos con datos de la mesa y mesero
    const pedidosResult = await pool.request().query(`
      SELECT
        p.Id            AS PedidoId,
        p.Estado,
        p.FechaCreacion,
        p.Total,
        m.Numero        AS MesaNumero,
        m.Id            AS MesaId,
        u.NombreCompleto AS Mesero
      FROM Pedidos p
      LEFT JOIN Mesas    m ON p.MesaId   = m.Id
      LEFT JOIN Usuarios u ON p.MeseroId = u.Id
      WHERE p.Estado = 'Abierto'
      ORDER BY p.FechaCreacion ASC
    `);

    if (pedidosResult.recordset.length === 0) {
      return NextResponse.json({ pedidos: [] });
    }

    const pedidoIds = pedidosResult.recordset.map(p => p.PedidoId);

    // Ítems de todos los pedidos abiertos en una sola consulta
    const itemsResult = await pool.request().query(`
      SELECT
        ip.PedidoId,
        ip.Id            AS ItemId,
        ip.Cantidad,
        ip.PrecioUnitario,
        ip.Observaciones,
        p.Nombre         AS Producto,
        p.Id             AS ProductoId
      FROM ItemsPedido ip
      JOIN Productos   p  ON ip.ProductoId = p.Id
      WHERE ip.PedidoId IN (${pedidoIds.join(',')})
      ORDER BY ip.Id ASC
    `);

    // Agrupar ítems por pedido
    const itemsMap = {};
    itemsResult.recordset.forEach(item => {
      if (!itemsMap[item.PedidoId]) itemsMap[item.PedidoId] = [];
      itemsMap[item.PedidoId].push({
        itemId:        item.ItemId,
        productoId:    item.ProductoId,
        nombre:        item.Producto,
        cantidad:      item.Cantidad,
        precioUnitario: item.PrecioUnitario,
        subtotal:      item.Cantidad * item.PrecioUnitario,
        observaciones: item.Observaciones
      });
    });

    // Construir respuesta enriquecida
    const pedidos = pedidosResult.recordset.map(p => {
      const items = itemsMap[p.PedidoId] || [];
      const total = items.reduce((s, i) => s + i.subtotal, 0);
      return {
        pedidoId:   p.PedidoId,
        mesaNumero: p.MesaNumero,
        mesaId:     p.MesaId,
        mesero:     p.Mesero,
        fechaCreacion: p.FechaCreacion,
        items,
        total
      };
    });

    return NextResponse.json({ pedidos });

  } catch (err) {
    console.error('Error al obtener pedidos activos para caja:', err);
    return NextResponse.json(
      { error: 'Error interno al obtener pedidos.', detalle: err.message },
      { status: 500 }
    );
  }
}
