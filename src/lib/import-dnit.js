/**
 * Importador masivo de archivos DNIT (Paraguay) a SQL Server
 * 
 * Uso:
 *   1. Descomprimir el ZIP de la DNIT
 *   2. Colocar los archivos .txt en una carpeta (ej: ./dnit-data/)
 *   3. Ejecutar: node src/lib/import-dnit.js ./dnit-data/
 * 
 * Formato esperado de los archivos .txt de la DNIT (pipe-delimited):
 *   RUC|DV|RAZON_SOCIAL|...otros campos ignorados
 * 
 * El script usa streaming + batch inserts para no colapsar la memoria
 * aunque el archivo tenga millones de registros.
 */

const fs   = require('fs');
const path = require('path');
const readline = require('readline');

// ── Cargar .env.local ────────────────────────────────────────────────
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
      const [key, ...val] = line.split('=');
      if (key && val.length) process.env[key.trim()] = val.join('=').trim();
    });
  }
} catch (_) {}

const { getPool, sql } = require('./db');

// ── Configuración ────────────────────────────────────────────────────
const BATCH_SIZE       = 5000;   // Registros por INSERT batch (ajustar según RAM)
const PROGRESS_EVERY   = 50000;  // Mostrar progreso cada N registros
const DELIMITER        = '|';    // Separador de columnas en el .txt
const SKIP_FIRST_LINE  = true;   // true si el .txt tiene cabecera

// Índice de cada columna dentro del .txt (0-based)
// Ajustar según el formato real del archivo DNIT descargado
const COL = {
  RUC:         0,
  DV:          1,
  RAZON_SOCIAL: 2,
};

// ── Función principal ────────────────────────────────────────────────
async function importarDNIT(carpeta) {
  const dir = path.resolve(process.cwd(), carpeta || './dnit-data');

  if (!fs.existsSync(dir)) {
    console.error(`❌ Carpeta no encontrada: ${dir}`);
    process.exit(1);
  }

  const archivos = fs.readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith('.txt'))
    .sort();

  if (archivos.length === 0) {
    console.error(`❌ No se encontraron archivos .txt en: ${dir}`);
    process.exit(1);
  }

  console.log(`\n=== IMPORTADOR DNIT → SQL Server ===`);
  console.log(`Carpeta  : ${dir}`);
  console.log(`Archivos : ${archivos.length} (${archivos.join(', ')})`);
  console.log(`Batch    : ${BATCH_SIZE} registros por inserción\n`);

  let pool;
  try {
    pool = await getPool();
  } catch (e) {
    console.error('❌ No se pudo conectar a SQL Server:', e.message);
    process.exit(1);
  }

  // Crear tabla si no existe (idempotente)
  await crearTablaConIndices(pool);

  // Limpiar tabla antes de reimportar para evitar duplicados
  console.log('🗑️  Vaciando tabla Contribuyentes...');
  await pool.request().query('DELETE FROM Contribuyentes');
  console.log('✅ Tabla vaciada. Iniciando importación...\n');

  let totalInsertados = 0;
  let totalErrores    = 0;
  const tiempoInicio  = Date.now();

  for (const archivo of archivos) {
    const rutaArchivo = path.join(dir, archivo);
    console.log(`📂 Procesando: ${archivo}`);

    const { insertados, errores } = await procesarArchivo(pool, rutaArchivo);
    totalInsertados += insertados;
    totalErrores    += errores;

    console.log(`   ✅ ${insertados.toLocaleString()} registros insertados, ⚠️ ${errores} omitidos\n`);
  }

  const segundos = ((Date.now() - tiempoInicio) / 1000).toFixed(1);
  console.log('════════════════════════════════════');
  console.log(`🎉 Importación finalizada en ${segundos}s`);
  console.log(`   Total insertados : ${totalInsertados.toLocaleString()}`);
  console.log(`   Total omitidos   : ${totalErrores.toLocaleString()}`);
  console.log('════════════════════════════════════\n');

  await sql.close();
  process.exit(0);
}

// ── Crear tabla e índices si no existen ─────────────────────────────
async function crearTablaConIndices(pool) {
  await pool.request().query(`
    IF OBJECT_ID('Contribuyentes', 'U') IS NULL
    BEGIN
      CREATE TABLE Contribuyentes (
        Id          INT           NOT NULL IDENTITY(1,1),
        RUC         NVARCHAR(15)  NOT NULL,
        DV          TINYINT       NOT NULL,
        RazonSocial NVARCHAR(300) NOT NULL,
        RUCCompleto AS (RUC + '-' + CAST(DV AS NVARCHAR(1))) PERSISTED,
        CONSTRAINT PK_Contribuyentes PRIMARY KEY CLUSTERED (Id ASC)
      );
      CREATE UNIQUE INDEX IX_Contribuyentes_RUC
        ON Contribuyentes (RUC ASC) INCLUDE (DV, RazonSocial);
      CREATE INDEX IX_Contribuyentes_RazonSocial
        ON Contribuyentes (RazonSocial ASC) INCLUDE (RUC, DV);
    END
  `);
}

