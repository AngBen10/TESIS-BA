import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET() {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT Id, Nombre FROM Categorias ORDER BY Nombre');
    return NextResponse.json(result.recordset);
  } catch (err) {
    console.error('Error fetching categories:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
