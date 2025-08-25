// =====================================================================================
// FLUXION AI - CLIENT MODEL
// Modelo de datos para clientes mayoristas y detallistas
// =====================================================================================

const { query } = require('../config/database');

/**
 * Modelo Client con operaciones CRUD y análisis de comportamiento
 */
class Client {
  
  /**
   * Obtener todos los clientes con filtros opcionales
   * @param {Object} options - Opciones de filtrado
   * @param {string} options.client_type - Filtrar por tipo (mayorista, detallista, corporativo)
   * @param {string} options.city - Filtrar por ciudad
   * @param {string} options.state - Filtrar por estado
   * @param {boolean} options.active - Filtrar por activo/inactivo
   * @param {boolean} options.withSalesData - Incluir datos de ventas
   * @param {number} options.limit - Límite de resultados
   * @param {number} options.offset - Offset para paginación
   * @returns {Promise<Array>} Lista de clientes
   */
  static async getAll(options = {}) {
    try {
      let whereConditions = [];
      let params = [];
      let paramIndex = 1;

      // Construir condiciones WHERE dinámicamente
      if (options.client_type) {
        whereConditions.push(`client_type = $${paramIndex}`);
        params.push(options.client_type);
        paramIndex++;
      }

      if (options.city) {
        whereConditions.push(`city ILIKE $${paramIndex}`);
        params.push(`%${options.city}%`);
        paramIndex++;
      }

      if (options.state) {
        whereConditions.push(`state ILIKE $${paramIndex}`);
        params.push(`%${options.state}%`);
        paramIndex++;
      }

      if (options.active !== undefined) {
        whereConditions.push(`active = $${paramIndex}`);
        params.push(options.active);
        paramIndex++;
      }

      // Query base
      let sql = `
        SELECT 
          c.id, c.client_code, c.business_name, c.contact_person,
          c.email, c.phone, c.whatsapp, c.address, c.city, c.state,
          c.client_type, c.credit_limit, c.payment_terms, c.active,
          c.created_at, c.updated_at
      `;

      // Si se requieren datos de ventas, agregar LEFT JOIN
      if (options.withSalesData) {
        sql += `,
          COUNT(s.id) as total_orders,
          COALESCE(SUM(s.total_amount), 0) as total_revenue,
          COALESCE(AVG(s.total_amount), 0) as avg_order_value,
          MAX(s.sale_date) as last_order_date,
          COUNT(s.id) FILTER (WHERE s.payment_status = 'vencido') as overdue_orders,
          COALESCE(SUM(s.total_amount) FILTER (WHERE s.payment_status = 'vencido'), 0) as overdue_amount
        `;
      }

      sql += ` FROM clients c`;

      if (options.withSalesData) {
        sql += ` LEFT JOIN sales s ON c.id = s.client_id`;
      }

      if (whereConditions.length > 0) {
        sql += ` WHERE ${whereConditions.join(' AND ')}`;
      }

      if (options.withSalesData) {
        sql += ` GROUP BY c.id, c.client_code, c.business_name, c.contact_person, c.email, c.phone, c.whatsapp, c.address, c.city, c.state, c.client_type, c.credit_limit, c.payment_terms, c.active, c.created_at, c.updated_at`;
      }

      sql += ` ORDER BY c.business_name`;

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
      console.error('💥 Error obteniendo clientes:', error.message);
      throw new Error(`Error obteniendo clientes: ${error.message}`);
    }
  }

