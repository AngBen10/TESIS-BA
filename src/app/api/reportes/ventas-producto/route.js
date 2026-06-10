import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';

/**
 * GET /api/reportes/ventas-producto
 *   ?desde=YYYY-MM-DD            (default: hoy 00:00)
 *   &hasta=YYYY-MM-DD            (default: hoy 23:59:59)
 *   &categoriaId=N               (opcional, filtrar por categoría)
 *
 * Devuelve el reporte de ventas detallado por producto en el rango.
 *
 * Para cada producto: unidades vendidas, ingresos brutos, costo total
 * (snapshot al momento de la venta), margen en Gs. y %, participación
 * sobre el total del periodo.
 *
 * Fuente de datos:
 *   Facturas (rango de fechas)
 *     → Pedidos (PedidoId)
 *       → ItemsPedido (con CostoUnitario snapshot)
 *         → Productos / Categorias
 *
 * Esto cuenta solo VENTAS COBRADAS (facturadas), no pedidos abiertos.
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);

        // ── 1. Parsear filtros ─────────────────────────────────────────
        const today = new Date().toISOString().slice(0, 10);
        const desdeStr = searchParams.get('desde') || today;
        const hastaStr = searchParams.get('hasta') || today;
        const catParam = searchParams.get('categoriaId');
        const categoriaId = catParam ? parseInt(catParam) : null;

        // Validación básica de fechas
        const reFecha = /^\d{4}-\d{2}-\d{2}$/;
        if (!reFecha.test(desdeStr) || !reFecha.test(hastaStr)) {
            return NextResponse.json(
                { error: 'Formato de fecha inválido. Use YYYY-MM-DD.' },
                { status: 400 }
            );
        }

        // Rango inclusivo: desde 00:00:00.000 hasta 23:59:59.997
        const desde = new Date(`${desdeStr}T00:00:00`);
        const hasta = new Date(`${hastaStr}T23:59:59.997`);

        if (desde > hasta) {
            return NextResponse.json(
                { error: 'La fecha "desde" no puede ser mayor que "hasta".' },
                { status: 400 }
            );
        }

        const pool = await getPool();

        // ── 2. Query principal: agregado por producto ───────────────────
        const req = pool.request()
            .input('desde', sql.DateTime2, desde)
            .input('hasta', sql.DateTime2, hasta);

        let whereCategoria = '';
        if (categoriaId) {
            req.input('catId', sql.Int, categoriaId);
            whereCategoria = ' AND p.CategoriaId = @catId';
        }

        const result = await req.query(`
      SELECT
        p.Id              AS ProductoId,
        p.Codigo,
        p.Nombre          AS Producto,
        c.Nombre          AS Categoria,
        SUM(ip.Cantidad)                          AS UnidadesVendidas,
        SUM(ip.Cantidad * ip.PrecioUnitario)      AS Ingresos,
        SUM(ip.Cantidad * ip.CostoUnitario)       AS CostoTotal,
        -- Si CostoUnitario quedó en 0 para todas las líneas, marcamos
        -- el producto como "sin receta" para que el frontend lo señale.
        MAX(CASE WHEN ip.CostoUnitario > 0 THEN 1 ELSE 0 END) AS TieneCosto
      FROM Facturas f
      INNER JOIN Pedidos     ped ON f.PedidoId    = ped.Id
      INNER JOIN ItemsPedido ip  ON ip.PedidoId   = ped.Id
      INNER JOIN Productos   p   ON ip.ProductoId = p.Id
      LEFT  JOIN Categorias  c   ON p.CategoriaId = c.Id
      WHERE f.FechaEmision >= @desde
        AND f.FechaEmision <= @hasta
        ${whereCategoria}
      GROUP BY p.Id, p.Codigo, p.Nombre, c.Nombre
      ORDER BY Ingresos DESC
    `);

        const filas = result.recordset.map(r => {
            const ingresos = Number(r.Ingresos) || 0;
            const costoTotal = Number(r.CostoTotal) || 0;
            const unidades = Number(r.UnidadesVendidas) || 0;
            const margenGs = ingresos - costoTotal;
            const margenPct = ingresos > 0
                ? Math.round((margenGs / ingresos) * 10000) / 100
                : 0;
            const costoUnitProm = unidades > 0
                ? Math.round((costoTotal / unidades) * 100) / 100
                : 0;
            const precioPromedio = unidades > 0
                ? Math.round((ingresos / unidades) * 100) / 100
                : 0;

            return {
                productoId: r.ProductoId,
                codigo: r.Codigo || '',
                producto: r.Producto,
                categoria: r.Categoria || 'Sin categoría',
                unidadesVendidas: unidades,
                precioPromedio,
                costoUnitarioPromedio: costoUnitProm,
                ingresos: Math.round(ingresos),
                costoTotal: Math.round(costoTotal),
                margenGs: Math.round(margenGs),
                margenPct,
                tieneCosto: r.TieneCosto === 1,
            };
        });

        // ── 3. Totales del periodo ──────────────────────────────────────
        const totalIngresos = filas.reduce((s, f) => s + f.ingresos, 0);
        const totalCosto = filas.reduce((s, f) => s + f.costoTotal, 0);
        const totalUnidades = filas.reduce((s, f) => s + f.unidadesVendidas, 0);
        const margenTotalGs = totalIngresos - totalCosto;
        const margenTotalPct = totalIngresos > 0
            ? Math.round((margenTotalGs / totalIngresos) * 10000) / 100
            : 0;

        // Agregar % de participación a cada fila (sobre ingresos totales)
        const filasConPct = filas.map(f => ({
            ...f,
            pctDelTotal: totalIngresos > 0
                ? Math.round((f.ingresos / totalIngresos) * 10000) / 100
                : 0,
        }));

        // ── 4. Cantidad de facturas en el periodo (para contexto) ───────
        const facReq = pool.request()
            .input('desde', sql.DateTime2, desde)
            .input('hasta', sql.DateTime2, hasta);
        const facturasRes = await facReq.query(`
      SELECT COUNT(*) AS Cant
      FROM Facturas
      WHERE FechaEmision >= @desde AND FechaEmision <= @hasta
    `);
        const cantidadFacturas = facturasRes.recordset[0]?.Cant || 0;

        return NextResponse.json({
            filtros: {
                desde: desdeStr,
                hasta: hastaStr,
                categoriaId,
            },
            resumen: {
                cantidadProductos: filasConPct.length,
                cantidadFacturas,
                totalUnidades,
                totalIngresos,
                totalCosto,
                margenTotalGs,
                margenTotalPct,
                ticketPromedio: cantidadFacturas > 0
                    ? Math.round(totalIngresos / cantidadFacturas)
                    : 0,
            },
            productos: filasConPct,
        });

    } catch (err) {
        console.error('Error GET /api/reportes/ventas-producto:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}