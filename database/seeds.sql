-- =====================================================================================
-- FLUXION AI POSTGRESQL DATABASE SEEDS
-- Datos iniciales para demo con contexto venezolano realista
-- =====================================================================================

-- =====================================================================================
-- DATOS INICIALES PARA DEMO
-- =====================================================================================

-- Insertar productos básicos venezolanos
INSERT INTO products (sku, name, category, brand, cost_price, selling_price, current_stock, min_stock_threshold) VALUES
('HARINA-PAN-1KG', 'Harina P.A.N. Blanca 1kg', 'Productos Básicos', 'P.A.N.', 6.50, 8.50, 48, 20),
('LECHE-SANTA-1L', 'Leche Santa Bárbara Completa 1L', 'Lácteos', 'Santa Bárbara', 9.00, 12.00, 24, 15),
('ARROZ-DIANA-1KG', 'Arroz Diana Premium 1kg', 'Productos Básicos', 'Diana', 4.20, 6.00, 85, 25),
('ACEITE-DIANA-1L', 'Aceite Diana Girasol 1L', 'Aceites', 'Diana', 8.80, 11.50, 32, 18),
('PASTA-PRIMOR-500G', 'Pasta Primor Espagueti 500g', 'Pastas', 'Primor', 2.30, 3.50, 120, 30),
('AZUCAR-SANTA-1KG', 'Azúcar Santa Bárbara Refinada 1kg', 'Productos Básicos', 'Santa Bárbara', 3.80, 5.20, 95, 40),
('CAFE-FAMA-500G', 'Café Fama de América 500g', 'Bebidas', 'Fama', 12.50, 16.80, 28, 15),
('MAYONESA-KRAFT-500G', 'Mayonesa Kraft Original 500g', 'Salsas', 'Kraft', 7.20, 9.50, 45, 20),
('SARDINAS-MARGARITA', 'Sardinas en Aceite Margarita', 'Enlatados', 'Margarita', 4.80, 6.50, 72, 25),
('DETERGENTE-ACE-1KG', 'Detergente en Polvo Ace 1kg', 'Limpieza', 'P&G', 8.90, 12.00, 38, 15),
('MALTA-POLAR-330ML', 'Malta Polar 330ml', 'Bebidas', 'Polar', 2.80, 4.20, 150, 50),
('ATUN-MARGARITA-170G', 'Atún en Aceite Margarita 170g', 'Enlatados', 'Margarita', 6.50, 8.80, 95, 30),
('AVENA-QUAKER-500G', 'Avena Quaker Tradicional 500g', 'Cereales', 'Quaker', 5.20, 7.50, 62, 25),
('SALSA-KRAFT-MAYO', 'Salsa de Tomate Kraft 200g', 'Salsas', 'Kraft', 3.60, 5.40, 88, 35),
('PAPEL-SCOTT-4R', 'Papel Higiénico Scott 4 Rollos', 'Higiene', 'Kimberly Clark', 4.90, 7.20, 120, 40),
-- Productos premium/importados
('PRINGLES-ORIGINAL', 'Pringles Papas Original 158g', 'Snacks', 'Pringles', 18.50, 25.00, 45, 15),
('OREO-GALLETAS-154G', 'Galletas Oreo Original 154g', 'Galletas', 'Nabisco', 12.80, 17.50, 68, 20),
('REDBULL-250ML', 'Red Bull Energy Drink 250ml', 'Bebidas Energéticas', 'Red Bull', 22.00, 32.00, 36, 15),
('NUTELLA-350G', 'Nutella Crema de Avellanas 350g', 'Dulces', 'Ferrero', 28.50, 38.00, 24, 10),
('COCA-COLA-600ML', 'Coca Cola 600ml', 'Refrescos', 'Coca Cola', 3.20, 5.50, 200, 60)
ON CONFLICT (sku) DO NOTHING;

