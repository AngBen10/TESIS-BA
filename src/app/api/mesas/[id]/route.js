import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';

// PUT /api/mesas/[id] — modificar número y/o capacidad
export async function PUT(request, { params }) {
    try {
        const resolvedParams = await params;
        const id = parseInt(resolvedParams.id);
        const { numero, capacidad } = await request.json();
        const pool = await getPool();

        const num = parseInt(numero);
        const cap = parseInt(capacidad) || 2;

        if (isNaN(num) || num < 1) {
            return NextResponse.json({ error: 'Número de mesa inválido.' }, { status: 400 });
        }
        if (cap < 1) {
            return NextResponse.json({ error: 'La capacidad debe ser al menos 1.' }, { status: 400 });
        }

        // Que no choque con otra mesa que ya tenga ese número
        const dup = await pool.request()
            .input('num', sql.Int, num)
            .input('id', sql.Int, id)
            .query('SELECT Id FROM Mesas WHERE Numero = @num AND Id <> @id');
        if (dup.recordset.length > 0) {
            return NextResponse.json({ error: `Ya existe otra mesa con el número ${num}.` }, { status: 409 });
        }

        await pool.request()
            .input('id', sql.Int, id)
            .input('num', sql.Int, num)
            .input('cap', sql.Int, cap)
            .query('UPDATE Mesas SET Numero = @num, Capacidad = @cap WHERE Id = @id');

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Error PUT /api/mesas/[id]:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE /api/mesas/[id]
// No permite eliminar mesas con pedidos en el histórico (rompería reportes).
export async function DELETE(request, { params }) {
    try {
        const resolvedParams = await params;
        const id = parseInt(resolvedParams.id);
        const pool = await getPool();

        const ped = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT COUNT(*) AS Total FROM Pedidos WHERE MesaId = @id');

        if (ped.recordset[0].Total > 0) {
            return NextResponse.json({
                error: 'No se puede eliminar: la mesa tiene pedidos en el histórico de ventas. Editá su número o capacidad en lugar de borrarla.'
            }, { status: 409 });
        }

        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM Mesas WHERE Id = @id');

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Error DELETE /api/mesas/[id]:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}