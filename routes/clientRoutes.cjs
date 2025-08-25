// =====================================================================================
// FLUXION AI - CLIENT ROUTES (MULTI-TENANT)
// Rutas para gestión de clientes con contexto de tenant
// =====================================================================================

const express = require('express');
const router = express.Router();
const Client = require('../models/Client.cjs');

// =====================================================================================
// CLIENT ENDPOINTS
// =====================================================================================

/**
 * GET /api/clients
 * Obtener lista de clientes del tenant
 */
router.get('/', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const options = {
      client_type: req.query.client_type,
      city: req.query.city,
      state: req.query.state,
      active: req.query.active !== undefined ? req.query.active === 'true' : undefined,
      withSalesData: req.query.with_sales_data === 'true',
      limit: parseInt(req.query.limit) || undefined,
      offset: parseInt(req.query.offset) || undefined
    };

    const clients = await Client.getAll(tenantSchema, options);

    res.json({
      success: true,
      data: clients,
      count: clients.length,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo clientes:', error.message);
    res.status(500).json({
      error: 'GET_CLIENTS_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/clients/search?q=término
 * Buscar clientes
 */
router.get('/search', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const { q: searchTerm } = req.query;
    const limit = parseInt(req.query.limit) || 20;

    if (!searchTerm) {
      return res.status(400).json({
        error: 'SEARCH_TERM_REQUIRED',
        message: 'Parámetro "q" es requerido para búsqueda'
      });
    }

    const clients = await Client.search(tenantSchema, searchTerm, limit);

    res.json({
      success: true,
      data: clients,
      count: clients.length,
      search_term: searchTerm,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error buscando clientes:', error.message);
    res.status(500).json({
      error: 'SEARCH_CLIENTS_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/clients/overdue
 * Obtener clientes con pagos vencidos
 */
router.get('/overdue', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const daysOverdue = parseInt(req.query.days) || 1;
    
    const clients = await Client.getOverdueClients(tenantSchema, daysOverdue);

    res.json({
      success: true,
      data: clients,
      count: clients.length,
      days_overdue_filter: daysOverdue,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo clientes morosos:', error.message);
    res.status(500).json({
      error: 'GET_OVERDUE_CLIENTS_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/clients/stats
 * Obtener estadísticas de clientes
 */
router.get('/stats', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const stats = await Client.getStats(tenantSchema);

    res.json({
      success: true,
      data: stats,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo estadísticas de clientes:', error.message);
    res.status(500).json({
      error: 'GET_CLIENTS_STATS_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/clients/:id
 * Obtener cliente específico por ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const { id } = req.params;

    const client = await Client.getById(tenantSchema, parseInt(id));

    if (!client) {
      return res.status(404).json({
        error: 'CLIENT_NOT_FOUND',
        message: `Cliente con ID ${id} no encontrado`,
        client_id: id,
        tenant_code: req.tenantCode
      });
    }

    res.json({
      success: true,
      data: client,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo cliente:', error.message);
    res.status(500).json({
      error: 'GET_CLIENT_ERROR',
      message: error.message,
      client_id: req.params.id,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/clients/:id/intelligence
 * Obtener análisis de comportamiento del cliente
 */
router.get('/:id/intelligence', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const { id } = req.params;
    const days = parseInt(req.query.days) || 90;

    const intelligence = await Client.getClientIntelligence(tenantSchema, parseInt(id), days);

    res.json({
      success: true,
      data: intelligence,
      analysis_period_days: days,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo inteligencia del cliente:', error.message);
    res.status(500).json({
      error: 'GET_CLIENT_INTELLIGENCE_ERROR',
      message: error.message,
      client_id: req.params.id,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/clients
 * Crear nuevo cliente
 */
router.post('/', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const clientData = req.body;

    const requiredFields = ['client_code', 'business_name'];
    const missingFields = requiredFields.filter(field => !clientData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Campos requeridos faltantes',
        missing_fields: missingFields,
        required_fields: requiredFields
      });
    }

    const newClient = await Client.create(tenantSchema, clientData);

    res.status(201).json({
      success: true,
      message: 'Cliente creado exitosamente',
      data: newClient,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error creando cliente:', error.message);
    
    if (error.message.includes('Ya existe un cliente')) {
      return res.status(409).json({
        error: 'CLIENT_CODE_EXISTS',
        message: error.message,
        tenant_code: req.tenantCode
      });
    }

    res.status(500).json({
      error: 'CREATE_CLIENT_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * PUT /api/clients/:id
 * Actualizar cliente existente
 */
router.put('/:id', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const { id } = req.params;
    const updateData = req.body;

    const updatedClient = await Client.update(tenantSchema, parseInt(id), updateData);

    res.json({
      success: true,
      message: 'Cliente actualizado exitosamente',
      data: updatedClient,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error actualizando cliente:', error.message);
    
    if (error.message.includes('no encontrado')) {
      return res.status(404).json({
        error: 'CLIENT_NOT_FOUND',
        message: error.message,
        client_id: req.params.id,
        tenant_code: req.tenantCode
      });
    }

    res.status(500).json({
      error: 'UPDATE_CLIENT_ERROR',
      message: error.message,
      client_id: req.params.id,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /api/clients/:id
 * Eliminar cliente (soft delete)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const { id } = req.params;

    const success = await Client.delete(tenantSchema, parseInt(id));

    if (!success) {
      return res.status(404).json({
        error: 'CLIENT_NOT_FOUND',
        message: `Cliente con ID ${id} no encontrado`,
        client_id: id,
        tenant_code: req.tenantCode
      });
    }

    res.json({
      success: true,
      message: 'Cliente desactivado exitosamente',
      client_id: id,
      note: 'El cliente fue marcado como inactivo (soft delete)',
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error eliminando cliente:', error.message);
    res.status(500).json({
      error: 'DELETE_CLIENT_ERROR',
      message: error.message,
      client_id: req.params.id,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;