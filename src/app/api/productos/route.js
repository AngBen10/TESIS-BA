import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';

export async function GET() {
  try {
    const pool = await getPool();
    
    // Ensure columns exist (simple migration)
    try {
      await pool.request().query('ALTER TABLE Productos ADD Codigo NVARCHAR(50)');
    } catch (e) {}
    try {
      await pool.request().query('ALTER TABLE Productos ADD StockActual INT DEFAULT 0');
    } catch (e) {}
    try {
      await pool.request().query('ALTER TABLE Productos ADD StockMinimo INT DEFAULT 0');
    } catch (e) {}
    try {
      await pool.request().query('ALTER TABLE Productos ADD RequierePreparacion BIT DEFAULT 1');
    } catch (e) {}

    const result = await pool.request().query(`
      SELECT p.*, c.Nombre as CategoriaNombre 
      FROM Productos p
      LEFT JOIN Categorias c ON p.CategoriaId = c.Id
      WHERE p.Activo = 1
      ORDER BY c.Nombre, p.Nombre
    `);
    return NextResponse.json(result.recordset);
  } catch (err) {
    console.error('Error fetching products:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { codigo, nombre, precio, categoriaId, requierePreparacion, stockActual, stockMinimo } = await request.json();
    const pool = await getPool();

    // Ensure columns exist
    try { await pool.request().query('ALTER TABLE Productos ADD Codigo NVARCHAR(50)'); } catch (e) {}
    try { await pool.request().query('ALTER TABLE Productos ADD StockActual INT DEFAULT 0'); } catch (e) {}
    try { await pool.request().query('ALTER TABLE Productos ADD StockMinimo INT DEFAULT 0'); } catch (e) {}
    try { await pool.request().query('ALTER TABLE Productos ADD RequierePreparacion BIT DEFAULT 1'); } catch (e) {}
    await pool.request()
      .input('codigo', sql.NVarChar, codigo || '')
      .input('nombre', sql.NVarChar, nombre)
      .input('precio', sql.Decimal(18, 2), precio)
      .input('catId', sql.Int, categoriaId)
      .input('prep', sql.Bit, requierePreparacion ? 1 : 0)
      .input('stockActual', sql.Int, parseInt(stockActual) || 0)
      .input('stockMinimo', sql.Int, parseInt(stockMinimo) || 0)
      .query(`
        INSERT INTO Productos (Codigo, Nombre, Precio, CategoriaId, RequierePreparacion, StockActual, StockMinimo, Activo)
        VALUES (@codigo, @nombre, @precio, @catId, @prep, @stockActual, @stockMinimo, 1)
      `);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error creating product:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
