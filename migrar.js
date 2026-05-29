const fs = require('fs');
const path = require('path');
const readline = require('readline');
const sql = require('mssql');

// Cargar variables de entorno desde .env.local
function loadEnv() {
    const envPath = path.join(__dirname, '.env.local');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const parts = trimmed.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
                process.env[key] = value;
            }
        });
    }
}
loadEnv();

// 1. Configuración de tu base de datos SQL Server usando variables de entorno
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

async function migrarRucs() {
    console.log("Iniciando conexión a la base de datos...");
    console.log(`Conectando a ${dbConfig.server}:${dbConfig.port} - BD: ${dbConfig.database}...`);
    const pool = await sql.connect(dbConfig);

    // Borramos la tabla si ya existe para limpiar el error anterior
    await pool.request().query(`
        IF EXISTS (SELECT * FROM sysobjects WHERE name='Contribuyentes' AND xtype='U')
        BEGIN
            DROP TABLE Contribuyentes;
        END

        -- Creamos la tabla SIN la columna calculada RUCCompleto
        CREATE TABLE Contribuyentes (
            RUC VARCHAR(20) NOT NULL PRIMARY KEY,
            RazonSocial VARCHAR(255),
            DV INT,
            CodigoAnterior VARCHAR(50),
            Estado VARCHAR(50)
        );
        CREATE INDEX IX_Contribuyentes_RazonSocial ON Contribuyentes (RazonSocial);
    `);

    for (let i = 0; i <= 9; i++) {
        const fileName = `ruc${i}.txt`;
        if (!fs.existsSync(fileName)) {
            console.log(`El archivo ${fileName} no existe, omitiendo...`);
            continue;
        }

        console.log(`Procesando ${fileName}...`);

        const fileStream = fs.createReadStream(fileName);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

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

            // Insertar en lotes de 10,000 para máximo rendimiento
            if (batchCount === 10000) {
                await pool.request().bulk(table);
                table.rows.length = 0; // Limpiar lote
                batchCount = 0;
            }
        }

        // Insertar el remanente
        if (batchCount > 0) {
            await pool.request().bulk(table);
        }
        console.log(`✔️ ${fileName} procesado con éxito.`);
    }

    console.log("Migración completada. Ya puedes consultar los RUCs desde Next.js.");
    await pool.close();
}

migrarRucs().catch(err => {
    console.error("Error en la migración:", err);
});