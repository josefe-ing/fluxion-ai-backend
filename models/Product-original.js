// =====================================================================================
// FLUXION AI - PRODUCT MODEL (MULTI-TENANT)
// Modelo de datos para productos con operaciones CRUD completas y soporte multi-tenant
// =====================================================================================

const { query } = require('../config/database.cjs');

/**
 * Modelo Product con operaciones CRUD y consultas especializadas - Multi-tenant
 * Cada método requiere un tenantSchema para operar en el schema correcto
 */
class Product {
  
  /**
   * Obtener todos los productos con filtros opcionales
   * @param {string} tenantSchema - Schema del tenant (ej: 'tenant_abc123')
   * @param {Object} options - Opciones de filtrado
   * @param {string} options.category - Filtrar por categoría
   * @param {string} options.brand - Filtrar por marca
   * @param {boolean} options.active - Filtrar por activo/inactivo
   * @param {boolean} options.lowStock - Solo productos con stock bajo
   * @param {number} options.limit - Límite de resultados
   * @param {number} options.offset - Offset para paginación
   * @returns {Promise<Array>} Lista de productos
   */
  static async getAll(tenantSchema, options = {}) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    try {
      let whereConditions = [];
      let params = [];
      let paramIndex = 1;

      // Construir condiciones WHERE dinámicamente
      if (options.category) {
        whereConditions.push(`category = $${paramIndex}`);
        params.push(options.category);
        paramIndex++;
      }

      if (options.brand) {
        whereConditions.push(`brand = $${paramIndex}`);
        params.push(options.brand);
        paramIndex++;
      }

      if (options.active !== undefined) {
        whereConditions.push(`active = $${paramIndex}`);
        params.push(options.active);
        paramIndex++;
      }

      if (options.lowStock) {
        whereConditions.push(`current_stock <= min_stock_threshold`);
      }

      // Construir query
      let sql = `
        SELECT 
          id, sku, name, category, brand,
          cost_price, selling_price, current_stock,
          min_stock_threshold, max_stock_threshold,
          active, created_at, updated_at,
          CASE 
            WHEN current_stock <= min_stock_threshold THEN 'low'
            WHEN current_stock >= max_stock_threshold THEN 'high'
            ELSE 'normal'
          END as stock_status,
          ROUND((selling_price - cost_price) / selling_price * 100, 2) as profit_margin_percent
        FROM "${tenantSchema}".products
      `;

      if (whereConditions.length > 0) {
        sql += ` WHERE ${whereConditions.join(' AND ')}`;
      }

      sql += ` ORDER BY name`;

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
      console.error('💥 Error obteniendo productos:', error.message);
      throw new Error(`Error obteniendo productos: ${error.message}`);
    }
  }

  /**
   * Obtener un producto por ID
   * @param {string} tenantSchema - Schema del tenant
   * @param {number} id - ID del producto
   * @returns {Promise<Object|null>} Producto encontrado o null
   */
  static async getById(tenantSchema, id) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    try {
      const result = await query(`
        SELECT 
          id, sku, name, category, brand,
          cost_price, selling_price, current_stock,
          min_stock_threshold, max_stock_threshold,
          active, created_at, updated_at,
          CASE 
            WHEN current_stock <= min_stock_threshold THEN 'low'
            WHEN current_stock >= max_stock_threshold THEN 'high'
            ELSE 'normal'
          END as stock_status,
          ROUND((selling_price - cost_price) / selling_price * 100, 2) as profit_margin_percent
        FROM "${tenantSchema}".products 
        WHERE id = $1
      `, [id]);

      return result.rows[0] || null;

    } catch (error) {
      console.error('💥 Error obteniendo producto por ID:', error.message);
      throw new Error(`Error obteniendo producto: ${error.message}`);
    }
  }

  /**
   * Obtener un producto por SKU
   * @param {string} sku - SKU del producto
   * @returns {Promise<Object|null>} Producto encontrado o null
   */
  static async getBySku(sku) {
    try {
      const result = await query(`
        SELECT 
          id, sku, name, category, brand,
          cost_price, selling_price, current_stock,
          min_stock_threshold, max_stock_threshold,
          active, created_at, updated_at,
          CASE 
            WHEN current_stock <= min_stock_threshold THEN 'low'
            WHEN current_stock >= max_stock_threshold THEN 'high'
            ELSE 'normal'
          END as stock_status,
          ROUND((selling_price - cost_price) / selling_price * 100, 2) as profit_margin_percent
        FROM "${tenantSchema}".products 
        WHERE sku = $1
      `, [sku]);

      return result.rows[0] || null;

    } catch (error) {
      console.error('💥 Error obteniendo producto por SKU:', error.message);
      throw new Error(`Error obteniendo producto: ${error.message}`);
    }
  }

  /**
   * Crear un nuevo producto
   * @param {Object} productData - Datos del producto
   * @returns {Promise<Object>} Producto creado
   */
  static async create(productData) {
    try {
      const {
        sku, name, category, brand, cost_price, selling_price,
        current_stock = 0, min_stock_threshold = 10, max_stock_threshold = 1000,
        active = true
      } = productData;

      // Validar que el SKU no exista
      const existing = await this.getBySku(sku);
      if (existing) {
        throw new Error(`Ya existe un producto con SKU: ${sku}`);
      }

      const result = await query(`
        INSERT INTO "${tenantSchema}".products (
          sku, name, category, brand, cost_price, selling_price,
          current_stock, min_stock_threshold, max_stock_threshold, active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        sku, name, category, brand, cost_price, selling_price,
        current_stock, min_stock_threshold, max_stock_threshold, active
      ]);

      return result.rows[0];

    } catch (error) {
      console.error('💥 Error creando producto:', error.message);
      throw new Error(`Error creando producto: ${error.message}`);
    }
  }

  /**
   * Actualizar un producto
   * @param {number} id - ID del producto
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<Object>} Producto actualizado
   */
  static async update(id, updateData) {
    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error(`Producto con ID ${id} no encontrado`);
      }

      // Construir query de actualización dinámicamente
      const updateFields = [];
      const params = [];
      let paramIndex = 1;

      const allowedFields = [
        'sku', 'name', 'category', 'brand', 'cost_price', 'selling_price',
        'current_stock', 'min_stock_threshold', 'max_stock_threshold', 'active'
      ];

      Object.keys(updateData).forEach(field => {
        if (allowedFields.includes(field)) {
          updateFields.push(`${field} = $${paramIndex}`);
          params.push(updateData[field]);
          paramIndex++;
        }
      });

      if (updateFields.length === 0) {
        throw new Error('No hay campos válidos para actualizar');
      }

      params.push(id);
      const sql = `
        UPDATE "${tenantSchema}".products 
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await query(sql, params);
      return result.rows[0];

    } catch (error) {
      console.error('💥 Error actualizando producto:', error.message);
      throw new Error(`Error actualizando producto: ${error.message}`);
    }
  }

  /**
   * Eliminar un producto (soft delete)
   * @param {number} id - ID del producto
   * @returns {Promise<boolean>} True si se eliminó exitosamente
   */
  static async delete(id) {
    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error(`Producto con ID ${id} no encontrado`);
      }

      // Soft delete - solo marcar como inactivo
      const result = await query(`
        UPDATE "${tenantSchema}".products 
        SET active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id
      `, [id]);

      return result.rowCount > 0;

    } catch (error) {
      console.error('💥 Error eliminando producto:', error.message);
      throw new Error(`Error eliminando producto: ${error.message}`);
    }
  }

  /**
   * Obtener productos con stock bajo
   * @returns {Promise<Array>} Lista de productos con stock bajo
   */
  static async getLowStock() {
    try {
      const result = await query(`
        SELECT 
          id, sku, name, category, brand,
          cost_price, selling_price, current_stock,
          min_stock_threshold, max_stock_threshold,
          active, created_at, updated_at,
          'low' as stock_status,
          ROUND((selling_price - cost_price) / selling_price * 100, 2) as profit_margin_percent,
          (min_stock_threshold - current_stock) as units_needed
        FROM "${tenantSchema}".products 
        WHERE current_stock <= min_stock_threshold 
        AND active = true
        ORDER BY (current_stock::float / min_stock_threshold::float) ASC
      `);

      return result.rows;

    } catch (error) {
      console.error('💥 Error obteniendo productos con stock bajo:', error.message);
      throw new Error(`Error obteniendo productos con stock bajo: ${error.message}`);
    }
  }

  /**
   * Obtener estadísticas de productos
   * @returns {Promise<Object>} Estadísticas de productos
   */
  static async getStats() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_products,
          COUNT(*) FILTER (WHERE active = true) as active_products,
          COUNT(*) FILTER (WHERE current_stock <= min_stock_threshold) as low_stock_products,
          COUNT(*) FILTER (WHERE current_stock = 0) as out_of_stock_products,
          COUNT(DISTINCT category) as total_categories,
          COUNT(DISTINCT brand) as total_brands,
          ROUND(AVG(selling_price), 2) as avg_selling_price,
          ROUND(SUM(current_stock * cost_price), 2) as total_inventory_value,
          ROUND(AVG((selling_price - cost_price) / selling_price * 100), 2) as avg_profit_margin
        FROM "${tenantSchema}".products
      `);

      return result.rows[0];

    } catch (error) {
      console.error('💥 Error obteniendo estadísticas de productos:', error.message);
      throw new Error(`Error obteniendo estadísticas: ${error.message}`);
    }
  }

  /**
   * Actualizar stock de un producto
   * @param {number} id - ID del producto
   * @param {number} newStock - Nuevo stock
   * @param {string} reason - Razón del cambio
   * @returns {Promise<Object>} Producto actualizado
   */
  static async updateStock(id, newStock, reason = 'manual_adjustment') {
    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error(`Producto con ID ${id} no encontrado`);
      }

      const previousStock = existing.current_stock;

      // Actualizar stock
      const result = await query(`
        UPDATE "${tenantSchema}".products 
        SET current_stock = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [newStock, id]);

      // Registrar movimiento de inventario
      await query(`
        INSERT INTO "${tenantSchema}".inventory_movements (
          product_id, movement_type, quantity, previous_stock, new_stock,
          cost_per_unit, reference_type, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        id,
        newStock > previousStock ? 'entrada' : 'salida',
        newStock - previousStock,
        previousStock,
        newStock,
        existing.cost_price,
        'ajuste',
        reason
      ]);

      return result.rows[0];

    } catch (error) {
      console.error('💥 Error actualizando stock:', error.message);
      throw new Error(`Error actualizando stock: ${error.message}`);
    }
  }

  /**
   * Buscar productos por texto
   * @param {string} searchTerm - Término de búsqueda
   * @param {number} limit - Límite de resultados
   * @returns {Promise<Array>} Productos encontrados
   */
  static async search(searchTerm, limit = 20) {
    try {
      const result = await query(`
        SELECT 
          id, sku, name, category, brand,
          cost_price, selling_price, current_stock,
          min_stock_threshold, max_stock_threshold,
          active, created_at, updated_at,
          CASE 
            WHEN current_stock <= min_stock_threshold THEN 'low'
            WHEN current_stock >= max_stock_threshold THEN 'high'
            ELSE 'normal'
          END as stock_status,
          ROUND((selling_price - cost_price) / selling_price * 100, 2) as profit_margin_percent
        FROM "${tenantSchema}".products 
        WHERE (
          name ILIKE $1 OR 
          sku ILIKE $1 OR 
          category ILIKE $1 OR 
          brand ILIKE $1
        )
        AND active = true
        ORDER BY 
          CASE WHEN name ILIKE $1 THEN 1 ELSE 2 END,
          name
        LIMIT $2
      `, [`%${searchTerm}%`, limit]);

      return result.rows;

    } catch (error) {
      console.error('💥 Error buscando productos:', error.message);
      throw new Error(`Error buscando productos: ${error.message}`);
    }
  }
}

module.exports = Product;