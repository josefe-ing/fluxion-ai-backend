/**
 * FLUXION AI - DEMO API SERVER
 * Simple proactive insights demo for "la granja"
 */

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

app.use(cors());
app.use(express.json());

// =====================================================================================
// IN-MEMORY STORAGE
// =====================================================================================

const insights = [];
const sseClients = [];

// =====================================================================================
// DEMO DATA GENERATORS
// =====================================================================================

function generateStockoutAlert() {
  return {
    id: uuidv4(),
    triggeredBy: 'inventory-monitor',
    timestamp: new Date().toISOString(),
    type: 'warning',
    priority: 'critical',
    title: 'Stock Crítico: Savoy Tango 130g',
    description: 'Solo quedan 2 cajas en inventario. 15 clientes han solicitado este producto en los últimos 3 días.',
    recommendation: 'Realizar pedido urgente de 500 cajas al proveedor. Considerar transferencia desde tienda Barquisimeto (50 cajas disponibles).',
    businessImpact: 'Pérdida potencial de Bs. 45,000 en ventas. 8 clientes VIP afectados.',
    confidence: 0.95,
    channels: ['whatsapp', 'dashboard', 'email'],
    status: 'generated',
    data: {
      product: 'Savoy Tango 130g',
      currentStock: 2,
      demandNext7Days: 85,
      supplier: 'Nestlé Venezuela',
      leadTime: '3-5 días'
    }
  };
}

function generateSeasonalOpportunity() {
  return {
    id: uuidv4(),
    triggeredBy: 'seasonal-analyzer',
    timestamp: new Date().toISOString(),
    type: 'opportunity',
    priority: 'high',
    title: 'Oportunidad Temporal: Halloween',
    description: 'Halloween en 5 días. Demanda de chocolates aumentará 280% basado en años anteriores.',
    recommendation: 'Preparar display especial con Kit-Kat, Snickers, M&Ms. Ofrecer combos promocionales a tiendas.',
    businessImpact: 'Ingreso adicional potencial de Bs. 180,000. Oportunidad de captar 12 nuevos clientes.',
    confidence: 0.88,
    channels: ['whatsapp', 'dashboard'],
    status: 'generated',
    data: {
      event: 'Halloween',
      daysUntil: 5,
      demandIncrease: '280%',
      topProducts: ['Kit-Kat', 'Snickers', 'M&Ms'],
      targetClients: 45
    }
  };
}

function generateClientRisk() {
  return {
    id: uuidv4(),
    triggeredBy: 'client-monitor',
    timestamp: new Date().toISOString(),
    type: 'warning',
    priority: 'high',
    title: 'Cliente en Riesgo: Distribuidora Zulia',
    description: 'Cliente VIP con 45 días sin pedidos (promedio: 15 días). Facturación mensual promedio: Bs. 125,000.',
    recommendation: 'Llamar hoy mismo. Ofrecer descuento 5% en próximo pedido + envío gratis.',
    businessImpact: 'Riesgo de perder Bs. 1,500,000 anuales. Cliente representa 3.2% de ventas totales.',
    confidence: 0.82,
    channels: ['whatsapp', 'dashboard'],
    status: 'generated',
    data: {
      client: 'Distribuidora Zulia C.A.',
      lastOrder: '2024-09-10',
      averageOrderValue: 125000,
      yearlyValue: 1500000,
      riskLevel: 'high'
    }
  };
}

function generateTransferRecommendation() {
  return {
    id: uuidv4(),
    triggeredBy: 'inventory-optimizer',
    timestamp: new Date().toISOString(),
    type: 'recommendation',
    priority: 'medium',
    title: 'Optimización: Transferencia entre Tiendas',
    description: 'Exceso de Harina PAN en Valencia (800 paquetes) y falta en Caracas (demanda: 300).',
    recommendation: 'Transferir 350 paquetes de Valencia a Caracas hoy. Costo: Bs. 1,200, ROI: Bs. 15,000.',
    businessImpact: 'Evitar pérdida de Bs. 45,000 en ventas Caracas. Reducir costo almacenaje Valencia.',
    confidence: 0.91,
    channels: ['dashboard'],
    status: 'generated',
    data: {
      product: 'Harina PAN 1kg',
      fromStore: 'Valencia',
      toStore: 'Caracas',
      quantity: 350,
      transferCost: 1200,
      expectedROI: 15000
    }
  };
}

function generatePriceAlert() {
  return {
    id: uuidv4(),
    triggeredBy: 'market-monitor',
    timestamp: new Date().toISOString(),
    type: 'info',
    priority: 'medium',
    title: 'Cambio de Precio: Aceite Mazeite',
    description: 'Proveedor aumentó precio 15%. Competencia mantiene precios anteriores.',
    recommendation: 'Negociar con proveedor alternativo (Oleica). Ajustar precio venta solo si margen < 18%.',
    businessImpact: 'Margen reducido de 22% a 18.7%. Impacto mensual: -Bs. 28,000.',
    confidence: 0.78,
    channels: ['email', 'dashboard'],
    status: 'generated',
    data: {
      product: 'Aceite Mazeite 1L',
      priceIncrease: '15%',
      currentMargin: '18.7%',
      competitor: 'Oleica',
      monthlyImpact: -28000
    }
  };
}