  /**
   * Obtener un cliente por ID
   * @param {number} id - ID del cliente
   * @param {boolean} withSalesData - Incluir datos de ventas
   * @returns {Promise<Object|null>} Cliente encontrado o null
   */
  static async getById(id, withSalesData = false) {
    try {
      let sql = `
        SELECT 
          c.id, c.client_code, c.business_name, c.contact_person,
          c.email, c.phone, c.whatsapp, c.address, c.city, c.state,
          c.client_type, c.credit_limit, c.payment_terms, c.active,
          c.created_at, c.updated_at
      `;

      if (withSalesData) {
        sql += `,
          COUNT(s.id) as total_orders,
          COALESCE(SUM(s.total_amount), 0) as total_revenue,
          COALESCE(AVG(s.total_amount), 0) as avg_order_value,
          MAX(s.sale_date) as last_order_date,
          COUNT(s.id) FILTER (WHERE s.payment_status = 'vencido') as overdue_orders,
          COALESCE(SUM(s.total_amount) FILTER (WHERE s.payment_status = 'vencido'), 0) as overdue_amount
        `;
      }

      sql += ` FROM clients c`;

      if (withSalesData) {
        sql += ` LEFT JOIN sales s ON c.id = s.client_id`;
      }

      sql += ` WHERE c.id = $1`;

      if (withSalesData) {
        sql += ` GROUP BY c.id, c.client_code, c.business_name, c.contact_person, c.email, c.phone, c.whatsapp, c.address, c.city, c.state, c.client_type, c.credit_limit, c.payment_terms, c.active, c.created_at, c.updated_at`;
      }

      const result = await query(sql, [id]);
      return result.rows[0] || null;

    } catch (error) {
      console.error('💥 Error obteniendo cliente por ID:', error.message);
      throw new Error(`Error obteniendo cliente: ${error.message}`);
    }
  }

  /**
   * Obtener un cliente por código
   * @param {string} clientCode - Código del cliente
   * @returns {Promise<Object|null>} Cliente encontrado o null
   */
  static async getByCode(clientCode) {
    try {
      const result = await query(`
        SELECT 
          id, client_code, business_name, contact_person,
          email, phone, whatsapp, address, city, state,
          client_type, credit_limit, payment_terms, active,
          created_at, updated_at
        FROM clients 
        WHERE client_code = $1
      `, [clientCode]);

      return result.rows[0] || null;

    } catch (error) {
      console.error('💥 Error obteniendo cliente por código:', error.message);
      throw new Error(`Error obteniendo cliente: ${error.message}`);
    }
  }

