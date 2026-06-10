import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';

/**
 * GET /api/reportes/ventas-mesa
 *   ?desde=YYYY-MM-DD   (default: hoy)
 *   &hasta=YYYY-MM-DD   (default: hoy)
 *
 * Reporte de rendimiento por mesa.
 *
 * Devuelve todas las mesas (incluso las que no tuvieron ventas), con:
 *   - cheques (cantidad de facturas)
 *   - ventas totales (Gs.)
 *   - ticket promedio
 *   - rotación diaria (cheques / días en rango)
 *   - venta por asiento (ventas / capacidad)
 *   - días con actividad
 *   - % del total
 *
 * Adicionalmente reporta las ventas presenciales (sin mesa) por separado
 * para que el manager tenga visibilidad completa del período.
 */
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

        // Días en el rango (inclusivo)
        const msPorDia = 24 * 60 * 60 * 1000;
        const diasEnRango = Math.round((new Date(hastaStr) - new Date(desdeStr)) / msPorDia) + 1;

        const pool = await getPool();

        // ── Query principal: TODAS las mesas con sus métricas ───────────
        // Se hace LEFT JOIN con una CTE que agrega facturas por mesa para
        // que las mesas sin actividad también aparezcan (con valores en 0).
        const result = await pool.request()
            .input('desde', sql.DateTime2, desde)
            .input('hasta', sql.DateTime2, hasta)
            .query(`
        WITH MesasConVentas AS (
          SELECT
            p.MesaId,
            COUNT(f.Id)                                    AS Cheques,
            SUM(f.Total)                                   AS Ventas,
            COUNT(DISTINCT CAST(f.FechaEmision AS DATE))   AS DiasConActividad,
            MAX(f.FechaEmision)                            AS UltimaVenta
          FROM Facturas f
          INNER JOIN Pedidos p ON f.PedidoId = p.Id
          WHERE f.FechaEmision >= @desde
            AND f.FechaEmision <= @hasta
            AND p.MesaId IS NOT NULL
          GROUP BY p.MesaId
        )
        SELECT
          m.Id              AS MesaId,
          m.Numero,
          m.Capacidad,
          ISNULL(mcv.Cheques, 0)          AS Cheques,
          ISNULL(mcv.Ventas, 0)           AS Ventas,
          ISNULL(mcv.DiasConActividad, 0) AS DiasConActividad,
          mcv.UltimaVenta
        FROM Mesas m
        LEFT JOIN MesasConVentas mcv ON m.Id = mcv.MesaId
        ORDER BY Ventas DESC, m.Numero ASC
      `);

        // ── Ventas presenciales (MesaId NULL) — info aparte ────────────
        const presencialRes = await pool.request()
            .input('desde', sql.DateTime2, desde)
            .input('hasta', sql.DateTime2, hasta)
            .query(`
        SELECT
          COUNT(f.Id)  AS Cheques,
          ISNULL(SUM(f.Total), 0) AS Ventas
        FROM Facturas f
        INNER JOIN Pedidos p ON f.PedidoId = p.Id
        WHERE f.FechaEmision >= @desde
          AND f.FechaEmision <= @hasta
          AND p.MesaId IS NULL
      `);

        const presencial = {
            cheques: Number(presencialRes.recordset[0]?.Cheques) || 0,
            ventas: Math.round(Number(presencialRes.recordset[0]?.Ventas) || 0),
        };

        const filas = result.recordset.map(r => {
            const ventas = Number(r.Ventas) || 0;
            const cheques = Number(r.Cheques) || 0;
            const capacidad = Number(r.Capacidad) || 0;
            const diasActividad = Number(r.DiasConActividad) || 0;

            const ticketPromedio = cheques > 0 ? Math.round(ventas / cheques) : 0;
            const rotacionPorDia = diasEnRango > 0 ? Math.round((cheques / diasEnRango) * 100) / 100 : 0;
            const ventaPorAsiento = capacidad > 0 ? Math.round(ventas / capacidad) : 0;

            return {
                mesaId: r.MesaId,
                numero: r.Numero,
                capacidad,
                cheques,
                ventas: Math.round(ventas),
                ticketPromedio,
                rotacionPorDia,
                ventaPorAsiento,
                diasConActividad: diasActividad,
                ultimaVenta: r.UltimaVenta,
                tieneActividad: cheques > 0,
            };
        });

        // ── Totales y porcentajes ──────────────────────────────────────
        const totalVentas = filas.reduce((s, f) => s + f.ventas, 0);
        const totalCheques = filas.reduce((s, f) => s + f.cheques, 0);
        const capacidadSalon = filas.reduce((s, f) => s + f.capacidad, 0);
        const mesasConActividad = filas.filter(f => f.tieneActividad).length;

        const filasConPct = filas.map(f => ({
            ...f,
            pctDelTotal: totalVentas > 0
                ? Math.round((f.ventas / totalVentas) * 10000) / 100
                : 0,
        }));

        // ── Identificar mesa top y de mayor rotación ───────────────────
        let mesaTop = null;
        let mesaMasRotacion = null;
        for (const f of filasConPct) {
            if (f.ventas > 0 && (!mesaTop || f.ventas > mesaTop.ventas)) {
                mesaTop = { numero: f.numero, ventas: f.ventas, pct: f.pctDelTotal };
            }
            if (f.rotacionPorDia > 0 && (!mesaMasRotacion || f.rotacionPorDia > mesaMasRotacion.rotacion)) {
                mesaMasRotacion = { numero: f.numero, rotacion: f.rotacionPorDia, cheques: f.cheques };
            }
        }

        // ── Respuesta ───────────────────────────────────────────────────
        return NextResponse.json({
            filtros: { desde: desdeStr, hasta: hastaStr, diasEnRango },
            resumen: {
                totalVentas,
                totalCheques,
                cantidadMesas: filas.length,
                mesasConActividad,
                capacidadSalon,
                ticketPromedio: totalCheques > 0 ? Math.round(totalVentas / totalCheques) : 0,
                ventaPorAsientoGeneral: capacidadSalon > 0 ? Math.round(totalVentas / capacidadSalon) : 0,
                mesaTop,
                mesaMasRotacion,
                presencial,
            },
            mesas: filasConPct,
        });

    } catch (err) {
        console.error('Error GET /api/reportes/ventas-mesa:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}