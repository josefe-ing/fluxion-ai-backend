// =====================================================================================
// FLUXION AI - MULTI-TENANT API SERVER
// Express server with complete multi-tenant API endpoints
// =====================================================================================

const express = require('express');
const cors = require('cors');
const { 
  tenantMiddleware, 
  requireTenant, 
  tenantRequestLogger, 
  tenantErrorHandler 
} = require('./middleware/tenantMiddleware.cjs');

const app = express();
const PORT = process.env.BACKEND_PORT || 3004;

// =====================================================================================
// MIDDLEWARE SETUP
// =====================================================================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'X-Tenant'],
  credentials: true
}));

// Global tenant middleware (debe ir antes de las rutas)
app.use(tenantMiddleware);
app.use(tenantRequestLogger);

// =====================================================================================
// HEALTH CHECK & SYSTEM ROUTES (No requieren tenant)
// =====================================================================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'fluxion-ai-multitenant',
    version: '1.0.0'
  });
});

app.get('/api/system/info', (req, res) => {
  res.json({
    service: 'Fluxion AI Multi-Tenant API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    features: [
      'multi-tenant-architecture',
      'postgresql-schemas',
      'real-time-insights',
      'inventory-management',
      'sales-analytics'
    ]
  });
});

// =====================================================================================
// TENANT MANAGEMENT ROUTES (Admin only)
// =====================================================================================

const tenantRoutes = require('./routes/tenantRoutes.cjs');
app.use('/api/admin/tenants', tenantRoutes);

// =====================================================================================
// MULTI-TENANT API ROUTES (Requieren tenant válido)
// =====================================================================================

const productRoutes = require('./routes/productRoutes.cjs');
const clientRoutes = require('./routes/clientRoutes.cjs');
const salesRoutes = require('./routes/salesRoutes.cjs');
const inventoryRoutes = require('./routes/inventoryRoutes.cjs');
const insightsRoutes = require('./routes/insightsRoutes.cjs');
const dashboardRoutes = require('./routes/dashboardRoutes.cjs');

// Aplicar middleware requireTenant a todas las rutas de API
app.use('/api/products', requireTenant, productRoutes);
app.use('/api/clients', requireTenant, clientRoutes);
app.use('/api/sales', requireTenant, salesRoutes);
app.use('/api/inventory', requireTenant, inventoryRoutes);
app.use('/api/insights', requireTenant, insightsRoutes);
app.use('/api/dashboard', requireTenant, dashboardRoutes);

// Rutas con parámetro de tenant en URL (alternativa)
app.use('/api/tenant/:tenantCode/products', requireTenant, productRoutes);
app.use('/api/tenant/:tenantCode/clients', requireTenant, clientRoutes);
app.use('/api/tenant/:tenantCode/sales', requireTenant, salesRoutes);
app.use('/api/tenant/:tenantCode/inventory', requireTenant, inventoryRoutes);
app.use('/api/tenant/:tenantCode/insights', requireTenant, insightsRoutes);
app.use('/api/tenant/:tenantCode/dashboard', requireTenant, dashboardRoutes);

// =====================================================================================
// ERROR HANDLING
// =====================================================================================

app.use(tenantErrorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: `Ruta ${req.originalUrl} no encontrada`,
    available_endpoints: {
      system: ['/api/health', '/api/system/info'],
      admin: ['/api/admin/tenants'],
      tenant_apis: [
        '/api/products (requiere header X-Tenant)',
        '/api/clients (requiere header X-Tenant)',
        '/api/sales (requiere header X-Tenant)',
        '/api/inventory (requiere header X-Tenant)',
        '/api/insights (requiere header X-Tenant)',
        '/api/dashboard (requiere header X-Tenant)'
      ],
      tenant_url_format: [
        '/api/tenant/{tenant_code}/products',
        '/api/tenant/{tenant_code}/clients',
        '/api/tenant/{tenant_code}/sales',
        '/api/tenant/{tenant_code}/inventory',
        '/api/tenant/{tenant_code}/insights',
        '/api/tenant/{tenant_code}/dashboard'
      ]
    }
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('💥 Error global:', error);
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Error interno del servidor',
    tenant_code: req.tenantCode || null,
    timestamp: new Date().toISOString()
  });
});

// =====================================================================================
// SERVER START
// =====================================================================================

const server = app.listen(PORT, () => {
  console.log('\n🚀 Fluxion AI Multi-Tenant API Server');
  console.log('=====================================');
  console.log(`✅ Servidor iniciado en puerto ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📊 System info: http://localhost:${PORT}/api/system/info`);
  console.log('\n📋 Endpoints disponibles:');
  console.log('   Admin: /api/admin/tenants/*');
  console.log('   API (con X-Tenant header): /api/products, /api/clients, /api/sales...');
  console.log('   API (con URL param): /api/tenant/{code}/products...');
  console.log('\n💡 Ejemplos de uso:');
  console.log('   curl -H "X-Tenant: demo123" http://localhost:' + PORT + '/api/products');
  console.log('   curl http://localhost:' + PORT + '/api/tenant/demo123/products');
  console.log('\n🔧 Para crear un tenant:');
  console.log('   POST /api/admin/tenants');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

module.exports = app;