const fs = require('fs');
const path = require('path');

// Cargar variables de entorno desde .env.local
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const [key, ...value] = trimmed.split('=');
      if (key && value) {
        process.env[key.trim()] = value.join('=').trim().replace(/^['"]|['"]$/g, '');
      }
    });
  }
} catch (e) {
  console.log('Error loading env');
}

const { getPool, sql } = require('c:/Columbia/TESIS-BA/src/lib/db.js');

async function test() {
  try {
    const pool = await getPool();
    console.log('--- Inspecting Productos Table Columns ---');
    const result = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Productos'
    `);
    console.log(result.recordset);
    await sql.close();
  } catch (err) {
    console.error('❌ ERROR DETECTADO:', err.message);
  }
}

test();