  /**
   * Crear un nuevo cliente
   * @param {Object} clientData - Datos del cliente
   * @returns {Promise<Object>} Cliente creado
   */
  static async create(clientData) {
    try {
      const {
        client_code, business_name, contact_person, email, phone, whatsapp,
        address, city, state, client_type = 'mayorista', credit_limit = 0,
        payment_terms = 30, active = true
      } = clientData;

      // Validar que el código no exista
      const existing = await this.getByCode(client_code);
      if (existing) {
        throw new Error(`Ya existe un cliente con código: ${client_code}`);
      }

      const result = await query(`
        INSERT INTO clients (
          client_code, business_name, contact_person, email, phone, whatsapp,
          address, city, state, client_type, credit_limit, payment_terms, active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        client_code, business_name, contact_person, email, phone, whatsapp,
        address, city, state, client_type, credit_limit, payment_terms, active
      ]);

      return result.rows[0];

    } catch (error) {
      console.error('💥 Error creando cliente:', error.message);
      throw new Error(`Error creando cliente: ${error.message}`);
    }
  }

  /**
   * Actualizar un cliente
   * @param {number} id - ID del cliente
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<Object>} Cliente actualizado
   */
  static async update(id, updateData) {
    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error(`Cliente con ID ${id} no encontrado`);
      }

      // Construir query de actualización dinámicamente
      const updateFields = [];
      const params = [];
      let paramIndex = 1;

      const allowedFields = [
        'client_code', 'business_name', 'contact_person', 'email', 'phone',
        'whatsapp', 'address', 'city', 'state', 'client_type', 'credit_limit',
        'payment_terms', 'active'
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
        UPDATE clients 
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await query(sql, params);
      return result.rows[0];

    } catch (error) {
      console.error('💥 Error actualizando cliente:', error.message);
      throw new Error(`Error actualizando cliente: ${error.message}`);
    }
  }

  /**
   * Eliminar un cliente (soft delete)
   * @param {number} id - ID del cliente
   * @returns {Promise<boolean>} True si se eliminó exitosamente
   */
  static async delete(id) {
    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error(`Cliente con ID ${id} no encontrado`);
      }

      // Verificar que no tenga ventas pendientes
      const pendingSales = await query(`
        SELECT COUNT(*) as count 
        FROM sales 
        WHERE client_id = $1 AND payment_status IN ('pendiente', 'parcial')
      `, [id]);

      if (parseInt(pendingSales.rows[0].count) > 0) {
        throw new Error('No se puede eliminar cliente con ventas pendientes');
      }

      // Soft delete - solo marcar como inactivo
      const result = await query(`
        UPDATE clients 
        SET active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id
      `, [id]);

      return result.rowCount > 0;

    } catch (error) {
      console.error('💥 Error eliminando cliente:', error.message);
      throw new Error(`Error eliminando cliente: ${error.message}`);
    }
  }

  /**
   * Obtener clientes con pagos vencidos
   * @param {number} daysOverdue - Días de vencimiento mínimo
   * @returns {Promise<Array>} Lista de clientes con pagos vencidos
   */
  static async getOverdueClients(daysOverdue = 0) {
    try {
      const result = await query(`
        SELECT 
          c.id, c.client_code, c.business_name, c.contact_person,
          c.email, c.phone, c.whatsapp, c.city, c.state,
          c.client_type, c.credit_limit,
          COUNT(s.id) as overdue_orders,
          SUM(s.total_amount) as overdue_amount,
          MIN(s.sale_date) as oldest_overdue_date,
          MAX(s.sale_date) as latest_overdue_date,
          CURRENT_DATE - MIN(s.sale_date::date) as days_overdue
        FROM clients c
        INNER JOIN sales s ON c.id = s.client_id
        WHERE s.payment_status = 'vencido'
        AND CURRENT_DATE - s.sale_date::date >= $1
        AND c.active = true
        GROUP BY c.id, c.client_code, c.business_name, c.contact_person,
                 c.email, c.phone, c.whatsapp, c.city, c.state,
                 c.client_type, c.credit_limit
        ORDER BY days_overdue DESC, overdue_amount DESC
      `, [daysOverdue]);

      return result.rows;

    } catch (error) {
      console.error('💥 Error obteniendo clientes morosos:', error.message);
      throw new Error(`Error obteniendo clientes morosos: ${error.message}`);
    }
  }

  /**
   * Obtener análisis de comportamiento de cliente
   * @param {number} id - ID del cliente
   * @param {number} days - Días hacia atrás para el análisis
   * @returns {Promise<Object>} Análisis de comportamiento
   */
  static async getClientIntelligence(id, days = 90) {
    try {
      const client = await this.getById(id, true);
      if (!client) {
        throw new Error(`Cliente con ID ${id} no encontrado`);
      }

      // Análisis de ventas por período
      const salesAnalysis = await query(`
        SELECT 
          COUNT(*) as total_orders,
          SUM(total_amount) as total_spent,
          AVG(total_amount) as avg_order_value,
          MIN(sale_date) as first_order,
          MAX(sale_date) as last_order,
          EXTRACT(DAYS FROM (MAX(sale_date) - MIN(sale_date))) as customer_lifetime_days,
          COUNT(DISTINCT EXTRACT(MONTH FROM sale_date)) as active_months,
          ROUND(AVG(EXTRACT(DAYS FROM (CURRENT_DATE - sale_date))), 0) as avg_days_between_orders
        FROM sales
        WHERE client_id = $1 
        AND sale_date >= CURRENT_DATE - INTERVAL '${days} days'
      `, [id]);

      // Productos más comprados
      const topProducts = await query(`
        SELECT 
          p.name, p.sku, p.category,
          SUM(sd.quantity) as total_quantity,
          SUM(sd.total_price) as total_spent,
          COUNT(DISTINCT s.id) as orders_count,
          ROUND(AVG(sd.unit_price), 2) as avg_price_paid
        FROM sale_details sd
        JOIN sales s ON sd.sale_id = s.id
        JOIN products p ON sd.product_id = p.id
        WHERE s.client_id = $1 
        AND s.sale_date >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY p.id, p.name, p.sku, p.category
        ORDER BY total_spent DESC
        LIMIT 10
      `, [id]);

      // Patrón de pagos
      const paymentPattern = await query(`
        SELECT 
          payment_status,
          COUNT(*) as orders_count,
          SUM(total_amount) as total_amount,
          ROUND(AVG(EXTRACT(DAYS FROM (CURRENT_DATE - sale_date))), 0) as avg_days_since_sale
        FROM sales
        WHERE client_id = $1 
        AND sale_date >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY payment_status
        ORDER BY total_amount DESC
      `, [id]);

      // Predicción de próxima compra
      const lastOrderDays = client.last_order_date ? 
        Math.floor((new Date() - new Date(client.last_order_date)) / (1000 * 60 * 60 * 24)) : null;
      
      const avgDaysBetween = salesAnalysis.rows[0]?.avg_days_between_orders || 30;
      const nextOrderPrediction = lastOrderDays !== null ? 
        Math.max(0, avgDaysBetween - lastOrderDays) : null;

      return {
        client: client,
        sales_summary: salesAnalysis.rows[0],
        top_products: topProducts.rows,
        payment_pattern: paymentPattern.rows,
        predictions: {
          next_order_in_days: nextOrderPrediction,
          likelihood_score: nextOrderPrediction !== null && nextOrderPrediction <= 7 ? 0.8 : 0.4,
          risk_level: client.overdue_amount > 0 ? 'high' : 'low'
        },
        analysis_period_days: days
      };

    } catch (error) {
      console.error('💥 Error obteniendo inteligencia de cliente:', error.message);
      throw new Error(`Error obteniendo inteligencia de cliente: ${error.message}`);
    }
  }

  /**
   * Obtener estadísticas de clientes
   * @returns {Promise<Object>} Estadísticas de clientes
   */
  static async getStats() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_clients,
          COUNT(*) FILTER (WHERE active = true) as active_clients,
          COUNT(*) FILTER (WHERE client_type = 'mayorista') as mayorista_clients,
          COUNT(*) FILTER (WHERE client_type = 'detallista') as detallista_clients,
          COUNT(*) FILTER (WHERE client_type = 'corporativo') as corporativo_clients,
          COUNT(DISTINCT city) as total_cities,
          COUNT(DISTINCT state) as total_states,
          ROUND(AVG(credit_limit), 2) as avg_credit_limit,
          ROUND(AVG(payment_terms), 0) as avg_payment_terms
        FROM clients
      `);

      // Estadísticas de ventas por tipo de cliente
      const salesByType = await query(`
        SELECT 
          c.client_type,
          COUNT(DISTINCT c.id) as clients_count,
          COUNT(s.id) as total_orders,
          COALESCE(SUM(s.total_amount), 0) as total_revenue,
          COALESCE(AVG(s.total_amount), 0) as avg_order_value
        FROM clients c
        LEFT JOIN sales s ON c.id = s.client_id
        WHERE c.active = true
        GROUP BY c.client_type
        ORDER BY total_revenue DESC
      `);

      return {
        general_stats: result.rows[0],
        sales_by_type: salesByType.rows
      };

    } catch (error) {
      console.error('💥 Error obteniendo estadísticas de clientes:', error.message);
      throw new Error(`Error obteniendo estadísticas: ${error.message}`);
    }
  }

  /**
   * Buscar clientes por texto
   * @param {string} searchTerm - Término de búsqueda
   * @param {number} limit - Límite de resultados
   * @returns {Promise<Array>} Clientes encontrados
   */
  static async search(searchTerm, limit = 20) {
    try {
      const result = await query(`
        SELECT 
          id, client_code, business_name, contact_person,
          email, phone, whatsapp, address, city, state,
          client_type, credit_limit, payment_terms, active,
          created_at, updated_at
        FROM clients 
        WHERE (
          business_name ILIKE $1 OR 
          client_code ILIKE $1 OR 
          contact_person ILIKE $1 OR
          city ILIKE $1 OR
          state ILIKE $1
        )
        AND active = true
        ORDER BY 
          CASE WHEN business_name ILIKE $1 THEN 1 ELSE 2 END,
          business_name
        LIMIT $2
      `, [`%${searchTerm}%`, limit]);

      return result.rows;

    } catch (error) {
      console.error('💥 Error buscando clientes:', error.message);
      throw new Error(`Error buscando clientes: ${error.message}`);
    }
  }
}

module.exports = Client;