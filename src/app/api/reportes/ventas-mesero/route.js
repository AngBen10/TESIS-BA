import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';

/**
 * GET /api/reportes/ventas-mesero
 *   ?desde=YYYY-MM-DD   (default: hoy)
 *   &hasta=YYYY-MM-DD   (default: hoy)
 *
 * Reporte de productividad por mesero/cajero.
 *
 * Para cada usuario que cerró ventas en el rango:
 *   - cheques (cantidad de facturas asociadas a pedidos donde es el mesero)
 *   - ventas totales (Gs.)
 *   - ticket promedio
 *   - mesas distintas atendidas
 *   - unidades vendidas
 *   - % del total del periodo
 *
 * Fuente: Facturas ⇒ Pedidos (MeseroId) ⇒ Usuarios.
 *
 * IMPORTANTE — datos históricos:
 *   Pedidos creados antes del fix del flujo tienen MeseroId = cajero.
 *   Esos van a seguir apareciendo en el reporte atribuidos al cajero,
 *   no al mesero real. Esta condición no se puede revertir sin más info.
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

        const pool = await getPool();

        // ── Query principal: agregado por mesero ────────────────────────
        // Necesitamos:
        //   - SUM(Facturas.Total)            → ventas
        //   - COUNT(Facturas.Id)             → cheques
        //   - COUNT(DISTINCT Pedidos.MesaId) → mesas (excluye NULL = presenciales)
        //   - SUM(ItemsPedido.Cantidad)      → unidades vendidas
        //
        // El COUNT de mesas usa una subquery porque sino se duplicaría
        // al hacer JOIN con ItemsPedido.
        const result = await pool.request()
            .input('desde', sql.DateTime2, desde)
            .input('hasta', sql.DateTime2, hasta)
            .query(`
        WITH FacturasPorMesero AS (
          SELECT
            p.MeseroId,
            f.Id AS FacturaId,
            f.Total AS FacturaTotal,
            p.MesaId,
            p.Id AS PedidoId
          FROM Facturas f
          INNER JOIN Pedidos p ON f.PedidoId = p.Id
          WHERE f.FechaEmision >= @desde
            AND f.FechaEmision <= @hasta
        ),
        UnidadesPorMesero AS (
          SELECT
            p.MeseroId,
            SUM(ip.Cantidad) AS Unidades
          FROM Facturas f
          INNER JOIN Pedidos p ON f.PedidoId = p.Id
          INNER JOIN ItemsPedido ip ON ip.PedidoId = p.Id
          WHERE f.FechaEmision >= @desde
            AND f.FechaEmision <= @hasta
          GROUP BY p.MeseroId
        )
        SELECT
          fpm.MeseroId,
          u.Usuario,
          u.NombreCompleto,
          r.Nombre AS RoleNombre,
          COUNT(fpm.FacturaId)                       AS Cheques,
          SUM(fpm.FacturaTotal)                      AS Ventas,
          COUNT(DISTINCT fpm.MesaId)                 AS MesasAtendidas,
          ISNULL(MAX(upm.Unidades), 0)               AS UnidadesVendidas
        FROM FacturasPorMesero fpm
        LEFT JOIN Usuarios u ON fpm.MeseroId = u.Id
        LEFT JOIN Roles    r ON u.RoleId    = r.Id
        LEFT JOIN UnidadesPorMesero upm ON upm.MeseroId = fpm.MeseroId
        GROUP BY fpm.MeseroId, u.Usuario, u.NombreCompleto, r.Nombre
        ORDER BY Ventas DESC
      `);

        const filas = result.recordset.map(r => {
            const ventas = Number(r.Ventas) || 0;
            const cheques = Number(r.Cheques) || 0;
            const mesas = Number(r.MesasAtendidas) || 0;
            const ticketPromedio = cheques > 0 ? Math.round(ventas / cheques) : 0;

            return {
                meseroId: r.MeseroId,
                usuario: r.Usuario || `Usuario #${r.MeseroId}`,
                nombre: r.NombreCompleto || r.Usuario || `Usuario #${r.MeseroId}`,
                rol: r.RoleNombre || 'Desconocido',
                cheques,
                ventas: Math.round(ventas),
                ticketPromedio,
                mesasAtendidas: mesas,
                unidadesVendidas: Number(r.UnidadesVendidas) || 0,
            };
        });

        // ── Totales y porcentajes ──────────────────────────────────────
        const totalVentas = filas.reduce((s, f) => s + f.ventas, 0);
        const totalCheques = filas.reduce((s, f) => s + f.cheques, 0);
        const totalMesas = filas.reduce((s, f) => s + f.mesasAtendidas, 0);
        const totalUnidades = filas.reduce((s, f) => s + f.unidadesVendidas, 0);

        const filasConPct = filas.map(f => ({
            ...f,
            pctDelTotal: totalVentas > 0
                ? Math.round((f.ventas / totalVentas) * 10000) / 100
                : 0,
        }));

        // ── Resumen ─────────────────────────────────────────────────────
        const ticketPromedioGeneral = totalCheques > 0 ? Math.round(totalVentas / totalCheques) : 0;
        const top = filasConPct[0] || null;

        return NextResponse.json({
            filtros: { desde: desdeStr, hasta: hastaStr },
            resumen: {
                totalVentas,
                totalCheques,
                totalMesas,
                totalUnidades,
                ticketPromedioGeneral,
                cantidadMeseros: filasConPct.length,
                topMesero: top
                    ? { nombre: top.nombre, ventas: top.ventas, pct: top.pctDelTotal }
                    : null,
            },
            meseros: filasConPct,
        });

    } catch (err) {
        console.error('Error GET /api/reportes/ventas-mesero:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}