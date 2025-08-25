// =====================================================================================
// FLUXION AI - TENANT SERVICE
// Servicio para gestión de tenants (clientes) con schemas separados
// =====================================================================================

const { query } = require('../config/database.cjs');

/**
 * Servicio TenantService para gestión multi-tenant con schemas por cliente
 */
class TenantService {
  
  /**
   * Crear un nuevo tenant con su schema dedicado
   * @param {Object} tenantData - Datos del tenant
   * @returns {Promise<Object>} Tenant creado
   */
  static async createTenant(tenantData) {
    const client = await query('BEGIN');
    
    try {
      const {
        tenant_code,
        company_name,
        contact_person,
        email,
        phone,
        address,
        city,
        state,
        plan = 'basic',
        max_users = 5,
        max_products = 1000,
        active = true
      } = tenantData;

      // Validar que el código de tenant sea válido (solo letras, números y guiones)
      if (!/^[a-z0-9_]+$/.test(tenant_code)) {
        throw new Error('El código del tenant solo puede contener letras minúsculas, números y guiones bajos');
      }

      // Verificar que no exista el tenant
      const existingTenant = await query(
        'SELECT id FROM public.tenants WHERE tenant_code = $1',
        [tenant_code]
      );

      if (existingTenant.rows.length > 0) {
        throw new Error(`Ya existe un tenant con código: ${tenant_code}`);
      }

      // Crear registro del tenant en la tabla principal
      const tenantResult = await query(`
        INSERT INTO public.tenants (
          tenant_code, company_name, contact_person, email, phone,
          address, city, state, plan, max_users, max_products, active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        tenant_code, company_name, contact_person, email, phone,
        address, city, state, plan, max_users, max_products, active
      ]);

      const tenant = tenantResult.rows[0];

      // Crear schema dedicado para el tenant
      const schemaName = `tenant_${tenant_code}`;
      await query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

      // Crear todas las tablas en el schema del tenant
      await this.createTenantSchema(schemaName);

      // Insertar datos iniciales si se proporcionan
      if (tenantData.initialData) {
        await this.insertInitialData(schemaName, tenantData.initialData);
      }

      await query('COMMIT');

      console.log(`✅ Tenant creado exitosamente: ${tenant_code} (Schema: ${schemaName})`);
      
      return {
        ...tenant,
        schema_name: schemaName
      };

    } catch (error) {
      await query('ROLLBACK');
      console.error('💥 Error creando tenant:', error.message);
      throw new Error(`Error creando tenant: ${error.message}`);
    }
  }

  /**
   * Crear el schema completo para un tenant
   * @param {string} schemaName - Nombre del schema
   */
  static async createTenantSchema(schemaName) {
    try {
      console.log(`🏗️ Creando schema para tenant: ${schemaName}`);

      // Leer el archivo de schema base y adaptarlo
      const fs = require('fs').promises;
      const path = require('path');
      
      let schemaSQL = await fs.readFile(
        path.join(__dirname, '../database/tenant-base-schema.sql'), 
        'utf8'
      );

      // Reemplazar referencias a tablas para usar el schema específico
      schemaSQL = schemaSQL
        // Remover extensiones ya creadas
        .replace(/CREATE EXTENSION[^;]+;/g, '')
        // Remover tipos ENUM ya creados
        .replace(/CREATE TYPE [^;]+;/g, '')
        // Cambiar todas las referencias de tabla para usar el schema
        .replace(/CREATE TABLE IF NOT EXISTS /g, `CREATE TABLE IF NOT EXISTS "${schemaName}".`)
        .replace(/CREATE TABLE /g, `CREATE TABLE "${schemaName}".`)
        .replace(/REFERENCES /g, `REFERENCES "${schemaName}".`)
        .replace(/CREATE INDEX /g, `CREATE INDEX IF NOT EXISTS `)
        .replace(/ON products/g, `ON "${schemaName}".products`)
        .replace(/ON clients/g, `ON "${schemaName}".clients`)
        .replace(/ON sales/g, `ON "${schemaName}".sales`)
        .replace(/ON sale_details/g, `ON "${schemaName}".sale_details`)
        .replace(/ON inventory_movements/g, `ON "${schemaName}".inventory_movements`)
        .replace(/ON insights/g, `ON "${schemaName}".insights`);

      // Ejecutar el schema adaptado
      await query(schemaSQL);

      console.log(`✅ Schema ${schemaName} creado exitosamente`);

    } catch (error) {
      console.error(`💥 Error creando schema ${schemaName}:`, error.message);
      throw error;
    }
  }

  /**
   * Insertar datos iniciales en el schema del tenant
   * @param {string} schemaName - Nombre del schema
   * @param {Object} initialData - Datos iniciales
   */
  static async insertInitialData(schemaName, initialData) {
    try {
      console.log(`🌱 Insertando datos iniciales para ${schemaName}`);

      if (initialData.products) {
        for (const product of initialData.products) {
          await query(`
            INSERT INTO "${schemaName}".products (
              sku, name, category, brand, cost_price, selling_price,
              current_stock, min_stock_threshold, max_stock_threshold, active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [
            product.sku, product.name, product.category, product.brand,
            product.cost_price, product.selling_price, product.current_stock || 0,
            product.min_stock_threshold || 10, product.max_stock_threshold || 1000,
            product.active !== false
          ]);
        }
      }

      if (initialData.clients) {
        for (const client of initialData.clients) {
          await query(`
            INSERT INTO "${schemaName}".clients (
              client_code, business_name, contact_person, email, phone,
              address, city, state, client_type, credit_limit, active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, [
            client.client_code, client.business_name, client.contact_person,
            client.email, client.phone, client.address, client.city, client.state,
            client.client_type || 'mayorista', client.credit_limit || 0,
            client.active !== false
          ]);
        }
      }

      console.log(`✅ Datos iniciales insertados para ${schemaName}`);

    } catch (error) {
      console.error(`💥 Error insertando datos iniciales para ${schemaName}:`, error.message);
      throw error;
    }
  }

  /**
   * Obtener información de un tenant
   * @param {string} tenantCode - Código del tenant
   * @returns {Promise<Object|null>} Información del tenant
   */
  static async getTenant(tenantCode) {
    try {
      const result = await query(`
        SELECT 
          id, tenant_code, company_name, contact_person, email, phone,
          address, city, state, plan, max_users, max_products, active,
          created_at, updated_at,
          CONCAT('tenant_', tenant_code) as schema_name
        FROM public.tenants 
        WHERE tenant_code = $1 AND active = true
      `, [tenantCode]);

      return result.rows[0] || null;

    } catch (error) {
      console.error('💥 Error obteniendo tenant:', error.message);
      throw new Error(`Error obteniendo tenant: ${error.message}`);
    }
  }

  /**
   * Listar todos los tenants
   * @returns {Promise<Array>} Lista de tenants
   */
  static async getAllTenants() {
    try {
      const result = await query(`
        SELECT 
          id, tenant_code, company_name, contact_person, email, phone,
          city, state, plan, max_users, max_products, active,
          created_at, updated_at,
          CONCAT('tenant_', tenant_code) as schema_name
        FROM public.tenants 
        ORDER BY created_at DESC
      `);

      return result.rows;

    } catch (error) {
      console.error('💥 Error obteniendo tenants:', error.message);
      throw new Error(`Error obteniendo tenants: ${error.message}`);
    }
  }

  /**
   * Obtener estadísticas de un tenant
   * @param {string} tenantCode - Código del tenant
   * @returns {Promise<Object>} Estadísticas del tenant
   */
  static async getTenantStats(tenantCode) {
    try {
      const tenant = await this.getTenant(tenantCode);
      if (!tenant) {
        throw new Error(`Tenant ${tenantCode} no encontrado`);
      }

      const schemaName = tenant.schema_name;

      const statsResult = await query(`
        SELECT 
          (SELECT COUNT(*) FROM "${schemaName}".products WHERE active = true) as total_products,
          (SELECT COUNT(*) FROM "${schemaName}".clients WHERE active = true) as total_clients,
          (SELECT COUNT(*) FROM "${schemaName}".sales) as total_sales,
          (SELECT COUNT(*) FROM "${schemaName}".insights WHERE is_active = true) as active_insights,
          (SELECT ROUND(SUM(current_stock * cost_price), 2) FROM "${schemaName}".products WHERE active = true) as inventory_value,
          (SELECT ROUND(SUM(total_amount), 2) FROM "${schemaName}".sales WHERE payment_status = 'pagado') as total_revenue
      `);

      const stats = statsResult.rows[0];

      return {
        tenant_info: tenant,
        usage_stats: {
          ...stats,
          products_usage: `${stats.total_products}/${tenant.max_products}`,
          storage_usage: await this.getSchemaSize(schemaName)
        }
      };

    } catch (error) {
      console.error('💥 Error obteniendo estadísticas del tenant:', error.message);
      throw new Error(`Error obteniendo estadísticas: ${error.message}`);
    }
  }

  /**
   * Obtener el tamaño de un schema
   * @param {string} schemaName - Nombre del schema
   * @returns {Promise<string>} Tamaño del schema
   */
  static async getSchemaSize(schemaName) {
    try {
      const result = await query(`
        SELECT 
          pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||tablename))) as schema_size
        FROM pg_tables 
        WHERE schemaname = $1
      `, [schemaName]);

      return result.rows[0]?.schema_size || '0 bytes';

    } catch (error) {
      console.error('💥 Error obteniendo tamaño del schema:', error.message);
      return 'N/A';
    }
  }

  /**
   * Desactivar un tenant (soft delete)
   * @param {string} tenantCode - Código del tenant
   * @returns {Promise<boolean>} True si se desactivó exitosamente
   */
  static async deactivateTenant(tenantCode) {
    try {
      const result = await query(`
        UPDATE public.tenants 
        SET active = false, updated_at = CURRENT_TIMESTAMP
        WHERE tenant_code = $1
        RETURNING id
      `, [tenantCode]);

      if (result.rowCount > 0) {
        console.log(`✅ Tenant ${tenantCode} desactivado exitosamente`);
        return true;
      }

      return false;

    } catch (error) {
      console.error('💥 Error desactivando tenant:', error.message);
      throw new Error(`Error desactivando tenant: ${error.message}`);
    }
  }

  /**
   * Eliminar completamente un tenant y su schema (PELIGROSO)
   * @param {string} tenantCode - Código del tenant
   * @param {boolean} confirmDelete - Confirmación explícita
   * @returns {Promise<boolean>} True si se eliminó exitosamente
   */
  static async deleteTenant(tenantCode, confirmDelete = false) {
    if (!confirmDelete) {
      throw new Error('Debe confirmar explícitamente la eliminación del tenant');
    }

    const client = await query('BEGIN');
    
    try {
      const tenant = await this.getTenant(tenantCode);
      if (!tenant) {
        throw new Error(`Tenant ${tenantCode} no encontrado`);
      }

      const schemaName = tenant.schema_name;

      // Eliminar schema completo
      await query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);

      // Eliminar registro del tenant
      await query('DELETE FROM public.tenants WHERE tenant_code = $1', [tenantCode]);

      await query('COMMIT');

      console.log(`⚠️ Tenant ${tenantCode} y schema ${schemaName} eliminados PERMANENTEMENTE`);
      return true;

    } catch (error) {
      await query('ROLLBACK');
      console.error('💥 Error eliminando tenant:', error.message);
      throw new Error(`Error eliminando tenant: ${error.message}`);
    }
  }

  /**
   * Migrar tenant existente a nueva versión de schema
   * @param {string} tenantCode - Código del tenant
   * @returns {Promise<boolean>} True si se migró exitosamente
   */
  static async migrateTenant(tenantCode) {
    try {
      const tenant = await this.getTenant(tenantCode);
      if (!tenant) {
        throw new Error(`Tenant ${tenantCode} no encontrado`);
      }

      const schemaName = tenant.schema_name;

      // Aquí puedes agregar lógica de migración específica
      // Por ejemplo, añadir nuevas columnas, índices, etc.
      
      console.log(`✅ Tenant ${tenantCode} migrado exitosamente`);
      return true;

    } catch (error) {
      console.error('💥 Error migrando tenant:', error.message);
      throw new Error(`Error migrando tenant: ${error.message}`);
    }
  }

  /**
   * Validar que un schema de tenant existe
   * @param {string} schemaName - Nombre del schema
   * @returns {Promise<boolean>} True si existe
   */
  static async schemaExists(schemaName) {
    try {
      const result = await query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.schemata 
          WHERE schema_name = $1
        ) as exists
      `, [schemaName]);

