const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
  },
};



let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .then(pool => {
        console.log('Conectado a SQL Server');
        return pool;
      })
      .catch(err => {
        poolPromise = null;
        console.error('¡Error en la conexión a la base de datos!: ', err);
        throw err;
      });
  }
  return poolPromise;
}

module.exports = {
  sql,
  getPool
};
