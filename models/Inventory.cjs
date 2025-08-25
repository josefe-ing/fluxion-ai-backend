// =====================================================================================
// FLUXION AI - INVENTORY MODEL (MULTI-TENANT)
// Modelo de datos para movimientos de inventario y valuación con soporte multi-tenant
// =====================================================================================

const { query } = require('../config/database.cjs');

/**
 * Modelo Inventory con operaciones de movimientos y valuación - Multi-tenant
 * Cada método requiere un tenantSchema para operar en el schema correcto
 */
class Inventory {
  
  /**
   * Obtener todos los movimientos de inventario
   * @param {string} tenantSchema - Schema del tenant
   * @param {Object} options - Opciones de filtrado
   * @returns {Promise<Array>} Lista de movimientos
   */
  static async getAllMovements(tenantSchema, options = {}) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    try {
      let whereConditions = [];
      let params = [];
      let paramIndex = 1;

      // Construir condiciones WHERE dinámicamente
      if (options.product_id) {
        whereConditions.push(`im.product_id = $${paramIndex}`);
        params.push(options.product_id);
        paramIndex++;
      }

      if (options.movement_type) {
        whereConditions.push(`im.movement_type = $${paramIndex}`);
        params.push(options.movement_type);
        paramIndex++;
      }

      if (options.reference_type) {
        whereConditions.push(`im.reference_type = $${paramIndex}`);
        params.push(options.reference_type);
        paramIndex++;
      }

      if (options.date_from) {
        whereConditions.push(`im.created_at >= $${paramIndex}`);
        params.push(options.date_from);
        paramIndex++;
      }

      if (options.date_to) {
        whereConditions.push(`im.created_at <= $${paramIndex}`);
        params.push(options.date_to);
        paramIndex++;
      }

      let sql = `
        SELECT 
          im.id, im.product_id, im.movement_type, im.quantity,
          im.previous_stock, im.new_stock, im.cost_per_unit,
          im.reference_type, im.reference_id, im.notes, im.created_at,
          p.sku, p.name as product_name, p.category, p.brand
        FROM "${tenantSchema}".inventory_movements im
        JOIN "${tenantSchema}".products p ON im.product_id = p.id
      `;

      if (whereConditions.length > 0) {
        sql += ` WHERE ${whereConditions.join(' AND ')}`;
      }

      sql += ` ORDER BY im.created_at DESC`;

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
   * Registrar un movimiento de inventario
   * @param {string} tenantSchema - Schema del tenant
   * @param {Object} movementData - Datos del movimiento
   * @returns {Promise<Object>} Movimiento creado
   */
  static async addMovement(tenantSchema, movementData) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    const client = await query('BEGIN');
    
    try {
      const {
        product_id, movement_type, quantity, cost_per_unit,
        reference_type, reference_id, notes
      } = movementData;

      // Obtener stock actual del producto
      const productResult = await query(`
        SELECT current_stock FROM "${tenantSchema}".products WHERE id = $1
      `, [product_id]);

      if (productResult.rows.length === 0) {
        throw new Error(`Producto con ID ${product_id} no encontrado`);
      }

      const currentStock = productResult.rows[0].current_stock;
      const previousStock = currentStock;
      
      // Calcular nuevo stock según tipo de movimiento
      let stockChange = 0;
      switch (movement_type) {
        case 'entrada':
          stockChange = Math.abs(quantity);
          break;
        case 'salida':
          stockChange = -Math.abs(quantity);
          if (currentStock + stockChange < 0) {
            throw new Error('No hay suficiente stock para realizar esta salida');
          }
          break;
        case 'ajuste':
          stockChange = quantity; // Puede ser positivo o negativo
          if (currentStock + stockChange < 0) {
            throw new Error('El ajuste resultaría en stock negativo');
          }
          break;
        case 'sincronizacion':
          stockChange = quantity; // Sincronización externa
          break;
        default:
          throw new Error('Tipo de movimiento no válido');
      }

      const newStock = currentStock + stockChange;

      // Registrar movimiento
      const movementResult = await query(`
        INSERT INTO "${tenantSchema}".inventory_movements (
          product_id, movement_type, quantity, previous_stock, new_stock,
          cost_per_unit, reference_type, reference_id, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        product_id, movement_type, stockChange, previousStock, newStock,
        cost_per_unit, reference_type, reference_id, notes
      ]);

      // Actualizar stock del producto
      await query(`
        UPDATE "${tenantSchema}".products 
        SET current_stock = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [newStock, product_id]);

      await query('COMMIT');
      return movementResult.rows[0];

    } catch (error) {
      await query('ROLLBACK');
      console.error('💥 Error registrando movimiento de inventario:', error.message);
      throw new Error(`Error registrando movimiento: ${error.message}`);
    }
  }

