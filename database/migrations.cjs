// =====================================================================================
// FLUXION AI - DATABASE MIGRATIONS SYSTEM
// Sistema de migraciones para PostgreSQL con control de versiones
// =====================================================================================

const fs = require('fs').promises;
const path = require('path');
const { query, testConnection } = require('../config/database.cjs');

/**
 * Tabla de control de migraciones
 */
const MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(255) UNIQUE NOT NULL,
    filename VARCHAR(255) NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INTEGER,
    checksum VARCHAR(64)
  );
`;

/**
 * Crear tabla de control de migraciones si no existe
 */
async function ensureMigrationsTable() {
  try {
    await query(MIGRATIONS_TABLE);
    console.log('✅ Tabla de migraciones verificada/creada');
    return true;
  } catch (error) {
    console.error('💥 Error creando tabla de migraciones:', error.message);
    throw error;
  }
}

/**
 * Obtener migraciones ya ejecutadas
 * @returns {Promise<Array>} Lista de versiones ejecutadas
 */
async function getExecutedMigrations() {
  try {
    const result = await query('SELECT version FROM schema_migrations ORDER BY executed_at');
    return result.rows.map(row => row.version);
  } catch (error) {
    console.error('💥 Error obteniendo migraciones ejecutadas:', error.message);
    throw error;
  }
}

/**
 * Registrar migración ejecutada
 * @param {string} version - Versión de la migración
 * @param {string} filename - Nombre del archivo
 * @param {number} executionTime - Tiempo de ejecución en ms
 */
async function recordMigration(version, filename, executionTime) {
  try {
    await query(
      'INSERT INTO schema_migrations (version, filename, execution_time_ms) VALUES ($1, $2, $3)',
      [version, filename, executionTime]
    );
  } catch (error) {
    console.error('💥 Error registrando migración:', error.message);
    throw error;
  }
}

/**
 * Ejecutar el schema inicial de la base de datos
 * @returns {Promise<boolean>} True si la ejecución fue exitosa
 */
async function runInitialSchema() {
  console.log('🚀 Ejecutando schema inicial de PostgreSQL...');
  
  try {
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schemaContent = await fs.readFile(schemaPath, 'utf-8');
    
    const startTime = Date.now();
    
    // Ejecutar el schema completo
    await query(schemaContent);
    
    const executionTime = Date.now() - startTime;
    
    // Registrar como migración inicial
    await recordMigration('001_initial_schema', 'schema.sql', executionTime);
    
    console.log(`✅ Schema inicial ejecutado exitosamente en ${executionTime}ms`);
    return true;
    
  } catch (error) {
    console.error('💥 Error ejecutando schema inicial:', error.message);
    throw error;
  }
}

/**
 * Ejecutar los datos semilla en la base de datos
 * @returns {Promise<boolean>} True si la ejecución fue exitosa
 */
async function runInitialSeeds() {
  console.log('🌱 Ejecutando datos semilla...');
  
  try {
    const seedsPath = path.join(__dirname, '../../database/seeds.sql');
    const seedsContent = await fs.readFile(seedsPath, 'utf-8');
    
    const startTime = Date.now();
    
    // Ejecutar los seeds
    await query(seedsContent);
    
    const executionTime = Date.now() - startTime;
    
    // Registrar como migración de seeds
    await recordMigration('002_initial_seeds', 'seeds.sql', executionTime);
    
    console.log(`✅ Datos semilla ejecutados exitosamente en ${executionTime}ms`);
    return true;
    
  } catch (error) {
    console.error('💥 Error ejecutando datos semilla:', error.message);
    throw error;
  }
}

/**
 * Verificar si la base de datos está inicializada
 * @returns {Promise<boolean>} True si ya está inicializada
 */
async function isDatabaseInitialized() {
  try {
    // Verificar si existe la tabla products (indicador de schema inicializado)
    const result = await query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'products'
      ) as exists
    `);
    
    return result.rows[0].exists;
  } catch (error) {
    console.error('💥 Error verificando inicialización:', error.message);
    return false;
  }
}

