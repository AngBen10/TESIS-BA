-- ===================================================================
-- SCRIPT DE MIGRACIÓN: PREPARACIÓN SIFEN / E-KUATIA (PARAGUAY)
-- Sistema: La Parada Bar
-- Motor: SQL Server 2022
-- ===================================================================

USE RestauranteDB;
GO

PRINT 'Iniciando migración de base de datos para Facturación Electrónica (SIFEN)...';

-- 1. Modificar tabla Facturas para soportar SIFEN
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Facturas') AND name = 'CDC')
BEGIN
    ALTER TABLE Facturas ADD CDC NVARCHAR(44) NULL;
    PRINT 'Columna CDC agregada a Facturas.';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Facturas') AND name = 'EnlaceQR')
BEGIN
    ALTER TABLE Facturas ADD EnlaceQR NVARCHAR(500) NULL;
    PRINT 'Columna EnlaceQR agregada a Facturas.';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Facturas') AND name = 'EstadoSIFEN')
BEGIN
    ALTER TABLE Facturas ADD EstadoSIFEN NVARCHAR(50) NULL DEFAULT 'Pendiente';
    PRINT 'Columna EstadoSIFEN agregada a Facturas.';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Facturas') AND name = 'XMLGenerado')
BEGIN
    ALTER TABLE Facturas ADD XMLGenerado NVARCHAR(MAX) NULL;
    PRINT 'Columna XMLGenerado agregada a Facturas.';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Facturas') AND name = 'RespuestaSIFEN')
BEGIN
    ALTER TABLE Facturas ADD RespuestaSIFEN NVARCHAR(MAX) NULL;
    PRINT 'Columna RespuestaSIFEN agregada a Facturas.';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Facturas') AND name = 'CodRespuestaSIFEN')
BEGIN
    ALTER TABLE Facturas ADD CodRespuestaSIFEN NVARCHAR(10) NULL;
    PRINT 'Columna CodRespuestaSIFEN agregada a Facturas.';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Facturas') AND name = 'MensajeSIFEN')
BEGIN
    ALTER TABLE Facturas ADD MensajeSIFEN NVARCHAR(MAX) NULL;
    PRINT 'Columna MensajeSIFEN agregada a Facturas.';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Facturas') AND name = 'FechaAprobacion')
BEGIN
    ALTER TABLE Facturas ADD FechaAprobacion DATETIME NULL;
    PRINT 'Columna FechaAprobacion agregada a Facturas.';
END
GO

-- 2. Insertar registros iniciales en la tabla Configuracion para el Emisor
PRINT 'Insertando parámetros iniciales de configuración del Emisor para SIFEN...';

MERGE INTO Configuracion AS Target
USING (VALUES 
    ('SIFEN_RUC', '80001234-5'),
    ('SIFEN_RazonSocial', 'La Parada Bar S.A.'),
    ('SIFEN_NombreFantasia', 'La Parada Bar'),
    ('SIFEN_Direccion', 'Avda. Principal 123, Asunción, Paraguay'),
    ('SIFEN_Telefono', '021-123456'),
    ('SIFEN_Email', 'facturacion@laparadabar.com.py'),
    ('SIFEN_Timbrado', '12345678'),
    ('SIFEN_TimbradoVigencia', '2027-12-31'),
    ('SIFEN_Establecimiento', '001'),
    ('SIFEN_PuntoExpedicion', '001'),
    ('SIFEN_Ambiente', '1'), -- 1 = Test / Sandbox, 2 = Producción
    ('SIFEN_CSC', 'ABCD1234EFGH5678IJKL9012MNOP3456'), -- Código de Seguridad del Contribuyente
    ('SIFEN_IdCSC', '0001'), -- Identificador del CSC (padded con ceros)
    ('SIFEN_CertificadoBase64', ''), -- Archivo PFX/P12 codificado en Base64
    ('SIFEN_CertificadoPassword', '') -- Contraseña del certificado digital
) AS Source (Clave, Valor)
ON Target.Clave = Source.Clave
WHEN NOT MATCHED THEN
    INSERT (Clave, Valor) VALUES (Source.Clave, Source.Valor)
WHEN MATCHED AND Target.Valor = '' OR Target.Valor IS NULL THEN
    UPDATE SET Valor = Source.Valor;
GO

PRINT 'Migración para SIFEN finalizada con éxito.';
GO
