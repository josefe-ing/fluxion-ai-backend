// =====================================================================================
// FLUXION AI - INVENTORY ROUTES (MULTI-TENANT)
// Rutas para gestión de inventario con contexto de tenant
// =====================================================================================

const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory.cjs');

/**
 * GET /api/inventory/movements
 * Obtener movimientos de inventario
 */
router.get('/movements', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const options = {
      product_id: req.query.product_id ? parseInt(req.query.product_id) : undefined,
      movement_type: req.query.movement_type,
      reference_type: req.query.reference_type,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      limit: parseInt(req.query.limit) || undefined,
      offset: parseInt(req.query.offset) || undefined
    };

    const movements = await Inventory.getAllMovements(tenantSchema, options);

    res.json({
      success: true,
      data: movements,
      count: movements.length,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo movimientos:', error.message);
    res.status(500).json({
      error: 'GET_MOVEMENTS_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/inventory/summary
 * Obtener resumen de inventario actual
 */
router.get('/summary', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const options = {
      category: req.query.category,
      brand: req.query.brand,
      low_stock_only: req.query.low_stock_only === 'true',
      limit: parseInt(req.query.limit) || undefined
    };

    const summary = await Inventory.getInventorySummary(tenantSchema, options);

    res.json({
      success: true,
      data: summary,
      count: summary.length,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo resumen de inventario:', error.message);
    res.status(500).json({
      error: 'GET_INVENTORY_SUMMARY_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/inventory/valuation
 * Obtener valuación FIFO del inventario
 */
router.get('/valuation', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const productId = req.query.product_id ? parseInt(req.query.product_id) : null;

    const valuation = await Inventory.getFIFOValuation(tenantSchema, productId);

    res.json({
      success: true,
      data: valuation,
      valuation_method: 'FIFO',
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo valuación:', error.message);
    res.status(500).json({
      error: 'GET_VALUATION_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/inventory/stats
 * Obtener estadísticas de movimientos
 */
router.get('/stats', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const options = {
      date_from: req.query.date_from,
      date_to: req.query.date_to
    };

    const stats = await Inventory.getMovementStats(tenantSchema, options);

    res.json({
      success: true,
      data: stats,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo estadísticas:', error.message);
    res.status(500).json({
      error: 'GET_INVENTORY_STATS_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/inventory/high-movement
 * Obtener productos con movimiento frecuente
 */
router.get('/high-movement', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const days = parseInt(req.query.days) || 30;
    const limit = parseInt(req.query.limit) || 10;

    const products = await Inventory.getHighMovementProducts(tenantSchema, days, limit);

    res.json({
      success: true,
      data: products,
      count: products.length,
      analysis_period_days: days,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo productos con alto movimiento:', error.message);
    res.status(500).json({
      error: 'GET_HIGH_MOVEMENT_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/inventory/movements
 * Registrar nuevo movimiento de inventario
 */
router.post('/movements', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const movementData = req.body;

    const requiredFields = ['product_id', 'movement_type', 'quantity', 'reference_type'];
    const missingFields = requiredFields.filter(field => !movementData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Campos requeridos faltantes',
        missing_fields: missingFields,
        required_fields: requiredFields
      });
    }

    const newMovement = await Inventory.addMovement(tenantSchema, movementData);

    res.status(201).json({
      success: true,
      message: 'Movimiento de inventario registrado exitosamente',
      data: newMovement,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error registrando movimiento:', error.message);
    
    if (error.message.includes('no encontrado')) {
      return res.status(404).json({
        error: 'PRODUCT_NOT_FOUND',
        message: error.message,
        tenant_code: req.tenantCode
      });
    }

    if (error.message.includes('No hay suficiente stock')) {
      return res.status(400).json({
        error: 'INSUFFICIENT_STOCK',
        message: error.message,
        tenant_code: req.tenantCode
      });
    }

    res.status(500).json({
      error: 'ADD_MOVEMENT_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/inventory/sync
 * Sincronizar inventario con sistema externo
 */
router.post('/sync', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const { sync_data } = req.body;

    if (!sync_data || !Array.isArray(sync_data)) {
      return res.status(400).json({
        error: 'INVALID_SYNC_DATA',
        message: 'sync_data debe ser un array con elementos {product_id, external_stock, cost_price?}'
      });
    }

    const syncResults = await Inventory.syncInventory(tenantSchema, sync_data);

    res.json({
      success: true,
      message: 'Sincronización de inventario completada',
      data: syncResults,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error sincronizando inventario:', error.message);
    res.status(500).json({
      error: 'SYNC_INVENTORY_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;