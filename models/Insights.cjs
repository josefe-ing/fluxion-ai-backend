// =====================================================================================
// FLUXION AI - INSIGHTS MODEL (MULTI-TENANT)
// Modelo de datos para insights proactivos y análisis de negocio con soporte multi-tenant
// =====================================================================================

const { query } = require('../config/database.cjs');

/**
 * Modelo Insights con generación automática de insights de negocio - Multi-tenant
 * Cada método requiere un tenantSchema para operar en el schema correcto
 */
class Insights {
  
  /**
   * Obtener todos los insights con filtros opcionales
   * @param {string} tenantSchema - Schema del tenant
   * @param {Object} options - Opciones de filtrado
   * @returns {Promise<Array>} Lista de insights
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

      if (options.status) {
        whereConditions.push(`status = $${paramIndex}`);
        params.push(options.status);
        paramIndex++;
      }

      if (options.active_only !== false) {
        whereConditions.push(`(expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`);
      }

      if (options.date_from) {
        whereConditions.push(`created_at >= $${paramIndex}`);
        params.push(options.date_from);
        paramIndex++;
      }

      if (options.date_to) {
        whereConditions.push(`created_at <= $${paramIndex}`);
        params.push(options.date_to);
        paramIndex++;
      }

      let sql = `
        SELECT 
          id, insight_id, triggered_by, type, priority, title, description,
          recommendation, business_impact, confidence, channels, status,
          data, expires_at, created_at,
          CASE 
            WHEN expires_at IS NULL THEN true
            WHEN expires_at > CURRENT_TIMESTAMP THEN true
            ELSE false
          END as is_active
        FROM "${tenantSchema}".insights
      `;

      if (whereConditions.length > 0) {
        sql += ` WHERE ${whereConditions.join(' AND ')}`;
      }

      sql += ` ORDER BY 
        CASE priority 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
        END, 
        created_at DESC`;

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
   * Crear un nuevo insight
   * @param {string} tenantSchema - Schema del tenant
   * @param {Object} insightData - Datos del insight
   * @returns {Promise<Object>} Insight creado
   */
  static async create(tenantSchema, insightData) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    try {
      const {
        triggered_by, type, priority, title, description, recommendation,
        business_impact, confidence, channels = ['dashboard'], data = {},
        expires_at = null
      } = insightData;

      // Generar ID único para el insight
      const insight_id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const result = await query(`
        INSERT INTO "${tenantSchema}".insights (
          insight_id, triggered_by, type, priority, title, description,
          recommendation, business_impact, confidence, channels, data, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        insight_id, triggered_by, type, priority, title, description,
        recommendation, business_impact, confidence, JSON.stringify(channels), 
        JSON.stringify(data), expires_at
      ]);

      return result.rows[0];

    } catch (error) {
      console.error('💥 Error creando insight:', error.message);
      throw new Error(`Error creando insight: ${error.message}`);
    }
  }

  /**
   * Actualizar estado de un insight
   * @param {string} tenantSchema - Schema del tenant
   * @param {string} insightId - ID del insight
   * @param {string} status - Nuevo estado
   * @returns {Promise<Object>} Insight actualizado
   */
  static async updateStatus(tenantSchema, insightId, status) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    try {
      const result = await query(`
        UPDATE "${tenantSchema}".insights 
        SET status = $1
        WHERE insight_id = $2
        RETURNING *
      `, [status, insightId]);

      if (result.rows.length === 0) {
        throw new Error(`Insight con ID ${insightId} no encontrado`);
      }

      return result.rows[0];

    } catch (error) {
      console.error('💥 Error actualizando estado del insight:', error.message);
      throw new Error(`Error actualizando insight: ${error.message}`);
    }
  }

  /**
   * Generar insights de inventario automáticamente
   * @param {string} tenantSchema - Schema del tenant
   * @returns {Promise<Array>} Insights generados
   */
  static async generateInventoryInsights(tenantSchema) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    try {
      const generatedInsights = [];

      // 1. Productos con stock crítico (sin stock)
      const outOfStockResult = await query(`
        SELECT id, sku, name, category, brand, current_stock, min_stock_threshold
        FROM "${tenantSchema}".products 
        WHERE current_stock = 0 AND active = true
        LIMIT 10
      `);

      if (outOfStockResult.rows.length > 0) {
        const outOfStockProducts = outOfStockResult.rows;
        const insight = await this.create(tenantSchema, {
          triggered_by: 'inventory_monitor',
          type: 'alert',
          priority: 'critical',
          title: `🚨 ${outOfStockProducts.length} productos sin stock`,
          description: `Se detectaron ${outOfStockProducts.length} productos completamente agotados que requieren reabastecimiento inmediato.`,
          recommendation: 'Revisar y programar pedidos urgentes para evitar pérdida de ventas.',
          business_impact: 'Alto riesgo de pérdida de ventas y clientes insatisfechos.',
          confidence: 0.95,
          channels: ['dashboard', 'whatsapp', 'email'],
          data: {
            affected_products: outOfStockProducts.length,
            product_list: outOfStockProducts.map(p => ({ sku: p.sku, name: p.name }))
          },
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días
        });
        generatedInsights.push(insight);
      }

      // 2. Productos con stock bajo
      const lowStockResult = await query(`
        SELECT id, sku, name, category, current_stock, min_stock_threshold
        FROM "${tenantSchema}".products 
        WHERE current_stock > 0 AND current_stock <= min_stock_threshold AND active = true
        ORDER BY (current_stock::float / min_stock_threshold::float) ASC
        LIMIT 15
      `);

      if (lowStockResult.rows.length > 0) {
        const lowStockProducts = lowStockResult.rows;
        const insight = await this.create(tenantSchema, {
          triggered_by: 'inventory_monitor',
          type: 'alert',
          priority: 'high',
          title: `⚠️ ${lowStockProducts.length} productos con stock bajo`,
          description: `Se identificaron ${lowStockProducts.length} productos cerca del límite mínimo de stock.`,
          recommendation: 'Programar pedidos de reabastecimiento en los próximos días.',
          business_impact: 'Riesgo medio de agotamiento si no se actúa pronto.',
          confidence: 0.90,
          channels: ['dashboard', 'whatsapp'],
          data: {
            affected_products: lowStockProducts.length,
            product_list: lowStockProducts.map(p => ({
              sku: p.sku,
              name: p.name,
              current_stock: p.current_stock,
              min_threshold: p.min_stock_threshold
            }))
          },
          expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 días
        });
        generatedInsights.push(insight);
      }

      // 3. Productos sobrestock
      const overStockResult = await query(`
        SELECT id, sku, name, current_stock, max_stock_threshold,
               ROUND((current_stock * cost_price)::numeric, 2) as tied_capital
        FROM "${tenantSchema}".products 
        WHERE current_stock > max_stock_threshold AND active = true
        ORDER BY current_stock DESC
        LIMIT 10
      `);

      if (overStockResult.rows.length > 0) {
        const overStockProducts = overStockResult.rows;
        const totalTiedCapital = overStockProducts.reduce((sum, p) => sum + parseFloat(p.tied_capital || 0), 0);

        const insight = await this.create(tenantSchema, {
          triggered_by: 'inventory_monitor',
          type: 'opportunity',
          priority: 'medium',
          title: `💰 Oportunidad: ${overStockProducts.length} productos sobrestockeados`,
          description: `Se detectaron productos con stock excesivo que representa $${totalTiedCapital.toFixed(2)} en capital inmovilizado.`,
          recommendation: 'Considerar promociones o descuentos para rotar el inventario excesivo.',
          business_impact: `Liberar capital inmovilizado y optimizar flujo de caja.`,
          confidence: 0.85,
          channels: ['dashboard'],
          data: {
            affected_products: overStockProducts.length,
            tied_capital: totalTiedCapital,
            product_list: overStockProducts.map(p => ({
              sku: p.sku,
              name: p.name,
              excess_stock: p.current_stock - p.max_stock_threshold,
              tied_capital: parseFloat(p.tied_capital || 0)
            }))
          },
          expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 días
        });
        generatedInsights.push(insight);
      }

      console.log(`✅ Se generaron ${generatedInsights.length} insights de inventario`);
      return generatedInsights;

    } catch (error) {
      console.error('💥 Error generando insights de inventario:', error.message);
      throw new Error(`Error generando insights de inventario: ${error.message}`);
    }
  }

  /**
   * Generar insights de ventas automáticamente
   * @param {string} tenantSchema - Schema del tenant
   * @returns {Promise<Array>} Insights generados
   */
  static async generateSalesInsights(tenantSchema) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    try {
      const generatedInsights = [];

      // 1. Tendencia de ventas (comparar últimos 30 vs 30 anteriores)
      const salesTrendResult = await query(`
        WITH current_period AS (
          SELECT COUNT(*) as sales_count, SUM(total_amount) as revenue
          FROM "${tenantSchema}".sales
          WHERE sale_date >= CURRENT_DATE - INTERVAL '30 days'
        ),
        previous_period AS (
          SELECT COUNT(*) as sales_count, SUM(total_amount) as revenue
          FROM "${tenantSchema}".sales
          WHERE sale_date >= CURRENT_DATE - INTERVAL '60 days'
          AND sale_date < CURRENT_DATE - INTERVAL '30 days'
        )
        SELECT 
          c.sales_count as current_sales,
          c.revenue as current_revenue,
          p.sales_count as previous_sales,
          p.revenue as previous_revenue,
          CASE 
            WHEN p.sales_count > 0 THEN 
              ROUND(((c.sales_count - p.sales_count)::numeric / p.sales_count * 100), 2)
            ELSE 0 
          END as sales_change_percent,
          CASE 
            WHEN p.revenue > 0 THEN 
              ROUND(((c.revenue - p.revenue)::numeric / p.revenue * 100), 2)
            ELSE 0 
          END as revenue_change_percent
        FROM current_period c, previous_period p
      `);

      if (salesTrendResult.rows.length > 0) {
        const trend = salesTrendResult.rows[0];
        const salesChange = parseFloat(trend.sales_change_percent || 0);
        const revenueChange = parseFloat(trend.revenue_change_percent || 0);

        if (Math.abs(salesChange) > 15 || Math.abs(revenueChange) > 15) {
          const isPositive = salesChange > 0 && revenueChange > 0;
          const insight = await this.create(tenantSchema, {
            triggered_by: 'sales_trend_analysis',
            type: isPositive ? 'opportunity' : 'alert',
            priority: Math.abs(salesChange) > 25 ? 'high' : 'medium',
            title: isPositive ? 
              `📈 Crecimiento en ventas: +${salesChange.toFixed(1)}%` : 
              `📉 Disminución en ventas: ${salesChange.toFixed(1)}%`,
            description: isPositive ?
              `Las ventas han aumentado ${salesChange.toFixed(1)}% y los ingresos ${revenueChange.toFixed(1)}% en los últimos 30 días.` :
              `Las ventas han disminuido ${Math.abs(salesChange).toFixed(1)}% y los ingresos ${Math.abs(revenueChange).toFixed(1)}% en los últimos 30 días.`,
            recommendation: isPositive ?
              'Mantener estrategias actuales y considerar expandir esfuerzos de marketing.' :
              'Analizar causas de la disminución y implementar estrategias de recuperación.',
            business_impact: isPositive ?
              'Oportunidad de capitalizarlo y acelerar el crecimiento.' :
              'Requiere atención inmediata para evitar mayor deterioro.',
            confidence: 0.88,
            channels: ['dashboard', 'email'],
            data: {
              current_sales: parseInt(trend.current_sales || 0),
              previous_sales: parseInt(trend.previous_sales || 0),
              sales_change_percent: salesChange,
              revenue_change_percent: revenueChange,
              current_revenue: parseFloat(trend.current_revenue || 0),
              previous_revenue: parseFloat(trend.previous_revenue || 0)
            },
            expires_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) // 10 días
          });
          generatedInsights.push(insight);
        }
      }

      // 2. Clientes con pagos vencidos
      const overdueResult = await query(`
        SELECT 
          c.id, c.business_name, c.client_code, c.payment_terms,
          COUNT(s.id) as overdue_sales,
          SUM(s.total_amount) as overdue_amount,
          MIN(s.sale_date) as oldest_sale_date
        FROM "${tenantSchema}".clients c
        JOIN "${tenantSchema}".sales s ON c.id = s.client_id
        WHERE s.payment_status IN ('pendiente', 'parcial', 'vencido')
        AND s.sale_date < (CURRENT_DATE - c.payment_terms)
        AND c.active = true
        GROUP BY c.id, c.business_name, c.client_code, c.payment_terms
        HAVING SUM(s.total_amount) > 1000
        ORDER BY SUM(s.total_amount) DESC
        LIMIT 10
      `);

      if (overdueResult.rows.length > 0) {
        const overdueClients = overdueResult.rows;
        const totalOverdue = overdueClients.reduce((sum, c) => sum + parseFloat(c.overdue_amount), 0);

        const insight = await this.create(tenantSchema, {
          triggered_by: 'payment_monitor',
          type: 'alert',
          priority: 'high',
          title: `💳 ${overdueClients.length} clientes con pagos vencidos`,
          description: `Se identificaron ${overdueClients.length} clientes con pagos vencidos por un total de $${totalOverdue.toFixed(2)}.`,
          recommendation: 'Contactar clientes para gestionar cobranza y revisar términos de crédito.',
          business_impact: 'Impacto directo en flujo de caja y capital de trabajo.',
          confidence: 0.95,
          channels: ['dashboard', 'whatsapp', 'email'],
          data: {
            affected_clients: overdueClients.length,
            total_overdue_amount: totalOverdue,
            client_list: overdueClients.map(c => ({
              client_code: c.client_code,
              business_name: c.business_name,
              overdue_amount: parseFloat(c.overdue_amount),
              overdue_sales: parseInt(c.overdue_sales),
              days_overdue: Math.floor((new Date() - new Date(c.oldest_sale_date)) / (1000 * 60 * 60 * 24))
            }))
          },
          expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 días
        });
        generatedInsights.push(insight);
      }

      console.log(`✅ Se generaron ${generatedInsights.length} insights de ventas`);
      return generatedInsights;

    } catch (error) {
      console.error('💥 Error generando insights de ventas:', error.message);
      throw new Error(`Error generando insights de ventas: ${error.message}`);
    }
  }

  /**
   * Generar insights de oportunidades de negocio
   * @param {string} tenantSchema - Schema del tenant
   * @returns {Promise<Array>} Insights generados
   */
  static async generateBusinessOpportunities(tenantSchema) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    try {
      const generatedInsights = [];

      // 1. Productos con alta rotación y buen margen
      const highPerformanceResult = await query(`
        SELECT 
          p.id, p.sku, p.name, p.category, p.brand,
          p.selling_price, p.cost_price,
          ROUND(((p.selling_price - p.cost_price)::numeric / p.selling_price * 100), 2) as profit_margin,
          COUNT(sd.id) as sales_frequency,
          SUM(sd.quantity) as total_sold,
          SUM(sd.line_total) as total_revenue
        FROM "${tenantSchema}".products p
        JOIN "${tenantSchema}".sale_details sd ON p.id = sd.product_id
        JOIN "${tenantSchema}".sales s ON sd.sale_id = s.id
        WHERE s.sale_date >= CURRENT_DATE - INTERVAL '60 days'
        AND p.active = true
        GROUP BY p.id, p.sku, p.name, p.category, p.brand, p.selling_price, p.cost_price
        HAVING COUNT(sd.id) >= 5 AND 
               ROUND(((p.selling_price - p.cost_price)::numeric / p.selling_price * 100), 2) >= 25
        ORDER BY total_revenue DESC, sales_frequency DESC
        LIMIT 5
      `);

      if (highPerformanceResult.rows.length > 0) {
        const topProducts = highPerformanceResult.rows;
        const totalOpportunityRevenue = topProducts.reduce((sum, p) => sum + parseFloat(p.total_revenue), 0);

        const insight = await this.create(tenantSchema, {
          triggered_by: 'opportunity_analysis',
          type: 'opportunity',
          priority: 'medium',
          title: `🎯 ${topProducts.length} productos estrella identificados`,
          description: `Se identificaron productos con alta rotación y buen margen que generaron $${totalOpportunityRevenue.toFixed(2)} en 60 días.`,
          recommendation: 'Considerar aumentar stock, promocionar más o expandir línea de productos similares.',
          business_impact: 'Oportunidad de maximizar ganancias en productos probadamente exitosos.',
          confidence: 0.82,
          channels: ['dashboard'],
          data: {
            star_products: topProducts.length,
            total_opportunity_revenue: totalOpportunityRevenue,
            product_list: topProducts.map(p => ({
              sku: p.sku,
              name: p.name,
              profit_margin: parseFloat(p.profit_margin),
              sales_frequency: parseInt(p.sales_frequency),
              total_revenue: parseFloat(p.total_revenue)
            }))
          },
          expires_at: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000) // 21 días
        });
        generatedInsights.push(insight);
      }

      console.log(`✅ Se generaron ${generatedInsights.length} insights de oportunidades`);
      return generatedInsights;

    } catch (error) {
      console.error('💥 Error generando insights de oportunidades:', error.message);
      throw new Error(`Error generando insights de oportunidades: ${error.message}`);
    }
  }

  /**
   * Ejecutar generación automática de todos los insights
   * @param {string} tenantSchema - Schema del tenant
   * @returns {Promise<Array>} Todos los insights generados
   */
  static async generateAllInsights(tenantSchema) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    try {
      console.log(`🧠 Generando insights automáticos para ${tenantSchema}...`);
      
      const allInsights = [];
      
      // Generar insights de inventario
      const inventoryInsights = await this.generateInventoryInsights(tenantSchema);
      allInsights.push(...inventoryInsights);
      
      // Generar insights de ventas
      const salesInsights = await this.generateSalesInsights(tenantSchema);
      allInsights.push(...salesInsights);
      
      // Generar insights de oportunidades
      const opportunityInsights = await this.generateBusinessOpportunities(tenantSchema);
      allInsights.push(...opportunityInsights);
      
      console.log(`✅ Total de insights generados: ${allInsights.length}`);
      return allInsights;

    } catch (error) {
      console.error('💥 Error en generación automática de insights:', error.message);
      throw new Error(`Error generando insights: ${error.message}`);
    }
  }

  /**
   * Limpiar insights expirados
   * @param {string} tenantSchema - Schema del tenant
   * @returns {Promise<number>} Número de insights eliminados
   */
  static async cleanupExpiredInsights(tenantSchema) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    try {
      const result = await query(`
        DELETE FROM "${tenantSchema}".insights 
        WHERE expires_at IS NOT NULL 
        AND expires_at < CURRENT_TIMESTAMP
      `);

      const deletedCount = result.rowCount || 0;
      if (deletedCount > 0) {
        console.log(`🧹 Se eliminaron ${deletedCount} insights expirados`);
      }

      return deletedCount;

    } catch (error) {
      console.error('💥 Error limpiando insights expirados:', error.message);
      throw new Error(`Error limpiando insights: ${error.message}`);
    }
  }

  /**
   * Obtener estadísticas de insights
   * @param {string} tenantSchema - Schema del tenant
   * @returns {Promise<Object>} Estadísticas de insights
   */
  static async getStats(tenantSchema) {
    if (!tenantSchema) {
      throw new Error('tenantSchema es requerido para operaciones multi-tenant');
    }
    
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_insights,
          COUNT(*) FILTER (WHERE expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP) as active_insights,
          COUNT(*) FILTER (WHERE priority = 'critical') as critical_insights,
          COUNT(*) FILTER (WHERE priority = 'high') as high_priority_insights,
          COUNT(*) FILTER (WHERE type = 'alert') as alert_insights,
          COUNT(*) FILTER (WHERE type = 'opportunity') as opportunity_insights,
          COUNT(*) FILTER (WHERE status = 'generated') as new_insights,
          COUNT(*) FILTER (WHERE status = 'read') as read_insights,
          COUNT(*) FILTER (WHERE status = 'acted') as acted_insights,
          ROUND(AVG(confidence)::numeric, 3) as avg_confidence
        FROM "${tenantSchema}".insights
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      `);

      return result.rows[0];

    } catch (error) {
      console.error('💥 Error obteniendo estadísticas de insights:', error.message);
      throw new Error(`Error obteniendo estadísticas: ${error.message}`);
    }
  }
}

module.exports = Insights;