const fs = require('fs');
const path = require('path');

// Carga manual de .env.local
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split('\n').forEach(line => {
      const [key, ...value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.join('=').trim();
      }
    });
  }
} catch (e) {}

const { getPool, sql } = require('./db');


async function createUsers() {
  try {
    const pool = await getPool();
    
    console.log('Limpiando usuarios previos...');
    await pool.request().query("DELETE FROM Usuarios WHERE Usuario IN ('Admin', 'Mesero', 'Cajero', 'admin')");
    
    console.log('Insertando nuevos usuarios...');
    await pool.request().query(`
      INSERT INTO Usuarios (Usuario, Contrasena, NombreCompleto, RoleId) 
      VALUES 
      ('Admin', '123', 'Administrador Sistema', 1),
      ('Cajero', '123', 'Cajero de Turno', 2),
      ('Mesero', '123', 'Mesero de Turno', 3)
    `);
    
    console.log('✅ Usuarios creados exitosamente:');
    console.log('- Admin / 123');
    console.log('- Cajero / 123');
    console.log('- Mesero / 123');
    
    await sql.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

createUsers();
