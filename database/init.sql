-- =====================================================================================
-- FLUXION AI DATABASE SCHEMA
-- Base de datos para el sistema de insights proactivos y analytics
-- =====================================================================================

-- Tabla de productos
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    brand VARCHAR(100),
    cost_price DECIMAL(10,2),
    selling_price DECIMAL(10,2),
    current_stock INTEGER DEFAULT 0,
    min_stock_threshold INTEGER DEFAULT 10,
    max_stock_threshold INTEGER DEFAULT 1000,
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de clientes
CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_code VARCHAR(50) UNIQUE NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    whatsapp VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    client_type ENUM('mayorista', 'detallista', 'corporativo') DEFAULT 'mayorista',
    credit_limit DECIMAL(12,2) DEFAULT 0,
    payment_terms INTEGER DEFAULT 30, -- días
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de ventas
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_number VARCHAR(100) UNIQUE NOT NULL,
    client_id INTEGER NOT NULL,
    sale_date DATETIME NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    payment_status ENUM('pendiente', 'parcial', 'pagado', 'vencido') DEFAULT 'pendiente',
    payment_method VARCHAR(50),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- Tabla de detalles de ventas
CREATE TABLE IF NOT EXISTS sale_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Tabla de movimientos de inventario
CREATE TABLE IF NOT EXISTS inventory_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    movement_type ENUM('entrada', 'salida', 'ajuste', 'sincronizacion') NOT NULL,
    quantity INTEGER NOT NULL, -- positivo para entrada, negativo para salida
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    cost_per_unit DECIMAL(10,2),
    reference_type ENUM('venta', 'compra', 'ajuste', 'sync') NOT NULL,
    reference_id INTEGER, -- ID de la venta, compra, etc.
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Tabla de insights proactivos
CREATE TABLE IF NOT EXISTS insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    insight_id VARCHAR(100) UNIQUE NOT NULL,
    triggered_by VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'insight', 'opportunity', 'alert', 'recommendation'
    priority ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    recommendation TEXT,
    business_impact TEXT,
    confidence DECIMAL(3,2) NOT NULL, -- 0.00 to 1.00
    channels TEXT, -- JSON array de canales ['dashboard', 'whatsapp', 'email']
    status ENUM('generated', 'sent', 'read', 'acted', 'dismissed') DEFAULT 'generated',
    data TEXT, -- JSON con data específica del insight
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de analytics agregados
CREATE TABLE IF NOT EXISTS analytics_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    analysis_type VARCHAR(100) NOT NULL, -- 'top_products', 'time_patterns', 'revenue_trends'
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    data TEXT NOT NULL, -- JSON con resultados del análisis
    metadata TEXT, -- JSON con metadatos del análisis
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de configuraciones del sistema
CREATE TABLE IF NOT EXISTS system_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- =====================================================================================

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);

CREATE INDEX IF NOT EXISTS idx_clients_code ON clients(client_code);
CREATE INDEX IF NOT EXISTS idx_clients_type ON clients(client_type);
CREATE INDEX IF NOT EXISTS idx_clients_active ON clients(active);

CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_client ON sales(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(payment_status);

CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_type ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inventory_date ON inventory_movements(created_at);

CREATE INDEX IF NOT EXISTS idx_insights_type ON insights(type);
CREATE INDEX IF NOT EXISTS idx_insights_priority ON insights(priority);
CREATE INDEX IF NOT EXISTS idx_insights_status ON insights(status);
CREATE INDEX IF NOT EXISTS idx_insights_created ON insights(created_at);

-- =====================================================================================
-- DATOS INICIALES PARA DEMO
-- =====================================================================================

-- Insertar productos básicos venezolanos
INSERT OR IGNORE INTO products (sku, name, category, brand, cost_price, selling_price, current_stock, min_stock_threshold) VALUES
('HARINA-PAN-1KG', 'Harina P.A.N. Blanca 1kg', 'Productos Básicos', 'P.A.N.', 6.50, 8.50, 48, 20),
('LECHE-SANTA-1L', 'Leche Santa Bárbara Completa 1L', 'Lácteos', 'Santa Bárbara', 9.00, 12.00, 24, 15),
('ARROZ-DIANA-1KG', 'Arroz Diana Premium 1kg', 'Productos Básicos', 'Diana', 4.20, 6.00, 85, 25),
('ACEITE-DIANA-1L', 'Aceite Diana Girasol 1L', 'Aceites', 'Diana', 8.80, 11.50, 32, 18),
('PASTA-PRIMOR-500G', 'Pasta Primor Espagueti 500g', 'Pastas', 'Primor', 2.30, 3.50, 120, 30),
('AZUCAR-SANTA-1KG', 'Azúcar Santa Bárbara Refinada 1kg', 'Productos Básicos', 'Santa Bárbara', 3.80, 5.20, 95, 40),
('CAFE-FAMA-500G', 'Café Fama de América 500g', 'Bebidas', 'Fama', 12.50, 16.80, 28, 15),
('MAYONESA-KRAFT-500G', 'Mayonesa Kraft Original 500g', 'Salsas', 'Kraft', 7.20, 9.50, 45, 20),
('SARDINAS-MARGARITA', 'Sardinas en Aceite Margarita', 'Enlatados', 'Margarita', 4.80, 6.50, 72, 25),
('DETERGENTE-ACE-1KG', 'Detergente en Polvo Ace 1kg', 'Limpieza', 'P&G', 8.90, 12.00, 38, 15);

-- Insertar clientes de ejemplo
INSERT OR IGNORE INTO clients (client_code, business_name, contact_person, email, phone, whatsapp, city, state, client_type, credit_limit) VALUES
('CLI001', 'Supermercado El Ahorro C.A.', 'María González', 'compras@elahorro.com.ve', '0241-8234567', '584128234567', 'Valencia', 'Carabobo', 'mayorista', 50000.00),
('CLI002', 'Distribuidora Los Andes', 'Carlos Pérez', 'gerencia@losandes.ve', '0274-2567890', '584142567890', 'Mérida', 'Mérida', 'mayorista', 75000.00),
('CLI003', 'Bodega Mi Pueblo', 'Ana Rodríguez', 'anamipueblo@gmail.com', '0212-9876543', '584129876543', 'Caracas', 'Miranda', 'detallista', 15000.00),
('CLI004', 'Comercializadora Oriente', 'Luis Hernández', 'luis@comoriente.com', '0281-4561237', '584164561237', 'Puerto La Cruz', 'Anzoátegui', 'mayorista', 85000.00),
('CLI005', 'Minimarket La Esquina', 'Rosa Martínez', 'rosaesquina@hotmail.com', '0251-7894561', '584257894561', 'Barquisimeto', 'Lara', 'detallista', 12000.00);

-- Configuraciones del sistema
INSERT OR IGNORE INTO system_config (config_key, config_value, description) VALUES
('auto_insights_enabled', 'true', 'Habilitar generación automática de insights'),
('min_stock_alert_threshold', '10', 'Umbral mínimo para alertas de stock'),
('sales_spike_threshold', '150', 'Porcentaje de incremento para detectar picos de ventas'),
('insight_retention_days', '90', 'Días para mantener insights en la base de datos'),
('api_rate_limit', '1000', 'Límite de requests por hora por IP'),
('whatsapp_notifications', 'true', 'Habilitar notificaciones por WhatsApp'),
('email_notifications', 'true', 'Habilitar notificaciones por email');