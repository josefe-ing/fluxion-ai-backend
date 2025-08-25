// =====================================================================================
// FLUXION AI - PRODUCT ROUTES (MULTI-TENANT)
// Rutas para gestión de productos con contexto de tenant
// =====================================================================================

const express = require('express');
const router = express.Router();
const Product = require('../models/Product.cjs');

// =====================================================================================
// PRODUCT ENDPOINTS (Todos requieren tenant en contexto)
// =====================================================================================

/**
 * GET /api/products
 * Obtener lista de productos del tenant con filtros opcionales
 */
router.get('/', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const options = {
      category: req.query.category,
      brand: req.query.brand,
      active: req.query.active !== undefined ? req.query.active === 'true' : undefined,
      lowStock: req.query.lowStock === 'true',
      limit: parseInt(req.query.limit) || undefined,
      offset: parseInt(req.query.offset) || undefined
    };

    const products = await Product.getAll(tenantSchema, options);

    res.json({
      success: true,
      data: products,
      count: products.length,
      tenant_code: req.tenantCode,
      filters_applied: Object.keys(options).filter(key => options[key] !== undefined),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo productos:', error.message);
    res.status(500).json({
      error: 'GET_PRODUCTS_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/products/search?q=término
 * Buscar productos por término de búsqueda
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

    const products = await Product.search(tenantSchema, searchTerm, limit);

    res.json({
      success: true,
      data: products,
      count: products.length,
      search_term: searchTerm,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error buscando productos:', error.message);
    res.status(500).json({
      error: 'SEARCH_PRODUCTS_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/products/low-stock
 * Obtener productos con stock bajo
 */
router.get('/low-stock', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const products = await Product.getLowStock(tenantSchema);

    res.json({
      success: true,
      data: products,
      count: products.length,
      alert_level: 'low_stock',
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo productos con stock bajo:', error.message);
    res.status(500).json({
      error: 'GET_LOW_STOCK_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/products/stats
 * Obtener estadísticas de productos del tenant
 */
router.get('/stats', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const stats = await Product.getStats(tenantSchema);

    res.json({
      success: true,
      data: stats,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo estadísticas de productos:', error.message);
    res.status(500).json({
      error: 'GET_PRODUCTS_STATS_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/products/:id
 * Obtener producto específico por ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        error: 'INVALID_PRODUCT_ID',
        message: 'ID de producto debe ser un número válido'
      });
    }

    const product = await Product.getById(tenantSchema, parseInt(id));

    if (!product) {
      return res.status(404).json({
        error: 'PRODUCT_NOT_FOUND',
        message: `Producto con ID ${id} no encontrado`,
        product_id: id,
        tenant_code: req.tenantCode
      });
    }

    res.json({
      success: true,
      data: product,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error obteniendo producto:', error.message);
    res.status(500).json({
      error: 'GET_PRODUCT_ERROR',
      message: error.message,
      product_id: req.params.id,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/products
 * Crear nuevo producto
 */
router.post('/', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const productData = req.body;

    // Validaciones básicas
    const requiredFields = ['sku', 'name', 'cost_price', 'selling_price'];
    const missingFields = requiredFields.filter(field => !productData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Campos requeridos faltantes',
        missing_fields: missingFields,
        required_fields: requiredFields
      });
    }

    const newProduct = await Product.create(tenantSchema, productData);

    res.status(201).json({
      success: true,
      message: 'Producto creado exitosamente',
      data: newProduct,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error creando producto:', error.message);
    
    if (error.message.includes('Ya existe un producto con SKU')) {
      return res.status(409).json({
        error: 'SKU_EXISTS',
        message: error.message,
        tenant_code: req.tenantCode
      });
    }

    res.status(500).json({
      error: 'CREATE_PRODUCT_ERROR',
      message: error.message,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * PUT /api/products/:id
 * Actualizar producto existente
 */
router.put('/:id', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const { id } = req.params;
    const updateData = req.body;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        error: 'INVALID_PRODUCT_ID',
        message: 'ID de producto debe ser un número válido'
      });
    }

    const updatedProduct = await Product.update(tenantSchema, parseInt(id), updateData);

    res.json({
      success: true,
      message: 'Producto actualizado exitosamente',
      data: updatedProduct,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error actualizando producto:', error.message);
    
    if (error.message.includes('no encontrado')) {
      return res.status(404).json({
        error: 'PRODUCT_NOT_FOUND',
        message: error.message,
        product_id: req.params.id,
        tenant_code: req.tenantCode
      });
    }

    res.status(500).json({
      error: 'UPDATE_PRODUCT_ERROR',
      message: error.message,
      product_id: req.params.id,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /api/products/:id
 * Eliminar producto (soft delete)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        error: 'INVALID_PRODUCT_ID',
        message: 'ID de producto debe ser un número válido'
      });
    }

    const success = await Product.delete(tenantSchema, parseInt(id));

    if (!success) {
      return res.status(404).json({
        error: 'PRODUCT_NOT_FOUND',
        message: `Producto con ID ${id} no encontrado`,
        product_id: id,
        tenant_code: req.tenantCode
      });
    }

    res.json({
      success: true,
      message: 'Producto desactivado exitosamente',
      product_id: id,
      note: 'El producto fue marcado como inactivo (soft delete)',
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error eliminando producto:', error.message);
    res.status(500).json({
      error: 'DELETE_PRODUCT_ERROR',
      message: error.message,
      product_id: req.params.id,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * PATCH /api/products/:id/stock
 * Actualizar stock de un producto
 */
router.patch('/:id/stock', async (req, res) => {
  try {
    const { tenantSchema } = req;
    const { id } = req.params;
    const { new_stock, reason = 'Manual adjustment via API' } = req.body;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        error: 'INVALID_PRODUCT_ID',
        message: 'ID de producto debe ser un número válido'
      });
    }

    if (new_stock === undefined || new_stock < 0) {
      return res.status(400).json({
        error: 'INVALID_STOCK_VALUE',
        message: 'new_stock debe ser un número >= 0'
      });
    }

    const updatedProduct = await Product.updateStock(tenantSchema, parseInt(id), new_stock, reason);

    res.json({
      success: true,
      message: 'Stock actualizado exitosamente',
      data: updatedProduct,
      stock_change: {
        new_stock: new_stock,
        reason: reason
      },
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error actualizando stock:', error.message);
    
    if (error.message.includes('no encontrado')) {
      return res.status(404).json({
        error: 'PRODUCT_NOT_FOUND',
        message: error.message,
        product_id: req.params.id,
        tenant_code: req.tenantCode
      });
    }

    res.status(500).json({
      error: 'UPDATE_STOCK_ERROR',
      message: error.message,
      product_id: req.params.id,
      tenant_code: req.tenantCode,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;