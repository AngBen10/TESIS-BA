import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';

export async function PUT(request, { params }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const { codigo, nombre, precio, categoriaId, requierePreparacion, stockActual, stockMinimo } = await request.json();
    const pool = await getPool();

    // Ensure columns exist
    try { await pool.request().query('ALTER TABLE Productos ADD Codigo NVARCHAR(50)'); } catch (e) {}
    try { await pool.request().query('ALTER TABLE Productos ADD StockActual INT DEFAULT 0'); } catch (e) {}
    try { await pool.request().query('ALTER TABLE Productos ADD StockMinimo INT DEFAULT 0'); } catch (e) {}
    try { await pool.request().query('ALTER TABLE Productos ADD RequierePreparacion BIT DEFAULT 1'); } catch (e) {}
    await pool.request()
      .input('id', sql.Int, id)
      .input('codigo', sql.NVarChar, codigo || '')
      .input('nombre', sql.NVarChar, nombre)
      .input('precio', sql.Decimal(18, 2), precio)
      .input('catId', sql.Int, categoriaId)
      .input('prep', sql.Bit, requierePreparacion ? 1 : 0)
      .input('stockActual', sql.Int, parseInt(stockActual) || 0)
      .input('stockMinimo', sql.Int, parseInt(stockMinimo) || 0)
      .query(`
        UPDATE Productos 
        SET Codigo = @codigo, Nombre = @nombre, Precio = @precio, CategoriaId = @catId, RequierePreparacion = @prep, StockActual = @stockActual, StockMinimo = @stockMinimo
        WHERE Id = @id
      `);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error updating product:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, id)
      .query('UPDATE Productos SET Activo = 0 WHERE Id = @id');
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting product:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