/**
 * Obtener estadísticas de la base de datos
 * @returns {Promise<Object>} Estadísticas de tablas y registros
 */
async function getDatabaseStats() {
  try {
    const tablesQuery = `
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    `;
    
    const tables = await query(tablesQuery);
    
    // Contar registros en tablas principales
    const counts = {};
    const mainTables = ['products', 'clients', 'sales', 'insights', 'system_config'];
    
    for (const table of mainTables) {
      try {
        const countResult = await query(`SELECT COUNT(*) as count FROM ${table}`);
        counts[table] = parseInt(countResult.rows[0].count);
      } catch (err) {
        counts[table] = 0;
      }
    }
    
    return {
      tables: tables.rows,
      recordCounts: counts,
      totalTables: tables.rows.length
    };
  } catch (error) {
    console.error('💥 Error obteniendo estadísticas:', error.message);
    throw error;
  }
}

/**
 * Función principal para inicializar la base de datos
 * @param {boolean} forceReset - Si true, resetea la base de datos
 * @returns {Promise<boolean>} True si la inicialización fue exitosa
 */
async function initializeDatabase(forceReset = false) {
  console.log('🗄️ Inicializando base de datos PostgreSQL para Fluxion AI...');
  
  try {
    // Verificar conexión
    const connectionOk = await testConnection();
    if (!connectionOk) {
      throw new Error('No se pudo establecer conexión con PostgreSQL');
    }
    
    // Crear tabla de migraciones
    await ensureMigrationsTable();
    
    // Verificar si ya está inicializada
    const isInitialized = await isDatabaseInitialized();
    const executedMigrations = await getExecutedMigrations();
    
    console.log(`📊 Estado actual: ${executedMigrations.length} migraciones ejecutadas`);
    
    if (forceReset || !isInitialized) {
      console.log('🔄 Inicializando/Reseteando base de datos...');
      
      // Ejecutar schema inicial
      if (!executedMigrations.includes('001_initial_schema')) {
        await runInitialSchema();
      } else {
        console.log('⏭️ Schema inicial ya ejecutado, saltando...');
      }
      
      // Ejecutar datos semilla
      if (!executedMigrations.includes('002_initial_seeds')) {
        await runInitialSeeds();
      } else {
        console.log('⏭️ Datos semilla ya ejecutados, saltando...');
      }
    } else {
      console.log('✅ Base de datos ya inicializada');
    }
    
    // Mostrar estadísticas finales
    const stats = await getDatabaseStats();
    console.log('\n📈 Estadísticas de la base de datos:');
    console.log('  📊 Tablas totales:', stats.totalTables);
    console.log('  📝 Registros por tabla:');
    Object.entries(stats.recordCounts).forEach(([table, count]) => {
      console.log(`    - ${table}: ${count} registros`);
    });
    
    console.log('\n🎉 Base de datos inicializada exitosamente');
    console.log('🔗 Lista para conectar desde DataGrip');
    console.log('📡 APIs listas para usar datos reales');
    
    return true;
    
  } catch (error) {
    console.error('💥 Error inicializando base de datos:', error.message);
    throw error;
  }
}

/**
 * Función para resetear completamente la base de datos
 * ⚠️ CUIDADO: Esto eliminará todos los datos
 */
async function resetDatabase() {
  console.log('⚠️ RESETEANDO BASE DE DATOS - TODOS LOS DATOS SERÁN ELIMINADOS');
  
  try {
    // Eliminar todas las tablas del schema público
    const dropTablesQuery = `
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT ALL ON SCHEMA public TO public;
    `;
    
    await query(dropTablesQuery);
    console.log('🧹 Todas las tablas eliminadas');
    
    // Reinicializar desde cero
    await initializeDatabase(true);
    
  } catch (error) {
    console.error('💥 Error reseteando base de datos:', error.message);
    throw error;
  }
}

module.exports = {
  initializeDatabase,
  resetDatabase,
  getDatabaseStats,
  isDatabaseInitialized,
  getExecutedMigrations,
  ensureMigrationsTable
};