-- Insertar clientes mayoristas y detallistas venezolanos
INSERT INTO clients (client_code, business_name, contact_person, email, phone, whatsapp, city, state, client_type, credit_limit) VALUES
('CLI001', 'Supermercado El Ahorro C.A.', 'María González', 'compras@elahorro.com.ve', '0241-8234567', '584128234567', 'Valencia', 'Carabobo', 'mayorista', 50000.00),
('CLI002', 'Distribuidora Los Andes', 'Carlos Pérez', 'gerencia@losandes.ve', '0274-2567890', '584142567890', 'Mérida', 'Mérida', 'mayorista', 75000.00),
('CLI003', 'Bodega Mi Pueblo', 'Ana Rodríguez', 'anamipueblo@gmail.com', '0212-9876543', '584129876543', 'Caracas', 'Miranda', 'detallista', 15000.00),
('CLI004', 'Comercializadora Oriente', 'Luis Hernández', 'luis@comoriente.com', '0281-4561237', '584164561237', 'Puerto La Cruz', 'Anzoátegui', 'mayorista', 85000.00),
('CLI005', 'Minimarket La Esquina', 'Rosa Martínez', 'rosaesquina@hotmail.com', '0251-7894561', '584257894561', 'Barquisimeto', 'Lara', 'detallista', 12000.00),
('CLI006', 'Abasto Central Zulia', 'Pedro Medina', 'pedro@abastocentral.com', '0261-7531598', '584167531598', 'Maracaibo', 'Zulia', 'mayorista', 95000.00),
('CLI007', 'Tienda Don José', 'José Ramírez', 'donjo.ramirez@gmail.com', '0244-3692580', '584143692580', 'Maracay', 'Aragua', 'detallista', 8500.00),
('CLI008', 'Distribuciones Andinas', 'Carmen Delgado', 'compras@distandinas.ve', '0276-8529630', '584268529630', 'San Cristóbal', 'Táchira', 'mayorista', 68000.00),
('CLI009', 'Supermercado Familiar', 'Miguel Torres', 'miguel.familiar@outlook.com', '0295-1472583', '584141472583', 'Cumaná', 'Sucre', 'mayorista', 42000.00),
('CLI010', 'Kiosco El Rápido', 'Luisa Moreno', 'luisamoreno78@hotmail.com', '0212-5837419', '584125837419', 'Caracas', 'Miranda', 'detallista', 5000.00)
ON CONFLICT (client_code) DO NOTHING;

-- Insertar ventas de ejemplo con fechas recientes
INSERT INTO sales (sale_number, client_id, sale_date, total_amount, tax_amount, payment_status, payment_method) VALUES
('VEN-2024-001', 1, '2024-01-15 10:30:00', 450.75, 67.61, 'pagado', 'transferencia'),
('VEN-2024-002', 3, '2024-01-16 14:20:00', 125.50, 18.83, 'pagado', 'efectivo'),
('VEN-2024-003', 2, '2024-01-17 09:15:00', 850.00, 127.50, 'pendiente', 'credito'),
('VEN-2024-004', 4, '2024-01-18 16:45:00', 1250.25, 187.54, 'parcial', 'transferencia'),
('VEN-2024-005', 5, '2024-01-19 11:30:00', 89.75, 13.46, 'pagado', 'efectivo'),
('VEN-2024-006', 1, '2024-01-22 13:20:00', 675.80, 101.37, 'pagado', 'transferencia'),
('VEN-2024-007', 6, '2024-01-23 08:45:00', 920.40, 138.06, 'pendiente', 'credito'),
('VEN-2024-008', 7, '2024-01-24 15:10:00', 156.90, 23.54, 'pagado', 'pago_movil'),
('VEN-2024-009', 8, '2024-01-25 10:25:00', 780.60, 117.09, 'pagado', 'transferencia'),
('VEN-2024-010', 9, '2024-01-26 12:15:00', 534.25, 80.14, 'vencido', 'credito')
ON CONFLICT (sale_number) DO NOTHING;

-- Insertar detalles de ventas
INSERT INTO sale_details (sale_id, product_id, quantity, unit_price, total_price) VALUES
-- Venta 1: Supermercado El Ahorro
(1, 1, 15, 8.50, 127.50),
(1, 2, 12, 12.00, 144.00),
(1, 3, 20, 6.00, 120.00),
(1, 11, 24, 4.20, 100.80),
-- Venta 2: Bodega Mi Pueblo
(2, 5, 8, 3.50, 28.00),
(2, 6, 6, 5.20, 31.20),
(2, 9, 4, 6.50, 26.00),
(2, 15, 2, 7.20, 14.40),
-- Venta 3: Distribuidora Los Andes
(3, 1, 50, 8.50, 425.00),
(3, 3, 35, 6.00, 210.00),
(3, 4, 15, 11.50, 172.50),
(3, 7, 8, 16.80, 134.40),
-- Venta 4: Comercializadora Oriente
(4, 16, 20, 25.00, 500.00),
(4, 17, 15, 17.50, 262.50),
(4, 18, 8, 32.00, 256.00),
(4, 19, 12, 38.00, 456.00),
-- Venta 5: Minimarket La Esquina
(5, 8, 5, 9.50, 47.50),
(5, 10, 2, 12.00, 24.00),
(5, 12, 3, 8.80, 26.40)
ON CONFLICT DO NOTHING;

