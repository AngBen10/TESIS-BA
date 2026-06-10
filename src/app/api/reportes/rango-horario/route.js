import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';

/**
 * GET /api/reportes/rango-horario
 *   ?desde=YYYY-MM-DD   (default: hoy 00:00)
 *   &hasta=YYYY-MM-DD   (default: hoy 23:59)
 *
 * Reporte de ventas distribuidas por franjas horarias.
 *
 * Devuelve:
 *   - resumen: KPIs generales, hora pico, día pico
 *   - porHora: agregado por hora del día (0..23) con promedio diario
 *   - heatmap: matriz día-de-semana × hora (cada celda con promedio
 *     ponderado por la cantidad de veces que ese día apareció en el rango)
 *   - porTurno: agrupado en franjas típicas de restaurante
 *     (Madrugada, Desayuno, Almuerzo, Tarde, Cena)
 *
 * Útil para programar turnos de personal y mise en place.
 */

// Turnos típicos: [hora inicio, hora fin) — fin exclusivo
// Las horas son 0..23
const TURNOS = [
    { id: 'desayuno', nombre: 'Desayuno', rango: '06:00 - 11:00', desde: 6, hasta: 11 },
    { id: 'almuerzo', nombre: 'Almuerzo', rango: '11:00 - 15:00', desde: 11, hasta: 15 },
    { id: 'tarde', nombre: 'Tarde', rango: '15:00 - 19:00', desde: 15, hasta: 19 },
    { id: 'cena', nombre: 'Cena', rango: '19:00 - 23:00', desde: 19, hasta: 23 },
    { id: 'madrugada', nombre: 'Madrugada', rango: '23:00 - 06:00', desde: 23, hasta: 24, extra: [0, 6] }, // envuelve medianoche
];

// Etiquetas: empezamos en lunes (0=Lun, 6=Dom) para que la semana se lea
// como en español. En JS getDay() devuelve 0=Domingo, así que convertimos.
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function jsDayToIndex(jsDay) {
    // jsDay: 0=Domingo..6=Sábado  → 0=Lunes..6=Domingo
    return (jsDay + 6) % 7;
}

