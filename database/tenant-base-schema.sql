-- =====================================================================================
-- FLUXION AI - TENANT BASE SCHEMA (BUSINESS TABLES)
-- Schema básico que se crea para cada tenant (sin triggers para evitar conflictos)
-- =====================================================================================

-- Tabla de productos
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    brand VARCHAR(100),
    cost_price DECIMAL(15,2) DEFAULT 0,
    selling_price DECIMAL(15,2) NOT NULL,
    current_stock INTEGER DEFAULT 0,
    min_stock_threshold INTEGER DEFAULT 10,
    max_stock_threshold INTEGER DEFAULT 1000,
    unit_of_measure VARCHAR(50) DEFAULT 'unidad',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de clientes
CREATE TABLE clients (
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
    client_type VARCHAR(50) DEFAULT 'mayorista',
    tax_id VARCHAR(50),
    credit_limit DECIMAL(15,2) DEFAULT 0,
    payment_terms INTEGER DEFAULT 30,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de ventas
CREATE TABLE sales (
    id SERIAL PRIMARY KEY,
    sale_number VARCHAR(100) UNIQUE NOT NULL,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    sale_date DATE NOT NULL,
    due_date DATE,
    subtotal DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'pending',
    payment_method VARCHAR(50),
    notes TEXT,
    cancelled BOOLEAN DEFAULT false,
    cancelled_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de detalles de ventas
CREATE TABLE sale_details (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    line_total DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de movimientos de inventario
CREATE TABLE inventory_movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    movement_type VARCHAR(50) NOT NULL, -- 'entrada', 'salida', 'ajuste', 'transferencia'
    quantity INTEGER NOT NULL, -- positivo para entradas, negativo para salidas
    cost_price DECIMAL(15,2),
    reference_type VARCHAR(50), -- 'compra', 'venta', 'ajuste', 'inicial'
    reference_id INTEGER, -- ID de la venta, compra, etc.
    notes TEXT,
    movement_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de insights proactivos
CREATE TABLE insights (
    id SERIAL PRIMARY KEY,
    insight_id VARCHAR(100) UNIQUE NOT NULL,
    triggered_by VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'inventory', 'sales', 'client', 'opportunity'
    priority VARCHAR(50) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    recommendation TEXT NOT NULL,
    business_impact TEXT,
    confidence DECIMAL(3,2) DEFAULT 0.80,
    channels JSONB DEFAULT '[]', -- ['dashboard', 'whatsapp', 'email']
    status VARCHAR(50) DEFAULT 'generated', -- 'generated', 'sent', 'read', 'acted', 'dismissed'
    data JSONB DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejor performance
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_active ON products(active);

CREATE INDEX idx_clients_client_code ON clients(client_code);
CREATE INDEX idx_clients_active ON clients(active);

CREATE INDEX idx_sales_sale_number ON sales(sale_number);
CREATE INDEX idx_sales_client_id ON sales(client_id);
CREATE INDEX idx_sales_date ON sales(sale_date);
CREATE INDEX idx_sales_payment_status ON sales(payment_status);

CREATE INDEX idx_sale_details_sale_id ON sale_details(sale_id);
CREATE INDEX idx_sale_details_product_id ON sale_details(product_id);

CREATE INDEX idx_inventory_product_id ON inventory_movements(product_id);
CREATE INDEX idx_inventory_movement_type ON inventory_movements(movement_type);
CREATE INDEX idx_inventory_movement_date ON inventory_movements(movement_date);

CREATE INDEX idx_insights_type ON insights(type);
CREATE INDEX idx_insights_priority ON insights(priority);
CREATE INDEX idx_insights_status ON insights(status);
CREATE INDEX idx_insights_expires_at ON insights(expires_at);

-- Comentarios descriptivos
COMMENT ON TABLE products IS 'Catálogo de productos del tenant';
COMMENT ON TABLE clients IS 'Base de clientes del tenant';
COMMENT ON TABLE sales IS 'Registro de ventas del tenant';
COMMENT ON TABLE sale_details IS 'Detalles línea por línea de cada venta';
COMMENT ON TABLE inventory_movements IS 'Historial de movimientos de inventario';
COMMENT ON TABLE insights IS 'Insights proactivos generados automáticamente';