// =====================================================================================
// STATS CALCULATION
// =====================================================================================

function calculateStats() {
  const byPriority = {
    critical: insights.filter(i => i.priority === 'critical').length,
    high: insights.filter(i => i.priority === 'high').length,
    medium: insights.filter(i => i.priority === 'medium').length,
    low: insights.filter(i => i.priority === 'low').length
  };

  const averageConfidence = insights.length > 0
    ? insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length
    : 0;

  const mostRecentUpdate = insights.length > 0 
    ? insights[0].timestamp 
    : null;

  return {
    total: insights.length,
    byPriority,
    averageConfidence,
    mostRecentUpdate
  };
}

// =====================================================================================
// SSE HELPERS
// =====================================================================================

function sendSSEToAll(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    client.res.write(message);
  });
}

function addInsight(insight) {
  insights.unshift(insight);
  if (insights.length > 100) {
    insights.pop();
  }
  
  sendSSEToAll({
    type: 'insight',
    data: insight
  });
}

// =====================================================================================
// API ROUTES
// =====================================================================================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'fluxion-demo-api',
    timestamp: new Date().toISOString()
  });
});

// Get recent insights
app.get('/api/insights/recent', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const priority = req.query.priority;
  
  let filtered = insights;
  if (priority) {
    filtered = insights.filter(i => i.priority === priority);
  }
  
  res.json({
    success: true,
    data: {
      insights: filtered.slice(0, limit),
      total: filtered.length
    }
  });
});

// Get stats
app.get('/api/insights/stats', (req, res) => {
  res.json({
    success: true,
    data: calculateStats()
  });
});

// SSE stream endpoint
app.get('/api/insights/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const clientId = uuidv4();
  const client = { id: clientId, res };
  sseClients.push(client);
  
  // Send initial connection message
  res.write('data: {"type":"connected","message":"Connected to insights stream"}\n\n');
  
  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write('data: {"type":"ping"}\n\n');
  }, 30000);
  
  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(keepAlive);
    const index = sseClients.findIndex(c => c.id === clientId);
    if (index !== -1) {
      sseClients.splice(index, 1);
    }
  });
});

// Demo triggers
app.get('/api/insights/demo/inventory-sync', (req, res) => {
  setTimeout(() => {
    addInsight(generateStockoutAlert());
  }, 1000);
  
  setTimeout(() => {
    addInsight(generateTransferRecommendation());
  }, 3000);
  
  res.json({
    success: true,
    message: 'Inventory sync triggered - insights will appear in 1-3 seconds'
  });
});

app.get('/api/insights/demo/sales-spike', (req, res) => {
  setTimeout(() => {
    addInsight(generateSeasonalOpportunity());
  }, 1000);
  
  setTimeout(() => {
    addInsight(generateClientRisk());
  }, 2500);
  
  setTimeout(() => {
    addInsight(generatePriceAlert());
  }, 4000);
  
  res.json({
    success: true,
    message: 'Sales spike analysis triggered - insights will appear in 1-4 seconds'
  });
});

// Generate initial demo insights
app.post('/api/insights/generate-initial', (req, res) => {
  // Clear existing
  insights.length = 0;
  
  // Add varied insights
  addInsight(generateStockoutAlert());
  addInsight(generateSeasonalOpportunity());
  addInsight(generateClientRisk());
  addInsight(generateTransferRecommendation());
  addInsight(generatePriceAlert());
  
  res.json({
    success: true,
    message: 'Initial insights generated',
    count: insights.length
  });
});

// =====================================================================================
// ERROR HANDLING
// =====================================================================================

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// =====================================================================================
// SERVER STARTUP
// =====================================================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║                 FLUXION AI DEMO API                    ║
╠════════════════════════════════════════════════════════╣
║  Status:     ✅ Running                                ║
║  Port:       ${PORT}                                      ║
║  Health:     http://localhost:${PORT}/health              ║
║  SSE:        http://localhost:${PORT}/api/insights/stream ║
╠════════════════════════════════════════════════════════╣
║  Demo Triggers:                                        ║
║  • /api/insights/demo/inventory-sync                  ║
║  • /api/insights/demo/sales-spike                     ║
╚════════════════════════════════════════════════════════╝
  `);
  
  // Generate some initial insights for demo
  setTimeout(() => {
    console.log('📊 Generating initial demo insights...');
    addInsight(generateStockoutAlert());
    setTimeout(() => addInsight(generateSeasonalOpportunity()), 2000);
    setTimeout(() => addInsight(generateClientRisk()), 4000);
  }, 2000);
});

module.exports = app;