function horaEnTurno(hora, turno) {
    if (hora >= turno.desde && hora < turno.hasta) return true;
    if (turno.extra && hora >= turno.extra[0] && hora < turno.extra[1]) return true;
    return false;
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

        // Cantidad de días en el rango (inclusivo)
        const msPorDia = 24 * 60 * 60 * 1000;
        const diasEnRango = Math.round((new Date(hastaStr) - new Date(desdeStr)) / msPorDia) + 1;

        // Contar cuántas veces aparece cada día de la semana en el rango
        // para promediar el heatmap correctamente.
        const apariciones = [0, 0, 0, 0, 0, 0, 0]; // Lun..Dom
        {
            const d = new Date(`${desdeStr}T12:00:00`);
            const fin = new Date(`${hastaStr}T12:00:00`);
            while (d <= fin) {
                apariciones[jsDayToIndex(d.getDay())]++;
                d.setDate(d.getDate() + 1);
            }
        }

        const pool = await getPool();

        // ── Query principal: agregado por fecha + hora ─────────────────
        const result = await pool.request()
            .input('desde', sql.DateTime2, desde)
            .input('hasta', sql.DateTime2, hasta)
            .query(`
        SELECT
          CAST(FechaEmision AS DATE) AS Fecha,
          DATEPART(HOUR, FechaEmision) AS Hora,
          COUNT(*) AS Facturas,
          ISNULL(SUM(Total), 0) AS Ingresos
        FROM Facturas
        WHERE FechaEmision >= @desde
          AND FechaEmision <= @hasta
        GROUP BY CAST(FechaEmision AS DATE), DATEPART(HOUR, FechaEmision)
        ORDER BY Fecha, Hora
      `);

        // ── Acumuladores ────────────────────────────────────────────────
        const porHora = Array.from({ length: 24 }, (_, h) => ({
            hora: h,
            ingresos: 0,
            facturas: 0,
        }));

        // heatmap[diaSemanaIdx][hora] = { ingresos, facturas }
        const heatmap = Array.from({ length: 7 }, () =>
            Array.from({ length: 24 }, () => ({ ingresos: 0, facturas: 0 }))
        );

        // Totales por fecha (para hallar día pico)
        const porFecha = new Map();

        let totalIngresos = 0;
        let totalFacturas = 0;

        for (const row of result.recordset) {
            const ingresos = Number(row.Ingresos) || 0;
            const facturas = Number(row.Facturas) || 0;
            const hora = Number(row.Hora);
            const fechaObj = new Date(row.Fecha);
            const diaIdx = jsDayToIndex(fechaObj.getUTCDay());
            const fechaStr = row.Fecha.toISOString().slice(0, 10);

            porHora[hora].ingresos += ingresos;
            porHora[hora].facturas += facturas;

            heatmap[diaIdx][hora].ingresos += ingresos;
            heatmap[diaIdx][hora].facturas += facturas;

            const prev = porFecha.get(fechaStr) || { ingresos: 0, facturas: 0 };
            prev.ingresos += ingresos;
            prev.facturas += facturas;
            porFecha.set(fechaStr, prev);

            totalIngresos += ingresos;
            totalFacturas += facturas;
        }

        // ── Cálculo de promedios y porcentajes ─────────────────────────
        const porHoraConPct = porHora.map(h => ({
            hora: h.hora,
            ingresos: Math.round(h.ingresos),
            facturas: h.facturas,
            ingresosPromedio: diasEnRango > 0 ? Math.round(h.ingresos / diasEnRango) : 0,
            facturasPromedio: diasEnRango > 0
                ? Math.round((h.facturas / diasEnRango) * 10) / 10
                : 0,
            pctIngresos: totalIngresos > 0
                ? Math.round((h.ingresos / totalIngresos) * 10000) / 100
                : 0,
        }));

        // ── Heatmap con promedio por aparición de día ──────────────────
        let maxIngresosCelda = 0;
        const celdas = [];
        for (let d = 0; d < 7; d++) {
            for (let h = 0; h < 24; h++) {
                const apar = apariciones[d];
                const ing = heatmap[d][h].ingresos;
                const fac = heatmap[d][h].facturas;
                const ingProm = apar > 0 ? Math.round(ing / apar) : 0;
                if (ingProm > maxIngresosCelda) maxIngresosCelda = ingProm;
                celdas.push({
                    diaSemanaIdx: d,
                    hora: h,
                    ingresos: Math.round(ing),
                    facturas: fac,
                    ingresosPromedio: ingProm,
                    diasObservados: apar,
                });
            }
        }

        // ── Turnos ──────────────────────────────────────────────────────
        const porTurno = TURNOS.map(t => {
            let ing = 0, fac = 0;
            for (const h of porHora) {
                if (horaEnTurno(h.hora, t)) {
                    ing += h.ingresos;
                    fac += h.facturas;
                }
            }
            return {
                id: t.id,
                nombre: t.nombre,
                rango: t.rango,
                ingresos: Math.round(ing),
                facturas: fac,
                ticketPromedio: fac > 0 ? Math.round(ing / fac) : 0,
                pctIngresos: totalIngresos > 0
                    ? Math.round((ing / totalIngresos) * 10000) / 100
                    : 0,
            };
        });

        // ── Picos ───────────────────────────────────────────────────────
        let horaPico = { hora: null, ingresos: 0, facturas: 0 };
        for (const h of porHoraConPct) {
            if (h.ingresos > horaPico.ingresos) {
                horaPico = { hora: h.hora, ingresos: h.ingresos, facturas: h.facturas };
            }
        }

        let diaPico = { fecha: null, ingresos: 0, facturas: 0 };
        for (const [fecha, datos] of porFecha.entries()) {
            if (datos.ingresos > diaPico.ingresos) {
                diaPico = { fecha, ingresos: Math.round(datos.ingresos), facturas: datos.facturas };
            }
        }

        // ── Respuesta ───────────────────────────────────────────────────
        return NextResponse.json({
            filtros: {
                desde: desdeStr,
                hasta: hastaStr,
                diasEnRango,
            },
            resumen: {
                totalIngresos: Math.round(totalIngresos),
                totalFacturas,
                ticketPromedio: totalFacturas > 0 ? Math.round(totalIngresos / totalFacturas) : 0,
                ingresoPromedioDiario: diasEnRango > 0 ? Math.round(totalIngresos / diasEnRango) : 0,
                horaPico,
                diaPico,
            },
            porHora: porHoraConPct,
            heatmap: {
                diasSemana: DIAS_SEMANA,
                apariciones,
                celdas,
                maxIngresosCelda,
            },
            porTurno,
        });

    } catch (err) {
        console.error('Error GET /api/reportes/rango-horario:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}