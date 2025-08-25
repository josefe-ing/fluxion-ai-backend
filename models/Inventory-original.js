// =====================================================================================
// FLUXION AI - INVENTORY MODEL
// Modelo de datos para movimientos de inventario y trazabilidad
// =====================================================================================

const { query } = require('../config/database');

/**
 * Modelo Inventory con gestión de movimientos y trazabilidad completa
 */
class Inventory {
  
  /**
   * Obtener todos los movimientos de inventario con filtros
   * @param {Object} options - Opciones de filtrado
   * @param {number} options.productId - Filtrar por producto
   * @param {string} options.movementType - Filtrar por tipo de movimiento
   * @param {string} options.referenceType - Filtrar por tipo de referencia
   * @param {string} options.dateFrom - Fecha inicio (YYYY-MM-DD)
   * @param {string} options.dateTo - Fecha fin (YYYY-MM-DD)
   * @param {number} options.limit - Límite de resultados
   * @param {number} options.offset - Offset para paginación
   * @returns {Promise<Array>} Lista de movimientos
   */
  static async getAllMovements(options = {}) {
    try {
      let whereConditions = [];
      let params = [];
      let paramIndex = 1;

      // Construir condiciones WHERE dinámicamente
      if (options.productId) {
        whereConditions.push(`im.product_id = $${paramIndex}`);
        params.push(options.productId);
        paramIndex++;
      }

      if (options.movementType) {
        whereConditions.push(`im.movement_type = $${paramIndex}`);
        params.push(options.movementType);
        paramIndex++;
      }

      if (options.referenceType) {
        whereConditions.push(`im.reference_type = $${paramIndex}`);
        params.push(options.referenceType);
        paramIndex++;
      }

      if (options.dateFrom) {
        whereConditions.push(`im.created_at >= $${paramIndex}`);
        params.push(options.dateFrom);
        paramIndex++;
      }

      if (options.dateTo) {
        whereConditions.push(`im.created_at <= $${paramIndex}`);
        params.push(options.dateTo + ' 23:59:59');
        paramIndex++;
      }

      // Construir query
      let sql = `
        SELECT 
          im.id, im.product_id, im.movement_type, im.quantity,
          im.previous_stock, im.new_stock, im.cost_per_unit,
          im.reference_type, im.reference_id, im.notes,
          im.created_at,
          p.sku, p.name as product_name, p.category, p.brand,
          p.current_stock,
          ABS(im.quantity) as abs_quantity,
          ROUND(ABS(im.quantity * im.cost_per_unit), 2) as movement_value,
          CASE 
            WHEN im.reference_type = 'venta' AND im.reference_id IS NOT NULL THEN
              (SELECT s.invoice_number FROM sales s WHERE s.id = im.reference_id)
            WHEN im.reference_type = 'compra' AND im.reference_id IS NOT NULL THEN
              CONCAT('COMPRA-', im.reference_id)
            ELSE NULL
          END as reference_number
        FROM inventory_movements im
        INNER JOIN products p ON im.product_id = p.id
      `;

      if (whereConditions.length > 0) {
        sql += ` WHERE ${whereConditions.join(' AND ')}`;
      }

      sql += ` ORDER BY im.created_at DESC, im.id DESC`;

      if (options.limit) {
        sql += ` LIMIT $${paramIndex}`;
        params.push(options.limit);
        paramIndex++;
      }

      if (options.offset) {
        sql += ` OFFSET $${paramIndex}`;
        params.push(options.offset);
      }

      const result = await query(sql, params);
      return result.rows;

    } catch (error) {
      console.error('💥 Error obteniendo movimientos de inventario:', error.message);
      throw new Error(`Error obteniendo movimientos: ${error.message}`);
    }
  }

  /**
   * Obtener un movimiento por ID
   * @param {number} id - ID del movimiento
   * @returns {Promise<Object|null>} Movimiento encontrado o null
   */
  static async getMovementById(id) {
    try {
      const result = await query(`
        SELECT 
          im.id, im.product_id, im.movement_type, im.quantity,
          im.previous_stock, im.new_stock, im.cost_per_unit,
          im.reference_type, im.reference_id, im.notes,
          im.created_at,
          p.sku, p.name as product_name, p.category, p.brand,
          p.cost_price, p.selling_price,
          ROUND(ABS(im.quantity * im.cost_per_unit), 2) as movement_value
        FROM inventory_movements im
        INNER JOIN products p ON im.product_id = p.id
        WHERE im.id = $1
      `, [id]);

      return result.rows[0] || null;

    } catch (error) {
      console.error('💥 Error obteniendo movimiento por ID:', error.message);
      throw new Error(`Error obteniendo movimiento: ${error.message}`);
    }
  }