// ── Procesar un archivo línea a línea ───────────────────────────────
function procesarArchivo(pool, rutaArchivo) {
  return new Promise((resolve) => {
    const stream = fs.createReadStream(rutaArchivo, { encoding: 'latin1' }); // DNIT usa latin-1
    const rl     = readline.createInterface({ input: stream, crlfDelay: Infinity });

    let batch       = [];
    let insertados  = 0;
    let errores     = 0;
    let lineaNum    = 0;
    let pendientes  = 0;
    let streamEnded = false;

    const checkFinalizar = () => {
      if (streamEnded && pendientes === 0) {
        resolve({ insertados, errores });
      }
    };

    rl.on('line', async (linea) => {
      lineaNum++;

      // Saltar cabecera si está configurado
      if (SKIP_FIRST_LINE && lineaNum === 1) return;

      const cols = linea.split(DELIMITER);

      // Validar que tenga los campos mínimos
      if (cols.length < 3) {
        errores++;
        return;
      }

      const ruc         = (cols[COL.RUC] || '').trim();
      const dvStr       = (cols[COL.DV] || '').trim();
      const razonSocial = (cols[COL.RAZON_SOCIAL] || '').trim().substring(0, 300);

      // Filtrar registros inválidos
      if (!ruc || !dvStr || !razonSocial || isNaN(parseInt(dvStr, 10))) {
        errores++;
        return;
      }

      const dv = parseInt(dvStr, 10);
      batch.push({ ruc, dv, razonSocial });

      // Cuando el batch está lleno, pausar el stream y hacer el INSERT
      if (batch.length >= BATCH_SIZE) {
        rl.pause();
        const batchActual = batch.splice(0, BATCH_SIZE);
        pendientes++;

        flushBatch(pool, batchActual)
          .then(n => {
            insertados += n;
            if (insertados % PROGRESS_EVERY < BATCH_SIZE) {
              process.stdout.write(`   → ${insertados.toLocaleString()} registros...\r`);
            }
          })
          .catch(() => { errores += batchActual.length; })
          .finally(() => {
            pendientes--;
            rl.resume();
            checkFinalizar();
          });
      }
    });

    rl.on('close', async () => {
      // Insertar el último batch residual
      if (batch.length > 0) {
        pendientes++;
        try {
          const n = await flushBatch(pool, batch);
          insertados += n;
        } catch (_) {
          errores += batch.length;
        } finally {
          pendientes--;
        }
        batch = [];
      }
      streamEnded = true;
      checkFinalizar();
    });

    rl.on('error', (err) => {
      console.error(`   ❌ Error al leer ${path.basename(rutaArchivo)}:`, err.message);
      streamEnded = true;
      resolve({ insertados, errores });
    });
  });
}

// ── INSERT de un batch usando Table-Valued Parameter (TVP) ──────────
async function flushBatch(pool, registros) {
  if (registros.length === 0) return 0;

  // Construir un INSERT masivo con múltiples VALUES
  // SQL Server acepta hasta ~1000 rows por statement; dividimos por seguridad
  const chunkSize = 1000;
  let totalInsertados = 0;

  for (let i = 0; i < registros.length; i += chunkSize) {
    const chunk = registros.slice(i, i + chunkSize);

    const values = chunk.map((_, idx) => `(@r${idx}, @d${idx}, @n${idx})`).join(',');
    const req    = pool.request();

    chunk.forEach(({ ruc, dv, razonSocial }, idx) => {
      req.input(`r${idx}`, sql.NVarChar(15),  ruc);
      req.input(`d${idx}`, sql.TinyInt,        dv);
      req.input(`n${idx}`, sql.NVarChar(300),  razonSocial);
    });

    // IGNORE duplicates de RUC
    await req.query(`
      INSERT INTO Contribuyentes (RUC, DV, RazonSocial)
      SELECT v.RUC, v.DV, v.RazonSocial
      FROM (VALUES ${values}) AS v(RUC, DV, RazonSocial)
      WHERE NOT EXISTS (
        SELECT 1 FROM Contribuyentes c WHERE c.RUC = v.RUC
      )
    `);

    totalInsertados += chunk.length;
  }

  return totalInsertados;
}

// ── Entrada ───────────────────────────────────────────────────────────
const carpetaArg = process.argv[2];
importarDNIT(carpetaArg);
