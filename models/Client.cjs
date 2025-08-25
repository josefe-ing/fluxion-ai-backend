// =====================================================================================
// FLUXION AI - CLIENT MODEL (MULTI-TENANT)
// Modelo de datos para clientes mayoristas y detallistas con soporte multi-tenant
// =====================================================================================

const { query } = require('../config/database.cjs');

/**
 * Modelo Client con operaciones CRUD y análisis de comportamiento - Multi-tenant
 * Cada método requiere un tenantSchema para operar en el schema correcto
 */
class Client {
  
  /**
   * Obtener todos los clientes con filtros opcionales
   * @param {string} tenantSchema - Schema del tenant
   * @param {Object} options - Opciones de filtrado
   * @returns {Promise<Array>} Lista de clientes
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
          id, client_code, business_name, contact_person, email, phone,
          whatsapp, address, city, state, client_type, credit_limit,
          payment_terms, active, created_at, updated_at
        FROM "${tenantSchema}".clients
      `;

      // Agregar datos de ventas si se solicita
      if (options.withSalesData) {
        sql = `
          SELECT 
            c.id, c.client_code, c.business_name, c.contact_person, c.email, c.phone,
            c.whatsapp, c.address, c.city, c.state, c.client_type, c.credit_limit,
            c.payment_terms, c.active, c.created_at, c.updated_at,
            COUNT(s.id) as total_sales,
            COALESCE(SUM(s.total_amount), 0) as total_revenue,
            COALESCE(AVG(s.total_amount), 0) as avg_sale_amount,
            MAX(s.sale_date) as last_sale_date
          FROM "${tenantSchema}".clients c
          LEFT JOIN "${tenantSchema}".sales s ON c.id = s.client_id
        `;
      }

      if (whereConditions.length > 0) {
        sql += ` WHERE ${whereConditions.join(' AND ')}`;
      }

      if (options.withSalesData) {
        sql += ` GROUP BY c.id, c.client_code, c.business_name, c.contact_person, c.email, c.phone,
                 c.whatsapp, c.address, c.city, c.state, c.client_type, c.credit_limit,
                 c.payment_terms, c.active, c.created_at, c.updated_at`;
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
   * @param {string} tenantSchema - Schema del tenant
   * @param {number} id - ID del cliente
   * @returns {Promise<Object|null>} Cliente encontrado o null
   */
  static async getById(tenantSchema, id) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    try {
      const result = await query(`
        SELECT 
          id, client_code, business_name, contact_person, email, phone,
          whatsapp, address, city, state, client_type, credit_limit,
          payment_terms, active, created_at, updated_at
        FROM "${tenantSchema}".clients
        WHERE id = $1
      `, [id]);

      return result.rows[0] || null;

    } catch (error) {
      console.error('💥 Error obteniendo cliente por ID:', error.message);
      throw new Error(`Error obteniendo cliente: ${error.message}`);
    }
  }

  /**
   * Obtener un cliente por código
   * @param {string} tenantSchema - Schema del tenant
   * @param {string} clientCode - Código del cliente
   * @returns {Promise<Object|null>} Cliente encontrado o null
   */
  static async getByCode(tenantSchema, clientCode) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    try {
      const result = await query(`
        SELECT 
          id, client_code, business_name, contact_person, email, phone,
          whatsapp, address, city, state, client_type, credit_limit,
          payment_terms, active, created_at, updated_at
        FROM "${tenantSchema}".clients
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
   * @param {string} tenantSchema - Schema del tenant
   * @param {Object} clientData - Datos del cliente
   * @returns {Promise<Object>} Cliente creado
   */
  static async create(tenantSchema, clientData) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    try {
      const {
        client_code, business_name, contact_person, email, phone, whatsapp,
        address, city, state, client_type = 'mayorista', credit_limit = 0,
        payment_terms = 30, active = true
      } = clientData;

      // Validar que el código no exista
      const existing = await this.getByCode(tenantSchema, client_code);
      if (existing) {
        throw new Error(`Ya existe un cliente con código: ${client_code}`);
      }

      const result = await query(`
        INSERT INTO "${tenantSchema}".clients (
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
   * @param {string} tenantSchema - Schema del tenant
   * @param {number} id - ID del cliente
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<Object>} Cliente actualizado
   */
  static async update(tenantSchema, id, updateData) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    try {
      const existing = await this.getById(tenantSchema, id);
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
        UPDATE "${tenantSchema}".clients 
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
   * @param {string} tenantSchema - Schema del tenant
   * @param {number} id - ID del cliente
   * @returns {Promise<boolean>} True si se eliminó exitosamente
   */
  static async delete(tenantSchema, id) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    try {
      const existing = await this.getById(tenantSchema, id);
      if (!existing) {
        throw new Error(`Cliente con ID ${id} no encontrado`);
      }

      // Soft delete - solo marcar como inactivo
      const result = await query(`
        UPDATE "${tenantSchema}".clients 
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
   * Obtener estadísticas de clientes
   * @param {string} tenantSchema - Schema del tenant
   * @returns {Promise<Object>} Estadísticas de clientes
   */
  static async getStats(tenantSchema) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
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
          ROUND(AVG(payment_terms), 2) as avg_payment_terms
        FROM "${tenantSchema}".clients
      `);

      return result.rows[0];

    } catch (error) {
      console.error('💥 Error obteniendo estadísticas de clientes:', error.message);
      throw new Error(`Error obteniendo estadísticas: ${error.message}`);
    }
  }

  /**
   * Buscar clientes por texto
   * @param {string} tenantSchema - Schema del tenant
   * @param {string} searchTerm - Término de búsqueda
   * @param {number} limit - Límite de resultados
   * @returns {Promise<Array>} Clientes encontrados
   */
  static async search(tenantSchema, searchTerm, limit = 20) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    try {
      const result = await query(`
        SELECT 
          id, client_code, business_name, contact_person, email, phone,
          whatsapp, address, city, state, client_type, credit_limit,
          payment_terms, active, created_at, updated_at
        FROM "${tenantSchema}".clients 
        WHERE (
          business_name ILIKE $1 OR 
          client_code ILIKE $1 OR 
          contact_person ILIKE $1 OR 
          email ILIKE $1 OR
          city ILIKE $1
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

  /**
   * Obtener clientes con pagos vencidos
   * @param {string} tenantSchema - Schema del tenant
   * @param {number} daysOverdue - Días de vencimiento mínimo
   * @returns {Promise<Array>} Clientes con pagos vencidos
   */
  static async getOverdueClients(tenantSchema, daysOverdue = 1) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    try {
      const result = await query(`
        SELECT DISTINCT
          c.id, c.client_code, c.business_name, c.contact_person, c.email, c.phone,
          c.whatsapp, c.payment_terms,
          COUNT(s.id) as overdue_sales,
          SUM(s.total_amount) as total_overdue_amount,
          MIN(s.sale_date) as oldest_overdue_date,
          ROUND(AVG(CURRENT_DATE - s.sale_date::date), 0) as avg_days_overdue
        FROM "${tenantSchema}".clients c
        JOIN "${tenantSchema}".sales s ON c.id = s.client_id
        WHERE s.payment_status IN ('pendiente', 'parcial')
        AND s.sale_date < (CURRENT_DATE - (c.payment_terms + $1))
        AND c.active = true
        GROUP BY c.id, c.client_code, c.business_name, c.contact_person, c.email, c.phone, c.whatsapp, c.payment_terms
        ORDER BY total_overdue_amount DESC
      `, [daysOverdue]);

      return result.rows;

    } catch (error) {
      console.error('💥 Error obteniendo clientes con pagos vencidos:', error.message);
      throw new Error(`Error obteniendo clientes con pagos vencidos: ${error.message}`);
    }
  }

  /**
   * Obtener inteligencia del cliente (análisis de comportamiento)
   * @param {string} tenantSchema - Schema del tenant
   * @param {number} id - ID del cliente
   * @param {number} days - Días hacia atrás para analizar
   * @returns {Promise<Object>} Análisis de comportamiento del cliente
   */
  static async getClientIntelligence(tenantSchema, id, days = 90) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    try {
      const client = await this.getById(tenantSchema, id);
      if (!client) {
        throw new Error(`Cliente con ID ${id} no encontrado`);
      }

      // Análisis de ventas
      const salesAnalysis = await query(`
        SELECT 
          COUNT(*) as total_sales,
          COALESCE(SUM(total_amount), 0) as total_revenue,
          COALESCE(AVG(total_amount), 0) as avg_sale_amount,
          MIN(sale_date) as first_sale_date,
          MAX(sale_date) as last_sale_date,
          COUNT(*) FILTER (WHERE payment_status = 'pagado') as paid_sales,
          COUNT(*) FILTER (WHERE payment_status = 'pendiente') as pending_sales,
          COUNT(*) FILTER (WHERE payment_status = 'vencido') as overdue_sales
        FROM "${tenantSchema}".sales
        WHERE client_id = $1 
        AND sale_date >= (CURRENT_DATE - INTERVAL '${days} days')
      `, [id]);

      // Productos más comprados
      const topProducts = await query(`
        SELECT 
          p.name, p.category, p.brand,
          COUNT(*) as purchase_frequency,
          SUM(sd.quantity) as total_quantity,
          SUM(sd.total_price) as total_spent
        FROM "${tenantSchema}".sales s
        JOIN "${tenantSchema}".sale_details sd ON s.id = sd.sale_id
        JOIN "${tenantSchema}".products p ON sd.product_id = p.id
        WHERE s.client_id = $1 
        AND s.sale_date >= (CURRENT_DATE - INTERVAL '${days} days')
        GROUP BY p.id, p.name, p.category, p.brand
        ORDER BY total_spent DESC
        LIMIT 5
      `, [id]);

      // Patrón de compras mensuales
      const monthlyPattern = await query(`
        SELECT 
          EXTRACT(MONTH FROM sale_date) as month,
          COUNT(*) as sales_count,
          SUM(total_amount) as monthly_revenue
        FROM "${tenantSchema}".sales
        WHERE client_id = $1 
        AND sale_date >= (CURRENT_DATE - INTERVAL '12 months')
        GROUP BY EXTRACT(MONTH FROM sale_date)
        ORDER BY month
      `, [id]);

      const salesData = salesAnalysis.rows[0];
      
      return {
        client_info: client,
        sales_summary: {
          ...salesData,
          avg_sale_amount: parseFloat(salesData.avg_sale_amount),
          total_revenue: parseFloat(salesData.total_revenue),
          payment_performance: {
            paid_percentage: salesData.total_sales > 0 ? 
              Math.round((salesData.paid_sales / salesData.total_sales) * 100) : 0,
            pending_count: parseInt(salesData.pending_sales),
            overdue_count: parseInt(salesData.overdue_sales)
          }
        },
        top_products: topProducts.rows,
        monthly_pattern: monthlyPattern.rows,
        loyalty_score: this.calculateLoyaltyScore(salesData, days),
        risk_assessment: this.assessClientRisk(salesData, client)
      };

    } catch (error) {
      console.error('💥 Error obteniendo inteligencia del cliente:', error.message);
      throw new Error(`Error obteniendo inteligencia del cliente: ${error.message}`);
    }
  }

  /**
   * Calcular score de lealtad del cliente
   * @param {Object} salesData - Datos de ventas del cliente
   * @param {number} days - Período analizado
   * @returns {number} Score de lealtad (0-100)
   */
  static calculateLoyaltyScore(salesData, days) {
    const frequencyScore = Math.min((salesData.total_sales / (days / 30)) * 10, 40);
    const volumeScore = Math.min((salesData.total_revenue / 10000) * 30, 30);
    const paymentScore = salesData.total_sales > 0 ? 
      (salesData.paid_sales / salesData.total_sales) * 30 : 0;
    
    return Math.round(frequencyScore + volumeScore + paymentScore);
  }

  /**
   * Evaluar riesgo del cliente
   * @param {Object} salesData - Datos de ventas del cliente
   * @param {Object} client - Datos del cliente
   * @returns {Object} Evaluación de riesgo
   */
  static assessClientRisk(salesData, client) {
    let riskLevel = 'low';
    let riskFactors = [];

    // Factor de pagos vencidos
    if (salesData.overdue_sales > 0) {
      riskFactors.push('Tiene pagos vencidos');
      riskLevel = 'medium';
    }

    // Factor de porcentaje de pagos pendientes
    const pendingPercentage = salesData.total_sales > 0 ? 
      (salesData.pending_sales / salesData.total_sales) * 100 : 0;
    
    if (pendingPercentage > 30) {
      riskFactors.push('Alto porcentaje de pagos pendientes');
      riskLevel = 'high';
    }

    // Factor de inactividad reciente
    if (salesData.last_sale_date) {
      const daysSinceLastSale = Math.floor(
        (new Date() - new Date(salesData.last_sale_date)) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceLastSale > 60) {
        riskFactors.push('Sin compras recientes');
        if (riskLevel === 'low') riskLevel = 'medium';
      }
    }

    return {
      level: riskLevel,
      factors: riskFactors,
      recommendation: this.getRiskRecommendation(riskLevel, riskFactors)
    };
  }

  /**
   * Obtener recomendación basada en el riesgo
   * @param {string} riskLevel - Nivel de riesgo
   * @param {Array} riskFactors - Factores de riesgo
   * @returns {string} Recomendación
   */
  static getRiskRecommendation(riskLevel, riskFactors) {
    switch (riskLevel) {
      case 'high':
        return 'Contactar inmediatamente para revisar pagos pendientes y condiciones de crédito';
      case 'medium':
        return 'Monitorear de cerca y considerar ajustar términos de pago';
      case 'low':
      default:
        return 'Cliente en buen estado, mantener relación comercial actual';
    }
  }
}

module.exports = Client;