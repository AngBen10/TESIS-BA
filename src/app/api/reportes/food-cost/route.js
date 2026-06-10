import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';

/**
 * GET /api/reportes/food-cost
 *   ?desde=YYYY-MM-DD   (default: hoy)
 *   &hasta=YYYY-MM-DD   (default: hoy)
 *
 * Reporte de FOOD COST TEÓRICO (basado en recetas y costos snapshot).
 *
 * Calcula el % de las ventas que se va en costo de insumos según las
 * recetas cargadas en el módulo de Escandallo. NO incluye merma real,
 * robo, ni errores de porcionado — eso requiere comparar contra
 * inventario físico (Food Cost Real).
 *
 * Fórmula:
 *   Food Cost % = (Σ Cantidad × CostoUnitario) / (Σ Cantidad × PrecioUnitario) × 100
 *
 * Devuelve:
 *   - resumen: KPIs globales con clasificación (excelente/normal/alerta/crítico)
 *   - porCategoria: food cost por categoría de menú
 *   - peorMargen / mejorMargen: top productos según FC%
 *   - evolucionDiaria: serie temporal del FC%
 *
 * Umbrales típicos de la industria restaurantera:
 *   ≤ 28%   excelente
 *   28-35%  normal
 *   35-40%  alerta
 *   > 40%   crítico
 */