      return result.rows[0].exists;

    } catch (error) {
      console.error('💥 Error verificando schema:', error.message);
      return false;
    }
  }

  /**
   * Obtener el contexto de tenant desde una request
   * @param {Object} req - Request object
   * @returns {Promise<Object>} Información del tenant
   */
  static async getTenantFromRequest(req) {
    try {
      // Obtener tenant_code desde headers, subdomain, o parámetro
      let tenantCode = null;

      // Opción 1: Header personalizado
      if (req.headers['x-tenant']) {
        tenantCode = req.headers['x-tenant'];
      }
      // Opción 2: Subdominio
      else if (req.hostname && req.hostname !== 'localhost') {
        const subdomain = req.hostname.split('.')[0];
        if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
          tenantCode = subdomain;
        }
      }
      // Opción 3: Parámetro en la URL
      else if (req.params.tenantCode) {
        tenantCode = req.params.tenantCode;
      }
      // Opción 4: Query parameter
      else if (req.query.tenant) {
        tenantCode = req.query.tenant;
      }

      if (!tenantCode) {
        throw new Error('Tenant code no proporcionado');
      }

      const tenant = await this.getTenant(tenantCode);
      if (!tenant) {
        throw new Error(`Tenant ${tenantCode} no encontrado o inactivo`);
      }

      return tenant;

    } catch (error) {
      console.error('💥 Error obteniendo tenant desde request:', error.message);
      throw error;
    }
  }
}

module.exports = TenantService;