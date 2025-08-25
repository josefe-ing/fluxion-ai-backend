// =====================================================================================
// FLUXION AI - DASHBOARD ROUTES (MULTI-TENANT)
// Rutas para dashboard consolidado con contexto de tenant
// =====================================================================================

const express = require('express');
const router = express.Router();
const Product = require('../models/Product.cjs');
const Client = require('../models/Client.cjs');
const Sales = require('../models/Sales.cjs');
const Inventory = require('../models/Inventory.cjs');
const Insights = require('../models/Insights.cjs');

/**
 * GET /api/dashboard/overview
 * Obtener vista general del dashboard con KPIs principales
 */
router.get('/overview', async (req, res) => {
  try {
    const { tenantSchema } = req;
    
    // Ejecutar consultas en paralelo para mejor performance
    const [
      productStats,
      clientStats,
      salesStats,
      insightStats,
      lowStockProducts,
      overdueClients
    ] = await Promise.all([
      Product.getStats(tenantSchema),
      Client.getStats(tenantSchema),
      Sales.getStats(tenantSchema, { 
        date_from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] 
      }),
      Insights.getStats(tenantSchema),
      Product.getLowStock(tenantSchema),
      Client.getOverdueClients(tenantSchema)
    ]);

    // Calcular KPIs principales
    const overview = {
      kpis: {
        total_products: parseInt(productStats.total_products || 0),
        active_products: parseInt(productStats.active_products || 0),
        low_stock_products: parseInt(productStats.low_stock_products || 0),
        total_clients: parseInt(clientStats.total_clients || 0),
        active_clients: parseInt(clientStats.active_clients || 0),
        total_sales_30d: parseInt(salesStats.total_sales || 0),
        total_revenue_30d: parseFloat(salesStats.total_revenue || 0),
        pending_revenue: parseFloat(salesStats.pending_revenue || 0),
        avg_sale_amount: parseFloat(salesStats.avg_sale_amount || 0),
        active_insights: parseInt(insightStats.active_insights || 0),
        critical_insights: parseInt(insightStats.critical_insights || 0)
      },
      alerts: {
        low_stock_count: lowStockProducts.length,
        overdue_clients_count: overdueClients.length,
        total_overdue_amount: overdueClients.reduce((sum, client) => 
          sum + parseFloat(client.total_overdue_amount || 0), 0
        )
      },
      inventory_value: parseFloat(productStats.total_inventory_value || 0),
      profit_margin_avg: parseFloat(productStats.avg_profit_margin || 0)
    };

    res.json({
      success: true,
      data: overview,
      tenant_code: req.tenantCode,
      period: 'last_30_days',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo overview del dashboard:', error.message);
    res.status(500).json({
      error: 'GET_DASHBOARD_OVERVIEW_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/dashboard/sales-trends
 * Obtener tendencias de ventas para gráficos
 */
router.get('/sales-trends', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const period = req.query.period || 'day';
    const days = parseInt(req.query.days) || 30;
    
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const [salesByPeriod, topProducts] = await Promise.all([
      Sales.getSalesByPeriod(tenantSchema, period, { 
        date_from: dateFrom,
        limit: days 
      }),
      Sales.getTopProducts(tenantSchema, { 
        date_from: dateFrom,
        limit: 10 
      })
    ]);

    res.json({
      success: true,
      data: {
        sales_by_period: salesByPeriod,
        top_products: topProducts
      },
      period: period,
      days_analyzed: days,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo tendencias de ventas:', error.message);
    res.status(500).json({
      error: 'GET_SALES_TRENDS_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/dashboard/inventory-analysis
 * Obtener análisis completo de inventario para el dashboard
 */
router.get('/inventory-analysis', async (req, res) => {
  try {
    const { tenantSchema } = req;
    
    const [
      inventorySummary,
      fifoValuation,
      highMovementProducts,
      movementStats
    ] = await Promise.all([
      Inventory.getInventorySummary(tenantSchema, { limit: 50 }),
      Inventory.getFIFOValuation(tenantSchema),
      Inventory.getHighMovementProducts(tenantSchema, 30, 10),
      Inventory.getMovementStats(tenantSchema, {
        date_from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      })
    ]);

    // Análisis por categorías
    const categoryAnalysis = {};
    inventorySummary.forEach(item => {
      const category = item.category || 'Sin categoría';
      if (!categoryAnalysis[category]) {
        categoryAnalysis[category] = {
          total_products: 0,
          total_value: 0,
          low_stock_count: 0
        };
      }
      categoryAnalysis[category].total_products++;
      categoryAnalysis[category].total_value += parseFloat(item.inventory_value || 0);
      if (item.stock_status === 'stock_bajo' || item.stock_status === 'sin_stock') {
        categoryAnalysis[category].low_stock_count++;
      }
    });

    // Calcular valor total del inventario
    const totalInventoryValue = Array.isArray(fifoValuation) 
      ? fifoValuation.reduce((sum, item) => sum + parseFloat(item.fifo_valuation || 0), 0)
      : parseFloat(fifoValuation?.fifo_valuation || 0);

    res.json({
      success: true,
      data: {
        inventory_summary: inventorySummary,
        category_analysis: categoryAnalysis,
        total_inventory_value: totalInventoryValue,
        high_movement_products: highMovementProducts,
        movement_stats_30d: movementStats
      },
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo análisis de inventario:', error.message);
    res.status(500).json({
      error: 'GET_INVENTORY_ANALYSIS_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/dashboard/client-insights
 * Obtener insights y análisis de clientes
 */
router.get('/client-insights', async (req, res) => {
  try {
    const { tenantSchema } = req;
    
    const [
      clientStats,
      overdueClients,
      topClients
    ] = await Promise.all([
      Client.getStats(tenantSchema),
      Client.getOverdueClients(tenantSchema, 1),
      Client.getAll(tenantSchema, { 
        withSalesData: true, 
        active: true,
        limit: 10 
      })
    ]);

    // Ordenar clientes por revenue y tomar top 10
    const topClientsByRevenue = topClients
      .filter(client => client.total_revenue > 0)
      .sort((a, b) => parseFloat(b.total_revenue || 0) - parseFloat(a.total_revenue || 0))
      .slice(0, 10);

    // Análisis geográfico
    const geographicAnalysis = {};
    topClients.forEach(client => {
      const city = client.city || 'No especificada';
      if (!geographicAnalysis[city]) {
        geographicAnalysis[city] = {
          client_count: 0,
          total_revenue: 0
        };
      }
      geographicAnalysis[city].client_count++;
      geographicAnalysis[city].total_revenue += parseFloat(client.total_revenue || 0);
    });

    res.json({
      success: true,
      data: {
        client_stats: clientStats,
        overdue_clients: overdueClients,
        top_clients_by_revenue: topClientsByRevenue,
        geographic_analysis: geographicAnalysis,
        payment_performance: {
          total_overdue_amount: overdueClients.reduce((sum, client) => 
            sum + parseFloat(client.total_overdue_amount || 0), 0),
          overdue_clients_count: overdueClients.length,
          avg_days_overdue: overdueClients.length > 0 
            ? Math.round(overdueClients.reduce((sum, client) => 
                sum + parseInt(client.avg_days_overdue || 0), 0) / overdueClients.length)
            : 0
        }
      },
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo insights de clientes:', error.message);
    res.status(500).json({
      error: 'GET_CLIENT_INSIGHTS_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/dashboard/alerts
 * Obtener alertas y notificaciones críticas
 */
router.get('/alerts', async (req, res) => {
  try {
    const { tenantSchema } = req;
    
    const [
      lowStockProducts,
      overdueClients,
      criticalInsights,
      outOfStockProducts
    ] = await Promise.all([
      Product.getLowStock(tenantSchema),
      Client.getOverdueClients(tenantSchema),
      Insights.getAll(tenantSchema, { 
        priority: 'critical', 
        status: 'generated',
        active_only: true,
        limit: 10 
      }),
      Product.getAll(tenantSchema, { 
        active: true,
        limit: 100
      }).then(products => products.filter(p => p.current_stock === 0))
    ]);

    const alerts = {
      critical: [],
      high: [],
      medium: []
    };

    // Alertas críticas: productos sin stock
    if (outOfStockProducts.length > 0) {
      alerts.critical.push({
        type: 'out_of_stock',
        title: `${outOfStockProducts.length} productos sin stock`,
        description: `Productos agotados que requieren reabastecimiento inmediato`,
        count: outOfStockProducts.length,
        data: outOfStockProducts.slice(0, 5).map(p => ({ sku: p.sku, name: p.name }))
      });
    }

    // Alertas altas: clientes morosos
    if (overdueClients.length > 0) {
      const totalOverdue = overdueClients.reduce((sum, client) => 
        sum + parseFloat(client.total_overdue_amount || 0), 0);
      
      alerts.high.push({
        type: 'overdue_payments',
        title: `${overdueClients.length} clientes con pagos vencidos`,
        description: `Total vencido: $${totalOverdue.toFixed(2)}`,
        count: overdueClients.length,
        amount: totalOverdue,
        data: overdueClients.slice(0, 5).map(c => ({
          client_code: c.client_code,
          business_name: c.business_name,
          overdue_amount: parseFloat(c.total_overdue_amount || 0)
        }))
      });
    }

    // Alertas medias: stock bajo
    if (lowStockProducts.length > 0) {
      alerts.medium.push({
        type: 'low_stock',
        title: `${lowStockProducts.length} productos con stock bajo`,
        description: `Productos cerca del límite mínimo de stock`,
        count: lowStockProducts.length,
        data: lowStockProducts.slice(0, 5).map(p => ({
          sku: p.sku,
          name: p.name,
          current_stock: p.current_stock,
          min_threshold: p.min_stock_threshold
        }))
      });
    }

    // Agregar insights críticos
    criticalInsights.forEach(insight => {
      alerts.critical.push({
        type: 'critical_insight',
        title: insight.title,
        description: insight.description,
        insight_id: insight.insight_id,
        confidence: insight.confidence,
        business_impact: insight.business_impact
      });
    });

    res.json({
      success: true,
      data: alerts,
      summary: {
        critical_count: alerts.critical.length,
        high_count: alerts.high.length,
        medium_count: alerts.medium.length,
        total_alerts: alerts.critical.length + alerts.high.length + alerts.medium.length
      },
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo alertas:', error.message);
    res.status(500).json({
      error: 'GET_DASHBOARD_ALERTS_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/dashboard/generate-insights
 * Generar insights automáticamente para el dashboard
 */
router.post('/generate-insights', async (req, res) => {
  try {
    const { tenantSchema } = req;
    
    // Generar todos los insights
    const allInsights = await Insights.generateAllInsights(tenantSchema);
    
    res.json({
      success: true,
      message: 'Insights generados exitosamente para el dashboard',
      data: allInsights,
      count: allInsights.length,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error generando insights para dashboard:', error.message);
    res.status(500).json({
      error: 'GENERATE_DASHBOARD_INSIGHTS_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;