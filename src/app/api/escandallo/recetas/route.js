import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';

// ── GET /api/escandallo/recetas?productoId=X ─────────────────────────
// Devuelve la receta completa de un producto: los ingredientes y cantidades.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const productoId = searchParams.get('productoId');

    if (!productoId) {
      return NextResponse.json({ error: 'Se requiere productoId' }, { status: 400 });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('pid', sql.Int, parseInt(productoId))
      .query(`
        SELECT
          r.Id           AS RecetaId,
          r.ProductoId,
          r.IngredienteId,
          r.Cantidad,
          i.Nombre       AS NombreIngrediente,
          i.UnidadReceta,
          i.UnidadCompra,
          i.CostoPorUnidadCompra,
          i.FactorConversion,
          i.PorcentajeMerma,
          -- Costo de esta línea de receta (con merma aplicada)
          ROUND(
            (r.Cantidad / NULLIF(i.FactorConversion, 0))
            * i.CostoPorUnidadCompra
            * (1 + i.PorcentajeMerma / 100.0),
          2) AS CostoLinea
        FROM Recetas r
        INNER JOIN Ingredientes i ON r.IngredienteId = i.Id
        WHERE r.ProductoId = @pid AND i.Activo = 1
        ORDER BY i.Nombre ASC
      `);

    return NextResponse.json({ receta: result.recordset });
  } catch (err) {
    console.error('Error GET /api/escandallo/recetas:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── POST /api/escandallo/recetas ─────────────────────────────────────
// Agrega o actualiza una línea de receta (upsert: si ya existe la
// combinación ProductoId+IngredienteId, actualiza la cantidad).
// Body: { productoId, ingredienteId, cantidad }
export async function POST(request) {
  try {
    const { productoId, ingredienteId, cantidad } = await request.json();

    if (!productoId || !ingredienteId || cantidad == null) {
      return NextResponse.json(
        { error: 'Se requieren productoId, ingredienteId y cantidad' },
        { status: 400 }
      );
    }

    if (parseFloat(cantidad) <= 0) {
      return NextResponse.json(
        { error: 'La cantidad debe ser mayor a 0' },
        { status: 400 }
      );
    }

    const pool = await getPool();

    // Upsert: verificar si ya existe la línea
    const exists = await pool.request()
      .input('pid', sql.Int, parseInt(productoId))
      .input('iid', sql.Int, parseInt(ingredienteId))
      .query(`SELECT Id FROM Recetas WHERE ProductoId = @pid AND IngredienteId = @iid`);

    if (exists.recordset.length > 0) {
      // Actualizar cantidad
      await pool.request()
        .input('pid',      sql.Int,          parseInt(productoId))
        .input('iid',      sql.Int,          parseInt(ingredienteId))
        .input('cantidad', sql.Decimal(18,4), parseFloat(cantidad))
        .query(`UPDATE Recetas SET Cantidad = @cantidad WHERE ProductoId = @pid AND IngredienteId = @iid`);
    } else {
      // Insertar nueva línea
      await pool.request()
        .input('pid',      sql.Int,          parseInt(productoId))
        .input('iid',      sql.Int,          parseInt(ingredienteId))
        .input('cantidad', sql.Decimal(18,4), parseFloat(cantidad))
        .query(`INSERT INTO Recetas (ProductoId, IngredienteId, Cantidad) VALUES (@pid, @iid, @cantidad)`);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error POST /api/escandallo/recetas:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── DELETE /api/escandallo/recetas?productoId=X&ingredienteId=Y ──────
// Elimina una línea específica de la receta.
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const productoId    = searchParams.get('productoId');
    const ingredienteId = searchParams.get('ingredienteId');

    if (!productoId || !ingredienteId) {
      return NextResponse.json(
        { error: 'Se requieren productoId e ingredienteId' },
        { status: 400 }
      );
    }

    const pool = await getPool();
    await pool.request()
      .input('pid', sql.Int, parseInt(productoId))
      .input('iid', sql.Int, parseInt(ingredienteId))
      .query(`DELETE FROM Recetas WHERE ProductoId = @pid AND IngredienteId = @iid`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error DELETE /api/escandallo/recetas:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
