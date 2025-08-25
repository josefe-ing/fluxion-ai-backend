-- =====================================================================================
-- FLUXION AI POSTGRESQL DATABASE SCHEMA
-- Base de datos PostgreSQL para el sistema de insights proactivos y analytics
-- =====================================================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tipos ENUM personalizados
CREATE TYPE client_type_enum AS ENUM ('mayorista', 'detallista', 'corporativo');
CREATE TYPE payment_status_enum AS ENUM ('pendiente', 'parcial', 'pagado', 'vencido');
CREATE TYPE movement_type_enum AS ENUM ('entrada', 'salida', 'ajuste', 'sincronizacion');
CREATE TYPE reference_type_enum AS ENUM ('venta', 'compra', 'ajuste', 'sync');
CREATE TYPE insight_priority_enum AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE insight_status_enum AS ENUM ('generated', 'sent', 'read', 'acted', 'dismissed');

-- Tabla de productos
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    brand VARCHAR(100),
    cost_price DECIMAL(10,2),
    selling_price DECIMAL(10,2),
    current_stock INTEGER DEFAULT 0,
    min_stock_threshold INTEGER DEFAULT 10,
    max_stock_threshold INTEGER DEFAULT 1000,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de clientes
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    client_code VARCHAR(50) UNIQUE NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    whatsapp VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    client_type client_type_enum DEFAULT 'mayorista',
    credit_limit DECIMAL(12,2) DEFAULT 0,
    payment_terms INTEGER DEFAULT 30, -- días
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de ventas
CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    sale_number VARCHAR(100) UNIQUE NOT NULL,
    client_id INTEGER NOT NULL,
    sale_date TIMESTAMP WITH TIME ZONE NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    payment_status payment_status_enum DEFAULT 'pendiente',
    payment_method VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- Tabla de detalles de ventas
CREATE TABLE IF NOT EXISTS sale_details (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Tabla de movimientos de inventario
CREATE TABLE IF NOT EXISTS inventory_movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    movement_type movement_type_enum NOT NULL,
    quantity INTEGER NOT NULL, -- positivo para entrada, negativo para salida
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    cost_per_unit DECIMAL(10,2),
    reference_type reference_type_enum NOT NULL,
    reference_id INTEGER, -- ID de la venta, compra, etc.
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Tabla de insights proactivos
CREATE TABLE IF NOT EXISTS insights (
    id SERIAL PRIMARY KEY,
    insight_id VARCHAR(100) UNIQUE NOT NULL,
    triggered_by VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'insight', 'opportunity', 'alert', 'recommendation'
    priority insight_priority_enum NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    recommendation TEXT,
    business_impact TEXT,
    confidence DECIMAL(3,2) NOT NULL, -- 0.00 to 1.00
    channels JSONB, -- JSON array de canales ['dashboard', 'whatsapp', 'email']
    status insight_status_enum DEFAULT 'generated',
    data JSONB, -- JSON con data específica del insight
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de analytics agregados
CREATE TABLE IF NOT EXISTS analytics_summaries (
    id SERIAL PRIMARY KEY,
    analysis_type VARCHAR(100) NOT NULL, -- 'top_products', 'time_patterns', 'revenue_trends'
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    data JSONB NOT NULL, -- JSON con resultados del análisis
    metadata JSONB, -- JSON con metadatos del análisis
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de configuraciones del sistema
CREATE TABLE IF NOT EXISTS system_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================================
-- FUNCIONES DE TRIGGERS PARA ACTUALIZAR updated_at
-- =====================================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers a las tablas que necesiten updated_at automático
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- =====================================================================================

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_current_stock ON products(current_stock);

CREATE INDEX IF NOT EXISTS idx_clients_code ON clients(client_code);
CREATE INDEX IF NOT EXISTS idx_clients_type ON clients(client_type);
CREATE INDEX IF NOT EXISTS idx_clients_active ON clients(active);
CREATE INDEX IF NOT EXISTS idx_clients_city ON clients(city);

CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_client ON sales(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(payment_status);
CREATE INDEX IF NOT EXISTS idx_sales_number ON sales(sale_number);

CREATE INDEX IF NOT EXISTS idx_sale_details_sale ON sale_details(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_details_product ON sale_details(product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_type ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inventory_date ON inventory_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_reference ON inventory_movements(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_insights_type ON insights(type);
CREATE INDEX IF NOT EXISTS idx_insights_priority ON insights(priority);
CREATE INDEX IF NOT EXISTS idx_insights_status ON insights(status);
CREATE INDEX IF NOT EXISTS idx_insights_created ON insights(created_at);
CREATE INDEX IF NOT EXISTS idx_insights_expires ON insights(expires_at);
CREATE INDEX IF NOT EXISTS idx_insights_data ON insights USING GIN(data);

CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_summaries(analysis_type);
CREATE INDEX IF NOT EXISTS idx_analytics_period ON analytics_summaries(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_analytics_data ON analytics_summaries USING GIN(data);

CREATE INDEX IF NOT EXISTS idx_config_key ON system_config(config_key);