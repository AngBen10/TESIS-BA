const fs = require('fs');
const path = require('path');

// Cargar variables de entorno desde .env.local
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const [key, ...value] = trimmed.split('=');
      if (key && value) {
        process.env[key.trim()] = value.join('=').trim().replace(/^['"]|['"]$/g, '');
      }
    });
  }
} catch (e) {
  console.log('Error loading env');
}

const { getPool, sql } = require('c:/Columbia/TESIS-BA/src/lib/db.js');

async function test() {
  try {
    const pool = await getPool();
    console.log('--- Probando Conexión ---');
    
    // Consulta 1: Ventas hoy
    console.log('Probando Consulta 1 (Ventas Hoy)...');
    await pool.request().query(`
      SELECT 
        ISNULL(SUM(Total), 0) AS VentasHoy,
        COUNT(*) AS FacturasHoy,
        ISNULL(AVG(Total), 0) AS TicketPromedio
      FROM Facturas
      WHERE CAST(FechaEmision AS DATE) = CAST(GETDATE() AS DATE)
    `);
    
    // Consulta 2: Ventas ayer
    console.log('Probando Consulta 2 (Ventas Ayer)...');
    await pool.request().query(`
      SELECT ISNULL(SUM(Total), 0) AS VentasAyer
      FROM Facturas
      WHERE CAST(FechaEmision AS DATE) = CAST(DATEADD(DAY, -1, GETDATE()) AS DATE)
    `);

    // Consulta 3: Ventas semanales
    console.log('Probando Consulta 3 (Ventas Semanales)...');
    await pool.request().query(`
      SELECT 
        CAST(FechaEmision AS DATE) AS Fecha,
        ISNULL(SUM(Total), 0) AS Total,
        COUNT(*) AS Cantidad
      FROM Facturas
      WHERE FechaEmision >= DATEADD(DAY, -6, CAST(GETDATE() AS DATE))
      GROUP BY CAST(FechaEmision AS DATE)
      ORDER BY Fecha ASC
    `);

    // Consulta 4: Ventas mes
    console.log('Probando Consulta 4 (Ventas Mes)...');
    await pool.request().query(`
      SELECT ISNULL(SUM(Total), 0) AS VentasMes, COUNT(*) AS FacturasMes
      FROM Facturas
      WHERE MONTH(FechaEmision) = MONTH(GETDATE()) AND YEAR(FechaEmision) = YEAR(GETDATE())
    `);

    // Consulta 5: Top productos
    console.log('Probando Consulta 5 (Top Productos)...');
    await pool.request().query(`
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

    // Consulta 6: Ventas por categoría
    console.log('Probando Consulta 6 (Ventas Categoría)...');
    await pool.request().query(`
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

    // Consulta 7: Métodos pago
    console.log('Probando Consulta 7 (Métodos Pago)...');
    await pool.request().query(`
      SELECT 
        ISNULL(MetodoPago, 'Sin especificar') AS Metodo,
        SUM(Total) AS Total,
        COUNT(*) AS Cantidad
      FROM Facturas
      WHERE CAST(FechaEmision AS DATE) = CAST(GETDATE() AS DATE)
      GROUP BY MetodoPago
    `);

    // Consulta 8: Distribución horaria
    console.log('Probando Consulta 8 (Distribución Horaria)...');
    await pool.request().query(`
      SELECT 
        DATEPART(HOUR, FechaEmision) AS Hora,
        COUNT(*) AS Cantidad,
        ISNULL(SUM(Total), 0) AS Total
      FROM Facturas
      WHERE CAST(FechaEmision AS DATE) = CAST(GETDATE() AS DATE)
      GROUP BY DATEPART(HOUR, FechaEmision)
      ORDER BY Hora
    `);

    // Consulta 9: Últimas 10 facturas
    console.log('Probando Consulta 9 (Últimas 10 Facturas)...');
    await pool.request().query(`
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

    // Consulta 10: Stock bajo
    console.log('Probando Consulta 10 (Stock Bajo)...');
    await pool.request().query(`
      SELECT 
        p.Id, p.Nombre, p.StockActual, p.StockMinimo,
        c.Nombre AS Categoria
      FROM Productos p
      LEFT JOIN Categorias c ON p.CategoriaId = c.Id
      WHERE p.Activo = 1 
        AND p.StockActual <= p.StockMinimo
      ORDER BY p.StockActual ASC
    `);

    // Consulta 11: Pedidos activos
    console.log('Probando Consulta 11 (Pedidos Activos)...');
    await pool.request().query(`
      SELECT COUNT(*) AS Total FROM Pedidos WHERE Estado = 'Abierto'
    `);

    console.log('🎉 Todas las consultas del dashboard funcionaron perfectamente!');
    await sql.close();
  } catch (err) {
    console.error('❌ ERROR DETECTADO:', err.message);
    process.exit(1);
  }
}

test();
