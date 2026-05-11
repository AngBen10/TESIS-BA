import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function POST(request) {
  try {
    const { usuario, contrasena } = await request.json();

    if (!usuario || !contrasena) {
      return NextResponse.json({ error: 'Usuario y contraseña requeridos' }, { status: 400 });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('user', usuario)
      .input('pass', contrasena)
      .query('SELECT Id, Usuario, NombreCompleto, RoleId FROM Usuarios WHERE Usuario = @user AND Contrasena = @pass AND Activo = 1');

    if (result.recordset.length === 0) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    const user = result.recordset[0];
    
    // En una app real usaríamos JWT o NextAuth aquí
    return NextResponse.json({ 
      success: true, 
      user: {
        id: user.Id,
        usuario: user.Usuario,
        nombre: user.NombreCompleto,
        roleId: user.RoleId
      }
    });

  } catch (err) {
    console.error('Error en Login API:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
