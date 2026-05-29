import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';

export async function GET() {
  try {
    const pool = await getPool();

    // ── 1. Ventas de HOY ──
    const ventasHoyRes = await pool.request().query(`
      SELECT 
        ISNULL(SUM(Total), 0) AS VentasHoy,
        COUNT(*) AS FacturasHoy,
        ISNULL(AVG(Total), 0) AS TicketPromedio
      FROM Facturas
      WHERE CAST(FechaEmision AS DATE) = CAST(GETDATE() AS DATE)
    `);
    const { VentasHoy, FacturasHoy, TicketPromedio } = ventasHoyRes.recordset[0];

    // ── 2. Ventas de AYER (para comparación) ──
    const ventasAyerRes = await pool.request().query(`
      SELECT ISNULL(SUM(Total), 0) AS VentasAyer
      FROM Facturas
      WHERE CAST(FechaEmision AS DATE) = CAST(DATEADD(DAY, -1, GETDATE()) AS DATE)
    `);
    const VentasAyer = ventasAyerRes.recordset[0].VentasAyer;

    // ── 3. Ventas SEMANALES (últimos 7 días) ──
    const ventasSemanaRes = await pool.request().query(`
      SELECT 
        CAST(FechaEmision AS DATE) AS Fecha,
        ISNULL(SUM(Total), 0) AS Total,
        COUNT(*) AS Cantidad
      FROM Facturas
      WHERE FechaEmision >= DATEADD(DAY, -6, CAST(GETDATE() AS DATE))
      GROUP BY CAST(FechaEmision AS DATE)
      ORDER BY Fecha ASC
    `);

    // Fill in missing days with 0
    const ventasSemana = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const found = ventasSemanaRes.recordset.find(
        r => new Date(r.Fecha).toISOString().split('T')[0] === dateStr
      );
      ventasSemana.push({
        fecha: dateStr,
        diaNombre: d.toLocaleDateString('es-ES', { weekday: 'short' }),
        total: found ? Number(found.Total) : 0,
        cantidad: found ? found.Cantidad : 0,
      });
    }

    // ── 4. Ventas del MES ──
    const ventasMesRes = await pool.request().query(`
      SELECT ISNULL(SUM(Total), 0) AS VentasMes, COUNT(*) AS FacturasMes
      FROM Facturas
      WHERE MONTH(FechaEmision) = MONTH(GETDATE()) AND YEAR(FechaEmision) = YEAR(GETDATE())
    `);
    const { VentasMes, FacturasMes } = ventasMesRes.recordset[0];

    // ── 5. Productos MÁS VENDIDOS (top 5) ──
    const topProductosRes = await pool.request().query(`
      SELECT TOP 5
        p.Nombre,
        SUM(ip.Cantidad) AS CantidadVendida,
        SUM(ip.Cantidad * ip.PrecioUnitario) AS TotalVendido
      FROM ItemsPedido ip
      INNER JOIN Productos p ON ip.ProductoId = p.Id
      INNER JOIN Pedidos ped ON ip.PedidoId = ped.Id
      WHERE ped.Estado = 'Cerrado'
      GROUP BY p.Nombre
      ORDER BY CantidadVendida DESC
    `);

    // ── 6. Ventas por CATEGORÍA ──
    const ventasCatRes = await pool.request().query(`
      SELECT 
        c.Nombre AS Categoria,
        SUM(ip.Cantidad * ip.PrecioUnitario) AS Total,
        SUM(ip.Cantidad) AS Cantidad
      FROM ItemsPedido ip
      INNER JOIN Productos p ON ip.ProductoId = p.Id
      INNER JOIN Categorias c ON p.CategoriaId = c.Id
      INNER JOIN Pedidos ped ON ip.PedidoId = ped.Id
      WHERE ped.Estado = 'Cerrado'
      GROUP BY c.Nombre
      ORDER BY Total DESC
    `);

    const totalCategorias = ventasCatRes.recordset.reduce((s, r) => s + Number(r.Total), 0);
    const ventasPorCategoria = ventasCatRes.recordset.map(r => ({
      categoria: r.Categoria,
      total: Number(r.Total),
      cantidad: r.Cantidad,
      porcentaje: totalCategorias > 0 ? Math.round((Number(r.Total) / totalCategorias) * 100) : 0,
    }));

    // ── 7. Ventas por MÉTODO DE PAGO ──
    const metodosPagoRes = await pool.request().query(`
      SELECT 
        ISNULL(MetodoPago, 'Sin especificar') AS Metodo,
        SUM(Total) AS Total,
        COUNT(*) AS Cantidad
      FROM Facturas
      WHERE CAST(FechaEmision AS DATE) = CAST(GETDATE() AS DATE)
      GROUP BY MetodoPago
    `);

    // ── 8. Distribución HORARIA del día ──
    const horariaRes = await pool.request().query(`
      SELECT 
        DATEPART(HOUR, FechaEmision) AS Hora,
        COUNT(*) AS Cantidad,
        ISNULL(SUM(Total), 0) AS Total
      FROM Facturas
      WHERE CAST(FechaEmision AS DATE) = CAST(GETDATE() AS DATE)
      GROUP BY DATEPART(HOUR, FechaEmision)
      ORDER BY Hora
    `);

    // Fill all 24 hours
    const distribucionHoraria = [];
    for (let h = 0; h < 24; h++) {
      const found = horariaRes.recordset.find(r => r.Hora === h);
      distribucionHoraria.push({
        hora: h,
        cantidad: found ? found.Cantidad : 0,
        total: found ? Number(found.Total) : 0,
      });
    }

    // ── 9. Últimas 10 FACTURAS ──
    const ultimasFacturasRes = await pool.request().query(`
      SELECT TOP 10
        f.Id,
        f.NumeroFactura,
        f.NombreCliente,
        f.RUCCliente,
        f.Total,
        f.MetodoPago,
        f.FechaEmision,
        f.EstadoSIFEN,
        f.CDC
      FROM Facturas f
      ORDER BY f.FechaEmision DESC
    `);

    // ── 10. Productos con STOCK BAJO ──
    const stockBajoRes = await pool.request().query(`
      SELECT 
        p.Id, p.Nombre, p.StockActual, p.StockMinimo,
        c.Nombre AS Categoria
      FROM Productos p
      LEFT JOIN Categorias c ON p.CategoriaId = c.Id
      WHERE p.Activo = 1 
        AND p.StockActual <= p.StockMinimo
      ORDER BY p.StockActual ASC
    `);

    // ── 11. Conteos rápidos ──
    const pedidosActivosRes = await pool.request().query(`
      SELECT COUNT(*) AS Total FROM Pedidos WHERE Estado = 'Abierto'
    `);

    // Porcentaje de cambio vs ayer
    let porcentajeCambio = 0;
    if (VentasAyer > 0) {
      porcentajeCambio = ((VentasHoy - VentasAyer) / VentasAyer * 100).toFixed(1);
    } else if (VentasHoy > 0) {
      porcentajeCambio = 100;
    }

    return NextResponse.json({
      ventasHoy: Number(VentasHoy),
      ventasAyer: Number(VentasAyer),
      porcentajeCambio: Number(porcentajeCambio),
      facturasHoy: FacturasHoy,
      ticketPromedio: Math.round(Number(TicketPromedio)),
      ventasMes: Number(VentasMes),
      facturasMes: FacturasMes,
      ventasSemana,
      topProductos: topProductosRes.recordset.map(r => ({
        nombre: r.Nombre,
        cantidadVendida: r.CantidadVendida,
        totalVendido: Number(r.TotalVendido),
      })),
      ventasPorCategoria,
      metodosPago: metodosPagoRes.recordset.map(r => ({
        metodo: r.Metodo,
        total: Number(r.Total),
        cantidad: r.Cantidad,
      })),
      distribucionHoraria,
      ultimasFacturas: ultimasFacturasRes.recordset.map(r => ({
        id: r.Id,
        numero: r.NumeroFactura,
        cliente: r.NombreCliente,
        ruc: r.RUCCliente,
        total: Number(r.Total),
        metodo: r.MetodoPago,
        fecha: r.FechaEmision,
        estadoSifen: r.EstadoSIFEN,
        cdc: r.CDC,
      })),
      stockBajo: stockBajoRes.recordset.map(r => ({
        id: r.Id,
        nombre: r.Nombre,
        stockActual: r.StockActual,
        stockMinimo: r.StockMinimo,
        categoria: r.Categoria,
      })),
      pedidosActivosBD: pedidosActivosRes.recordset[0].Total,
    });

  } catch (err) {
    console.error('Error en /api/reportes:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