-- Insertar movimientos de inventario
INSERT INTO inventory_movements (product_id, movement_type, quantity, previous_stock, new_stock, cost_per_unit, reference_type, reference_id, notes) VALUES
-- Movimientos de ventas
(1, 'salida', -15, 63, 48, 6.50, 'venta', 1, 'Venta a Supermercado El Ahorro'),
(2, 'salida', -12, 36, 24, 9.00, 'venta', 1, 'Venta a Supermercado El Ahorro'),
(3, 'salida', -20, 105, 85, 4.20, 'venta', 1, 'Venta a Supermercado El Ahorro'),
-- Entrada de mercancía
(1, 'entrada', 100, 48, 148, 6.50, 'compra', null, 'Reposición stock Harina P.A.N.'),
(16, 'entrada', 50, 45, 95, 18.50, 'compra', null, 'Importación Pringles'),
(18, 'entrada', 24, 36, 60, 22.00, 'compra', null, 'Importación Red Bull'),
-- Ajustes de inventario
(7, 'ajuste', -3, 31, 28, 12.50, 'ajuste', null, 'Ajuste por productos vencidos'),
(20, 'sincronizacion', 25, 175, 200, 3.20, 'sync', null, 'Sincronización automática stock');

-- Insertar insights proactivos de ejemplo
INSERT INTO insights (insight_id, triggered_by, type, priority, title, description, recommendation, business_impact, confidence, channels, status, data) VALUES
('insight_001', 'inventory.low_stock', 'alert', 'high', 'Stock bajo de Harina P.A.N.', 
'El stock de Harina P.A.N. Blanca 1kg está en 48 unidades, cerca del umbral mínimo de 20.', 
'Realizar pedido de reposición de 200 unidades antes del fin de semana.',
'Evitar pérdidas de ventas por faltante del producto más vendido.',
0.94, '["dashboard", "whatsapp"]', 'generated',
'{"product_sku": "HARINA-PAN-1KG", "current_stock": 48, "min_threshold": 20, "recommended_order": 200}'),

('insight_002', 'sales.spike.detected', 'opportunity', 'critical', 'Pico de ventas detectado en productos premium',
'Las ventas de productos importados han aumentado 180% esta semana comparado con el promedio.',
'Aumentar stock de Pringles, Oreo y Red Bull para capitalizar la demanda.',
'Oportunidad de incrementar márgenes con productos de alto valor.',
0.89, '["dashboard", "email", "whatsapp"]', 'generated',
'{"category": "premium", "increase_percent": 180, "products": ["PRINGLES-ORIGINAL", "OREO-GALLETAS-154G", "REDBULL-250ML"]}'),

('insight_003', 'client.payment.overdue', 'alert', 'medium', 'Cliente con pagos vencidos',
'Supermercado Familiar tiene una factura vencida de Bs. 534.25 desde hace 15 días.',
'Contactar al cliente para acordar plan de pagos o suspender crédito temporalmente.',
'Reducir riesgo de cartera y mantener flujo de caja saludable.',
0.92, '["dashboard"]', 'read',
'{"client_code": "CLI009", "overdue_amount": 534.25, "days_overdue": 15, "client_name": "Supermercado Familiar"}');

-- Insertar configuraciones del sistema
INSERT INTO system_config (config_key, config_value, description) VALUES
('auto_insights_enabled', 'true', 'Habilitar generación automática de insights'),
('min_stock_alert_threshold', '10', 'Umbral mínimo para alertas de stock'),
('sales_spike_threshold', '150', 'Porcentaje de incremento para detectar picos de ventas'),
('insight_retention_days', '90', 'Días para mantener insights en la base de datos'),
('api_rate_limit', '1000', 'Límite de requests por hora por IP'),
('whatsapp_notifications', 'true', 'Habilitar notificaciones por WhatsApp'),
('email_notifications', 'true', 'Habilitar notificaciones por email'),
('db_connection_timeout', '30', 'Timeout de conexión a BD en segundos'),
('max_pool_connections', '20', 'Máximo de conexiones simultáneas a BD'),
('backup_retention_days', '30', 'Días para mantener backups de BD')
ON CONFLICT (config_key) DO NOTHING;