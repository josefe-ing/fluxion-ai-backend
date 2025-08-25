#!/usr/bin/env node

// =====================================================================================
// FLUXION AI - DATABASE SETUP SCRIPT
// Script para inicializar la base de datos PostgreSQL desde línea de comandos
// =====================================================================================

require('dotenv').config({ path: '.env.database' });

const { initializeDatabase, resetDatabase, getDatabaseStats } = require('../database/migrations.cjs');
const { testConnection, closePool } = require('../config/database.cjs');

/**
 * Mostrar ayuda del comando
 */
function showHelp() {
  console.log(`
🗄️ Fluxion AI - PostgreSQL Database Setup

Uso: node backend/scripts/setup-database.js [comando]

Comandos disponibles:
  init      Inicializar la base de datos (por defecto)
  reset     Resetear completamente la base de datos ⚠️
  test      Probar la conexión a PostgreSQL
  stats     Mostrar estadísticas de la base de datos
  help      Mostrar esta ayuda

Variables de entorno requeridas (.env.database):
  DB_HOST=localhost
  DB_PORT=5432
  DB_NAME=fluxionai_dev
  DB_USER=postgres
  DB_PASSWORD=postgres

Para DataGrip:
  Host: localhost
  Port: 5432
  Database: fluxionai_dev
  User: postgres
  Password: postgres
  URL: jdbc:postgresql://localhost:5432/fluxionai_dev

Ejemplos:
  node backend/scripts/setup-database.js init
  node backend/scripts/setup-database.js test
  node backend/scripts/setup-database.js stats
`);
}

/**
 * Probar conexión a la base de datos
 */
async function testDatabaseConnection() {
  console.log('🔗 Probando conexión a PostgreSQL...\n');
  
  try {
    const isConnected = await testConnection();
    
    if (isConnected) {
      console.log('\n✅ Conexión exitosa!');
      console.log('📋 Configuración para DataGrip:');
      console.log(`  Host: ${process.env.DB_HOST || 'localhost'}`);
      console.log(`  Port: ${process.env.DB_PORT || '5432'}`);
      console.log(`  Database: ${process.env.DB_NAME || 'fluxionai_dev'}`);
      console.log(`  User: ${process.env.DB_USER || 'postgres'}`);
      console.log(`  Password: ${process.env.DB_PASSWORD || 'postgres'}`);
      console.log(`  URL: jdbc:postgresql://${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'fluxionai_dev'}`);
    } else {
      console.log('\n❌ No se pudo conectar a PostgreSQL');
      console.log('\n🔧 Verifica que:');
      console.log('  1. PostgreSQL esté instalado y ejecutándose');
      console.log('  2. Las credenciales en .env.database sean correctas');
      console.log('  3. La base de datos exista o tengas permisos para crearla');
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Error de conexión:', error.message);
    process.exit(1);
  }
}

/**
 * Mostrar estadísticas de la base de datos
 */
async function showDatabaseStats() {
  console.log('📊 Obteniendo estadísticas de la base de datos...\n');
  
  try {
    const stats = await getDatabaseStats();
    
    console.log('📈 Estadísticas de PostgreSQL:');
    console.log(`  📊 Total de tablas: ${stats.totalTables}`);
    console.log('  📝 Registros por tabla:');
    
    Object.entries(stats.recordCounts).forEach(([table, count]) => {
      console.log(`    - ${table}: ${count.toLocaleString()} registros`);
    });
    
    console.log('\n💾 Tamaños de tablas:');
    stats.tables.forEach(table => {
      console.log(`    - ${table.tablename}: ${table.size}`);
    });
    
  } catch (error) {
    console.error('💥 Error obteniendo estadísticas:', error.message);
    process.exit(1);
  }
}

/**
 * Inicializar la base de datos
 */
async function setupDatabase() {
  console.log('🚀 Inicializando base de datos PostgreSQL para Fluxion AI...\n');
  
  try {
    await initializeDatabase();
    
    console.log('\n🎉 ¡Base de datos lista!');
    console.log('\n📋 Próximos pasos:');
    console.log('  1. Conectar DataGrip con las credenciales mostradas');
    console.log('  2. Ejecutar el servidor backend: npm run backend');
    console.log('  3. Probar las APIs desde Postman');
    
  } catch (error) {
    console.error('💥 Error inicializando base de datos:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n🔧 Solución:');
      console.log('  1. Instala PostgreSQL: brew install postgresql');
      console.log('  2. Inicia el servicio: brew services start postgresql');
      console.log('  3. Crea la base de datos: createdb fluxionai_dev');
    } else if (error.code === '3D000') {
      console.log('\n🔧 Solución:');
      console.log('  1. Crea la base de datos: createdb fluxionai_dev');
    } else if (error.code === '28P01') {
      console.log('\n🔧 Solución:');
      console.log('  1. Verifica el usuario/contraseña en .env.database');
      console.log('  2. O crea el usuario: createuser -s postgres');
    }
    
    process.exit(1);
  }
}

/**
 * Resetear la base de datos
 */
async function resetDatabaseCommand() {
  console.log('⚠️ ADVERTENCIA: Esto eliminará TODOS los datos de la base de datos');
  
  // En un entorno real, aquí pedirías confirmación del usuario
  console.log('🔄 Procediendo con el reset...\n');
  
  try {
    await resetDatabase();
    console.log('\n✅ Base de datos reseteada exitosamente');
  } catch (error) {
    console.error('💥 Error reseteando base de datos:', error.message);
    process.exit(1);
  }
}

/**
 * Función principal
 */
async function main() {
  const command = process.argv[2] || 'init';
  
  try {
    switch (command.toLowerCase()) {
      case 'help':
      case '-h':
      case '--help':
        showHelp();
        break;
        
      case 'test':
        await testDatabaseConnection();
        break;
        
      case 'stats':
        await showDatabaseStats();
        break;
        
      case 'reset':
        await resetDatabaseCommand();
        break;
        
      case 'init':
      default:
        await setupDatabase();
        break;
    }
  } catch (error) {
    console.error('💥 Error ejecutando comando:', error.message);
    process.exit(1);
  } finally {
    // Cerrar conexiones
    await closePool();
    process.exit(0);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  setupDatabase,
  testDatabaseConnection,
  showDatabaseStats,
  resetDatabaseCommand
};