// =====================================================================================
// FLUXION AI - SALES MODEL (MULTI-TENANT)
// Modelo de datos para ventas con transacciones y soporte multi-tenant
// =====================================================================================

const { query } = require('../config/database.cjs');

/**
 * Modelo Sales con operaciones CRUD y gestión de transacciones - Multi-tenant
 * Cada método requiere un tenantSchema para operar en el schema correcto
 */
class Sales {
  
  /**
   * Obtener todas las ventas con filtros opcionales
   * @param {string} tenantSchema - Schema del tenant
   * @param {Object} options - Opciones de filtrado
   * @returns {Promise<Array>} Lista de ventas
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
      if (options.client_id) {
        whereConditions.push(`s.client_id = $${paramIndex}`);
        params.push(options.client_id);
        paramIndex++;
      }

      if (options.payment_status) {
        whereConditions.push(`s.payment_status = $${paramIndex}`);
        params.push(options.payment_status);
        paramIndex++;
      }

      if (options.date_from) {
        whereConditions.push(`s.sale_date >= $${paramIndex}`);
        params.push(options.date_from);
        paramIndex++;
      }

      if (options.date_to) {
        whereConditions.push(`s.sale_date <= $${paramIndex}`);
        params.push(options.date_to);
        paramIndex++;
      }

      if (options.min_amount) {
        whereConditions.push(`s.total_amount >= $${paramIndex}`);
        params.push(options.min_amount);
        paramIndex++;
      }

      let sql = `
        SELECT 
          s.id, s.sale_number, s.client_id, s.sale_date, s.total_amount,
          s.tax_amount, s.discount_amount, s.payment_status, s.payment_method,
          s.notes, s.created_at,
          c.business_name as client_name, c.client_code, c.client_type
        FROM "${tenantSchema}".sales s
        JOIN "${tenantSchema}".clients c ON s.client_id = c.id
      `;

      if (whereConditions.length > 0) {
        sql += ` WHERE ${whereConditions.join(' AND ')}`;
      }

      sql += ` ORDER BY s.sale_date DESC`;

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
      console.error('💥 Error obteniendo ventas:', error.message);
      throw new Error(`Error obteniendo ventas: ${error.message}`);
    }
  }

  /**
   * Obtener una venta por ID con detalles
   * @param {string} tenantSchema - Schema del tenant
   * @param {number} id - ID de la venta
   * @returns {Promise<Object|null>} Venta con detalles o null
   */
  static async getById(tenantSchema, id) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    try {
      // Obtener datos principales de la venta
      const saleResult = await query(`
        SELECT 
          s.id, s.sale_number, s.client_id, s.sale_date, s.total_amount,
          s.tax_amount, s.discount_amount, s.payment_status, s.payment_method,
          s.notes, s.created_at,
          c.business_name as client_name, c.client_code, c.client_type,
          c.contact_person, c.email, c.phone
        FROM "${tenantSchema}".sales s
        JOIN "${tenantSchema}".clients c ON s.client_id = c.id
        WHERE s.id = $1
      `, [id]);

      if (saleResult.rows.length === 0) {
        return null;
      }

      const sale = saleResult.rows[0];

      // Obtener detalles de la venta
      const detailsResult = await query(`
        SELECT 
          sd.id, sd.product_id, sd.quantity, sd.unit_price, sd.total_price,
          p.sku, p.name as product_name, p.category, p.brand
        FROM "${tenantSchema}".sale_details sd
        JOIN "${tenantSchema}".products p ON sd.product_id = p.id
        WHERE sd.sale_id = $1
        ORDER BY sd.id
      `, [id]);

      sale.details = detailsResult.rows;
      return sale;

    } catch (error) {
      console.error('💥 Error obteniendo venta por ID:', error.message);
      throw new Error(`Error obteniendo venta: ${error.message}`);
    }
  }

  /**
   * Crear una nueva venta con transacción
   * @param {string} tenantSchema - Schema del tenant
   * @param {Object} saleData - Datos de la venta
   * @returns {Promise<Object>} Venta creada
   */
  static async create(tenantSchema, saleData) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    const client = await query('BEGIN');
    
    try {
      const {
        sale_number, client_id, sale_date, payment_status = 'pendiente',
        payment_method, notes, details = [], tax_amount = 0, discount_amount = 0
      } = saleData;

      // Validar que el número de venta no exista
      const existing = await query(`
        SELECT id FROM "${tenantSchema}".sales WHERE sale_number = $1
      `, [sale_number]);

      if (existing.rows.length > 0) {
        throw new Error(`Ya existe una venta con número: ${sale_number}`);
      }

      // Validar que existan los productos y calcular totales
      let calculatedTotal = 0;
      const validatedDetails = [];

      for (const detail of details) {
        const productResult = await query(`
          SELECT id, name, selling_price, current_stock 
          FROM "${tenantSchema}".products 
          WHERE id = $1 AND active = true
        `, [detail.product_id]);

        if (productResult.rows.length === 0) {
          throw new Error(`Producto con ID ${detail.product_id} no encontrado o inactivo`);
        }

        const product = productResult.rows[0];
        
        // Verificar stock disponible
        if (product.current_stock < detail.quantity) {
          throw new Error(`Stock insuficiente para ${product.name}. Disponible: ${product.current_stock}, Solicitado: ${detail.quantity}`);
        }

        const unitPrice = detail.unit_price || product.selling_price;
        const totalPrice = unitPrice * detail.quantity;
        calculatedTotal += totalPrice;

        validatedDetails.push({
          ...detail,
          unit_price: unitPrice,
          total_price: totalPrice,
          product: product
        });
      }

      const finalTotal = calculatedTotal + (tax_amount || 0) - (discount_amount || 0);

      // Crear registro de venta
      const saleResult = await query(`
        INSERT INTO "${tenantSchema}".sales (
          sale_number, client_id, sale_date, total_amount, tax_amount,
          discount_amount, payment_status, payment_method, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        sale_number, client_id, sale_date, finalTotal, tax_amount,
        discount_amount, payment_status, payment_method, notes
      ]);

      const sale = saleResult.rows[0];

      // Crear detalles de venta y actualizar stock
      for (const detail of validatedDetails) {
        // Insertar detalle
        await query(`
          INSERT INTO "${tenantSchema}".sale_details (
            sale_id, product_id, quantity, unit_price, total_price
          ) VALUES ($1, $2, $3, $4, $5)
        `, [
          sale.id, detail.product_id, detail.quantity,
          detail.unit_price, detail.total_price
        ]);

        // Actualizar stock del producto
        const newStock = detail.product.current_stock - detail.quantity;
        await query(`
          UPDATE "${tenantSchema}".products 
          SET current_stock = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [newStock, detail.product_id]);

        // Registrar movimiento de inventario
        await query(`
          INSERT INTO "${tenantSchema}".inventory_movements (
            product_id, movement_type, quantity, previous_stock, new_stock,
            cost_per_unit, reference_type, reference_id, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          detail.product_id, 'salida', -detail.quantity,
          detail.product.current_stock, newStock,
          detail.unit_price, 'venta', sale.id,
          `Venta ${sale_number}`
        ]);
      }

      await query('COMMIT');

      // Retornar venta completa con detalles
      return await this.getById(tenantSchema, sale.id);

    } catch (error) {
      await query('ROLLBACK');
      console.error('💥 Error creando venta:', error.message);
      throw new Error(`Error creando venta: ${error.message}`);
    }
  }

  /**
   * Actualizar estado de pago de una venta
   * @param {string} tenantSchema - Schema del tenant
   * @param {number} id - ID de la venta
   * @param {string} paymentStatus - Nuevo estado de pago
   * @param {string} paymentMethod - Método de pago (opcional)
   * @returns {Promise<Object>} Venta actualizada
   */
  static async updatePaymentStatus(tenantSchema, id, paymentStatus, paymentMethod = null) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    try {
      const existing = await this.getById(tenantSchema, id);
      if (!existing) {
        throw new Error(`Venta con ID ${id} no encontrada`);
      }

      const updateFields = ['payment_status = $2'];
      const params = [id, paymentStatus];
      let paramIndex = 3;

      if (paymentMethod) {
        updateFields.push(`payment_method = $${paramIndex}`);
        params.push(paymentMethod);
        paramIndex++;
      }

      const result = await query(`
        UPDATE "${tenantSchema}".sales 
        SET ${updateFields.join(', ')}
        WHERE id = $1
        RETURNING *
      `, params);

      return result.rows[0];

    } catch (error) {
      console.error('💥 Error actualizando estado de pago:', error.message);
      throw new Error(`Error actualizando estado de pago: ${error.message}`);
    }
  }

  /**
   * Cancelar una venta (reversar stock)
   * @param {string} tenantSchema - Schema del tenant
   * @param {number} id - ID de la venta
   * @param {string} reason - Razón de cancelación
   * @returns {Promise<boolean>} True si se canceló exitosamente
   */
  static async cancel(tenantSchema, id, reason = 'Cancelación manual') {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    const client = await query('BEGIN');
    
    try {
      const sale = await this.getById(tenantSchema, id);
      if (!sale) {
        throw new Error(`Venta con ID ${id} no encontrada`);
      }

      if (sale.payment_status === 'cancelado') {
        throw new Error('La venta ya está cancelada');
      }

      // Reversar stock para cada producto
      for (const detail of sale.details) {
        // Obtener stock actual del producto
        const productResult = await query(`
          SELECT current_stock FROM "${tenantSchema}".products WHERE id = $1
        `, [detail.product_id]);

        if (productResult.rows.length > 0) {
          const currentStock = productResult.rows[0].current_stock;
          const newStock = currentStock + detail.quantity;

          // Actualizar stock
          await query(`
            UPDATE "${tenantSchema}".products 
            SET current_stock = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [newStock, detail.product_id]);

          // Registrar movimiento de inventario (devolución)
          await query(`
            INSERT INTO "${tenantSchema}".inventory_movements (
              product_id, movement_type, quantity, previous_stock, new_stock,
              cost_per_unit, reference_type, reference_id, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            detail.product_id, 'entrada', detail.quantity,
            currentStock, newStock, detail.unit_price,
            'sync', sale.id, `Cancelación de venta ${sale.sale_number}: ${reason}`
          ]);
        }
      }

      // Marcar venta como cancelada
      await query(`
        UPDATE "${tenantSchema}".sales 
        SET payment_status = 'cancelado', notes = COALESCE(notes || ' | ', '') || $2
        WHERE id = $1
      `, [id, `CANCELADA: ${reason}`]);

      await query('COMMIT');
      return true;

    } catch (error) {
      await query('ROLLBACK');
      console.error('💥 Error cancelando venta:', error.message);
      throw new Error(`Error cancelando venta: ${error.message}`);
    }
  }

  /**
   * Obtener estadísticas de ventas
   * @param {string} tenantSchema - Schema del tenant
   * @param {Object} options - Opciones de filtrado por fechas
   * @returns {Promise<Object>} Estadísticas de ventas
   */
  static async getStats(tenantSchema, options = {}) {
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
          conditions.push(`sale_date >= $${paramIndex}`);
          params.push(options.date_from);
          paramIndex++;
        }
        if (options.date_to) {
          conditions.push(`sale_date <= $${paramIndex}`);
          params.push(options.date_to);
          paramIndex++;
        }
        whereClause = `WHERE ${conditions.join(' AND ')}`;
      }

      const result = await query(`
        SELECT 
          COUNT(*) as total_sales,
          COUNT(*) FILTER (WHERE payment_status = 'pagado') as paid_sales,
          COUNT(*) FILTER (WHERE payment_status = 'pendiente') as pending_sales,
          COUNT(*) FILTER (WHERE payment_status = 'parcial') as partial_sales,
          COUNT(*) FILTER (WHERE payment_status = 'vencido') as overdue_sales,
          COUNT(*) FILTER (WHERE payment_status = 'cancelado') as cancelled_sales,
          ROUND(SUM(total_amount), 2) as total_revenue,
          ROUND(SUM(CASE WHEN payment_status = 'pagado' THEN total_amount ELSE 0 END), 2) as paid_revenue,
          ROUND(SUM(CASE WHEN payment_status IN ('pendiente', 'parcial') THEN total_amount ELSE 0 END), 2) as pending_revenue,
          ROUND(AVG(total_amount), 2) as avg_sale_amount,
          COUNT(DISTINCT client_id) as unique_clients
        FROM "${tenantSchema}".sales
        ${whereClause}
      `, params);

      return result.rows[0];

    } catch (error) {
      console.error('💥 Error obteniendo estadísticas de ventas:', error.message);
      throw new Error(`Error obteniendo estadísticas: ${error.message}`);
    }
  }

  /**
   * Obtener ventas por período (diario, mensual, etc.)
   * @param {string} tenantSchema - Schema del tenant
   * @param {string} period - Período ('day', 'week', 'month', 'year')
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Array>} Ventas agrupadas por período
   */
  static async getSalesByPeriod(tenantSchema, period = 'day', options = {}) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    try {
      let dateFormat;
      let orderBy;

      switch (period.toLowerCase()) {
        case 'hour':
          dateFormat = "TO_CHAR(sale_date, 'YYYY-MM-DD HH24:00')";
          orderBy = 'sale_date';
          break;
        case 'day':
          dateFormat = "TO_CHAR(sale_date, 'YYYY-MM-DD')";
          orderBy = 'sale_date';
          break;
        case 'week':
          dateFormat = "TO_CHAR(sale_date, 'YYYY-IW')";
          orderBy = 'DATE_TRUNC(\'week\', sale_date)';
          break;
        case 'month':
          dateFormat = "TO_CHAR(sale_date, 'YYYY-MM')";
          orderBy = 'DATE_TRUNC(\'month\', sale_date)';
          break;
        case 'year':
          dateFormat = "TO_CHAR(sale_date, 'YYYY')";
          orderBy = 'DATE_TRUNC(\'year\', sale_date)';
          break;
        default:
          throw new Error('Período no válido. Use: hour, day, week, month, year');
      }

      let whereClause = '';
      const params = [];
      let paramIndex = 1;

      if (options.date_from || options.date_to) {
        const conditions = [];
        if (options.date_from) {
          conditions.push(`sale_date >= $${paramIndex}`);
          params.push(options.date_from);
          paramIndex++;
        }
        if (options.date_to) {
          conditions.push(`sale_date <= $${paramIndex}`);
          params.push(options.date_to);
          paramIndex++;
        }
        whereClause = `WHERE ${conditions.join(' AND ')}`;
      }

      const result = await query(`
        SELECT 
          ${dateFormat} as period,
          COUNT(*) as sales_count,
          ROUND(SUM(total_amount), 2) as total_revenue,
          ROUND(AVG(total_amount), 2) as avg_sale_amount,
          COUNT(DISTINCT client_id) as unique_clients
        FROM "${tenantSchema}".sales
        ${whereClause}
        GROUP BY ${dateFormat}, ${orderBy}
        ORDER BY ${orderBy}
        LIMIT ${options.limit || 50}
      `, params);

      return result.rows;

    } catch (error) {
      console.error('💥 Error obteniendo ventas por período:', error.message);
      throw new Error(`Error obteniendo ventas por período: ${error.message}`);
    }
  }

  /**
   * Obtener productos más vendidos
   * @param {string} tenantSchema - Schema del tenant
   * @param {Object} options - Opciones de filtrado
   * @returns {Promise<Array>} Productos más vendidos
   */
  static async getTopProducts(tenantSchema, options = {}) {
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
          conditions.push(`s.sale_date >= $${paramIndex}`);
          params.push(options.date_from);
          paramIndex++;
        }
        if (options.date_to) {
          conditions.push(`s.sale_date <= $${paramIndex}`);
          params.push(options.date_to);
          paramIndex++;
        }
        whereClause = `WHERE ${conditions.join(' AND ')}`;
      }

      const result = await query(`
        SELECT 
          p.id, p.sku, p.name, p.category, p.brand,
          SUM(sd.quantity) as total_quantity_sold,
          SUM(sd.total_price) as total_revenue,
          COUNT(DISTINCT s.id) as sales_count,
          ROUND(AVG(sd.unit_price), 2) as avg_selling_price,
          ROUND(SUM(sd.total_price) / SUM(sd.quantity), 2) as avg_price_per_unit
        FROM "${tenantSchema}".products p
        JOIN "${tenantSchema}".sale_details sd ON p.id = sd.product_id
        JOIN "${tenantSchema}".sales s ON sd.sale_id = s.id
        ${whereClause}
        GROUP BY p.id, p.sku, p.name, p.category, p.brand
        ORDER BY total_quantity_sold DESC
        LIMIT ${options.limit || 20}
      `, params);

      return result.rows;

    } catch (error) {
      console.error('💥 Error obteniendo productos más vendidos:', error.message);
      throw new Error(`Error obteniendo productos más vendidos: ${error.message}`);
    }
  }
}

module.exports = Sales;