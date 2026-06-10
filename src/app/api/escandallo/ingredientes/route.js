import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';

// ── GET /api/escandallo/ingredientes ─────────────────────────────────
// Retorna todos los ingredientes activos para el módulo de escandallo.
export async function GET() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        Id,
        Nombre,
        UnidadCompra,
        CostoPorUnidadCompra,
        UnidadReceta,
        FactorConversion,
        PorcentajeMerma,
        StockActual,
        Proveedor,
        Notas,
        Activo,
        FechaCreacion,
        -- Costo por unidad de receta (ya calculado en la BD para eficiencia)
        ROUND(CostoPorUnidadCompra / NULLIF(FactorConversion, 0), 6) AS CostoPorUnidadReceta
      FROM Ingredientes
      WHERE Activo = 1
      ORDER BY Nombre ASC
    `);
    return NextResponse.json(result.recordset);
  } catch (err) {
    console.error('Error GET /api/escandallo/ingredientes:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── POST /api/escandallo/ingredientes ────────────────────────────────
// Crea un nuevo ingrediente.
// Body: { nombre, unidadCompra, costoPorUnidadCompra, unidadReceta,
//         factorConversion, porcentajeMerma, stockActual, proveedor, notas }
export async function POST(request) {
  try {
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
        { error: 'Faltan campos obligatorios: nombre, unidadCompra, costoPorUnidadCompra, unidadReceta, factorConversion' },
        { status: 400 }
      );
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('nombre',               sql.NVarChar(150), nombre)
      .input('unidadCompra',         sql.NVarChar(50),  unidadCompra)
      .input('costo',                sql.Decimal(18,2), parseFloat(costoPorUnidadCompra))
      .input('unidadReceta',         sql.NVarChar(50),  unidadReceta)
      .input('factor',               sql.Decimal(18,6), parseFloat(factorConversion))
      .input('merma',                sql.Decimal(5,2),  parseFloat(porcentajeMerma))
      .input('stock',                sql.Decimal(18,3), parseFloat(stockActual))
      .input('proveedor',            sql.NVarChar(100), proveedor)
      .input('notas',                sql.NVarChar(255), notas)
      .query(`
        INSERT INTO Ingredientes
          (Nombre, UnidadCompra, CostoPorUnidadCompra, UnidadReceta, FactorConversion, PorcentajeMerma, StockActual, Proveedor, Notas)
        OUTPUT INSERTED.Id
        VALUES
          (@nombre, @unidadCompra, @costo, @unidadReceta, @factor, @merma, @stock, @proveedor, @notas)
      `);

    return NextResponse.json({ success: true, id: result.recordset[0].Id }, { status: 201 });
  } catch (err) {
    console.error('Error POST /api/escandallo/ingredientes:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