function clasificar(pct) {
    if (pct === 0) return 'sin_datos';
    if (pct <= 28) return 'excelente';
    if (pct <= 35) return 'normal';
    if (pct <= 40) return 'alerta';
    return 'critico';
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);

        const today = new Date().toISOString().slice(0, 10);
        const desdeStr = searchParams.get('desde') || today;
        const hastaStr = searchParams.get('hasta') || today;

        const reFecha = /^\d{4}-\d{2}-\d{2}$/;
        if (!reFecha.test(desdeStr) || !reFecha.test(hastaStr)) {
            return NextResponse.json({ error: 'Formato de fecha inválido. Use YYYY-MM-DD.' }, { status: 400 });
        }

        const desde = new Date(`${desdeStr}T00:00:00`);
        const hasta = new Date(`${hastaStr}T23:59:59.997`);

        if (desde > hasta) {
            return NextResponse.json({ error: 'La fecha "desde" no puede ser mayor que "hasta".' }, { status: 400 });
        }

        const pool = await getPool();

        // ── Query 1: agregado por producto (para top peor/mejor) ────────
        const productosRes = await pool.request()
            .input('desde', sql.DateTime2, desde)
            .input('hasta', sql.DateTime2, hasta)
            .query(`
        SELECT
          p.Id                                          AS ProductoId,
          p.Nombre                                      AS Producto,
          ISNULL(c.Nombre, 'Sin categoría')             AS Categoria,
          SUM(ip.Cantidad)                              AS Unidades,
          SUM(ip.Cantidad * ip.PrecioUnitario)          AS Ingresos,
          SUM(ip.Cantidad * ip.CostoUnitario)           AS Costo,
          MAX(CASE WHEN ip.CostoUnitario > 0 THEN 1 ELSE 0 END) AS TieneCosto
        FROM Facturas f
        INNER JOIN Pedidos    pe ON f.PedidoId    = pe.Id
        INNER JOIN ItemsPedido ip ON ip.PedidoId   = pe.Id
        INNER JOIN Productos  p  ON ip.ProductoId = p.Id
        LEFT  JOIN Categorias c  ON p.CategoriaId = c.Id
        WHERE f.FechaEmision >= @desde
          AND f.FechaEmision <= @hasta
        GROUP BY p.Id, p.Nombre, c.Nombre
      `);

        // ── Query 2: agregado por categoría ─────────────────────────────
        const categoriasRes = await pool.request()
            .input('desde', sql.DateTime2, desde)
            .input('hasta', sql.DateTime2, hasta)
            .query(`
        SELECT
          ISNULL(c.Id, 0)                       AS CategoriaId,
          ISNULL(c.Nombre, 'Sin categoría')     AS Categoria,
          SUM(ip.Cantidad * ip.PrecioUnitario)  AS Ingresos,
          SUM(ip.Cantidad * ip.CostoUnitario)   AS Costo,
          COUNT(DISTINCT p.Id)                  AS Productos
        FROM Facturas f
        INNER JOIN Pedidos    pe ON f.PedidoId    = pe.Id
        INNER JOIN ItemsPedido ip ON ip.PedidoId   = pe.Id
        INNER JOIN Productos  p  ON ip.ProductoId = p.Id
        LEFT  JOIN Categorias c  ON p.CategoriaId = c.Id
        WHERE f.FechaEmision >= @desde
          AND f.FechaEmision <= @hasta
        GROUP BY c.Id, c.Nombre
        ORDER BY Ingresos DESC
      `);

        // ── Query 3: evolución diaria ───────────────────────────────────
        const evolucionRes = await pool.request()
            .input('desde', sql.DateTime2, desde)
            .input('hasta', sql.DateTime2, hasta)
            .query(`
        SELECT
          CAST(f.FechaEmision AS DATE)          AS Fecha,
          SUM(ip.Cantidad * ip.PrecioUnitario)  AS Ingresos,
          SUM(ip.Cantidad * ip.CostoUnitario)   AS Costo
        FROM Facturas f
        INNER JOIN Pedidos    pe ON f.PedidoId  = pe.Id
        INNER JOIN ItemsPedido ip ON ip.PedidoId = pe.Id
        WHERE f.FechaEmision >= @desde
          AND f.FechaEmision <= @hasta
        GROUP BY CAST(f.FechaEmision AS DATE)
        ORDER BY Fecha ASC
      `);

        // ── Procesar productos ──────────────────────────────────────────
        const productos = productosRes.recordset.map(r => {
            const ingresos = Number(r.Ingresos) || 0;
            const costo = Number(r.Costo) || 0;
            const margenGs = ingresos - costo;
            const foodCostPct = ingresos > 0 && costo > 0
                ? Math.round((costo / ingresos) * 10000) / 100
                : 0;
            return {
                productoId: r.ProductoId,
                producto: r.Producto,
                categoria: r.Categoria,
                unidades: Number(r.Unidades) || 0,
                ingresos: Math.round(ingresos),
                costo: Math.round(costo),
                margenGs: Math.round(margenGs),
                foodCostPct,
                tieneCosto: r.TieneCosto === 1,
            };
        });

        // ── Totales globales ────────────────────────────────────────────
        const totalIngresos = productos.reduce((s, p) => s + p.ingresos, 0);
        const totalCosto = productos.reduce((s, p) => s + p.costo, 0);
        const margenGs = totalIngresos - totalCosto;
        const foodCostPct = totalIngresos > 0
            ? Math.round((totalCosto / totalIngresos) * 10000) / 100
            : 0;
        const margenPct = totalIngresos > 0
            ? Math.round(((totalIngresos - totalCosto) / totalIngresos) * 10000) / 100
            : 0;

        // ── Productos sin receta (afectan al cálculo) ───────────────────
        const sinReceta = productos.filter(p => !p.tieneCosto);
        const ingresosSinReceta = sinReceta.reduce((s, p) => s + p.ingresos, 0);
        const pctSinReceta = totalIngresos > 0
            ? Math.round((ingresosSinReceta / totalIngresos) * 10000) / 100
            : 0;

        // Para "peor margen" y "mejor margen" EXCLUIMOS los sin receta
        const productosConReceta = productos.filter(p => p.tieneCosto);

        const peorMargen = [...productosConReceta]
            .sort((a, b) => b.foodCostPct - a.foodCostPct)
            .slice(0, 10);

        const mejorMargen = [...productosConReceta]
            .sort((a, b) => a.foodCostPct - b.foodCostPct)
            .slice(0, 10);

        // ── Procesar categorías ─────────────────────────────────────────
        const porCategoria = categoriasRes.recordset.map(r => {
            const ingresos = Number(r.Ingresos) || 0;
            const costo = Number(r.Costo) || 0;
            const fc = ingresos > 0 && costo > 0
                ? Math.round((costo / ingresos) * 10000) / 100
                : 0;
            return {
                categoriaId: r.CategoriaId,
                categoria: r.Categoria,
                productos: Number(r.Productos) || 0,
                ingresos: Math.round(ingresos),
                costo: Math.round(costo),
                margenGs: Math.round(ingresos - costo),
                foodCostPct: fc,
                clasificacion: clasificar(fc),
                pctDelTotal: totalIngresos > 0
                    ? Math.round((ingresos / totalIngresos) * 10000) / 100
                    : 0,
            };
        });

        // ── Procesar evolución diaria ───────────────────────────────────
        const msPorDia = 24 * 60 * 60 * 1000;
        const diasEnRango = Math.round((new Date(hastaStr) - new Date(desdeStr)) / msPorDia) + 1;

        const evolucionMap = new Map();
        {
            const d = new Date(`${desdeStr}T12:00:00`);
            const fin = new Date(`${hastaStr}T12:00:00`);
            while (d <= fin) {
                const k = d.toISOString().slice(0, 10);
                evolucionMap.set(k, { fecha: k, ingresos: 0, costo: 0, foodCostPct: 0 });
                d.setDate(d.getDate() + 1);
            }
        }

        for (const r of evolucionRes.recordset) {
            const fecha = r.Fecha instanceof Date
                ? r.Fecha.toISOString().slice(0, 10)
                : new Date(r.Fecha).toISOString().slice(0, 10);
            const dia = evolucionMap.get(fecha);
            if (!dia) continue;
            const ing = Number(r.Ingresos) || 0;
            const cos = Number(r.Costo) || 0;
            dia.ingresos = Math.round(ing);
            dia.costo = Math.round(cos);
            dia.foodCostPct = ing > 0 && cos > 0
                ? Math.round((cos / ing) * 10000) / 100
                : 0;
        }

        const evolucionDiaria = Array.from(evolucionMap.values());

        return NextResponse.json({
            filtros: { desde: desdeStr, hasta: hastaStr, diasEnRango },
            resumen: {
                totalIngresos,
                totalCosto,
                margenGs,
                foodCostPct,
                margenPct,
                clasificacion: clasificar(foodCostPct),
                cantidadProductos: productos.length,
                sinReceta: {
                    cantidad: sinReceta.length,
                    ingresos: Math.round(ingresosSinReceta),
                    pctDelTotal: pctSinReceta,
                },
            },
            porCategoria,
            peorMargen,
            mejorMargen,
            evolucionDiaria,
        });

    } catch (err) {
        console.error('Error GET /api/reportes/food-cost:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}