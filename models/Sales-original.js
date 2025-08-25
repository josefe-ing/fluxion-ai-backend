// =====================================================================================
// FLUXION AI - SALES MODEL
// Modelo de datos para ventas con operaciones CRUD completas y análisis de ventas
// =====================================================================================

const { query } = require('../config/database');

/**
 * Modelo Sales con operaciones CRUD y análisis de ventas
 */
class Sales {
  
  /**
   * Obtener todas las ventas con filtros opcionales
   * @param {Object} options - Opciones de filtrado
   * @param {number} options.clientId - Filtrar por cliente
   * @param {string} options.status - Filtrar por estado de pago
   * @param {string} options.dateFrom - Fecha inicio (YYYY-MM-DD)
   * @param {string} options.dateTo - Fecha fin (YYYY-MM-DD)
   * @param {number} options.minAmount - Monto mínimo
   * @param {number} options.maxAmount - Monto máximo
   * @param {number} options.limit - Límite de resultados
   * @param {number} options.offset - Offset para paginación
   * @returns {Promise<Array>} Lista de ventas
   */
  static async getAll(options = {}) {
    try {
      let whereConditions = [];
      let params = [];
      let paramIndex = 1;

      // Construir condiciones WHERE dinámicamente
      if (options.clientId) {
        whereConditions.push(`s.client_id = $${paramIndex}`);
        params.push(options.clientId);
        paramIndex++;
      }

      if (options.status) {
        whereConditions.push(`s.payment_status = $${paramIndex}`);
        params.push(options.status);
        paramIndex++;
      }

      if (options.dateFrom) {
        whereConditions.push(`s.sale_date >= $${paramIndex}`);
        params.push(options.dateFrom);
        paramIndex++;
      }

      if (options.dateTo) {
        whereConditions.push(`s.sale_date <= $${paramIndex}`);
        params.push(options.dateTo);
        paramIndex++;
      }

      if (options.minAmount) {
        whereConditions.push(`s.total_amount >= $${paramIndex}`);
        params.push(options.minAmount);
        paramIndex++;
      }

      if (options.maxAmount) {
        whereConditions.push(`s.total_amount <= $${paramIndex}`);
        params.push(options.maxAmount);
        paramIndex++;
      }

      // Construir query
      let sql = `
        SELECT 
          s.id, s.invoice_number, s.client_id, s.sale_date,
          s.subtotal, s.tax_amount, s.total_amount,
          s.payment_status, s.payment_due_date, s.notes,
          s.created_at, s.updated_at,
          c.name as client_name,
          c.type as client_type,
          c.city as client_city,
          c.state as client_state,
          CASE 
            WHEN s.payment_status = 'pagado' THEN 0
            WHEN s.payment_due_date < CURRENT_DATE AND s.payment_status != 'pagado' THEN DATE_PART('day', CURRENT_DATE - s.payment_due_date)
            ELSE 0
          END as days_overdue,
          (
            SELECT COUNT(*) 
            FROM sale_details sd 
            WHERE sd.sale_id = s.id
          ) as items_count,
          (
            SELECT SUM(sd.quantity) 
            FROM sale_details sd 
            WHERE sd.sale_id = s.id
          ) as total_units
        FROM sales s
        INNER JOIN clients c ON s.client_id = c.id
      `;

      if (whereConditions.length > 0) {
        sql += ` WHERE ${whereConditions.join(' AND ')}`;
      }

      sql += ` ORDER BY s.sale_date DESC, s.id DESC`;

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
   * @param {number} id - ID de la venta
   * @returns {Promise<Object|null>} Venta con detalles o null
   */
  static async getById(id) {
    try {
      // Obtener información principal de la venta
      const saleResult = await query(`
        SELECT 
          s.id, s.invoice_number, s.client_id, s.sale_date,
          s.subtotal, s.tax_amount, s.total_amount,
          s.payment_status, s.payment_due_date, s.notes,
          s.created_at, s.updated_at,
          c.name as client_name,
          c.type as client_type,
          c.email as client_email,
          c.phone as client_phone,
          c.address as client_address,
          c.city as client_city,
          c.state as client_state,
          CASE 
            WHEN s.payment_status = 'pagado' THEN 0
            WHEN s.payment_due_date < CURRENT_DATE AND s.payment_status != 'pagado' THEN DATE_PART('day', CURRENT_DATE - s.payment_due_date)
            ELSE 0
          END as days_overdue
        FROM sales s
        INNER JOIN clients c ON s.client_id = c.id
        WHERE s.id = $1
      `, [id]);

      const sale = saleResult.rows[0];
      if (!sale) return null;

      // Obtener detalles de la venta
      const detailsResult = await query(`
        SELECT 
          sd.id, sd.product_id, sd.quantity, sd.unit_price,
          sd.subtotal, sd.notes,
          p.sku, p.name as product_name,
          p.category, p.brand,
          p.current_stock as available_stock
        FROM sale_details sd
        INNER JOIN products p ON sd.product_id = p.id
        WHERE sd.sale_id = $1
        ORDER BY sd.id
      `, [id]);

      sale.details = detailsResult.rows;
      sale.items_count = sale.details.length;
      sale.total_units = sale.details.reduce((sum, detail) => sum + detail.quantity, 0);

      return sale;

    } catch (error) {
      console.error('💥 Error obteniendo venta por ID:', error.message);
      throw new Error(`Error obteniendo venta: ${error.message}`);
    }
  }

  /**
   * Crear una nueva venta con detalles
   * @param {Object} saleData - Datos de la venta
   * @returns {Promise<Object>} Venta creada
   */
  static async create(saleData) {
    const client = await query('BEGIN');
    
    try {
      const {
        invoice_number, client_id, sale_date,
        payment_due_date, notes, details = []
      } = saleData;

      // Validar que el cliente exista
      const clientExists = await query('SELECT id FROM clients WHERE id = $1', [client_id]);
      if (clientExists.rows.length === 0) {
        throw new Error(`Cliente con ID ${client_id} no encontrado`);
      }

      // Validar que hay detalles
      if (!details.length) {
        throw new Error('La venta debe tener al menos un producto');
      }

      // Calcular totales
      let subtotal = 0;
      const processedDetails = [];

      for (const detail of details) {
        const { product_id, quantity, unit_price, notes: detailNotes } = detail;
        
        // Verificar que el producto existe y hay stock
        const product = await query(
          'SELECT id, name, current_stock FROM products WHERE id = $1 AND active = true',
          [product_id]
        );

        if (product.rows.length === 0) {
          throw new Error(`Producto con ID ${product_id} no encontrado o inactivo`);
        }

        if (product.rows[0].current_stock < quantity) {
          throw new Error(
            `Stock insuficiente para ${product.rows[0].name}. Disponible: ${product.rows[0].current_stock}, Solicitado: ${quantity}`
          );
        }

        const detailSubtotal = quantity * unit_price;
        subtotal += detailSubtotal;

        processedDetails.push({
          product_id,
          quantity,
          unit_price,
          subtotal: detailSubtotal,
          notes: detailNotes
        });
      }

      const tax_amount = subtotal * 0.16; // IVA 16%
      const total_amount = subtotal + tax_amount;

      // Crear la venta
      const saleResult = await query(`
        INSERT INTO sales (
          invoice_number, client_id, sale_date, subtotal,
          tax_amount, total_amount, payment_due_date, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        invoice_number, client_id, sale_date, subtotal,
        tax_amount, total_amount, payment_due_date, notes
      ]);

      const sale = saleResult.rows[0];

      // Crear detalles de la venta
      for (const detail of processedDetails) {
        await query(`
          INSERT INTO sale_details (
            sale_id, product_id, quantity, unit_price, subtotal, notes
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          sale.id, detail.product_id, detail.quantity,
          detail.unit_price, detail.subtotal, detail.notes
        ]);

        // Actualizar stock del producto
        const previousStock = await query(
          'SELECT current_stock, cost_price FROM products WHERE id = $1',
          [detail.product_id]
        );

        const newStock = previousStock.rows[0].current_stock - detail.quantity;

        await query(
          'UPDATE products SET current_stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [newStock, detail.product_id]
        );

        // Registrar movimiento de inventario
        await query(`
          INSERT INTO inventory_movements (
            product_id, movement_type, quantity, previous_stock, new_stock,
            cost_per_unit, reference_type, reference_id, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          detail.product_id,
          'salida',
          -detail.quantity, // Negativo para salida
          previousStock.rows[0].current_stock,
          newStock,
          previousStock.rows[0].cost_price,
          'venta',
          sale.id,
          `Venta ${invoice_number}`
        ]);
      }

      await query('COMMIT');

      // Devolver la venta completa con detalles
      return await this.getById(sale.id);

    } catch (error) {
      await query('ROLLBACK');
      console.error('💥 Error creando venta:', error.message);
      throw new Error(`Error creando venta: ${error.message}`);
    }
  }

  /**
   * Actualizar estado de pago de una venta
   * @param {number} id - ID de la venta
   * @param {string} paymentStatus - Nuevo estado de pago
   * @param {string} notes - Notas adicionales
   * @returns {Promise<Object>} Venta actualizada
   */
  static async updatePaymentStatus(id, paymentStatus, notes) {
    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error(`Venta con ID ${id} no encontrada`);
      }

      const validStatuses = ['pendiente', 'parcial', 'pagado', 'vencido'];
      if (!validStatuses.includes(paymentStatus)) {
        throw new Error(`Estado de pago inválido: ${paymentStatus}`);
      }

      const result = await query(`
        UPDATE sales 
        SET 
          payment_status = $1, 
          notes = COALESCE($2, notes),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `, [paymentStatus, notes, id]);

      return await this.getById(id);

    } catch (error) {
      console.error('💥 Error actualizando estado de pago:', error.message);
      throw new Error(`Error actualizando estado de pago: ${error.message}`);
    }
  }

  /**
   * Obtener estadísticas de ventas
   * @param {Object} options - Opciones de período
   * @param {string} options.dateFrom - Fecha inicio
   * @param {string} options.dateTo - Fecha fin
   * @returns {Promise<Object>} Estadísticas de ventas
   */
  static async getStats(options = {}) {
    try {
      const { dateFrom, dateTo } = options;
      let whereClause = '';
      const params = [];

      if (dateFrom && dateTo) {
        whereClause = 'WHERE s.sale_date BETWEEN $1 AND $2';
        params.push(dateFrom, dateTo);
      }

      const result = await query(`
        SELECT 
          COUNT(*) as total_sales,
          COUNT(*) FILTER (WHERE payment_status = 'pagado') as paid_sales,
          COUNT(*) FILTER (WHERE payment_status = 'pendiente') as pending_sales,
          COUNT(*) FILTER (WHERE payment_status = 'vencido') as overdue_sales,
          ROUND(SUM(total_amount), 2) as total_revenue,
          ROUND(SUM(subtotal), 2) as subtotal_revenue,
          ROUND(SUM(tax_amount), 2) as total_taxes,
          ROUND(AVG(total_amount), 2) as avg_sale_amount,
          COUNT(DISTINCT client_id) as unique_clients,
          ROUND(SUM(total_amount) FILTER (WHERE payment_status = 'pagado'), 2) as collected_revenue,
          ROUND(SUM(total_amount) FILTER (WHERE payment_status != 'pagado'), 2) as pending_revenue,
          MAX(total_amount) as largest_sale,
          MIN(total_amount) as smallest_sale
        FROM sales s
        ${whereClause}
      `, params);

      const stats = result.rows[0];

      // Obtener top productos vendidos
      const topProductsResult = await query(`
        SELECT 
          p.name,
          p.sku,
          p.category,
          SUM(sd.quantity) as total_quantity,
          ROUND(SUM(sd.subtotal), 2) as total_revenue,
          COUNT(DISTINCT sd.sale_id) as sales_count
        FROM sale_details sd
        INNER JOIN products p ON sd.product_id = p.id
        INNER JOIN sales s ON sd.sale_id = s.id
        ${whereClause}
        GROUP BY p.id, p.name, p.sku, p.category
        ORDER BY total_revenue DESC
        LIMIT 10
      `, params);

      stats.top_products = topProductsResult.rows;

      // Obtener top clientes
      const topClientsResult = await query(`
        SELECT 
          c.name,
          c.type,
          c.city,
          c.state,
          COUNT(s.id) as sales_count,
          ROUND(SUM(s.total_amount), 2) as total_spent,
          ROUND(AVG(s.total_amount), 2) as avg_sale_amount
        FROM clients c
        INNER JOIN sales s ON c.id = s.client_id
        ${whereClause}
        GROUP BY c.id, c.name, c.type, c.city, c.state
        ORDER BY total_spent DESC
        LIMIT 10
      `, params);

      stats.top_clients = topClientsResult.rows;

      return stats;

    } catch (error) {
      console.error('💥 Error obteniendo estadísticas de ventas:', error.message);
      throw new Error(`Error obteniendo estadísticas: ${error.message}`);
    }
  }

  /**
   * Obtener ventas vencidas (pagos atrasados)
   * @param {number} daysOverdue - Días de atraso mínimo
   * @returns {Promise<Array>} Ventas vencidas
   */
  static async getOverdueSales(daysOverdue = 0) {
    try {
      const result = await query(`
        SELECT 
          s.id, s.invoice_number, s.client_id, s.sale_date,
          s.total_amount, s.payment_due_date, s.payment_status,
          c.name as client_name,
          c.type as client_type,
          c.email as client_email,
          c.phone as client_phone,
          c.city as client_city,
          c.state as client_state,
          DATE_PART('day', CURRENT_DATE - s.payment_due_date) as days_overdue
        FROM sales s
        INNER JOIN clients c ON s.client_id = c.id
        WHERE s.payment_due_date < CURRENT_DATE
        AND s.payment_status IN ('pendiente', 'parcial', 'vencido')
        AND DATE_PART('day', CURRENT_DATE - s.payment_due_date) >= $1
        ORDER BY s.payment_due_date ASC
      `, [daysOverdue]);

      return result.rows;

    } catch (error) {
      console.error('💥 Error obteniendo ventas vencidas:', error.message);
      throw new Error(`Error obteniendo ventas vencidas: ${error.message}`);
    }
  }

  /**
   * Obtener análisis de ventas por período
   * @param {string} period - 'day', 'week', 'month', 'year'
   * @param {number} periods - Número de períodos a analizar
   * @returns {Promise<Array>} Análisis temporal de ventas
   */
  static async getSalesTrend(period = 'month', periods = 12) {
    try {
      let dateFormat, dateInterval;
      
      switch (period) {
        case 'day':
          dateFormat = 'YYYY-MM-DD';
          dateInterval = '1 day';
          break;
        case 'week':
          dateFormat = 'YYYY-"W"WW';
          dateInterval = '1 week';
          break;
        case 'month':
          dateFormat = 'YYYY-MM';
          dateInterval = '1 month';
          break;
        case 'year':
          dateFormat = 'YYYY';
          dateInterval = '1 year';
          break;
        default:
          throw new Error(`Período inválido: ${period}`);
      }

      const result = await query(`
        SELECT 
          TO_CHAR(s.sale_date, $1) as period,
          COUNT(*) as sales_count,
          ROUND(SUM(s.total_amount), 2) as total_revenue,
          ROUND(AVG(s.total_amount), 2) as avg_sale_amount,
          COUNT(DISTINCT s.client_id) as unique_clients,
          SUM(
            (SELECT SUM(sd.quantity) 
             FROM sale_details sd 
             WHERE sd.sale_id = s.id)
          ) as total_units_sold
        FROM sales s
        WHERE s.sale_date >= CURRENT_DATE - INTERVAL '${periods} ${period}'
        GROUP BY TO_CHAR(s.sale_date, $1)
        ORDER BY period ASC
      `, [dateFormat]);

      return result.rows;

    } catch (error) {
      console.error('💥 Error obteniendo tendencia de ventas:', error.message);
      throw new Error(`Error obteniendo tendencia de ventas: ${error.message}`);
    }
  }

  /**
   * Cancelar una venta (soft delete)
   * @param {number} id - ID de la venta
   * @param {string} reason - Razón de cancelación
   * @returns {Promise<boolean>} True si se canceló exitosamente
   */
  static async cancel(id, reason) {
    const client = await query('BEGIN');
    
    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error(`Venta con ID ${id} no encontrada`);
      }

      if (existing.payment_status === 'pagado') {
        throw new Error('No se puede cancelar una venta que ya está pagada');
      }

      // Restaurar stock de todos los productos
      for (const detail of existing.details) {
        const currentStock = await query(
          'SELECT current_stock, cost_price FROM products WHERE id = $1',
          [detail.product_id]
        );

        const newStock = currentStock.rows[0].current_stock + detail.quantity;

        await query(
          'UPDATE products SET current_stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [newStock, detail.product_id]
        );

        // Registrar movimiento de inventario (reversión)
        await query(`
          INSERT INTO inventory_movements (
            product_id, movement_type, quantity, previous_stock, new_stock,
            cost_per_unit, reference_type, reference_id, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          detail.product_id,
          'entrada',
          detail.quantity,
          currentStock.rows[0].current_stock,
          newStock,
          currentStock.rows[0].cost_price,
          'cancelacion',
          id,
          `Cancelación venta ${existing.invoice_number}: ${reason}`
        ]);
      }

      // Marcar venta como cancelada
      await query(`
        UPDATE sales 
        SET 
          payment_status = 'cancelado',
          notes = CONCAT(COALESCE(notes, ''), ' | CANCELADA: ', $1),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [reason, id]);

      await query('COMMIT');
      return true;

    } catch (error) {
      await query('ROLLBACK');
      console.error('💥 Error cancelando venta:', error.message);
      throw new Error(`Error cancelando venta: ${error.message}`);
    }
  }
}

module.exports = Sales;