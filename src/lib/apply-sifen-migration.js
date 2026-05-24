const fs = require('fs');
const path = require('path');

// Cargar variables de entorno desde .env.local
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
  console.log('Aviso: No se pudo cargar .env.local de forma automática.');
}

const { getPool, sql } = require('./db');

async function runMigration() {
  console.log('=== APLICANDO MIGRACIÓN DE BD SIFEN ===');
  const sqlPath = path.join(process.cwd(), 'sifen_setup.sql');
  
  if (!fs.existsSync(sqlPath)) {
    console.error(`❌ No se encontró el archivo de migración en: ${sqlPath}`);
    process.exit(1);
  }

  const rawSql = fs.readFileSync(sqlPath, 'utf-8');

  // El driver 'mssql' de Node no tolera comandos 'GO' (son delimitadores del CLI de SQL Server).
  // Separamos por bloques 'GO' y los ejecutamos de forma secuencial.
  const batches = rawSql
    .split(/^\s*GO\s*$/im)
    .map(batch => batch.trim())
    .filter(batch => batch.length > 0);

  try {
    const pool = await getPool();
    console.log('Conectado a la base de datos:', process.env.DB_DATABASE);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      // Ignorar comandos "USE RestauranteDB" porque la conexión ya está establecida en esa BD
      if (batch.toUpperCase().startsWith('USE ')) {
        continue;
      }
      
      console.log(`\nEjecutando bloque de migración ${i + 1}/${batches.length}...`);
      await pool.request().query(batch);
      console.log(`✅ Bloque ${i + 1} completado.`);
    }

    console.log('\n🎉 ¡Migración aplicada con éxito en SQL Server!');
    await sql.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error al ejecutar la migración:');
    console.error(err.message);
    if (err.lineNumber) console.error(`Línea: ${err.lineNumber}`);
    process.exit(1);
  }
}

runMigration();
