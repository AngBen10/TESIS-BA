# LA PARADA - Sistema de Gestión

Este proyecto es una aplicación web y de escritorio moderna desarrollada con **Next.js** para la interfaz web/API y **Electron** para la visualización de escritorio. La base de datos utilizada es **Microsoft SQL Server**.

---

## 🚀 Cómo cambiar de Vista Web a Vista Escritorio

El proyecto está configurado de forma híbrida. Dependiendo de cómo lo inicies, puedes visualizarlo en el navegador o en una ventana de aplicación nativa.

### 1. Vista Web (Navegador)
Para ejecutar el proyecto únicamente en modo web (accesible desde tu navegador en `http://localhost:3000`):
```bash
npm run dev
```
*   **Ideal para:** Desarrollo rápido, pruebas de diseño responsivo y depuración en las herramientas de desarrollo del navegador.

### 2. Vista Escritorio (Electron)
Para ejecutar la aplicación como una aplicación de escritorio nativa:
```bash
npm run desktop
```
*   **¿Cómo funciona internamente?** Este comando utiliza `concurrently` para realizar dos acciones en paralelo:
    1. Inicia el servidor de desarrollo de Next.js (`npm run dev`).
    2. Espera a que el puerto `3000` esté listo (`wait-on http://localhost:3000`) y luego lanza **Electron** (`electron .`), abriendo una ventana nativa de escritorio maximizada apuntando a la aplicación.
*   **Configuración en `main.js`:** Electron está configurado para cargar la URL local en modo de desarrollo (`http://localhost:3000/login`) y el build estático en producción.

---

## 🔌 Configuración de la Conexión a la Base de Datos

La aplicación utiliza **Microsoft SQL Server** como base de datos principal, gestionada a través de la librería `mssql`.

### 1. Variables de Entorno (`.env.local`)
Crea o edita el archivo [.env.local](file:///c:/Columbia/TESIS-BA/.env.local) en la raíz del proyecto para definir los datos de conexión:

```env
DB_USER=adm
DB_PASSWORD=admadm
DB_SERVER=localhost
DB_PORT=50120
DB_DATABASE=RestauranteDB
DB_ENCRYPT=false
DB_TRUST_CERT=true
```

*   `DB_USER`: Usuario de SQL Server.
*   `DB_PASSWORD`: Contraseña del usuario.
*   `DB_SERVER`: Host del servidor (ej. `localhost` o una IP específica si la base de datos está en otro servidor).
*   `DB_PORT`: Puerto donde escucha SQL Server (por defecto suele ser `1433`, en este entorno configurado en `50120`).
*   `DB_DATABASE`: Nombre de la base de datos (`RestauranteDB`).
*   `DB_ENCRYPT`: Debe ser `true` si estás conectando a Azure o requieres encriptación SSL, o `false` para conexiones locales sencillas.
*   `DB_TRUST_CERT`: Establecido en `true` para confiar en certificados de servidor auto-firmados en entornos de desarrollo.

### 2. Módulo de Conexión (`src/lib/db.js`)
La conexión se administra de forma centralizada en [db.js](file:///c:/Columbia/TESIS-BA/src/lib/db.js) mediante un pool de conexiones reutilizable:

```javascript
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
```

---

## 📂 Estructura Principal del Proyecto

*   **`main.js`**: Archivo de entrada de Electron. Configura el tamaño de ventana, comportamiento y la carga del sitio.
*   **`src/app/`**: Directorio de Next.js (App Router) donde se encuentran todas las páginas y la API REST del backend.
*   **`src/lib/db.js`**: Conector principal a la base de datos SQL Server.
*   **`package.json`**: Define los scripts de inicio y las dependencias del sistema.
