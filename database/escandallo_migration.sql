-- ═══════════════════════════════════════════════════════════════════
--  MÓDULO DE ESCANDALLO — Migración de Base de Datos
--  Sistema: La Parada Bar
--  Descripción: Agrega las tablas de Ingredientes, Recetas y Costos
--               Indirectos al esquema existente de RestauranteDB.
--  Instrucciones: Ejecutar contra la base de datos RestauranteDB.
-- ═══════════════════════════════════════════════════════════════════

USE RestauranteDB;
GO

-- ── 1. INGREDIENTES (Inventario de Materia Prima) ──────────────────
--
-- UnidadCompra:         Cómo se compra el insumo ("Kg", "Lt", "Unidad", "Docena")
-- CostoPorUnidadCompra: Precio total de una unidad de compra (en Gs.)
-- UnidadReceta:         Cómo se usa en la receta ("g", "ml", "unidad")
-- FactorConversion:     Cuántas UnidadesReceta tiene una UnidadCompra
--                       Ej: 1 Kg = 1000 g → FactorConversion = 1000
-- PorcentajeMerma:      % del ingrediente que se pierde en preparación
--                       Ej: 10 → se necesita un 10% extra para compensar
-- ──────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Ingredientes')
BEGIN
    CREATE TABLE Ingredientes (
        Id                   INT PRIMARY KEY IDENTITY(1,1),
        Nombre               NVARCHAR(150)  NOT NULL,
        UnidadCompra         NVARCHAR(50)   NOT NULL,
        CostoPorUnidadCompra DECIMAL(18,2)  NOT NULL,
        UnidadReceta         NVARCHAR(50)   NOT NULL,
        FactorConversion     DECIMAL(18,6)  NOT NULL DEFAULT 1,
        PorcentajeMerma      DECIMAL(5,2)   NOT NULL DEFAULT 0,
        StockActual          DECIMAL(18,3)  DEFAULT 0,
        Proveedor            NVARCHAR(100),
        Notas                NVARCHAR(255),
        Activo               BIT            DEFAULT 1,
        FechaCreacion        DATETIME       DEFAULT GETDATE()
    );
    PRINT 'Tabla Ingredientes creada OK';
END
ELSE
    PRINT 'Tabla Ingredientes ya existe - omitida';
GO

-- ── 2. RECETAS (Relación Plato ↔ Ingredientes) ────────────────────
--
-- ProductoId:   FK a Productos (el plato del menú)
-- IngredienteId: FK a Ingredientes (el insumo)
-- Cantidad:     Cuánto de ese ingrediente se usa, expresado en
--               la UnidadReceta del ingrediente (g, ml, unidades)
-- ──────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Recetas')
BEGIN
    CREATE TABLE Recetas (
        Id            INT PRIMARY KEY IDENTITY(1,1),
        ProductoId    INT NOT NULL,
        IngredienteId INT NOT NULL,
        Cantidad      DECIMAL(18,4) NOT NULL,
        CONSTRAINT FK_Recetas_Productos    FOREIGN KEY (ProductoId)    REFERENCES Productos(Id),
        CONSTRAINT FK_Recetas_Ingredientes FOREIGN KEY (IngredienteId) REFERENCES Ingredientes(Id),
        CONSTRAINT UQ_Receta UNIQUE (ProductoId, IngredienteId)
    );
    PRINT 'Tabla Recetas creada OK';
END
ELSE
    PRINT 'Tabla Recetas ya existe - omitida';
GO

-- ── 3. COSTOS INDIRECTOS (Mano de Obra y Gastos Generales) ────────
--
-- Tipo 'fijo':       Valor es un monto en Gs. que se suma al costo
-- Tipo 'porcentaje': Valor es un % que se aplica sobre el costo de ingredientes
-- ──────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CostosIndirectos')
BEGIN
    CREATE TABLE CostosIndirectos (
        Id          INT PRIMARY KEY IDENTITY(1,1),
        ProductoId  INT NOT NULL,
        Descripcion NVARCHAR(100) NOT NULL,
        Tipo        NVARCHAR(20)  NOT NULL DEFAULT 'fijo',  -- 'fijo' | 'porcentaje'
        Valor       DECIMAL(18,2) NOT NULL,
        CONSTRAINT FK_CostosIndirectos_Productos FOREIGN KEY (ProductoId) REFERENCES Productos(Id),
        CONSTRAINT CK_Tipo CHECK (Tipo IN ('fijo', 'porcentaje'))
    );
    PRINT 'Tabla CostosIndirectos creada OK';
