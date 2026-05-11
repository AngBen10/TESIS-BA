const fs = require('fs');
const path = require('path');

// Cargar .env.local manualmente si no existe dotenv
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
} catch (e) {
  console.log('Aviso: No se pudo cargar .env.local manualmente');
}

const { getPool, sql } = require('./db');

async function testConnection() {
  console.log('--- Probando Conexión Dinámica ---');
  console.log('Servidor:', process.env.DB_SERVER);
  console.log('Base de Datos:', process.env.DB_DATABASE);
  console.log('Usuario:', process.env.DB_USER);
  
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT @@version as version');
    console.log('\n✅ ¡Conexión Exitosa!');
    console.log('Versión de SQL Server:', result.recordset[0].version);
    
    const tables = await pool.request().query("SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'");
    console.log('Tablas encontradas en la DB:', tables.recordset[0].count);
    
    await sql.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error al conectar:');
    console.error(err.message);
    process.exit(1);
  }
}

testConnection();
