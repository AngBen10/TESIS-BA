import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';

/**
 * GET /api/escandallo/costos?productoId=X&margen=0.70
 *
 * Motor de Costeo del Módulo de Escandallo.
 *
 * Recibe el ID de un producto, consulta la base de datos y devuelve
 * el cálculo matemático completo de costos y rentabilidad.
 *
 * ── Fórmulas aplicadas ──────────────────────────────────────────────
 *
 * Para cada ingrediente de la receta:
 *   costoLinea = (cantidad / factorConversion) * costoPorUnidadCompra
 *              * (1 + porcentajeMerma / 100)
 *
 * Donde:
 *   - cantidad           = gramos / ml / unidades según la receta
 *   - factorConversion   = cuántas unidades de receta tiene una unidad de compra
 *   - costoPorUnidadCompra = precio de compra en Gs. por unidad
 *   - porcentajeMerma    = % de desperdicio (aumenta el costo real)
 *
 * Costo de ingredientes = Σ costoLinea de todos los ingredientes
 *
 * Costos indirectos:
 *   - Tipo 'fijo':       se suma el monto directamente
 *   - Tipo 'porcentaje': se aplica el % sobre el costo de ingredientes
 *
 * Costo total = costoIngredientes + costoIndirectoTotal
 *
 * Precio sugerido = costoTotal / (1 - margenDeseado)
 *   donde margenDeseado es el % de ganancia sobre el precio de venta
 *   (parámetro "margen" en la URL, default: 0.70 = 70%)
 *
 * Margen real = (precioVenta - costoTotal) / precioVenta * 100
 *
 * ────────────────────────────────────────────────────────────────────
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const productoId    = searchParams.get('productoId');
    const margenParam   = searchParams.get('margen');

    if (!productoId) {
      return NextResponse.json({ error: 'Se requiere el parámetro productoId' }, { status: 400 });
    }

    // Margen deseado (como decimal: 0.70 = 70%). Por defecto 70%.
    const margenDeseado = margenParam ? Math.min(Math.max(parseFloat(margenParam), 0.01), 0.99) : 0.70;

    const pool = await getPool();

    // ── 1. Datos del producto ────────────────────────────────────────
    const prodRes = await pool.request()
      .input('pid', sql.Int, parseInt(productoId))
      .query(`
        SELECT p.Id, p.Nombre, p.Precio, c.Nombre AS CategoriaNombre
        FROM Productos p
        LEFT JOIN Categorias c ON p.CategoriaId = c.Id
        WHERE p.Id = @pid AND p.Activo = 1
      `);

    if (prodRes.recordset.length === 0) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    const producto = prodRes.recordset[0];

    // ── 2. Ingredientes de la receta con cálculo de costo ────────────
    const recetaRes = await pool.request()
      .input('pid', sql.Int, parseInt(productoId))
      .query(`
        SELECT
          r.Id              AS RecetaId,
          i.Id              AS IngredienteId,
          i.Nombre          AS Ingrediente,
          r.Cantidad,
          i.UnidadReceta,
          i.UnidadCompra,
          i.CostoPorUnidadCompra,
          i.FactorConversion,
          i.PorcentajeMerma,
          -- Costo real considerando merma
          ROUND(
            (r.Cantidad / NULLIF(i.FactorConversion, 0))
            * i.CostoPorUnidadCompra
            * (1 + i.PorcentajeMerma / 100.0),
          2) AS CostoLinea,
          -- Costo sin merma (para comparación)
          ROUND(
            (r.Cantidad / NULLIF(i.FactorConversion, 0))
            * i.CostoPorUnidadCompra,
          2) AS CostoSinMerma
        FROM Recetas r
        INNER JOIN Ingredientes i ON r.IngredienteId = i.Id
        WHERE r.ProductoId = @pid AND i.Activo = 1
        ORDER BY CostoLinea DESC
      `);

    const lineasIngredientes = recetaRes.recordset.map(r => ({
      ingredienteId:        r.IngredienteId,
      ingrediente:          r.Ingrediente,
      cantidad:             parseFloat(r.Cantidad),
      unidadReceta:         r.UnidadReceta,
      unidadCompra:         r.UnidadCompra,
      costoPorUnidadCompra: parseFloat(r.CostoPorUnidadCompra),
      factorConversion:     parseFloat(r.FactorConversion),
      porcentajeMerma:      parseFloat(r.PorcentajeMerma),
      costoSinMerma:        parseFloat(r.CostoSinMerma),
      costoLinea:           parseFloat(r.CostoLinea),
    }));

    // ── 3. Suma del costo de ingredientes ────────────────────────────
    const costoIngredientes = lineasIngredientes.reduce((sum, l) => sum + l.costoLinea, 0);

    // ── 4. Costos indirectos ─────────────────────────────────────────
    const indirectosRes = await pool.request()
      .input('pid', sql.Int, parseInt(productoId))
      .query(`
        SELECT Id, Descripcion, Tipo, Valor
        FROM CostosIndirectos
        WHERE ProductoId = @pid
        ORDER BY Tipo, Descripcion
      `);

    let costoIndirectoTotal = 0;
    const costosIndirectos = indirectosRes.recordset.map(ci => {
      let montoCalculado;
      if (ci.Tipo === 'fijo') {
        montoCalculado = parseFloat(ci.Valor);
      } else {
        // Porcentaje sobre el costo de ingredientes
        montoCalculado = costoIngredientes * (parseFloat(ci.Valor) / 100);
      }
      montoCalculado = Math.round(montoCalculado * 100) / 100;
      costoIndirectoTotal += montoCalculado;
      return {
        id:          ci.Id,
        descripcion: ci.Descripcion,
        tipo:        ci.Tipo,
        valor:       parseFloat(ci.Valor),
        monto:       montoCalculado,
      };
    });

    // ── 5. Costo total ───────────────────────────────────────────────
    const costoTotal = Math.round((costoIngredientes + costoIndirectoTotal) * 100) / 100;

    // ── 6. Análisis de rentabilidad ──────────────────────────────────
    const precioVenta     = parseFloat(producto.Precio);
    const precioSugerido  = costoTotal > 0 ? Math.round(costoTotal / (1 - margenDeseado)) : 0;
    const margenReal      = precioVenta > 0
      ? Math.round(((precioVenta - costoTotal) / precioVenta) * 10000) / 100
      : 0;
    const gananciaReal    = Math.round((precioVenta - costoTotal) * 100) / 100;
    const rentabilidad    = margenReal >= 60 ? 'Alta' : margenReal >= 40 ? 'Media' : margenReal >= 20 ? 'Baja' : 'Crítica';

    // ── 7. Participación porcentual de cada ingrediente en el costo ──
    const lineasConPct = lineasIngredientes.map(l => ({
      ...l,
      pctDelCosto: costoIngredientes > 0
        ? Math.round((l.costoLinea / costoIngredientes) * 10000) / 100
        : 0,
    }));

    // ── 8. Respuesta JSON completa ───────────────────────────────────
    return NextResponse.json({
      // Datos del producto
      productoId:          producto.Id,
      producto:            producto.Nombre,
      categoria:           producto.CategoriaNombre,
      precioVenta,

      // Desglose de costos
      lineasIngredientes:  lineasConPct,
      costoIngredientes:   Math.round(costoIngredientes * 100) / 100,

      costosIndirectos,
      costoIndirectoTotal: Math.round(costoIndirectoTotal * 100) / 100,

      costoTotal,

      // Análisis financiero
      margenDeseado:       Math.round(margenDeseado * 10000) / 100, // como %
      precioSugerido,
      margenReal,
      gananciaReal,
      rentabilidad,

      // Metadatos
      tieneReceta:         lineasIngredientes.length > 0,
      cantidadIngredientes: lineasIngredientes.length,
    });

  } catch (err) {
    console.error('Error GET /api/escandallo/costos:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