END
ELSE
    PRINT 'Tabla CostosIndirectos ya existe - omitida';
GO

-- ═══════════════════════════════════════════════════════════════════
--  DATOS DE EJEMPLO — Ingredientes para "Bife de Chorizo" y "Milanesa"
--  (Adaptados a precios de mercado paraguayo en Guaraníes)
-- ═══════════════════════════════════════════════════════════════════

-- Ingredientes base
INSERT INTO Ingredientes (Nombre, UnidadCompra, CostoPorUnidadCompra, UnidadReceta, FactorConversion, PorcentajeMerma, Proveedor)
VALUES
    ('Carne de Res (Bife)',    'Kg',    35000,  'g',       1000,  5.0, 'Frigorífico Central'),
    ('Carne de Res (Milanesa)','Kg',    28000,  'g',       1000,  8.0, 'Frigorífico Central'),
    ('Aceite de Girasol',      'Lt',     8000,  'ml',      1000,  2.0, 'Distribuidora El Triunfo'),
    ('Pan Rallado',            'Kg',    10000,  'g',       1000,  0.0, 'Panificadora La Nueva'),
    ('Huevo',                  'Docena', 9000,  'unidad',    12,  0.0, NULL),
    ('Sal Fina',               'Kg',     2500,  'g',       1000,  0.0, NULL),
    ('Pimienta Negra',         'Kg',    45000,  'g',       1000,  0.0, NULL),
    ('Limón',                  'Kg',     4000,  'unidad',     8, 10.0, NULL),
    ('Papa',                   'Kg',     5000,  'g',       1000, 15.0, 'Mercado Central'),
    ('Agua Mineral (Botella)', 'Unidad', 3000,  'unidad',     1,  0.0, 'Provisiones El Sol'),
    ('Gaseosa (Botella 500ml)','Unidad', 3500,  'unidad',     1,  0.0, 'Provisiones El Sol');
GO

-- Recuperar IDs de productos existentes para las recetas
DECLARE @IdBife     INT = (SELECT TOP 1 Id FROM Productos WHERE Nombre LIKE '%Bife%' AND Activo = 1);
DECLARE @IdMilanesa INT = (SELECT TOP 1 Id FROM Productos WHERE Nombre LIKE '%Milanesa%' AND Activo = 1);

DECLARE @IdIngCarneBife    INT = (SELECT Id FROM Ingredientes WHERE Nombre = 'Carne de Res (Bife)');
DECLARE @IdIngCarneMil     INT = (SELECT Id FROM Ingredientes WHERE Nombre = 'Carne de Res (Milanesa)');
DECLARE @IdIngAceite       INT = (SELECT Id FROM Ingredientes WHERE Nombre = 'Aceite de Girasol');
DECLARE @IdIngPanRallado   INT = (SELECT Id FROM Ingredientes WHERE Nombre = 'Pan Rallado');
DECLARE @IdIngHuevo        INT = (SELECT Id FROM Ingredientes WHERE Nombre = 'Huevo');
DECLARE @IdIngSal          INT = (SELECT Id FROM Ingredientes WHERE Nombre = 'Sal Fina');
DECLARE @IdIngPimienta     INT = (SELECT Id FROM Ingredientes WHERE Nombre = 'Pimienta Negra');
DECLARE @IdIngLimon        INT = (SELECT Id FROM Ingredientes WHERE Nombre = 'Limón');
DECLARE @IdIngPapa         INT = (SELECT Id FROM Ingredientes WHERE Nombre = 'Papa');

-- Receta: Bife de Chorizo (porción 250g de carne + guarnición)
IF @IdBife IS NOT NULL AND @IdIngCarneBife IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Recetas WHERE ProductoId = @IdBife AND IngredienteId = @IdIngCarneBife)
        INSERT INTO Recetas (ProductoId, IngredienteId, Cantidad) VALUES (@IdBife, @IdIngCarneBife, 250);   -- 250 g de bife
    IF NOT EXISTS (SELECT 1 FROM Recetas WHERE ProductoId = @IdBife AND IngredienteId = @IdIngSal)
        INSERT INTO Recetas (ProductoId, IngredienteId, Cantidad) VALUES (@IdBife, @IdIngSal, 3);            -- 3 g sal
    IF NOT EXISTS (SELECT 1 FROM Recetas WHERE ProductoId = @IdBife AND IngredienteId = @IdIngPimienta)
        INSERT INTO Recetas (ProductoId, IngredienteId, Cantidad) VALUES (@IdBife, @IdIngPimienta, 1);       -- 1 g pimienta
    IF NOT EXISTS (SELECT 1 FROM Recetas WHERE ProductoId = @IdBife AND IngredienteId = @IdIngLimon)
        INSERT INTO Recetas (ProductoId, IngredienteId, Cantidad) VALUES (@IdBife, @IdIngLimon, 1);          -- 1 limón
    IF NOT EXISTS (SELECT 1 FROM Recetas WHERE ProductoId = @IdBife AND IngredienteId = @IdIngAceite)
        INSERT INTO Recetas (ProductoId, IngredienteId, Cantidad) VALUES (@IdBife, @IdIngAceite, 15);        -- 15 ml aceite
    IF NOT EXISTS (SELECT 1 FROM Recetas WHERE ProductoId = @IdBife AND IngredienteId = @IdIngPapa)
        INSERT INTO Recetas (ProductoId, IngredienteId, Cantidad) VALUES (@IdBife, @IdIngPapa, 200);         -- 200 g papa
    PRINT 'Receta de Bife de Chorizo cargada OK';
