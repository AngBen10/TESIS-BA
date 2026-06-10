/**
 * ============================================================================
 * SCRIPT DE MIGRACIÓN DE RUCs (SQL Server)
 * ============================================================================
 * Este script lee archivos de texto (ruc0.txt a ruc9.txt) de manera eficiente 
 * usando streams y los inserta en una base de datos SQL Server mediante
 * inserción por lotes (bulk insert) para maximizar el rendimiento.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const sql = require('mssql');

/**
 * Cargar variables de entorno desde .env.local de forma manual.
 * Esto evita dependencias externas adicionales y asegura que la configuración
 * local sea leída correctamente.
 */
function loadEnv() {
    const envPath = path.join(__dirname, '..', '.env.local');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach(line => {
            const trimmed = line.trim();
            // Ignorar líneas vacías o comentarios
            if (!trimmed || trimmed.startsWith('#')) return;
            
            const parts = trimmed.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
                process.env[key] = value;
            }
        });
        console.log('✅ Variables de entorno cargadas correctamente.');
    } else {
        console.warn('⚠️ No se encontró el archivo .env.local, se usarán los valores por defecto.');
    }
}
loadEnv();

/**
 * 1. Configuración de la base de datos SQL Server.
 * Se utilizan las variables de entorno cargadas previamente.
 */
const dbConfig = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
    server: process.env.DB_SERVER || 'localhost',
    port: parseInt(process.env.DB_PORT) || 1433,
    database: process.env.DB_DATABASE || 'RestauranteDB',
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_CERT === 'true'
    }
};

/**
 * Función principal asíncrona que coordina todo el proceso de migración.
 */
async function migrarRucs() {
    console.log(`\n🚀 Iniciando conexión a la base de datos...`);
    console.log(`🔌 Conectando a ${dbConfig.server}:${dbConfig.port} - BD: ${dbConfig.database}...`);
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        console.log('✅ Conexión establecida con SQL Server.\n');
    } catch (err) {
        console.error('❌ Error crítico al conectar con la base de datos:', err);
        return; // Salir si no hay conexión
    }

    try {
        console.log('🧹 Preparando tabla Contribuyentes...');
        // Borramos la tabla si ya existe para asegurar una migración limpia (Idempotencia)
        await pool.request().query(`
            IF EXISTS (SELECT * FROM sysobjects WHERE name='Contribuyentes' AND xtype='U')
            BEGIN
                DROP TABLE Contribuyentes;
            END

            -- Creamos la tabla estructurada para los datos del RUC
            CREATE TABLE Contribuyentes (
                RUC VARCHAR(20) NOT NULL PRIMARY KEY,
                RazonSocial VARCHAR(255),
                DV INT,
                CodigoAnterior VARCHAR(50),
                Estado VARCHAR(50)
            );
            -- Índice para acelerar búsquedas por Razón Social
            CREATE INDEX IX_Contribuyentes_RazonSocial ON Contribuyentes (RazonSocial);
        `);
        console.log('✅ Tabla Contribuyentes creada exitosamente.\n');

        // Procesar archivos del 0 al 9 secuencialmente
        for (let i = 0; i <= 9; i++) {
            const fileName = path.join(__dirname, '..', 'data', 'ruc', `ruc${i}.txt`);
            if (!fs.existsSync(fileName)) {
                console.log(`⚠️ El archivo ${fileName} no existe, omitiendo...`);
                continue;
            }

            console.log(`⏳ Procesando ${fileName}...`);

            // Uso de Streams para no saturar la memoria RAM con archivos grandes
            const fileStream = fs.createReadStream(fileName);
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });

            // Configuración del objeto Table para Bulk Insert
            const table = new sql.Table('Contribuyentes');
            table.create = false;
            table.columns.add('RUC', sql.VarChar(20), { nullable: false });
            table.columns.add('RazonSocial', sql.VarChar(255), { nullable: true });
            table.columns.add('DV', sql.Int, { nullable: true });
            table.columns.add('CodigoAnterior', sql.VarChar(50), { nullable: true });
            table.columns.add('Estado', sql.VarChar(50), { nullable: true });

            let batchCount = 0;

            for await (const line of rl) {
                const parts = line.split('|');
                if (parts.length >= 5) {
                    table.rows.add(
                        parts[0].trim(),           // RUC
                        parts[1].trim(),           // RazonSocial
                        parseInt(parts[2]) || 0,   // DV
                        parts[3].trim(),           // CodigoAnterior
                        parts[4].trim()            // Estado
                    );
                    batchCount++;
                }

                // Insertar en lotes de 10,000 registros para máximo rendimiento
                if (batchCount === 10000) {
                    await pool.request().bulk(table);
                    table.rows.length = 0; // Limpiar el lote procesado
                    batchCount = 0;
                }
            }

            // Insertar los registros restantes que no completaron el último lote de 10k
            if (batchCount > 0) {
                await pool.request().bulk(table);
            }
            console.log(`✔️ Archivo ${fileName} procesado e insertado con éxito.`);
        }

        console.log("\n🎉 Migración completada exitosamente. Ya puedes consultar los RUCs desde la aplicación.");
    } catch (err) {
        console.error('❌ Error durante la migración de datos:', err);
    } finally {
        // Asegurarse de cerrar la conexión a la base de datos siempre
        if (pool) {
            await pool.close();
            console.log('🔒 Conexión a la base de datos cerrada.');
        }
    }
}

// Ejecución del script
migrarRucs().catch(err => {
    console.error("❌ Error inesperado en la ejecución:", err);
});