// =====================================================================================
// FLUXION AI - INSIGHTS ROUTES (MULTI-TENANT)
// Rutas para gestión de insights proactivos con contexto de tenant
// =====================================================================================

const express = require('express');
const router = express.Router();
const Insights = require('../models/Insights.cjs');

/**
 * GET /api/insights
 * Obtener insights del tenant con filtros
 */
router.get('/', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const options = {
      type: req.query.type,
      priority: req.query.priority,
      status: req.query.status,
      active_only: req.query.active_only !== 'false',
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      limit: parseInt(req.query.limit) || undefined,
      offset: parseInt(req.query.offset) || undefined
    };

    const insights = await Insights.getAll(tenantSchema, options);

    res.json({
      success: true,
      data: insights,
      count: insights.length,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo insights:', error.message);
    res.status(500).json({
      error: 'GET_INSIGHTS_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/insights/stats
 * Obtener estadísticas de insights
 */
router.get('/stats', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const stats = await Insights.getStats(tenantSchema);

    res.json({
      success: true,
      data: stats,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo estadísticas de insights:', error.message);
    res.status(500).json({
      error: 'GET_INSIGHTS_STATS_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/insights
 * Crear nuevo insight
 */
router.post('/', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const insightData = req.body;

    const requiredFields = ['triggered_by', 'type', 'priority', 'title', 'description', 'confidence'];
    const missingFields = requiredFields.filter(field => !insightData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Campos requeridos faltantes',
        missing_fields: missingFields,
        required_fields: requiredFields
      });
    }

    const newInsight = await Insights.create(tenantSchema, insightData);

    res.status(201).json({
      success: true,
      message: 'Insight creado exitosamente',
      data: newInsight,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error creando insight:', error.message);
    res.status(500).json({
      error: 'CREATE_INSIGHT_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * PATCH /api/insights/:insightId/status
 * Actualizar estado de un insight
 */
router.patch('/:insightId/status', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const { insightId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        error: 'STATUS_REQUIRED',
        message: 'status es requerido',
        valid_statuses: ['generated', 'sent', 'read', 'acted', 'dismissed']
      });
    }

    const updatedInsight = await Insights.updateStatus(tenantSchema, insightId, status);

    res.json({
      success: true,
      message: 'Estado del insight actualizado exitosamente',
      data: updatedInsight,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error actualizando estado del insight:', error.message);
    
    if (error.message.includes('no encontrado')) {
      return res.status(404).json({
        error: 'INSIGHT_NOT_FOUND',
        message: error.message,
        insight_id: req.params.insightId,
        tenant_code: req.tenantCode
      });
    }

    res.status(500).json({
      error: 'UPDATE_INSIGHT_STATUS_ERROR',
      message: error.message,
      insight_id: req.params.insightId,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/insights/generate/inventory
 * Generar insights de inventario automáticamente
 */
router.post('/generate/inventory', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const insights = await Insights.generateInventoryInsights(tenantSchema);

    res.json({
      success: true,
      message: 'Insights de inventario generados exitosamente',
      data: insights,
      count: insights.length,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error generando insights de inventario:', error.message);
    res.status(500).json({
      error: 'GENERATE_INVENTORY_INSIGHTS_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/insights/generate/sales
 * Generar insights de ventas automáticamente
 */
router.post('/generate/sales', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const insights = await Insights.generateSalesInsights(tenantSchema);

    res.json({
      success: true,
      message: 'Insights de ventas generados exitosamente',
      data: insights,
      count: insights.length,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error generando insights de ventas:', error.message);
    res.status(500).json({
      error: 'GENERATE_SALES_INSIGHTS_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/insights/generate/opportunities
 * Generar insights de oportunidades de negocio
 */
router.post('/generate/opportunities', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const insights = await Insights.generateBusinessOpportunities(tenantSchema);

    res.json({
      success: true,
      message: 'Insights de oportunidades generados exitosamente',
      data: insights,
      count: insights.length,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error generando insights de oportunidades:', error.message);
    res.status(500).json({
      error: 'GENERATE_OPPORTUNITIES_INSIGHTS_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/insights/generate/all
 * Generar todos los insights automáticamente
 */
router.post('/generate/all', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const insights = await Insights.generateAllInsights(tenantSchema);

    res.json({
      success: true,
      message: 'Todos los insights generados exitosamente',
      data: insights,
      count: insights.length,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error generando todos los insights:', error.message);
    res.status(500).json({
      error: 'GENERATE_ALL_INSIGHTS_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /api/insights/cleanup
 * Limpiar insights expirados
 */
router.delete('/cleanup', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const deletedCount = await Insights.cleanupExpiredInsights(tenantSchema);

    res.json({
      success: true,
      message: 'Limpieza de insights expirados completada',
      deleted_count: deletedCount,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error limpiando insights expirados:', error.message);
    res.status(500).json({
      error: 'CLEANUP_INSIGHTS_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/insights/stream (SSE)
 * Server-Sent Events para insights en tiempo real
 */
router.get('/stream', (req, res) => {
  // Configurar SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control, X-Tenant'
  });

  const { tenantCode } = req;
  
  // Enviar mensaje inicial
  res.write(`data: ${JSON.stringify({
    type: 'connection',
    message: `Conectado al stream de insights para tenant ${tenantCode}`,
    tenant_code: tenantCode,
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Mantener conexión viva
  const keepAlive = setInterval(() => {
    res.write(`data: ${JSON.stringify({
      type: 'ping',
      timestamp: new Date().toISOString()
    })}\n\n`);
  }, 30000);

  // Limpiar al desconectar
  req.on('close', () => {
    clearInterval(keepAlive);
    console.log(`🔌 Cliente desconectado del stream de insights para tenant ${tenantCode}`);
  });

  // TODO: Implementar notificación en tiempo real de nuevos insights
  // Este es un placeholder básico - en producción integrar con websockets o Redis
});

module.exports = router;