// =====================================================================================
// FLUXION AI - POSTGRESQL DATABASE CONFIGURATION
// Configuración y pool de conexiones para PostgreSQL
// =====================================================================================

const { Pool } = require('pg');

/**
 * Configuración de la base de datos PostgreSQL
 * Variables de entorno con valores por defecto para desarrollo
 */
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'fluxionai_dev',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  
  // Configuración del pool de conexiones
  max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20, // máximo de conexiones
  min: parseInt(process.env.DB_MIN_CONNECTIONS) || 2,  // mínimo de conexiones
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000, // 30 segundos
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 10000, // 10 segundos
  
  // Configuración SSL para producción
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  
  // Configuración adicional
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT) || 30000, // 30 segundos
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT) || 30000, // 30 segundos
};

/**
 * Pool de conexiones PostgreSQL
 * Reutiliza conexiones para mejor performance
 */
const pool = new Pool(dbConfig);

/**
 * Event listeners para el pool de conexiones
 */
pool.on('connect', (client) => {
  console.log('✅ Nueva conexión PostgreSQL establecida:', client.processID);
});

pool.on('acquire', (client) => {
  console.log('🔄 Conexión PostgreSQL adquirida del pool:', client.processID);
});

pool.on('remove', (client) => {
  console.log('❌ Conexión PostgreSQL removida del pool:', client.processID);
});

pool.on('error', (err, client) => {
  console.error('💥 Error inesperado en el pool PostgreSQL:', err);
  process.exit(-1);
});

/**
 * Función para probar la conexión a la base de datos
 * @returns {Promise<boolean>} True si la conexión es exitosa
 */
async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    client.release();
    
    console.log('🔗 Conexión PostgreSQL exitosa:');
    console.log('  📅 Timestamp:', result.rows[0].current_time);
    console.log('  🗄️ Versión:', result.rows[0].pg_version.split(' ')[0]);
    console.log('  🏠 Host:', dbConfig.host);
    console.log('  🚪 Puerto:', dbConfig.port);
    console.log('  📊 Base de datos:', dbConfig.database);
    console.log('  👤 Usuario:', dbConfig.user);
    
    return true;
  } catch (err) {
    console.error('💥 Error de conexión PostgreSQL:');
    console.error('  📍 Host:', dbConfig.host);
    console.error('  🚪 Puerto:', dbConfig.port);
    console.error('  📊 Base de datos:', dbConfig.database);
    console.error('  ❌ Error:', err.message);
    return false;
  }
}

/**
 * Función para ejecutar consultas con manejo de errores
 * @param {string} text - Query SQL
 * @param {Array} params - Parámetros de la consulta
 * @returns {Promise<Object>} Resultado de la consulta
 */
async function query(text, params) {
  const start = Date.now();
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    console.log('🔍 Query ejecutado:', {
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      duration: duration + 'ms',
      rows: result.rowCount
    });
    
    return result;
  } catch (err) {
    const duration = Date.now() - start;
    
    console.error('💥 Error en query:', {
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      duration: duration + 'ms',
      error: err.message
    });
    
    throw err;
  }
}

/**
 * Función para obtener un cliente del pool para transacciones
 * @returns {Promise<Object>} Cliente PostgreSQL
 */
async function getClient() {
  const client = await pool.connect();
  
  const query = client.query;
  const release = client.release;
  
  // Wrapper para logging de queries
  client.query = (...args) => {
    client.lastQuery = args;
    return query.apply(client, args);
  };
  
  // Wrapper para release con logging
  client.release = () => {
    return release.apply(client);
  };
  
  return client;
}

/**
 * Función para cerrar todas las conexiones del pool
 * Útil para shutdown graceful
 */
async function closePool() {
  try {
    await pool.end();
    console.log('🔒 Pool de conexiones PostgreSQL cerrado exitosamente');
  } catch (err) {
    console.error('💥 Error cerrando pool PostgreSQL:', err.message);
  }
}

/**
 * Función para obtener estadísticas del pool
 * @returns {Object} Estadísticas del pool de conexiones
 */
function getPoolStats() {
  return {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingClients: pool.waitingCount,
    maxConnections: pool.options.max,
    minConnections: pool.options.min
  };
}

// Proceso de shutdown graceful
process.on('SIGINT', async () => {
  console.log('🛑 Recibida señal SIGINT, cerrando pool de conexiones...');
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Recibida señal SIGTERM, cerrando pool de conexiones...');
  await closePool();
  process.exit(0);
});

module.exports = {
  pool,
  query,
  getClient,
  testConnection,
  closePool,
  getPoolStats,
  dbConfig
};