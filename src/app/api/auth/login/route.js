import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    const { usuario, contrasena } = await request.json();

    if (!usuario || !contrasena) {
      return NextResponse.json({ error: 'Usuario y contraseña requeridos' }, { status: 400 });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('user', usuario)
      .query('SELECT Id, Usuario, NombreCompleto, RoleId, Contrasena FROM Usuarios WHERE Usuario = @user AND Activo = 1');

    if (result.recordset.length === 0) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    const user = result.recordset[0];
    
    // Verificar si la contraseña en la BD ya está encriptada con bcrypt (empieza con $2a$ o $2b$)
    let contrasenaValida = false;
    const isHashed = user.Contrasena.startsWith('$2a$') || user.Contrasena.startsWith('$2b$');

    if (isHashed) {
      contrasenaValida = await bcrypt.compare(contrasena, user.Contrasena);
    } else {
      // Si no está encriptada, la comparamos en texto plano (como estaba antes)
      if (user.Contrasena === contrasena) {
        contrasenaValida = true;
        // Encriptar la contraseña y actualizar la base de datos para la próxima vez
        const hashedPass = await bcrypt.hash(contrasena, 10);
        await pool.request()
          .input('id', user.Id)
          .input('hash', hashedPass)
          .query('UPDATE Usuarios SET Contrasena = @hash WHERE Id = @id');
      }
    }

    if (!contrasenaValida) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }
    
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
