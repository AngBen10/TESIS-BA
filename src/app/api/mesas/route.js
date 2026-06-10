import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';

// GET /api/mesas — listar todas las mesas con su estado
export async function GET() {
    try {
        const pool = await getPool();
        const r = await pool.request().query(`
      SELECT
        m.Id,
        m.Numero,
        m.Capacidad,
        m.EstadoId,
        ISNULL(e.Nombre, 'Disponible') AS EstadoNombre,
        (SELECT COUNT(*) FROM Pedidos p WHERE p.MesaId = m.Id) AS PedidosHistoricos
      FROM Mesas m
      LEFT JOIN EstadosMesa e ON m.EstadoId = e.Id
      ORDER BY m.Numero ASC
    `);
        return NextResponse.json({ mesas: r.recordset });
    } catch (err) {
        console.error('Error GET /api/mesas:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST /api/mesas — crear mesa(s)
//   Individual: { numero, capacidad }
//   Masivo:     { desde, hasta, capacidad }  → crea el rango, omite las que ya existen
export async function POST(request) {
    try {
        const body = await request.json();
        const pool = await getPool();

        // ── Modo masivo (creación por rango) ───────────────────────────
        if (body.desde != null && body.hasta != null) {
            const desde = parseInt(body.desde);
            const hasta = parseInt(body.hasta);
            const capacidad = parseInt(body.capacidad) || 2;

            if (isNaN(desde) || isNaN(hasta) || desde < 1 || hasta < desde) {
                return NextResponse.json({ error: 'Rango inválido. Verificá "desde" y "hasta".' }, { status: 400 });
            }
            if (hasta - desde + 1 > 500) {
                return NextResponse.json({ error: 'Rango demasiado grande (máximo 500 mesas por lote).' }, { status: 400 });
            }

            // Números ya existentes para omitirlos
            const existRes = await pool.request().query('SELECT Numero FROM Mesas');
            const existentes = new Set(existRes.recordset.map(r => r.Numero));

            let creadas = 0, omitidas = 0;
            for (let n = desde; n <= hasta; n++) {
                if (existentes.has(n)) { omitidas++; continue; }
                await pool.request()
                    .input('num', sql.Int, n)
                    .input('cap', sql.Int, capacidad)
                    .query('INSERT INTO Mesas (Numero, Capacidad, EstadoId) VALUES (@num, @cap, 1)');
                creadas++;
            }
            return NextResponse.json({ success: true, creadas, omitidas });
        }

        // ── Modo individual ─────────────────────────────────────────────
        const numero = parseInt(body.numero);
        const capacidad = parseInt(body.capacidad) || 2;

        if (isNaN(numero) || numero < 1) {
            return NextResponse.json({ error: 'Número de mesa inválido.' }, { status: 400 });
        }
        if (capacidad < 1) {
            return NextResponse.json({ error: 'La capacidad debe ser al menos 1.' }, { status: 400 });
        }

        // Unicidad del número
        const dup = await pool.request()
            .input('num', sql.Int, numero)
            .query('SELECT Id FROM Mesas WHERE Numero = @num');
        if (dup.recordset.length > 0) {
            return NextResponse.json({ error: `Ya existe la mesa N° ${numero}.` }, { status: 409 });
        }

        const ins = await pool.request()
            .input('num', sql.Int, numero)
            .input('cap', sql.Int, capacidad)
            .query(`
        INSERT INTO Mesas (Numero, Capacidad, EstadoId) VALUES (@num, @cap, 1);
        SELECT SCOPE_IDENTITY() AS Id;
      `);

        return NextResponse.json({ success: true, id: ins.recordset[0].Id });
    } catch (err) {
        console.error('Error POST /api/mesas:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE /api/mesas — eliminación masiva por rango
//   Body: { desde, hasta }
//   Respeta la protección: mesas con pedidos en histórico se omiten y se reportan.
export async function DELETE(request) {
    try {
        const body = await request.json();
        const desde = parseInt(body.desde);
        const hasta = parseInt(body.hasta);

        if (isNaN(desde) || isNaN(hasta) || desde < 1 || hasta < desde) {
            return NextResponse.json({ error: 'Rango inválido. Verificá "desde" y "hasta".' }, { status: 400 });
        }
        if (hasta - desde + 1 > 500) {
            return NextResponse.json({ error: 'Rango demasiado grande (máximo 500 mesas por lote).' }, { status: 400 });
        }

        const pool = await getPool();

        // Traer las mesas existentes en el rango con su cantidad de pedidos
        const lista = await pool.request()
            .input('desde', sql.Int, desde)
            .input('hasta', sql.Int, hasta)
            .query(`
        SELECT 
          m.Id, 
          m.Numero,
          (SELECT COUNT(*) FROM Pedidos p WHERE p.MesaId = m.Id) AS Pedidos
        FROM Mesas m
        WHERE m.Numero BETWEEN @desde AND @hasta
        ORDER BY m.Numero ASC
      `);

        let eliminadas = 0;
        const omitidasConPedidos = [];

        for (const m of lista.recordset) {
            if (m.Pedidos > 0) {
                omitidasConPedidos.push({ numero: m.Numero, pedidos: m.Pedidos });
                continue;
            }
            await pool.request()
                .input('id', sql.Int, m.Id)
                .query('DELETE FROM Mesas WHERE Id = @id');
            eliminadas++;
        }

        const rangoTotal = hasta - desde + 1;
        const omitidasInexistentes = rangoTotal - lista.recordset.length;

        return NextResponse.json({
            success: true,
            eliminadas,
            omitidasConPedidos,
            omitidasInexistentes,
            rangoTotal,
        });
    } catch (err) {
        console.error('Error DELETE /api/mesas:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}