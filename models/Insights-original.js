// =====================================================================================
// FLUXION AI - INSIGHTS MODEL
// Modelo de datos para insights proactivos y generación de recomendaciones inteligentes
// =====================================================================================

const { query } = require('../config/database');

/**
 * Modelo Insights con generación de análisis proactivos y recomendaciones de negocio
 */
class Insights {
  
  /**
   * Obtener todos los insights con filtros opcionales
   * @param {Object} options - Opciones de filtrado
   * @param {string} options.type - Filtrar por tipo de insight
   * @param {string} options.priority - Filtrar por prioridad
   * @param {boolean} options.isActive - Solo insights activos
   * @param {string} options.category - Filtrar por categoría
   * @param {number} options.limit - Límite de resultados
   * @param {number} options.offset - Offset para paginación
   * @returns {Promise<Array>} Lista de insights
   */
  static async getAll(options = {}) {
    try {
      let whereConditions = [];
      let params = [];
      let paramIndex = 1;

      // Construir condiciones WHERE dinámicamente
      if (options.type) {
        whereConditions.push(`type = $${paramIndex}`);
        params.push(options.type);
        paramIndex++;
      }

      if (options.priority) {
        whereConditions.push(`priority = $${paramIndex}`);
        params.push(options.priority);
        paramIndex++;
      }

      if (options.isActive !== undefined) {
        whereConditions.push(`is_active = $${paramIndex}`);
        params.push(options.isActive);
        paramIndex++;
      }

      if (options.category) {
        whereConditions.push(`category = $${paramIndex}`);
        params.push(options.category);
        paramIndex++;
      }

      // Construir query
      let sql = `
        SELECT 
          id, type, title, description, category, priority,
          data_context, recommendations, confidence_score,
          is_active, created_at, updated_at, expires_at,
          CASE 
            WHEN expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP THEN true
            ELSE false
          END as is_expired,
          CASE 
            WHEN created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours' THEN true
            ELSE false
          END as is_recent
        FROM insights
      `;

      if (whereConditions.length > 0) {
        sql += ` WHERE ${whereConditions.join(' AND ')}`;
      }

      sql += ` ORDER BY 
        CASE priority 
          WHEN 'critico' THEN 1 
          WHEN 'alto' THEN 2 
          WHEN 'medio' THEN 3 
          ELSE 4 
        END,
        created_at DESC
      `;

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
      console.error('💥 Error obteniendo insights:', error.message);
      throw new Error(`Error obteniendo insights: ${error.message}`);
    }
  }

  /**
   * Obtener un insight por ID
   * @param {number} id - ID del insight
   * @returns {Promise<Object|null>} Insight encontrado o null
   */
  static async getById(id) {
    try {
      const result = await query(`
        SELECT 
          id, type, title, description, category, priority,
          data_context, recommendations, confidence_score,
          is_active, created_at, updated_at, expires_at,
          CASE 
            WHEN expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP THEN true
            ELSE false
          END as is_expired
        FROM insights 
        WHERE id = $1
      `, [id]);

      return result.rows[0] || null;

    } catch (error) {
      console.error('💥 Error obteniendo insight por ID:', error.message);
      throw new Error(`Error obteniendo insight: ${error.message}`);
    }
  }

