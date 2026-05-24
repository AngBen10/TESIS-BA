const path = require('path');
const fs   = require('fs');

try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
      const [k, ...v] = line.split('=');
      if (k && v.length) process.env[k.trim()] = v.join('=').trim();
    });
  }
} catch (_) {}

const { getPool, sql } = require('./db');

async function run() {
  const pool = await getPool();
  console.log('Aplicando migración DNIT...');

  // Tabla Contribuyentes
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
        ON Contribuyentes (RUC) INCLUDE (DV, RazonSocial);
      CREATE INDEX IX_Contribuyentes_RazonSocial
        ON Contribuyentes (RazonSocial) INCLUDE (RUC, DV);
      PRINT 'Tabla Contribuyentes creada.';
    END
  `);

  // Claves SMTP en Configuracion
  const smtpKeys = [
    ['SMTP_Host',     'smtp.gmail.com'],
    ['SMTP_Port',     '587'],
    ['SMTP_User',     ''],
    ['SMTP_Password', ''],
    ['SMTP_From',     ''],
  ];

  for (const [clave, valor] of smtpKeys) {
    await pool.request()
      .input('clave', sql.NVarChar(100), clave)
      .input('valor', sql.NVarChar(500), valor)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM Configuracion WHERE Clave = @clave)
          INSERT INTO Configuracion (Clave, Valor) VALUES (@clave, @valor)
      `);
  }

  console.log('✅ Migración DNIT aplicada. Tabla Contribuyentes lista y claves SMTP insertadas.');
  const { sql: sqlClose } = require('./db');
  await sqlClose.close();
  process.exit(0);
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