END

-- Receta: Milanesa con Papas
IF @IdMilanesa IS NOT NULL AND @IdIngCarneMil IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Recetas WHERE ProductoId = @IdMilanesa AND IngredienteId = @IdIngCarneMil)
        INSERT INTO Recetas (ProductoId, IngredienteId, Cantidad) VALUES (@IdMilanesa, @IdIngCarneMil, 220);  -- 220 g milanesa
    IF NOT EXISTS (SELECT 1 FROM Recetas WHERE ProductoId = @IdMilanesa AND IngredienteId = @IdIngHuevo)
        INSERT INTO Recetas (ProductoId, IngredienteId, Cantidad) VALUES (@IdMilanesa, @IdIngHuevo, 1);       -- 1 huevo
    IF NOT EXISTS (SELECT 1 FROM Recetas WHERE ProductoId = @IdMilanesa AND IngredienteId = @IdIngPanRallado)
        INSERT INTO Recetas (ProductoId, IngredienteId, Cantidad) VALUES (@IdMilanesa, @IdIngPanRallado, 60); -- 60 g pan rallado
    IF NOT EXISTS (SELECT 1 FROM Recetas WHERE ProductoId = @IdMilanesa AND IngredienteId = @IdIngAceite)
        INSERT INTO Recetas (ProductoId, IngredienteId, Cantidad) VALUES (@IdMilanesa, @IdIngAceite, 80);     -- 80 ml aceite fritura
    IF NOT EXISTS (SELECT 1 FROM Recetas WHERE ProductoId = @IdMilanesa AND IngredienteId = @IdIngSal)
        INSERT INTO Recetas (ProductoId, IngredienteId, Cantidad) VALUES (@IdMilanesa, @IdIngSal, 3);
    IF NOT EXISTS (SELECT 1 FROM Recetas WHERE ProductoId = @IdMilanesa AND IngredienteId = @IdIngPapa)
        INSERT INTO Recetas (ProductoId, IngredienteId, Cantidad) VALUES (@IdMilanesa, @IdIngPapa, 200);
    PRINT 'Receta de Milanesa con Papas cargada OK';
END

-- Costos Indirectos de ejemplo
IF @IdBife IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM CostosIndirectos WHERE ProductoId = @IdBife AND Descripcion = 'Mano de Obra')
        INSERT INTO CostosIndirectos (ProductoId, Descripcion, Tipo, Valor) VALUES (@IdBife, 'Mano de Obra', 'fijo', 5000);
    IF NOT EXISTS (SELECT 1 FROM CostosIndirectos WHERE ProductoId = @IdBife AND Descripcion = 'Gas y Servicios')
        INSERT INTO CostosIndirectos (ProductoId, Descripcion, Tipo, Valor) VALUES (@IdBife, 'Gas y Servicios', 'porcentaje', 5);
END

IF @IdMilanesa IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM CostosIndirectos WHERE ProductoId = @IdMilanesa AND Descripcion = 'Mano de Obra')
        INSERT INTO CostosIndirectos (ProductoId, Descripcion, Tipo, Valor) VALUES (@IdMilanesa, 'Mano de Obra', 'fijo', 4000);
    IF NOT EXISTS (SELECT 1 FROM CostosIndirectos WHERE ProductoId = @IdMilanesa AND Descripcion = 'Gas y Servicios')
        INSERT INTO CostosIndirectos (ProductoId, Descripcion, Tipo, Valor) VALUES (@IdMilanesa, 'Gas y Servicios', 'porcentaje', 5);
END

PRINT '✔ Migración de Escandallo completada con éxito.';
GO