  /**
   * Registrar un movimiento de inventario manual
   * @param {Object} movementData - Datos del movimiento
   * @returns {Promise<Object>} Movimiento registrado
   */
  static async recordMovement(movementData) {
    const client = await query('BEGIN');
    
    try {
      const {
        product_id, movement_type, quantity, cost_per_unit,
        reference_type = 'ajuste', reference_id = null, notes
      } = movementData;

      // Validar tipo de movimiento
      const validTypes = ['entrada', 'salida'];
      if (!validTypes.includes(movement_type)) {
        throw new Error(`Tipo de movimiento inválido: ${movement_type}`);
      }

      // Obtener producto actual
      const product = await query(
        'SELECT id, name, current_stock, cost_price FROM products WHERE id = $1 AND active = true',
        [product_id]
      );

      if (product.rows.length === 0) {
        throw new Error(`Producto con ID ${product_id} no encontrado o inactivo`);
      }

      const currentProduct = product.rows[0];
      const previousStock = currentProduct.current_stock;
      
      // Calcular nuevo stock
      const adjustedQuantity = movement_type === 'entrada' ? Math.abs(quantity) : -Math.abs(quantity);
      const newStock = previousStock + adjustedQuantity;

      // Validar que el stock no sea negativo
      if (newStock < 0) {
        throw new Error(`Stock insuficiente. Stock actual: ${previousStock}, Cantidad solicitada: ${Math.abs(quantity)}`);
      }

      // Usar cost_per_unit proporcionado o el costo actual del producto
      const finalCostPerUnit = cost_per_unit || currentProduct.cost_price;

      // Registrar movimiento
      const movementResult = await query(`
        INSERT INTO inventory_movements (
          product_id, movement_type, quantity, previous_stock, new_stock,
          cost_per_unit, reference_type, reference_id, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        product_id, movement_type, adjustedQuantity, previousStock, newStock,
        finalCostPerUnit, reference_type, reference_id, notes
      ]);

      // Actualizar stock del producto
      await query(
        'UPDATE products SET current_stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newStock, product_id]
      );

      await query('COMMIT');

      return await this.getMovementById(movementResult.rows[0].id);

    } catch (error) {
      await query('ROLLBACK');
      console.error('💥 Error registrando movimiento:', error.message);
      throw new Error(`Error registrando movimiento: ${error.message}`);
    }
  }

  /**
   * Obtener historial de un producto específico
   * @param {number} productId - ID del producto
   * @param {number} limit - Límite de resultados
   * @returns {Promise<Array>} Historial de movimientos del producto
   */
  static async getProductHistory(productId, limit = 50) {
    try {
      const result = await query(`
        SELECT 
          im.id, im.movement_type, im.quantity,
          im.previous_stock, im.new_stock, im.cost_per_unit,
          im.reference_type, im.reference_id, im.notes,
          im.created_at,
          ROUND(ABS(im.quantity * im.cost_per_unit), 2) as movement_value,
          CASE 
            WHEN im.reference_type = 'venta' AND im.reference_id IS NOT NULL THEN
              (SELECT s.invoice_number FROM sales s WHERE s.id = im.reference_id)
            WHEN im.reference_type = 'compra' AND im.reference_id IS NOT NULL THEN
              CONCAT('COMPRA-', im.reference_id)
            ELSE 'AJUSTE MANUAL'
          END as reference_description,
          p.name as product_name,
          p.sku
        FROM inventory_movements im
        INNER JOIN products p ON im.product_id = p.id
        WHERE im.product_id = $1
        ORDER BY im.created_at DESC, im.id DESC
        LIMIT $2
      `, [productId, limit]);

      return result.rows;

    } catch (error) {
      console.error('💥 Error obteniendo historial del producto:', error.message);
      throw new Error(`Error obteniendo historial: ${error.message}`);
    }
  }

  /**
   * Obtener estadísticas de inventario
   * @param {Object} options - Opciones de período
   * @param {string} options.dateFrom - Fecha inicio
   * @param {string} options.dateTo - Fecha fin
   * @returns {Promise<Object>} Estadísticas de inventario
   */
  static async getInventoryStats(options = {}) {
    try {
      const { dateFrom, dateTo } = options;
      let whereClause = '';
      const params = [];

      if (dateFrom && dateTo) {
        whereClause = 'WHERE im.created_at BETWEEN $1 AND $2';
        params.push(dateFrom, dateTo + ' 23:59:59');
      }

      const result = await query(`
        SELECT 
          COUNT(*) as total_movements,
          COUNT(*) FILTER (WHERE movement_type = 'entrada') as inbound_movements,
          COUNT(*) FILTER (WHERE movement_type = 'salida') as outbound_movements,
          ROUND(SUM(ABS(quantity * cost_per_unit)) FILTER (WHERE movement_type = 'entrada'), 2) as inbound_value,
          ROUND(SUM(ABS(quantity * cost_per_unit)) FILTER (WHERE movement_type = 'salida'), 2) as outbound_value,
          SUM(ABS(quantity)) FILTER (WHERE movement_type = 'entrada') as total_units_in,
          SUM(ABS(quantity)) FILTER (WHERE movement_type = 'salida') as total_units_out,
          COUNT(DISTINCT product_id) as products_affected,
          COUNT(*) FILTER (WHERE reference_type = 'venta') as sales_movements,
          COUNT(*) FILTER (WHERE reference_type = 'compra') as purchase_movements,
          COUNT(*) FILTER (WHERE reference_type = 'ajuste') as adjustment_movements
        FROM inventory_movements im
        ${whereClause}
      `, params);

      const stats = result.rows[0];

      // Obtener productos más movidos
      const topMovedResult = await query(`
        SELECT 
          p.name,
          p.sku,
          p.category,
          COUNT(im.id) as movement_count,
          SUM(ABS(im.quantity)) as total_units_moved,
          ROUND(SUM(ABS(im.quantity * im.cost_per_unit)), 2) as total_value_moved
        FROM products p
        INNER JOIN inventory_movements im ON p.id = im.product_id
        ${whereClause.replace('im.', 'im.')}
        GROUP BY p.id, p.name, p.sku, p.category
        ORDER BY movement_count DESC, total_units_moved DESC
        LIMIT 10
      `, params);

      stats.most_moved_products = topMovedResult.rows;

      // Obtener resumen de stock actual
      const stockSummaryResult = await query(`
        SELECT 
          COUNT(*) as total_products,
          SUM(current_stock) as total_units_in_stock,
          ROUND(SUM(current_stock * cost_price), 2) as total_inventory_value,
          COUNT(*) FILTER (WHERE current_stock <= min_stock_threshold) as low_stock_products,
          COUNT(*) FILTER (WHERE current_stock = 0) as out_of_stock_products,
          ROUND(AVG(current_stock), 2) as avg_stock_per_product
        FROM products
        WHERE active = true
      `);

      stats.current_stock_summary = stockSummaryResult.rows[0];

      return stats;

    } catch (error) {
      console.error('💥 Error obteniendo estadísticas de inventario:', error.message);
      throw new Error(`Error obteniendo estadísticas: ${error.message}`);
    }
  }

  /**
   * Obtener análisis de rotación de inventario
   * @param {number} days - Período de análisis en días
   * @returns {Promise<Array>} Análisis de rotación por producto
   */
  static async getInventoryTurnover(days = 90) {
    try {
      const result = await query(`
        WITH product_movements AS (
          SELECT 
            p.id,
            p.sku,
            p.name,
            p.category,
            p.brand,
            p.current_stock,
            p.cost_price,
            COALESCE(SUM(ABS(im.quantity)) FILTER (WHERE im.movement_type = 'salida'), 0) as units_sold,
            COALESCE(SUM(ABS(im.quantity)) FILTER (WHERE im.movement_type = 'entrada'), 0) as units_received,
            COALESCE(AVG(p.current_stock), p.current_stock) as avg_stock
          FROM products p
          LEFT JOIN inventory_movements im ON p.id = im.product_id
            AND im.created_at >= CURRENT_DATE - INTERVAL '${days} days'
          WHERE p.active = true
          GROUP BY p.id, p.sku, p.name, p.category, p.brand, p.current_stock, p.cost_price
        )
        SELECT 
          *,
          CASE 
            WHEN current_stock > 0 AND units_sold > 0 THEN 
              ROUND((units_sold::numeric / (${days}::numeric / 365)) / NULLIF(current_stock, 0), 2)
            ELSE 0 
          END as turnover_ratio,
          CASE 
            WHEN units_sold > 0 THEN 
              ROUND(${days}::numeric * current_stock / NULLIF(units_sold, 0), 0)
            ELSE NULL 
          END as days_of_inventory,
          ROUND(current_stock * cost_price, 2) as inventory_value,
          CASE 
            WHEN current_stock > 0 AND units_sold = 0 THEN 'Sin movimiento'
            WHEN current_stock = 0 THEN 'Sin stock'
            WHEN units_sold > 0 AND (${days}::numeric * current_stock / NULLIF(units_sold, 0)) < 30 THEN 'Rotación alta'
            WHEN units_sold > 0 AND (${days}::numeric * current_stock / NULLIF(units_sold, 0)) < 90 THEN 'Rotación normal'
            ELSE 'Rotación lenta'
          END as turnover_category
        FROM product_movements
        ORDER BY 
          CASE WHEN units_sold > 0 THEN turnover_ratio ELSE 0 END DESC,
          units_sold DESC
      `);

      return result.rows;

    } catch (error) {
      console.error('💥 Error obteniendo análisis de rotación:', error.message);
      throw new Error(`Error obteniendo análisis de rotación: ${error.message}`);
    }
  }

  /**
   * Obtener valorización de inventario por método FIFO
   * @param {number} productId - ID del producto (opcional)
   * @returns {Promise<Array>} Valorización detallada
   */
  static async getFIFOValuation(productId = null) {
    try {
      let whereClause = productId ? 'WHERE p.id = $1' : '';
      let params = productId ? [productId] : [];

      const result = await query(`
        WITH inventory_layers AS (
          SELECT 
            im.product_id,
            im.quantity,
            im.cost_per_unit,
            im.created_at,
            SUM(im.quantity) OVER (
              PARTITION BY im.product_id 
              ORDER BY im.created_at 
              ROWS UNBOUNDED PRECEDING
            ) as running_stock,
            ROW_NUMBER() OVER (
              PARTITION BY im.product_id 
              ORDER BY im.created_at
            ) as layer_order
          FROM inventory_movements im
          WHERE im.movement_type = 'entrada'
          AND im.quantity > 0
        ),
        current_layers AS (
          SELECT 
            il.*,
            p.current_stock,
            p.name as product_name,
            p.sku,
            LEAST(
              il.quantity,
              GREATEST(0, p.current_stock - COALESCE(LAG(il.running_stock) OVER (
                PARTITION BY il.product_id 
                ORDER BY il.created_at
              ), 0))
            ) as remaining_quantity
          FROM inventory_layers il
          INNER JOIN products p ON il.product_id = p.id
          ${whereClause}
        )
        SELECT 
          product_id,
          product_name,
          sku,
          current_stock,
          layer_order,
          remaining_quantity,
          cost_per_unit,
          ROUND(remaining_quantity * cost_per_unit, 2) as layer_value,
          created_at as purchase_date
        FROM current_layers
        WHERE remaining_quantity > 0
        ORDER BY product_id, layer_order
      `, params);

      // Agrupar por producto si no se especificó uno
      if (!productId) {
        const grouped = {};
        let totalValue = 0;
        let totalUnits = 0;

        result.rows.forEach(row => {
          if (!grouped[row.product_id]) {
            grouped[row.product_id] = {
              product_id: row.product_id,
              product_name: row.product_name,
              sku: row.sku,
              current_stock: row.current_stock,
              layers: [],
              total_value: 0,
              avg_cost: 0
            };
          }

          grouped[row.product_id].layers.push({
            layer_order: row.layer_order,
            remaining_quantity: row.remaining_quantity,
            cost_per_unit: row.cost_per_unit,
            layer_value: row.layer_value,
            purchase_date: row.purchase_date
          });

          grouped[row.product_id].total_value += parseFloat(row.layer_value);
          totalValue += parseFloat(row.layer_value);
          totalUnits += parseFloat(row.remaining_quantity);
        });

        // Calcular costo promedio ponderado para cada producto
        Object.values(grouped).forEach(product => {
          if (product.current_stock > 0) {
            product.avg_cost = parseFloat((product.total_value / product.current_stock).toFixed(2));
          }
        });

        return {
          products: Object.values(grouped),
          summary: {
            total_inventory_value: parseFloat(totalValue.toFixed(2)),
            total_units: totalUnits,
            avg_cost_per_unit: totalUnits > 0 ? parseFloat((totalValue / totalUnits).toFixed(2)) : 0
          }
        };
      }

      return result.rows;

    } catch (error) {
      console.error('💥 Error obteniendo valorización FIFO:', error.message);
      throw new Error(`Error obteniendo valorización: ${error.message}`);
    }
  }

  /**
   * Procesar entrada de inventario (compra/recepción)
   * @param {Object} entryData - Datos de la entrada
   * @returns {Promise<Array>} Movimientos registrados
   */
  static async processInventoryEntry(entryData) {
    const client = await query('BEGIN');
    
    try {
      const { reference_type = 'compra', reference_id, notes, items } = entryData;

      if (!items || items.length === 0) {
        throw new Error('Debe especificar al menos un producto');
      }

      const movements = [];

      for (const item of items) {
        const { product_id, quantity, cost_per_unit } = item;

        if (quantity <= 0) {
          throw new Error('La cantidad debe ser mayor a cero');
        }

        const movement = await this.recordMovement({
          product_id,
          movement_type: 'entrada',
          quantity,
          cost_per_unit,
          reference_type,
          reference_id,
          notes
        });

        movements.push(movement);
      }

      await query('COMMIT');
      return movements;

    } catch (error) {
      await query('ROLLBACK');
      console.error('💥 Error procesando entrada de inventario:', error.message);
      throw new Error(`Error procesando entrada: ${error.message}`);
    }
  }

  /**
   * Obtener alertas de inventario
   * @returns {Promise<Object>} Alertas de stock y movimientos
   */
  static async getInventoryAlerts() {
    try {
      // Productos con stock bajo
      const lowStockResult = await query(`
        SELECT 
          id, sku, name, category, current_stock, min_stock_threshold,
          ROUND((min_stock_threshold - current_stock)::numeric / min_stock_threshold * 100, 1) as shortage_percentage
        FROM products
        WHERE current_stock <= min_stock_threshold
        AND active = true
        ORDER BY shortage_percentage DESC
        LIMIT 20
      `);

      // Productos sin movimiento reciente
      const noMovementResult = await query(`
        SELECT 
          p.id, p.sku, p.name, p.category, p.current_stock,
          ROUND(p.current_stock * p.cost_price, 2) as tied_capital,
          COALESCE(MAX(im.created_at), p.created_at) as last_movement
        FROM products p
        LEFT JOIN inventory_movements im ON p.id = im.product_id
        WHERE p.active = true
        GROUP BY p.id, p.sku, p.name, p.category, p.current_stock, p.cost_price, p.created_at
        HAVING COALESCE(MAX(im.created_at), p.created_at) < CURRENT_DATE - INTERVAL '60 days'
        AND p.current_stock > 0
        ORDER BY tied_capital DESC
        LIMIT 15
      `);

      // Productos con exceso de stock
      const overStockResult = await query(`
        SELECT 
          id, sku, name, category, current_stock, max_stock_threshold,
          ROUND((current_stock - max_stock_threshold)::numeric / max_stock_threshold * 100, 1) as excess_percentage,
          ROUND((current_stock - max_stock_threshold) * cost_price, 2) as excess_value
        FROM products
        WHERE current_stock > max_stock_threshold
        AND active = true
        ORDER BY excess_percentage DESC
        LIMIT 15
      `);

      // Movimientos sospechosos (grandes cambios)
      const suspiciousMovementsResult = await query(`
        SELECT 
          im.id, im.product_id, im.movement_type, im.quantity,
          im.previous_stock, im.new_stock, im.reference_type,
          im.created_at, im.notes,
          p.sku, p.name as product_name,
          ABS(im.quantity::numeric / NULLIF(im.previous_stock, 0)) as change_ratio
        FROM inventory_movements im
        INNER JOIN products p ON im.product_id = p.id
        WHERE im.created_at >= CURRENT_DATE - INTERVAL '7 days'
        AND im.previous_stock > 0
        AND ABS(im.quantity::numeric / im.previous_stock) > 0.5
        ORDER BY change_ratio DESC
        LIMIT 10
      `);

      return {
        low_stock_alerts: lowStockResult.rows,
        no_movement_alerts: noMovementResult.rows,
        overstock_alerts: overStockResult.rows,
        suspicious_movements: suspiciousMovementsResult.rows,
        summary: {
          critical_alerts: lowStockResult.rows.length,
          dormant_products: noMovementResult.rows.length,
          overstock_products: overStockResult.rows.length,
          suspicious_count: suspiciousMovementsResult.rows.length
        }
      };

    } catch (error) {
      console.error('💥 Error obteniendo alertas de inventario:', error.message);
      throw new Error(`Error obteniendo alertas: ${error.message}`);
    }
  }
}

module.exports = Inventory;