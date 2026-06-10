import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';

/**
 * GET /api/facturacion/buscar-ruc?q=XXXXXXX
 * * Busca contribuyentes en la tabla DNIT por RUC exacto o por
 * prefijo/texto de Razón Social. Devuelve hasta 10 sugerencias.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();

    if (q.length < 2) {
      return NextResponse.json({ resultados: [] });
    }

    const pool = await getPool();

    // Verificar que la tabla exista (puede no estar importada aún)
    const tableExists = await pool.request().query(`
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'Contribuyentes'
    `);

    if (tableExists.recordset.length === 0) {
      return NextResponse.json({
        resultados: [],
        advertencia: 'La tabla de contribuyentes DNIT aún no fue importada. Ejecuta el script import-dnit.js primero.'
      });
    }

    // Determinar si la búsqueda parece un RUC numérico o texto (tolerando guiones)
    const cleanQ = q.replace(/-/g, '');
    const esRUC = /^\d+$/.test(cleanQ);

    let result;

    if (esRUC) {
      // Si tiene guion, tomamos la parte numérica antes del guion
      const rucBase = q.includes('-') ? q.split('-')[0].trim() : q;
      // Búsqueda exacta o por prefijo de RUC
      result = await pool.request()
        .input('q', sql.NVarChar(15), rucBase + '%')
        .query(`
          SELECT TOP 10 RUC, DV, RazonSocial
          FROM Contribuyentes
          WHERE RUC LIKE @q
          ORDER BY RUC ASC
        `);
    } else {
      // Búsqueda por texto en Razón Social (insensible a mayúsculas)
      result = await pool.request()
        .input('q', sql.NVarChar(305), '%' + q + '%')
        .query(`
          SELECT TOP 10 RUC, DV, RazonSocial
          FROM Contribuyentes
          WHERE RazonSocial LIKE @q
          ORDER BY RazonSocial ASC
        `);
    }

    const resultados = result.recordset.map(r => {
      let nombreFormateado = r.RazonSocial;

      // Verificamos si existe una coma (formato "APELLIDOS, NOMBRES" de personas físicas)
      if (nombreFormateado && nombreFormateado.includes(',')) {
        const partes = nombreFormateado.split(',');
        // partes[0] contiene los apellidos (ej: "BENITEZ PALMA")
        // partes[1] contiene los nombres (ej: " ANGEL DAVID")

        // Los unimos invirtiendo el orden y usamos trim() para limpiar espacios vacíos
        nombreFormateado = `${partes[1].trim()} ${partes[0].trim()}`;
      }

      return {
        ruc: r.RUC,
        dv: r.DV,
        rucCompleto: `${r.RUC}-${r.DV}`,
        razonSocial: nombreFormateado
      };
    });

    return NextResponse.json({ resultados });

  } catch (err) {
    console.error('Error en búsqueda RUC DNIT:', err);
    return NextResponse.json(
      { error: 'Error interno al buscar en la tabla DNIT.', detalle: err.message },
      { status: 500 }
    );
  }
}