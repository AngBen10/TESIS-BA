const sql = require('mssql');

// Hardcoded config for scratch script
const config = {
  user: 'adm',
  password: 'admadm',
  server: 'localhost',
  port: 50120,
  database: 'RestauranteDB',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function seed() {
  try {
    const pool = await new sql.ConnectionPool(config).connect();
    console.log('Conectado para seeding');

    // Get categories to map IDs
    const cats = await pool.request().query('SELECT * FROM Categorias');
    const catMap = {};
    cats.recordset.forEach(c => catMap[c.Nombre] = c.Id);

    const products = [
      { codigo: 'BEB-003', nombre: 'Cerveza Pilsen 600ml', precio: 12000, categoria: 'Bebidas', prep: 0, stock: 48 },
      { codigo: 'BEB-004', nombre: 'Jugo de Naranja Natural', precio: 10000, categoria: 'Bebidas', prep: 1, stock: 0 },
      { codigo: 'BEB-005', nombre: 'Café Expreso', precio: 7000, categoria: 'Bebidas', prep: 1, stock: 0 },
      { codigo: 'ENT-001', nombre: 'Empanada de Carne (unidad)', precio: 5000, categoria: 'Entradas', prep: 0, stock: 20 },
      { codigo: 'ENT-002', nombre: 'Sopa Paraguaya (porción)', precio: 8000, categoria: 'Entradas', prep: 1, stock: 0 },
      { codigo: 'PLA-003', nombre: 'Tallarín de Pollo', precio: 28000, categoria: 'Platos Principales', prep: 1, stock: 0 },
      { codigo: 'PLA-004', nombre: 'Pollo al Horno con Ensalada', precio: 32000, categoria: 'Platos Principales', prep: 1, stock: 0 },
      { codigo: 'POS-001', nombre: 'Flan Casero con Caramelo', precio: 12000, categoria: 'Postres', prep: 1, stock: 0 },
      { codigo: 'POS-002', nombre: 'Helado 3 Sabores', precio: 15000, categoria: 'Postres', prep: 0, stock: 10 }
    ];

    for (const p of products) {
      const catId = catMap[p.categoria];
      if (!catId) {
        console.log(`Categoría ${p.categoria} no encontrada, saltando ${p.nombre}`);
        continue;
      }

      await pool.request()
        .input('codigo', sql.NVarChar, p.codigo)
        .input('nombre', sql.NVarChar, p.nombre)
        .input('precio', sql.Decimal(18, 2), p.precio)
        .input('catId', sql.Int, catId)
        .input('prep', sql.Bit, p.prep)
        .input('stock', sql.Int, p.stock)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM Productos WHERE Nombre = @nombre)
          INSERT INTO Productos (Codigo, Nombre, Precio, CategoriaId, RequierePreparacion, StockActual, StockMinimo, Activo)
          VALUES (@codigo, @nombre, @precio, @catId, @prep, @stock, 5, 1)
        `);
      console.log(`Producto añadido/verificado: ${p.nombre}`);
    }

    await pool.close();
    console.log('Seeding completado');
  } catch (err) {
    console.error('Error en seeding:', err);
  }
}

seed();
