// =====================================================================================
// FLUXION AI - TENANT MANAGEMENT ROUTES
// Rutas para gestión de tenants (administración)
// =====================================================================================

const express = require('express');
const router = express.Router();
const TenantService = require('../services/TenantService.cjs');

// =====================================================================================
// TENANT MANAGEMENT ENDPOINTS
// =====================================================================================

/**
 * GET /api/admin/tenants
 * Obtener lista de todos los tenants
 */
router.get('/', async (req, res) => {
  try {
    const tenants = await TenantService.getAllTenants();
    res.json({
      success: true,
      data: tenants,
      count: tenants.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo tenants:', error.message);
    res.status(500).json({
      error: 'GET_TENANTS_ERROR',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/tenants/:tenantCode
 * Obtener información de un tenant específico
 */
router.get('/:tenantCode', async (req, res) => {
  try {
    const { tenantCode } = req.params;
    const tenant = await TenantService.getTenant(tenantCode);

    if (!tenant) {
      return res.status(404).json({
        error: 'TENANT_NOT_FOUND',
        message: `Tenant ${tenantCode} no encontrado`,
        tenant_code: tenantCode
      });
    }

    res.json({
      success: true,
      data: tenant,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo tenant:', error.message);
    res.status(500).json({
      error: 'GET_TENANT_ERROR',
      message: error.message,
      tenant_code: req.params.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/tenants/:tenantCode/stats
 * Obtener estadísticas de un tenant
 */
router.get('/:tenantCode/stats', async (req, res) => {
  try {
    const { tenantCode } = req.params;
    const stats = await TenantService.getTenantStats(tenantCode);

    res.json({
      success: true,
      data: stats,
      tenant_code: tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo stats del tenant:', error.message);
    res.status(500).json({
      error: 'GET_TENANT_STATS_ERROR',
      message: error.message,
      tenant_code: req.params.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/admin/tenants
 * Crear un nuevo tenant con schema dedicado
 */
router.post('/', async (req, res) => {
  try {
    const tenantData = req.body;

    // Validaciones básicas
    if (!tenantData.tenant_code || !tenantData.company_name) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'tenant_code y company_name son requeridos',
        required_fields: ['tenant_code', 'company_name']
      });
    }

    // Validar formato del tenant_code
    if (!/^[a-z0-9_]+$/.test(tenantData.tenant_code)) {
      return res.status(400).json({
        error: 'INVALID_TENANT_CODE',
        message: 'tenant_code solo puede contener letras minúsculas, números y guiones bajos',
        provided: tenantData.tenant_code
      });
    }

    const newTenant = await TenantService.createTenant(tenantData);

    res.status(201).json({
      success: true,
      message: 'Tenant creado exitosamente',
      data: newTenant,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error creando tenant:', error.message);
    
    // Errores específicos
    if (error.message.includes('Ya existe un tenant')) {
      return res.status(409).json({
        error: 'TENANT_EXISTS',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({
      error: 'CREATE_TENANT_ERROR',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * PUT /api/admin/tenants/:tenantCode/deactivate
 * Desactivar un tenant (soft delete)
 */
router.put('/:tenantCode/deactivate', async (req, res) => {
  try {
    const { tenantCode } = req.params;
    const success = await TenantService.deactivateTenant(tenantCode);

    if (!success) {
      return res.status(404).json({
        error: 'TENANT_NOT_FOUND',
        message: `Tenant ${tenantCode} no encontrado`,
        tenant_code: tenantCode
      });
    }

    res.json({
      success: true,
      message: `Tenant ${tenantCode} desactivado exitosamente`,
      tenant_code: tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error desactivando tenant:', error.message);
    res.status(500).json({
      error: 'DEACTIVATE_TENANT_ERROR',
      message: error.message,
      tenant_code: req.params.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /api/admin/tenants/:tenantCode
 * Eliminar completamente un tenant (PELIGROSO)
 */
router.delete('/:tenantCode', async (req, res) => {
  try {
    const { tenantCode } = req.params;
    const { confirm } = req.query;

    if (confirm !== 'DELETE_EVERYTHING') {
      return res.status(400).json({
        error: 'CONFIRMATION_REQUIRED',
        message: 'Para eliminar un tenant permanentemente debe usar ?confirm=DELETE_EVERYTHING',
        warning: 'Esta operación NO SE PUEDE DESHACER',
        tenant_code: tenantCode
      });
    }

    const success = await TenantService.deleteTenant(tenantCode, true);

    if (!success) {
      return res.status(404).json({
        error: 'TENANT_NOT_FOUND',
        message: `Tenant ${tenantCode} no encontrado`,
        tenant_code: tenantCode
      });
    }

    res.json({
      success: true,
      message: `Tenant ${tenantCode} eliminado PERMANENTEMENTE`,
      warning: 'Todos los datos han sido eliminados',
      tenant_code: tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error eliminando tenant:', error.message);
    res.status(500).json({
      error: 'DELETE_TENANT_ERROR',
      message: error.message,
      tenant_code: req.params.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/admin/tenants/:tenantCode/migrate
 * Migrar tenant a nueva versión de schema
 */
router.post('/:tenantCode/migrate', async (req, res) => {
  try {
    const { tenantCode } = req.params;
    const success = await TenantService.migrateTenant(tenantCode);

    res.json({
      success: true,
      message: `Tenant ${tenantCode} migrado exitosamente`,
      tenant_code: tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error migrando tenant:', error.message);
    res.status(500).json({
      error: 'MIGRATE_TENANT_ERROR',
      message: error.message,
      tenant_code: req.params.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/admin/tenants/demo
 * Crear tenant de demostración con datos de ejemplo
 */
router.post('/demo', async (req, res) => {
  try {
    const demoTenantData = {
      tenant_code: 'demo_' + Date.now(),
      company_name: 'Distribuidora Demo Valencia',
      contact_person: 'Demo User',
      email: 'demo@fluxionai.com',
      phone: '+58-241-000-0000',
      address: 'Av. Demo 123, Valencia',
      city: 'Valencia',
      state: 'Carabobo',
      plan: 'demo',
      max_users: 3,
      max_products: 100,
      active: true,
      initialData: {
        products: [
          {
            sku: 'HARINA-PAN-1KG',
            name: 'Harina P.A.N. 1Kg',
            category: 'Alimentos Básicos',
            brand: 'P.A.N.',
            cost_price: 2.50,
            selling_price: 3.20,
            current_stock: 45,
            min_stock_threshold: 20,
            max_stock_threshold: 100
          },
          {
            sku: 'ACEITE-MAZEITE-1L',
            name: 'Aceite Mazeite 1L',
            category: 'Aceites',
            brand: 'Mazeite',
            cost_price: 1.80,
            selling_price: 2.45,
            current_stock: 32,
            min_stock_threshold: 15,
            max_stock_threshold: 80
          }
        ],
        clients: [
          {
            client_code: 'DEMO-001',
            business_name: 'Bodega La Esperanza',
            contact_person: 'Carlos Demo',
            email: 'carlos@demo.com',
            phone: '+58-241-111-1111',
            address: 'Calle Demo 456',
            city: 'Valencia',
            state: 'Carabobo',
            client_type: 'mayorista',
            credit_limit: 5000
          }
        ]
      }
    };

    const demoTenant = await TenantService.createTenant(demoTenantData);

    res.status(201).json({
      success: true,
      message: 'Tenant demo creado exitosamente',
      data: demoTenant,
      demo_info: {
        tenant_code: demoTenant.tenant_code,
        access_examples: {
          header: `curl -H "X-Tenant: ${demoTenant.tenant_code}" http://localhost:3004/api/products`,
          url: `curl http://localhost:3004/api/tenant/${demoTenant.tenant_code}/products`
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error creando tenant demo:', error.message);
    res.status(500).json({
      error: 'CREATE_DEMO_TENANT_ERROR',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;