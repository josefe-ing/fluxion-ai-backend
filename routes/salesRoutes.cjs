// =====================================================================================
// FLUXION AI - SALES ROUTES (MULTI-TENANT)
// Rutas para gestión de ventas con contexto de tenant
// =====================================================================================

const express = require('express');
const router = express.Router();
const Sales = require('../models/Sales.cjs');

/**
 * GET /api/sales
 * Obtener lista de ventas del tenant
 */
router.get('/', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const options = {
      client_id: req.query.client_id ? parseInt(req.query.client_id) : undefined,
      payment_status: req.query.payment_status,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      min_amount: req.query.min_amount ? parseFloat(req.query.min_amount) : undefined,
      limit: parseInt(req.query.limit) || undefined,
      offset: parseInt(req.query.offset) || undefined
    };

    const sales = await Sales.getAll(tenantSchema, options);

    res.json({
      success: true,
      data: sales,
      count: sales.length,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo ventas:', error.message);
    res.status(500).json({
      error: 'GET_SALES_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/sales/stats
 * Obtener estadísticas de ventas
 */
router.get('/stats', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const options = {
      date_from: req.query.date_from,
      date_to: req.query.date_to
    };

    const stats = await Sales.getStats(tenantSchema, options);

    res.json({
      success: true,
      data: stats,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo estadísticas de ventas:', error.message);
    res.status(500).json({
      error: 'GET_SALES_STATS_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/sales/period/:period
 * Obtener ventas agrupadas por período
 */
router.get('/period/:period', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const { period } = req.params;
    const options = {
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      limit: parseInt(req.query.limit) || undefined
    };

    const salesByPeriod = await Sales.getSalesByPeriod(tenantSchema, period, options);

    res.json({
      success: true,
      data: salesByPeriod,
      count: salesByPeriod.length,
      period: period,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo ventas por período:', error.message);
    res.status(500).json({
      error: 'GET_SALES_BY_PERIOD_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/sales/top-products
 * Obtener productos más vendidos
 */
router.get('/top-products', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const options = {
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      limit: parseInt(req.query.limit) || 20
    };

    const topProducts = await Sales.getTopProducts(tenantSchema, options);

    res.json({
      success: true,
      data: topProducts,
      count: topProducts.length,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo productos más vendidos:', error.message);
    res.status(500).json({
      error: 'GET_TOP_PRODUCTS_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/sales/:id
 * Obtener venta específica por ID con detalles
 */
router.get('/:id', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const { id } = req.params;

    const sale = await Sales.getById(tenantSchema, parseInt(id));

    if (!sale) {
      return res.status(404).json({
        error: 'SALE_NOT_FOUND',
        message: `Venta con ID ${id} no encontrada`,
        sale_id: id,
        tenant_code: req.tenantCode
      });
    }

    res.json({
      success: true,
      data: sale,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo venta:', error.message);
    res.status(500).json({
      error: 'GET_SALE_ERROR',
      message: error.message,
      sale_id: req.params.id,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/sales
 * Crear nueva venta
 */
router.post('/', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const saleData = req.body;

    const requiredFields = ['sale_number', 'client_id', 'sale_date', 'details'];
    const missingFields = requiredFields.filter(field => !saleData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Campos requeridos faltantes',
        missing_fields: missingFields,
        required_fields: requiredFields
      });
    }

    const newSale = await Sales.create(tenantSchema, saleData);

    res.status(201).json({
      success: true,
      message: 'Venta creada exitosamente',
      data: newSale,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error creando venta:', error.message);
    
    if (error.message.includes('Ya existe una venta')) {
      return res.status(409).json({
        error: 'SALE_NUMBER_EXISTS',
        message: error.message,
        tenant_code: req.tenantCode
      });
    }

    if (error.message.includes('Stock insuficiente')) {
      return res.status(400).json({
        error: 'INSUFFICIENT_STOCK',
        message: error.message,
        tenant_code: req.tenantCode
      });
    }

    res.status(500).json({
      error: 'CREATE_SALE_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * PATCH /api/sales/:id/payment
 * Actualizar estado de pago de una venta
 */
router.patch('/:id/payment', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const { id } = req.params;
    const { payment_status, payment_method } = req.body;

    if (!payment_status) {
      return res.status(400).json({
        error: 'PAYMENT_STATUS_REQUIRED',
        message: 'payment_status es requerido'
      });
    }

    const updatedSale = await Sales.updatePaymentStatus(tenantSchema, parseInt(id), payment_status, payment_method);

    res.json({
      success: true,
      message: 'Estado de pago actualizado exitosamente',
      data: updatedSale,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error actualizando pago:', error.message);
    
    if (error.message.includes('no encontrada')) {
      return res.status(404).json({
        error: 'SALE_NOT_FOUND',
        message: error.message,
        sale_id: req.params.id,
        tenant_code: req.tenantCode
      });
    }

    res.status(500).json({
      error: 'UPDATE_PAYMENT_ERROR',
      message: error.message,
      sale_id: req.params.id,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/sales/:id/cancel
 * Cancelar una venta (reversar stock)
 */
router.post('/:id/cancel', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const { id } = req.params;
    const { reason = 'Cancelación manual via API' } = req.body;

    const success = await Sales.cancel(tenantSchema, parseInt(id), reason);

    res.json({
      success: true,
      message: 'Venta cancelada exitosamente',
      sale_id: id,
      reason: reason,
      note: 'El stock fue revertido automáticamente',
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error cancelando venta:', error.message);
    
    if (error.message.includes('no encontrada')) {
      return res.status(404).json({
        error: 'SALE_NOT_FOUND',
        message: error.message,
        sale_id: req.params.id,
        tenant_code: req.tenantCode
      });
    }

    if (error.message.includes('ya está cancelada')) {
      return res.status(400).json({
        error: 'SALE_ALREADY_CANCELLED',
        message: error.message,
        sale_id: req.params.id,
        tenant_code: req.tenantCode
      });
    }

    res.status(500).json({
      error: 'CANCEL_SALE_ERROR',
      message: error.message,
      sale_id: req.params.id,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;