  /**
   * Crear un nuevo insight
   * @param {Object} insightData - Datos del insight
   * @returns {Promise<Object>} Insight creado
   */
  static async create(insightData) {
    try {
      const {
        type, title, description, category, priority = 'medio',
        data_context = {}, recommendations = [], confidence_score = 0.5,
        is_active = true, expires_at = null
      } = insightData;

      const result = await query(`
        INSERT INTO insights (
          type, title, description, category, priority,
          data_context, recommendations, confidence_score,
          is_active, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        type, title, description, category, priority,
        JSON.stringify(data_context), JSON.stringify(recommendations),
        confidence_score, is_active, expires_at
      ]);

      return result.rows[0];

    } catch (error) {
      console.error('💥 Error creando insight:', error.message);
      throw new Error(`Error creando insight: ${error.message}`);
    }
  }

  /**
   * Actualizar un insight
   * @param {number} id - ID del insight
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<Object>} Insight actualizado
   */
  static async update(id, updateData) {
    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error(`Insight con ID ${id} no encontrado`);
      }

      // Construir query de actualización dinámicamente
      const updateFields = [];
      const params = [];
      let paramIndex = 1;

      const allowedFields = [
        'type', 'title', 'description', 'category', 'priority',
        'data_context', 'recommendations', 'confidence_score',
        'is_active', 'expires_at'
      ];

      Object.keys(updateData).forEach(field => {
        if (allowedFields.includes(field)) {
          updateFields.push(`${field} = $${paramIndex}`);
          
          // Manejar campos JSON
          if (field === 'data_context' || field === 'recommendations') {
            params.push(JSON.stringify(updateData[field]));
          } else {
            params.push(updateData[field]);
          }
          paramIndex++;
        }
      });

      if (updateFields.length === 0) {
        throw new Error('No hay campos válidos para actualizar');
      }

      params.push(id);
      const sql = `
        UPDATE insights 
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await query(sql, params);
      return result.rows[0];

    } catch (error) {
      console.error('💥 Error actualizando insight:', error.message);
      throw new Error(`Error actualizando insight: ${error.message}`);
    }
  }

  /**
   * Desactivar un insight
   * @param {number} id - ID del insight
   * @returns {Promise<boolean>} True si se desactivó exitosamente
   */
  static async deactivate(id) {
    try {
      const result = await query(`
        UPDATE insights 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id
      `, [id]);

      return result.rowCount > 0;

    } catch (error) {
      console.error('💥 Error desactivando insight:', error.message);
      throw new Error(`Error desactivando insight: ${error.message}`);
    }
  }

  /**
   * Generar insights de inventario automáticamente
   * @returns {Promise<Array>} Insights generados
   */
  static async generateInventoryInsights() {
    try {
      const insights = [];

      // 1. Productos con stock crítico
      const criticalStockResult = await query(`
        SELECT 
          COUNT(*) as count,
          ARRAY_AGG(
            JSON_BUILD_OBJECT(
              'id', id,
              'sku', sku,
              'name', name,
              'current_stock', current_stock,
              'min_threshold', min_stock_threshold,
              'shortage_days', ROUND((min_stock_threshold - current_stock)::numeric / GREATEST(1, min_stock_threshold) * 30), 0)
            )
          ) as products
        FROM products 
        WHERE current_stock <= min_stock_threshold * 0.5
        AND active = true
      `);

      if (criticalStockResult.rows[0].count > 0) {
        const products = criticalStockResult.rows[0].products;
        
        insights.push({
          type: 'stock_alert',
          title: `⚠️ Stock Crítico: ${criticalStockResult.rows[0].count} productos en riesgo`,
          description: `Se detectaron productos con stock por debajo del 50% del mínimo recomendado. Acción inmediata requerida.`,
          category: 'inventario',
          priority: 'critico',
          confidence_score: 0.95,
          data_context: {
            products_count: criticalStockResult.rows[0].count,
            affected_products: products,
            risk_level: 'critical',
            estimated_stockout_days: Math.min(...products.map(p => p.shortage_days))
          },
          recommendations: [
            `Generar órdenes de compra urgentes para ${criticalStockResult.rows[0].count} productos`,
            'Activar proveedores alternativos para productos críticos',
            'Revisar política de stock mínimo para evitar futuros desabastecimientos',
            'Implementar alertas tempranas cuando el stock llegue al 70% del mínimo'
          ]
        });
      }

      // 2. Análisis de productos sin movimiento
      const dormantProductsResult = await query(`
        WITH product_activity AS (
          SELECT 
            p.id, p.sku, p.name, p.current_stock, p.cost_price,
            COALESCE(MAX(im.created_at), p.created_at) as last_movement,
            ROUND(p.current_stock * p.cost_price, 2) as tied_capital
          FROM products p
          LEFT JOIN inventory_movements im ON p.id = im.product_id
          WHERE p.active = true AND p.current_stock > 0
          GROUP BY p.id, p.sku, p.name, p.current_stock, p.cost_price, p.created_at
          HAVING COALESCE(MAX(im.created_at), p.created_at) < CURRENT_DATE - INTERVAL '45 days'
        )
        SELECT 
          COUNT(*) as count,
          ROUND(SUM(tied_capital), 2) as total_tied_capital,
          ARRAY_AGG(
            JSON_BUILD_OBJECT(
              'id', id,
              'sku', sku,
              'name', name,
              'stock', current_stock,
              'tied_capital', tied_capital,
              'days_inactive', DATE_PART('day', CURRENT_DATE - last_movement)
            )
            ORDER BY tied_capital DESC
            LIMIT 10
          ) as top_products
        FROM product_activity
      `);

      if (dormantProductsResult.rows[0].count > 0) {
        const data = dormantProductsResult.rows[0];
        
        insights.push({
          type: 'inventory_optimization',
          title: `📦 Capital Inmovilizado: $${data.total_tied_capital.toLocaleString()} en ${data.count} productos sin movimiento`,
          description: `Se detectaron productos sin actividad en los últimos 45 días que representan capital inmovilizado significativo.`,
          category: 'inventario',
          priority: 'alto',
          confidence_score: 0.85,
          data_context: {
            dormant_products_count: data.count,
            total_tied_capital: data.total_tied_capital,
            top_dormant_products: data.top_products,
            analysis_period_days: 45
          },
          recommendations: [
            'Implementar promociones especiales para productos sin movimiento',
            'Revisar estrategia de precios para productos con baja rotación',
            'Considerar liquidación de inventario para liberar capital',
            'Analizar demanda histórica para ajustar niveles de reorden'
          ]
        });
      }

      // 3. Oportunidades de ventas basadas en tendencias
      const salesOpportunityResult = await query(`
        WITH monthly_sales AS (
          SELECT 
            p.id, p.sku, p.name, p.current_stock,
            DATE_TRUNC('month', s.sale_date) as month,
            SUM(sd.quantity) as units_sold,
            AVG(sd.unit_price) as avg_price
          FROM products p
          INNER JOIN sale_details sd ON p.id = sd.product_id
          INNER JOIN sales s ON sd.sale_id = s.id
          WHERE s.sale_date >= CURRENT_DATE - INTERVAL '3 months'
          GROUP BY p.id, p.sku, p.name, p.current_stock, DATE_TRUNC('month', s.sale_date)
        ),
        trending_products AS (
          SELECT 
            id, sku, name, current_stock,
            AVG(units_sold) as avg_monthly_sales,
            COUNT(*) as months_with_sales,
            ROUND(
              (COALESCE(MAX(units_sold) FILTER (WHERE month = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')), 0) - 
               COALESCE(AVG(units_sold) FILTER (WHERE month < DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')), 1)) 
              / NULLIF(AVG(units_sold) FILTER (WHERE month < DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')), 0) * 100, 1
            ) as growth_rate
          FROM monthly_sales
          GROUP BY id, sku, name, current_stock
          HAVING COUNT(*) >= 2
          AND AVG(units_sold) > 5
        )
        SELECT 
          COUNT(*) FILTER (WHERE growth_rate > 20) as growing_products_count,
          ARRAY_AGG(
            JSON_BUILD_OBJECT(
              'id', id,
              'sku', sku,
              'name', name,
              'current_stock', current_stock,
              'avg_monthly_sales', ROUND(avg_monthly_sales, 1),
              'growth_rate', growth_rate,
              'stock_weeks', ROUND(current_stock / (avg_monthly_sales / 4.3), 1)
            )
            ORDER BY growth_rate DESC
          ) FILTER (WHERE growth_rate > 20) as growing_products
        FROM trending_products
      `);

      if (salesOpportunityResult.rows[0].growing_products_count > 0) {
        const data = salesOpportunityResult.rows[0];
        
        insights.push({
          type: 'sales_opportunity',
          title: `📈 Oportunidad de Ventas: ${data.growing_products_count} productos en crecimiento acelerado`,
          description: `Se identificaron productos con crecimiento de ventas superior al 20% que pueden necesitar mayor inventario.`,
          category: 'ventas',
          priority: 'medio',
          confidence_score: 0.78,
          data_context: {
            growing_products_count: data.growing_products_count,
            growing_products: data.growing_products,
            analysis_period_months: 3,
            growth_threshold: 20
          },
          recommendations: [
            'Incrementar stock para productos con alta demanda creciente',
            'Analizar capacidad de proveedores para satisfacer demanda aumentada',
            'Considerar promociones cruzadas con productos complementarios',
            'Monitorear tendencias del mercado para productos en crecimiento'
          ]
        });
      }

      // 4. Análisis de clientes con riesgo de pérdida
      const clientRiskResult = await query(`
        WITH client_behavior AS (
          SELECT 
            c.id, c.name, c.type, c.city,
            COUNT(s.id) as total_sales,
            ROUND(SUM(s.total_amount), 2) as total_spent,
            MAX(s.sale_date) as last_sale_date,
            AVG(s.total_amount) as avg_sale_amount,
            DATE_PART('day', CURRENT_DATE - MAX(s.sale_date)) as days_since_last_sale
          FROM clients c
          INNER JOIN sales s ON c.id = s.client_id
          WHERE s.sale_date >= CURRENT_DATE - INTERVAL '6 months'
          GROUP BY c.id, c.name, c.type, c.city
          HAVING COUNT(s.id) >= 3
        )
        SELECT 
          COUNT(*) FILTER (WHERE days_since_last_sale > 60) as at_risk_clients_count,
          ROUND(SUM(total_spent) FILTER (WHERE days_since_last_sale > 60), 2) as at_risk_revenue,
          ARRAY_AGG(
            JSON_BUILD_OBJECT(
              'id', id,
              'name', name,
              'type', type,
              'city', city,
              'total_spent', total_spent,
              'days_since_last_sale', days_since_last_sale,
              'avg_sale_amount', ROUND(avg_sale_amount, 2),
              'risk_level', 
                CASE 
                  WHEN days_since_last_sale > 120 THEN 'high'
                  WHEN days_since_last_sale > 90 THEN 'medium'
                  ELSE 'low'
                END
            )
            ORDER BY total_spent DESC
          ) FILTER (WHERE days_since_last_sale > 60) as at_risk_clients
        FROM client_behavior
      `);

      if (clientRiskResult.rows[0].at_risk_clients_count > 0) {
        const data = clientRiskResult.rows[0];
        
        insights.push({
          type: 'client_retention',
          title: `👥 Riesgo de Pérdida de Clientes: ${data.at_risk_clients_count} clientes inactivos (${data.at_risk_revenue ? '$' + data.at_risk_revenue.toLocaleString() : '$0'} en riesgo)`,
          description: `Clientes valiosos no han realizado compras en más de 60 días, representando riesgo de pérdida de ingresos.`,
          category: 'clientes',
          priority: 'alto',
          confidence_score: 0.82,
          data_context: {
            at_risk_clients_count: data.at_risk_clients_count,
            at_risk_revenue: data.at_risk_revenue,
            at_risk_clients: data.at_risk_clients,
            inactivity_threshold_days: 60
          },
          recommendations: [
            'Implementar campaña de reactivación para clientes inactivos',
            'Ofrecer descuentos especiales o promociones personalizadas',
            'Contacto directo con clientes de alto valor para entender necesidades',
            'Analizar razones de inactividad y ajustar estrategia comercial'
          ]
        });
      }

      // Insertar todos los insights generados
      const createdInsights = [];
      for (const insightData of insights) {
        // Verificar que no exista un insight similar reciente
        const existingResult = await query(`
          SELECT id FROM insights 
          WHERE type = $1 AND category = $2 
          AND created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
          AND is_active = true
        `, [insightData.type, insightData.category]);

        if (existingResult.rows.length === 0) {
          const createdInsight = await this.create({
            ...insightData,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Expira en 7 días
          });
          createdInsights.push(createdInsight);
        }
      }

      return createdInsights;

    } catch (error) {
      console.error('💥 Error generando insights de inventario:', error.message);
      throw new Error(`Error generando insights: ${error.message}`);
    }
  }

  /**
   * Generar resumen de insights activos
   * @returns {Promise<Object>} Resumen de insights
   */
  static async getInsightsSummary() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_insights,
          COUNT(*) FILTER (WHERE is_active = true) as active_insights,
          COUNT(*) FILTER (WHERE priority = 'critico') as critical_insights,
          COUNT(*) FILTER (WHERE priority = 'alto') as high_priority_insights,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours') as recent_insights,
          COUNT(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP) as expired_insights,
          COUNT(DISTINCT category) as categories_count,
          ROUND(AVG(confidence_score), 2) as avg_confidence,
          MAX(created_at) as last_generated
        FROM insights
      `);

      const summary = result.rows[0];

      // Obtener distribución por categoría
      const categoryResult = await query(`
        SELECT 
          category,
          COUNT(*) as count,
          COUNT(*) FILTER (WHERE is_active = true) as active_count
        FROM insights
        GROUP BY category
        ORDER BY count DESC
      `);

      summary.category_distribution = categoryResult.rows;

      // Obtener insights más recientes
      const recentResult = await query(`
        SELECT id, type, title, priority, category, created_at
        FROM insights
        WHERE is_active = true
        ORDER BY created_at DESC
        LIMIT 5
      `);

      summary.recent_insights = recentResult.rows;

      return summary;

    } catch (error) {
      console.error('💥 Error obteniendo resumen de insights:', error.message);
      throw new Error(`Error obteniendo resumen: ${error.message}`);
    }
  }

  /**
   * Limpiar insights expirados
   * @returns {Promise<number>} Número de insights limpiados
   */
  static async cleanupExpiredInsights() {
    try {
      const result = await query(`
        UPDATE insights 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE expires_at IS NOT NULL 
        AND expires_at < CURRENT_TIMESTAMP
        AND is_active = true
        RETURNING id
      `);

      return result.rowCount;

    } catch (error) {
      console.error('💥 Error limpiando insights expirados:', error.message);
      throw new Error(`Error limpiando insights: ${error.message}`);
    }
  }

  /**
   * Obtener insights por tipo específico
   * @param {string} type - Tipo de insight
   * @param {boolean} activeOnly - Solo insights activos
   * @returns {Promise<Array>} Insights del tipo especificado
   */
  static async getByType(type, activeOnly = true) {
    try {
      let whereClause = 'WHERE type = $1';
      const params = [type];

      if (activeOnly) {
        whereClause += ' AND is_active = true';
      }

      const result = await query(`
        SELECT 
          id, type, title, description, category, priority,
          data_context, recommendations, confidence_score,
          is_active, created_at, updated_at, expires_at
        FROM insights
        ${whereClause}
        ORDER BY created_at DESC
      `, params);

      return result.rows;

    } catch (error) {
      console.error('💥 Error obteniendo insights por tipo:', error.message);
      throw new Error(`Error obteniendo insights: ${error.message}`);
    }
  }

  /**
   * Marcar insight como visto/procesado
   * @param {number} id - ID del insight
   * @param {string} action - Acción tomada
   * @returns {Promise<boolean>} True si se actualizó exitosamente
   */
  static async markAsProcessed(id, action = 'viewed') {
    try {
      const result = await query(`
        UPDATE insights 
        SET 
          data_context = data_context || $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id
      `, [JSON.stringify({ processed_at: new Date().toISOString(), action }), id]);

      return result.rowCount > 0;

    } catch (error) {
      console.error('💥 Error marcando insight como procesado:', error.message);
      throw new Error(`Error actualizando insight: ${error.message}`);
    }
  }
}

module.exports = Insights;