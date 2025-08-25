// =====================================================================================
// FLUXION AI - TENANT MIDDLEWARE (MULTI-TENANT)
// Middleware para resolución automática de contexto de tenant desde requests HTTP
// =====================================================================================

const TenantService = require('../services/TenantService.cjs');

/**
 * Middleware para resolver el tenant desde la request y añadirlo al contexto
 * Soporta múltiples métodos de identificación del tenant:
 * 1. Header personalizado X-Tenant
 * 2. Subdominio (tenant.fluxionai.com)
 * 3. Parámetro en URL (/api/tenant/:tenantCode/...)
 * 4. Query parameter (?tenant=abc123)
 */
const tenantMiddleware = async (req, res, next) => {
  try {
    let tenantCode = null;
    let tenant = null;

    // Método 1: Header personalizado X-Tenant (preferido para APIs)
    if (req.headers['x-tenant']) {
      tenantCode = req.headers['x-tenant'];
      console.log(`🏢 Tenant detectado via header: ${tenantCode}`);
    }
    
    // Método 2: Subdominio (tenant.fluxionai.com)
    else if (req.hostname && req.hostname !== 'localhost' && !req.hostname.startsWith('127.0.0.1')) {
      const hostParts = req.hostname.split('.');
      if (hostParts.length >= 2) {
        const subdomain = hostParts[0];
        if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
          tenantCode = subdomain;
          console.log(`🏢 Tenant detectado via subdominio: ${tenantCode}`);
        }
      }
    }
    
    // Método 3: Parámetro en URL (/api/tenant/:tenantCode/...)
    else if (req.params && req.params.tenantCode) {
      tenantCode = req.params.tenantCode;
      console.log(`🏢 Tenant detectado via URL param: ${tenantCode}`);
    }
    // Método 3b: Extraer tenant code del path usando regex (para middleware global)
    else if (req.path && req.path.startsWith('/api/tenant/')) {
      const pathMatch = req.path.match(/^\/api\/tenant\/([^\/]+)\//);
      if (pathMatch) {
        tenantCode = pathMatch[1];
        console.log(`🏢 Tenant detectado via path regex: ${tenantCode}`);
      }
    }
    
    // Método 4: Query parameter (?tenant=abc123)
    else if (req.query && req.query.tenant) {
      tenantCode = req.query.tenant;
      console.log(`🏢 Tenant detectado via query param: ${tenantCode}`);
    }

    // Si no se encontró tenant code, verificar si el endpoint lo requiere
    if (!tenantCode) {
      // Lista de rutas que NO requieren tenant (públicas)
      const publicRoutes = [
        '/api/health',
        '/api/system',
        '/api/admin',
        '/api/tenants', // Para gestión de tenants desde admin
        '/favicon.ico'
      ];

      const isPublicRoute = publicRoutes.some(route => req.path.startsWith(route));
      
      if (!isPublicRoute) {
        return res.status(400).json({
          error: 'TENANT_REQUIRED',
          message: 'Se requiere especificar el tenant. Use header X-Tenant, subdominio, o parámetro tenant.',
          methods: {
            header: 'X-Tenant: abc123',
            subdomain: 'abc123.fluxionai.com',
            url_param: '/api/tenant/abc123/products',
            query_param: '/api/products?tenant=abc123'
          }
        });
      }
    }

    // Si hay tenant code, validar que existe y está activo
    if (tenantCode) {
      try {
        tenant = await TenantService.getTenant(tenantCode);
        
        if (!tenant) {
          return res.status(404).json({
            error: 'TENANT_NOT_FOUND',
            message: `Tenant '${tenantCode}' no encontrado o inactivo`,
            tenant_code: tenantCode
          });
        }

        // Verificar que el schema existe
        const schemaExists = await TenantService.schemaExists(tenant.schema_name);
        if (!schemaExists) {
          return res.status(500).json({
            error: 'TENANT_SCHEMA_MISSING',
            message: `Schema del tenant '${tenantCode}' no existe. Contacte al administrador.`,
            tenant_code: tenantCode,
            schema_name: tenant.schema_name
          });
        }

        // Añadir información del tenant al request
        req.tenant = tenant;
        req.tenantCode = tenantCode;
        req.tenantSchema = tenant.schema_name;

        // Header de respuesta para debugging
        res.set('X-Tenant-Active', tenantCode);
        res.set('X-Tenant-Schema', tenant.schema_name);

        console.log(`✅ Tenant válido: ${tenantCode} (${tenant.company_name}) - Schema: ${tenant.schema_name}`);

      } catch (tenantError) {
        console.error('💥 Error validando tenant:', tenantError.message);
        return res.status(500).json({
          error: 'TENANT_VALIDATION_ERROR',
          message: 'Error interno validando tenant',
          tenant_code: tenantCode
        });
      }
    }

    next();

  } catch (error) {
    console.error('💥 Error en tenant middleware:', error.message);
    return res.status(500).json({
      error: 'MIDDLEWARE_ERROR',
      message: 'Error interno en middleware de tenant'
    });
  }
};

/**
 * Middleware específico que REQUIERE tenant (para rutas protegidas)
 * Use este middleware en rutas que necesitan obligatoriamente un tenant
 */
const requireTenant = (req, res, next) => {
  if (!req.tenant || !req.tenantSchema) {
    return res.status(400).json({
      error: 'TENANT_REQUIRED',
      message: 'Esta operación requiere un tenant válido'
    });
  }
  next();
};

/**
 * Middleware para logging de requests con contexto de tenant
 */
const tenantRequestLogger = (req, res, next) => {
  const tenantInfo = req.tenant ? 
    `[${req.tenantCode}:${req.tenant.company_name}]` : 
    '[NO-TENANT]';
  
  console.log(`🌐 ${tenantInfo} ${req.method} ${req.originalUrl} - ${req.ip}`);
  next();
};

/**
 * Middleware para validar límites por tenant (rate limiting básico)
 */
const tenantRateLimit = (req, res, next) => {
  // TODO: Implementar rate limiting por tenant basado en su plan
  // Por ahora solo log
  if (req.tenant) {
    const plan = req.tenant.plan;
    console.log(`📊 Request de tenant ${req.tenantCode} con plan: ${plan}`);
  }
  next();
};

/**
 * Helper function para obtener estadísticas de tenant desde request
 */
const getTenantStats = async (req) => {
  if (!req.tenant) {
    throw new Error('Tenant requerido para obtener estadísticas');
  }
  
  return await TenantService.getTenantStats(req.tenantCode);
};

/**
 * Helper function para verificar permisos de tenant
 */
const checkTenantPermission = (req, permission) => {
  if (!req.tenant) {
    return false;
  }
  
  // TODO: Implementar sistema de permisos más sofisticado
  // Por ahora todos los tenants activos tienen todos los permisos
  return req.tenant.active;
};

/**
 * Middleware de error específico para tenant
 */
const tenantErrorHandler = (error, req, res, next) => {
  // Si el error es relacionado con tenant, dar contexto adicional
  if (error.message && error.message.includes('tenantSchema es requerido')) {
    return res.status(400).json({
      error: 'TENANT_CONTEXT_MISSING',
      message: 'Error interno: contexto de tenant perdido en la operación',
      tenant_code: req.tenantCode,
      hint: 'Este error indica un problema en el código del servidor'
    });
  }

  // Para otros errores, pasar al siguiente middleware
  next(error);
};

module.exports = {
  tenantMiddleware,
  requireTenant,
  tenantRequestLogger,
  tenantRateLimit,
  getTenantStats,
  checkTenantPermission,
  tenantErrorHandler
};