import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';

/**
 * GET /api/reportes/metodo-pago
 *   ?desde=YYYY-MM-DD   (default: hoy)
 *   &hasta=YYYY-MM-DD   (default: hoy)
 *
 * Reporte de ventas desglosadas por método de pago.
 *
 * Devuelve:
 *   - resumen: KPIs generales, método dominante
 *   - porMetodo: agregado por método (cantidad, total, %, ticket promedio)
 *   - evolucionDiaria: para gráfico de barras apiladas por día
 *
 * IMPORTANTE:
 *   Facturas creadas antes del bugfix de la entrega 1 tienen MetodoPago = NULL.
 *   Acá las contamos como "Sin especificar" — el frontend muestra un banner
 *   explicativo cuando hay datos en esa categoría.
 */

const METODOS_ORDEN = ['Efectivo', 'Tarjeta', 'Transferencia', 'Sin especificar'];

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

        // ── Query 1: agregado por método ────────────────────────────────
        const porMetodoRes = await pool.request()
            .input('desde', sql.DateTime2, desde)
            .input('hasta', sql.DateTime2, hasta)
            .query(`
        SELECT
          ISNULL(MetodoPago, 'Sin especificar') AS Metodo,
          COUNT(*)                              AS Cheques,
          ISNULL(SUM(Total), 0)                 AS Ventas
        FROM Facturas
        WHERE FechaEmision >= @desde
          AND FechaEmision <= @hasta
        GROUP BY ISNULL(MetodoPago, 'Sin especificar')
      `);

        // ── Query 2: evolución por día + método ─────────────────────────
        const evolucionRes = await pool.request()
            .input('desde', sql.DateTime2, desde)
            .input('hasta', sql.DateTime2, hasta)
            .query(`
        SELECT
          CAST(FechaEmision AS DATE)            AS Fecha,
          ISNULL(MetodoPago, 'Sin especificar') AS Metodo,
          COUNT(*)                              AS Cheques,
          ISNULL(SUM(Total), 0)                 AS Ventas
        FROM Facturas
        WHERE FechaEmision >= @desde
          AND FechaEmision <= @hasta
        GROUP BY CAST(FechaEmision AS DATE), ISNULL(MetodoPago, 'Sin especificar')
        ORDER BY Fecha ASC
      `);

        // ── Procesar porMetodo ──────────────────────────────────────────
        const totalVentas = porMetodoRes.recordset.reduce((s, r) => s + Number(r.Ventas), 0);
        const totalCheques = porMetodoRes.recordset.reduce((s, r) => s + Number(r.Cheques), 0);

        const porMetodo = porMetodoRes.recordset.map(r => {
            const ventas = Number(r.Ventas) || 0;
            const cheques = Number(r.Cheques) || 0;
            return {
                metodo: r.Metodo,
                cheques,
                ventas: Math.round(ventas),
                ticketPromedio: cheques > 0 ? Math.round(ventas / cheques) : 0,
                pct: totalVentas > 0 ? Math.round((ventas / totalVentas) * 10000) / 100 : 0,
            };
        });

        // Ordenar: primero los métodos "conocidos" en orden estable, después
        // cualquier otro (incluyendo Sin especificar al final).
        porMetodo.sort((a, b) => {
            const ia = METODOS_ORDEN.indexOf(a.metodo);
            const ib = METODOS_ORDEN.indexOf(b.metodo);
            if (ia === -1 && ib === -1) return b.ventas - a.ventas;
            if (ia === -1) return 1;
            if (ib === -1) return -1;
            return ia - ib;
        });

        // ── Procesar evolución diaria ──────────────────────────────────
        // Estructura: { fecha: 'YYYY-MM-DD', porMetodo: { Efectivo: 100, ... }, total: 100 }
        // Para el gráfico, devolvemos una fila por día con todos los métodos como columnas.
        const metodosPresentes = porMetodo.map(p => p.metodo); // ordenados

        // Pre-armar el rango completo de fechas (para días sin ventas)
        const diasMap = new Map();
        {
            const d = new Date(`${desdeStr}T12:00:00`);
            const fin = new Date(`${hastaStr}T12:00:00`);
            while (d <= fin) {
                const k = d.toISOString().slice(0, 10);
                const init = { fecha: k, porMetodo: {}, total: 0, cheques: 0 };
                for (const m of metodosPresentes) init.porMetodo[m] = 0;
                diasMap.set(k, init);
                d.setDate(d.getDate() + 1);
            }
        }

        for (const r of evolucionRes.recordset) {
            const fecha = r.Fecha instanceof Date
                ? r.Fecha.toISOString().slice(0, 10)
                : new Date(r.Fecha).toISOString().slice(0, 10);
            const dia = diasMap.get(fecha);
            if (!dia) continue;
            const ventas = Number(r.Ventas) || 0;
            dia.porMetodo[r.Metodo] = (dia.porMetodo[r.Metodo] || 0) + ventas;
            dia.total += ventas;
            dia.cheques += Number(r.Cheques) || 0;
        }

        const evolucionDiaria = Array.from(diasMap.values()).map(d => ({
            fecha: d.fecha,
            total: Math.round(d.total),
            cheques: d.cheques,
            porMetodo: Object.fromEntries(
                Object.entries(d.porMetodo).map(([k, v]) => [k, Math.round(v)])
            ),
        }));

        // ── Identificar método dominante ────────────────────────────────
        let metodoDominante = null;
        for (const m of porMetodo) {
            if (m.metodo === 'Sin especificar') continue; // no cuenta como dominante
            if (!metodoDominante || m.ventas > metodoDominante.ventas) {
                metodoDominante = { metodo: m.metodo, ventas: m.ventas, pct: m.pct };
            }
        }

        // ── Cantidad sin especificar (para banner en UI) ───────────────
        const sinEspecificar = porMetodo.find(p => p.metodo === 'Sin especificar');

        return NextResponse.json({
            filtros: { desde: desdeStr, hasta: hastaStr, diasEnRango },
            resumen: {
                totalVentas: Math.round(totalVentas),
                totalCheques,
                ticketPromedio: totalCheques > 0 ? Math.round(totalVentas / totalCheques) : 0,
                cantidadMetodos: porMetodo.length,
                metodoDominante,
                sinEspecificar: sinEspecificar
                    ? { cheques: sinEspecificar.cheques, ventas: sinEspecificar.ventas, pct: sinEspecificar.pct }
                    : null,
            },
            porMetodo,
            evolucionDiaria,
            metodosPresentes,
        });

    } catch (err) {
        console.error('Error GET /api/reportes/metodo-pago:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}