  /**
   * Obtener resumen de inventario actual
   * @param {string} tenantSchema - Schema del tenant
   * @param {Object} options - Opciones de filtrado
   * @returns {Promise<Array>} Resumen de inventario
   */
  static async getInventorySummary(tenantSchema, options = {}) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    try {
      let whereConditions = ['p.active = true'];
      let params = [];
      let paramIndex = 1;

      if (options.category) {
        whereConditions.push(`p.category = $${paramIndex}`);
        params.push(options.category);
        paramIndex++;
      }

      if (options.brand) {
        whereConditions.push(`p.brand = $${paramIndex}`);
        params.push(options.brand);
        paramIndex++;
      }

      if (options.low_stock_only) {
        whereConditions.push('p.current_stock <= p.min_stock_threshold');
      }

      const sql = `
        SELECT 
          p.id, p.sku, p.name, p.category, p.brand,
          p.current_stock, p.min_stock_threshold, p.max_stock_threshold,
          p.cost_price, p.selling_price,
          ROUND(p.current_stock * p.cost_price, 2) as inventory_value,
          CASE 
            WHEN p.current_stock <= 0 THEN 'sin_stock'
            WHEN p.current_stock <= p.min_stock_threshold THEN 'stock_bajo'
            WHEN p.current_stock >= p.max_stock_threshold THEN 'sobrestockado'
            ELSE 'normal'
          END as stock_status,
          -- Últimos movimientos
          (SELECT COUNT(*) FROM "${tenantSchema}".inventory_movements im 
           WHERE im.product_id = p.id 
           AND im.created_at >= CURRENT_DATE - INTERVAL '30 days') as movements_last_30_days
        FROM "${tenantSchema}".products p
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY 
          CASE 
            WHEN p.current_stock <= 0 THEN 1
            WHEN p.current_stock <= p.min_stock_threshold THEN 2
            ELSE 3
          END,
          p.name
        LIMIT ${options.limit || 100}
      `;

      const result = await query(sql, params);
      return result.rows;

    } catch (error) {
      console.error('💥 Error obteniendo resumen de inventario:', error.message);
      throw new Error(`Error obteniendo resumen de inventario: ${error.message}`);
    }
  }

  /**
   * Obtener valuación de inventario con método FIFO
   * @param {string} tenantSchema - Schema del tenant
   * @param {number} productId - ID del producto (opcional, null para todos)
   * @returns {Promise<Object|Array>} Valuación FIFO
   */
  static async getFIFOValuation(tenantSchema, productId = null) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    try {
      let productCondition = '';
      let params = [];
      
      if (productId) {
        productCondition = 'WHERE p.id = $1 AND';
        params.push(productId);
      } else {
        productCondition = 'WHERE';
      }

      const sql = `
        WITH inventory_fifo AS (
          SELECT 
            p.id as product_id,
            p.sku,
            p.name as product_name,
            p.current_stock,
            p.cost_price as current_cost,
            -- Calcular valuación FIFO usando CTE recursivo
            CASE 
              WHEN p.current_stock > 0 THEN
                (SELECT 
                  COALESCE(
                    SUM(
                      CASE 
                        WHEN running_stock <= p.current_stock 
                        THEN ABS(im.quantity) * COALESCE(im.cost_per_unit, p.cost_price)
                        WHEN running_stock - ABS(im.quantity) < p.current_stock 
                        THEN (p.current_stock - (running_stock - ABS(im.quantity))) * COALESCE(im.cost_per_unit, p.cost_price)
                        ELSE 0 
                      END
                    ), 
                    p.current_stock * p.cost_price
                  ) as fifo_value
                FROM (
                  SELECT 
                    im.quantity,
                    im.cost_per_unit,
                    SUM(ABS(im.quantity)) OVER (
                      ORDER BY im.created_at DESC 
                      ROWS UNBOUNDED PRECEDING
                    ) as running_stock
                  FROM "${tenantSchema}".inventory_movements im
                  WHERE im.product_id = p.id 
                  AND im.movement_type = 'entrada'
                  AND im.quantity > 0
                  ORDER BY im.created_at DESC
                ) im
                WHERE running_stock > (
                  SELECT COALESCE(SUM(ABS(quantity)), 0) 
                  FROM "${tenantSchema}".inventory_movements 
                  WHERE product_id = p.id 
                  AND movement_type = 'entrada' 
                  AND quantity > 0
                ) - p.current_stock
                )
              ELSE 0 
            END as fifo_valuation,
            -- Valor usando costo actual
            ROUND(p.current_stock * p.cost_price, 2) as current_cost_valuation,
            -- Valor de venta estimado
            ROUND(p.current_stock * p.selling_price, 2) as selling_value_estimate
          FROM "${tenantSchema}".products p
          ${productCondition} p.active = true
        )
        SELECT 
          product_id,
          sku,
          product_name,
          current_stock,
          current_cost,
          ROUND(COALESCE(fifo_valuation, current_cost_valuation), 2) as fifo_valuation,
          current_cost_valuation,
          selling_value_estimate,
          ROUND(
            selling_value_estimate - COALESCE(fifo_valuation, current_cost_valuation), 2
          ) as potential_profit
        FROM inventory_fifo
        ORDER BY fifo_valuation DESC
      `;

      const result = await query(sql, params);
      
      if (productId) {
        return result.rows[0] || null;
      } else {
        return result.rows;
      }

    } catch (error) {
      console.error('💥 Error calculando valuación FIFO:', error.message);
      throw new Error(`Error calculando valuación FIFO: ${error.message}`);
    }
  }

  /**
   * Obtener estadísticas de movimientos de inventario
   * @param {string} tenantSchema - Schema del tenant
   * @param {Object} options - Opciones de filtrado por fechas
   * @returns {Promise<Object>} Estadísticas de movimientos
   */
  static async getMovementStats(tenantSchema, options = {}) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    try {
      let whereClause = '';
      const params = [];
      let paramIndex = 1;

      if (options.date_from || options.date_to) {
        const conditions = [];
        if (options.date_from) {
          conditions.push(`created_at >= $${paramIndex}`);
          params.push(options.date_from);
          paramIndex++;
        }
        if (options.date_to) {
          conditions.push(`created_at <= $${paramIndex}`);
          params.push(options.date_to);
          paramIndex++;
        }
        whereClause = `WHERE ${conditions.join(' AND ')}`;
      }

      const result = await query(`
        SELECT 
          COUNT(*) as total_movements,
          COUNT(*) FILTER (WHERE movement_type = 'entrada') as entrada_movements,
          COUNT(*) FILTER (WHERE movement_type = 'salida') as salida_movements,
          COUNT(*) FILTER (WHERE movement_type = 'ajuste') as ajuste_movements,
          COUNT(*) FILTER (WHERE movement_type = 'sincronizacion') as sync_movements,
          SUM(ABS(quantity)) FILTER (WHERE movement_type = 'entrada') as total_entries,
          SUM(ABS(quantity)) FILTER (WHERE movement_type = 'salida') as total_exits,
          COUNT(DISTINCT product_id) as products_moved,
          ROUND(AVG(ABS(quantity)), 2) as avg_movement_quantity
        FROM "${tenantSchema}".inventory_movements
        ${whereClause}
      `, params);

      return result.rows[0];

    } catch (error) {
      console.error('💥 Error obteniendo estadísticas de movimientos:', error.message);
      throw new Error(`Error obteniendo estadísticas de movimientos: ${error.message}`);
    }
  }

  /**
   * Obtener productos con movimiento frecuente
   * @param {string} tenantSchema - Schema del tenant
   * @param {number} days - Días hacia atrás para analizar
   * @param {number} limit - Límite de resultados
   * @returns {Promise<Array>} Productos con más movimientos
   */
  static async getHighMovementProducts(tenantSchema, days = 30, limit = 10) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    try {
      const result = await query(`
        SELECT 
          p.id, p.sku, p.name, p.category, p.brand, p.current_stock,
          COUNT(im.id) as movement_count,
          SUM(ABS(im.quantity)) as total_quantity_moved,
          SUM(ABS(im.quantity)) FILTER (WHERE im.movement_type = 'entrada') as total_entries,
          SUM(ABS(im.quantity)) FILTER (WHERE im.movement_type = 'salida') as total_exits,
          ROUND(AVG(ABS(im.quantity)), 2) as avg_movement_size,
          MAX(im.created_at) as last_movement_date
        FROM "${tenantSchema}".products p
        JOIN "${tenantSchema}".inventory_movements im ON p.id = im.product_id
        WHERE im.created_at >= (CURRENT_DATE - INTERVAL '${days} days')
        AND p.active = true
        GROUP BY p.id, p.sku, p.name, p.category, p.brand, p.current_stock
        HAVING COUNT(im.id) > 0
        ORDER BY movement_count DESC, total_quantity_moved DESC
        LIMIT $1
      `, [limit]);

      return result.rows;

    } catch (error) {
      console.error('💥 Error obteniendo productos con alto movimiento:', error.message);
      throw new Error(`Error obteniendo productos con alto movimiento: ${error.message}`);
    }
  }

  /**
   * Sincronizar inventario con sistema externo
   * @param {string} tenantSchema - Schema del tenant
   * @param {Array} syncData - Datos de sincronización
   * @returns {Promise<Object>} Resultado de sincronización
   */
  static async syncInventory(tenantSchema, syncData) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    const client = await query('BEGIN');
    
    try {
      const syncResults = {
        processed: 0,
        updated: 0,
        errors: [],
        movements_created: 0
      };

      for (const item of syncData) {
        try {
          const { product_id, external_stock, cost_price, notes = 'Sincronización externa' } = item;

          // Obtener stock actual
          const productResult = await query(`
            SELECT current_stock, sku, name FROM "${tenantSchema}".products WHERE id = $1
          `, [product_id]);

          if (productResult.rows.length === 0) {
            syncResults.errors.push(`Producto con ID ${product_id} no encontrado`);
            continue;
          }

          const product = productResult.rows[0];
          const currentStock = product.current_stock;
          const difference = external_stock - currentStock;

          syncResults.processed++;

          if (difference !== 0) {
            // Registrar movimiento de sincronización
            await query(`
              INSERT INTO "${tenantSchema}".inventory_movements (
                product_id, movement_type, quantity, previous_stock, new_stock,
                cost_per_unit, reference_type, reference_id, notes
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
              product_id, 'sincronizacion', difference, currentStock, external_stock,
              cost_price, 'sync', null, `${notes} - Diferencia: ${difference}`
            ]);

            // Actualizar stock del producto
            await query(`
              UPDATE "${tenantSchema}".products 
              SET current_stock = $1, updated_at = CURRENT_TIMESTAMP
              WHERE id = $2
            `, [external_stock, product_id]);

            syncResults.updated++;
            syncResults.movements_created++;
          }

        } catch (itemError) {
          syncResults.errors.push(`Error procesando producto ${item.product_id}: ${itemError.message}`);
        }
      }

      await query('COMMIT');
      
      console.log(`✅ Sincronización completada: ${syncResults.updated}/${syncResults.processed} productos actualizados`);
      return syncResults;

    } catch (error) {
      await query('ROLLBACK');
      console.error('💥 Error sincronizando inventario:', error.message);
      throw new Error(`Error sincronizando inventario: ${error.message}`);
    }
  }
}

module.exports = Inventory;