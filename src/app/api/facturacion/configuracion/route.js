import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';

// Obtener todas las configuraciones relacionadas con SIFEN y la Empresa
export async function GET() {
  try {
    const pool = await getPool();
    // Ampliamos la consulta para traer claves SIFEN_ y EMPRESA_
    const result = await pool.request().query(
      "SELECT Clave, Valor FROM Configuracion WHERE Clave LIKE 'SIFEN_%' OR Clave LIKE 'EMPRESA_%'"
    );

    // Convertir lista a objeto clave-valor
    const config = {};
    result.recordset.forEach(row => {
      config[row.Clave] = row.Valor;
    });

    return NextResponse.json({ success: true, config });
  } catch (err) {
    console.error('Error al obtener la configuración:', err);
    return NextResponse.json({ error: 'Error interno del servidor al obtener configuración' }, { status: 500 });
  }
}

// Guardar o actualizar configuraciones de SIFEN y la Empresa
export async function POST(request) {
  try {
    const body = await request.json();
    const pool = await getPool();

    // Iniciar una transacción implícita para asegurar consistencia
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const keys = Object.keys(body);

      for (const clave of keys) {
        // Permitimos modificar tanto claves de SIFEN_ como de EMPRESA_ por seguridad
        if (!clave.startsWith('SIFEN_') && !clave.startsWith('EMPRESA_')) continue;

        const valor = body[clave] !== undefined && body[clave] !== null ? String(body[clave]) : '';

        // Usamos una consulta combinada de UPDATE o INSERT (UPSERT)
        await transaction.request()
          .input('clave', sql.NVarChar(100), clave)
          .input('valor', sql.NVarChar(sql.MAX), valor)
          .query(`
            IF EXISTS (SELECT 1 FROM Configuracion WHERE Clave = @clave)
            BEGIN
                UPDATE Configuracion SET Valor = @valor WHERE Clave = @clave
            END
            ELSE
            BEGIN
                INSERT INTO Configuracion (Clave, Valor) VALUES (@clave, @valor)
            END
          `);
      }

      await transaction.commit();
      return NextResponse.json({ success: true, message: 'Configuración actualizada correctamente' });
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }

  } catch (err) {
    console.error('Error al guardar la configuración:', err);
    return NextResponse.json({ error: 'Error interno al guardar la configuración' }, { status: 500 });
  }
}