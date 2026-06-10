-- ===================================================================
-- TABLA DE CONTRIBUYENTES DNIT (Paraguay)
-- Optimizada para búsqueda instantánea por RUC y Razón Social
-- ===================================================================

USE RestauranteDB;
GO

-- Eliminar si existe (para re-importación limpia)
IF OBJECT_ID('Contribuyentes', 'U') IS NOT NULL
    DROP TABLE Contribuyentes;
GO

CREATE TABLE Contribuyentes (
    Id           INT            NOT NULL IDENTITY(1,1),
    RUC          NVARCHAR(15)   NOT NULL,  -- Número de RUC sin DV
    DV           TINYINT        NOT NULL,  -- Dígito Verificador (0-9)
    RazonSocial  NVARCHAR(300)  NOT NULL,
    RUCCompleto  AS (RUC + '-' + CAST(DV AS NVARCHAR(1))) PERSISTED,  -- Columna calculada persistida
    CONSTRAINT PK_Contribuyentes PRIMARY KEY CLUSTERED (Id ASC)
);
GO

-- Índice principal: búsqueda exacta y prefijo por RUC
CREATE UNIQUE INDEX IX_Contribuyentes_RUC
    ON Contribuyentes (RUC ASC)
    INCLUDE (DV, RazonSocial);
GO

-- Índice para autocompletado por Razón Social (búsqueda por texto)
CREATE INDEX IX_Contribuyentes_RazonSocial
    ON Contribuyentes (RazonSocial ASC)
    INCLUDE (RUC, DV);
GO

PRINT 'Tabla Contribuyentes creada con índices optimizados.';
GO
