-- Esquema de Base de Datos para Sistema de Restaurante (La Parada Bar)
-- Objetivo: SQL Server 2022
-- Idioma: Español

USE master;
GO

IF EXISTS (SELECT * FROM sys.databases WHERE name = 'RestauranteDB')
BEGIN
    ALTER DATABASE RestauranteDB SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE RestauranteDB;
END
GO

CREATE DATABASE RestauranteDB;
GO

USE RestauranteDB;
GO

-- 1. Roles y Usuarios
CREATE TABLE Roles (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Nombre NVARCHAR(50) NOT NULL UNIQUE
);

INSERT INTO Roles (Nombre) VALUES ('Administrador'), ('Cajero'), ('Mesero');

CREATE TABLE Usuarios (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Usuario NVARCHAR(50) NOT NULL UNIQUE,
    Contrasena NVARCHAR(255) NOT NULL, -- Usar hash en producción
    NombreCompleto NVARCHAR(100),
    RoleId INT FOREIGN KEY REFERENCES Roles(Id),
    Activo BIT DEFAULT 1
);

-- Usuario Administrador por defecto
INSERT INTO Usuarios (Usuario, Contrasena, NombreCompleto, RoleId) 
VALUES ('admin', 'admin123', 'Administrador del Sistema', 1);

-- 2. Menú y Productos
CREATE TABLE Categorias (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Nombre NVARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE Productos (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Nombre NVARCHAR(150) NOT NULL,
    Precio DECIMAL(18, 2) NOT NULL,
    CategoriaId INT FOREIGN KEY REFERENCES Categorias(Id),
    Activo BIT DEFAULT 1,
    ImagenUrl NVARCHAR(MAX),
    RequierePreparacion BIT DEFAULT 1,
    ControlStock BIT DEFAULT 0,
    StockActual INT DEFAULT 0,
    StockMinimo INT DEFAULT 0
);

-- 3. Salón y Mesas
CREATE TABLE EstadosMesa (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Nombre NVARCHAR(50) NOT NULL UNIQUE
);

INSERT INTO EstadosMesa (Nombre) VALUES ('Disponible'), ('Ocupada'), ('En Limpieza'), ('Reservada');

CREATE TABLE Mesas (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Numero INT NOT NULL UNIQUE,
    Capacidad INT DEFAULT 2,
    EstadoId INT DEFAULT 1 FOREIGN KEY REFERENCES EstadosMesa(Id)
);

-- 4. Pedidos y Cocina
CREATE TABLE EstadosItemsPedido (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Nombre NVARCHAR(50) NOT NULL UNIQUE
);

INSERT INTO EstadosItemsPedido (Nombre) VALUES ('Pendiente'), ('En Preparación'), ('Listo'), ('Entregado');

CREATE TABLE Pedidos (
    Id INT PRIMARY KEY IDENTITY(1,1),
    MesaId INT FOREIGN KEY REFERENCES Mesas(Id),
    MeseroId INT FOREIGN KEY REFERENCES Usuarios(Id),
    FechaCreacion DATETIME DEFAULT GETDATE(),
    Estado NVARCHAR(50) DEFAULT 'Abierto', -- Abierto, Cerrado, Cancelado
    Total DECIMAL(18, 2) DEFAULT 0
);

CREATE TABLE ItemsPedido (
    Id INT PRIMARY KEY IDENTITY(1,1),
    PedidoId INT FOREIGN KEY REFERENCES Pedidos(Id),
    ProductoId INT FOREIGN KEY REFERENCES Productos(Id),
    Cantidad INT NOT NULL DEFAULT 1,
    PrecioUnitario DECIMAL(18, 2) NOT NULL,
    Observaciones NVARCHAR(255),
    EstadoItemId INT DEFAULT 1 FOREIGN KEY REFERENCES EstadosItemsPedido(Id)
);

-- 5. Facturación
CREATE TABLE Facturas (
    Id INT PRIMARY KEY IDENTITY(1,1),
    PedidoId INT FOREIGN KEY REFERENCES Pedidos(Id),
    CajeroId INT FOREIGN KEY REFERENCES Usuarios(Id),
    NombreCliente NVARCHAR(150) DEFAULT 'Consumidor Final',
    RUCCliente NVARCHAR(50),
    MetodoPago NVARCHAR(50), -- Efectivo, Tarjeta, etc.
    Total DECIMAL(18, 2) NOT NULL,
    FechaEmision DATETIME DEFAULT GETDATE(),
    NumeroFactura NVARCHAR(50) -- Para cumplimiento SET/SIFEN
);

-- 6. Configuración
CREATE TABLE Configuracion (
    Clave NVARCHAR(100) PRIMARY KEY,
    Valor NVARCHAR(MAX)
);
GO

-- Datos iniciales de prueba
INSERT INTO Categorias (Nombre) VALUES ('Bebidas'), ('Entradas'), ('Platos Principales'), ('Postres');
INSERT INTO Productos (Nombre, Precio, CategoriaId) VALUES 
('Agua Mineral 500ml', 5000, 1),
('Gaseosa 500ml', 8000, 1),
('Bife de Chorizo', 50000, 3),
('Milanesa con Papas', 35000, 3);

INSERT INTO Mesas (Numero, Capacidad) VALUES (1, 2), (2, 4), (3, 4), (4, 6), (5, 8);
GO
