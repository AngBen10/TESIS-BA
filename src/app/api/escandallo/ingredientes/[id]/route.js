import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';

// ── PUT /api/escandallo/ingredientes/[id] ────────────────────────────
// Actualiza un ingrediente existente.
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const {
      nombre,
      unidadCompra,
      costoPorUnidadCompra,
      unidadReceta,
      factorConversion,
      porcentajeMerma = 0,
      stockActual = 0,
      proveedor = null,
      notas = null,
    } = await request.json();

    if (!nombre || !unidadCompra || !costoPorUnidadCompra || !unidadReceta || !factorConversion) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios' },
        { status: 400 }
      );
    }

    const pool = await getPool();
    await pool.request()
      .input('id',          sql.Int,          parseInt(id))
      .input('nombre',      sql.NVarChar(150), nombre)
      .input('unidadCompra',sql.NVarChar(50),  unidadCompra)
      .input('costo',       sql.Decimal(18,2), parseFloat(costoPorUnidadCompra))
      .input('unidadReceta',sql.NVarChar(50),  unidadReceta)
      .input('factor',      sql.Decimal(18,6), parseFloat(factorConversion))
      .input('merma',       sql.Decimal(5,2),  parseFloat(porcentajeMerma))
      .input('stock',       sql.Decimal(18,3), parseFloat(stockActual))
      .input('proveedor',   sql.NVarChar(100), proveedor)
      .input('notas',       sql.NVarChar(255), notas)
      .query(`
        UPDATE Ingredientes SET
          Nombre               = @nombre,
          UnidadCompra         = @unidadCompra,
          CostoPorUnidadCompra = @costo,
          UnidadReceta         = @unidadReceta,
          FactorConversion     = @factor,
          PorcentajeMerma      = @merma,
          StockActual          = @stock,
          Proveedor            = @proveedor,
          Notas                = @notas
        WHERE Id = @id AND Activo = 1
      `);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error PUT /api/escandallo/ingredientes/[id]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── DELETE /api/escandallo/ingredientes/[id] ─────────────────────────
// Soft-delete: marca el ingrediente como Activo = 0.
// Verifica que el ingrediente no esté en uso en ninguna Receta activa.
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const pool = await getPool();

    // Verificar si está siendo usado en alguna receta
    const used = await pool.request()
      .input('id', sql.Int, parseInt(id))
      .query(`SELECT COUNT(*) AS Total FROM Recetas WHERE IngredienteId = @id`);

    if (used.recordset[0].Total > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar: el ingrediente está siendo usado en una o más recetas.' },
        { status: 409 }
      );
    }

    await pool.request()
      .input('id', sql.Int, parseInt(id))
      .query(`UPDATE Ingredientes SET Activo = 0 WHERE Id = @id`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error DELETE /api/escandallo/ingredientes/[id]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
