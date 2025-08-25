-- =====================================================================================
-- FLUXION AI - TENANT MANAGEMENT SCHEMA
-- Tabla principal para gestión de tenants (clientes) con schemas separados
-- =====================================================================================

-- Tabla principal de tenants en el schema público
CREATE TABLE IF NOT EXISTS public.tenants (
    id SERIAL PRIMARY KEY,
    tenant_code VARCHAR(50) UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    whatsapp VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    
    -- Configuración del plan
    plan VARCHAR(50) DEFAULT 'basic',
    max_users INTEGER DEFAULT 5,
    max_products INTEGER DEFAULT 1000,
    max_storage_gb INTEGER DEFAULT 5,
    
    -- Estado y fechas
    active BOOLEAN DEFAULT true,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    subscription_ends_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata adicional
    features JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    billing_info JSONB DEFAULT '{}'
);

-- Tabla de usuarios por tenant
CREATE TABLE IF NOT EXISTS public.tenant_users (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    permissions JSONB DEFAULT '{}',
    active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tenant_id, user_code),
    UNIQUE(tenant_id, email)
);

-- Tabla de sesiones de usuario
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES public.tenant_users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de auditoría multi-tenant
CREATE TABLE IF NOT EXISTS public.tenant_audit_log (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES public.tenant_users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de configuraciones globales del sistema
CREATE TABLE IF NOT EXISTS public.system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    is_encrypted BOOLEAN DEFAULT false,
    updated_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- =====================================================================================

-- Índices para tenants
CREATE INDEX IF NOT EXISTS idx_tenants_active ON public.tenants(active);
CREATE INDEX IF NOT EXISTS idx_tenants_code ON public.tenants(tenant_code);
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON public.tenants(plan);
CREATE INDEX IF NOT EXISTS idx_tenants_city ON public.tenants(city, state);

-- Índices para usuarios
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON public.tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_email ON public.tenant_users(email);
CREATE INDEX IF NOT EXISTS idx_tenant_users_active ON public.tenant_users(tenant_id, active);
CREATE INDEX IF NOT EXISTS idx_tenant_users_role ON public.tenant_users(tenant_id, role);

-- Índices para sesiones
CREATE INDEX IF NOT EXISTS idx_user_sessions_tenant ON public.user_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON public.user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON public.user_sessions(expires_at);

-- Índices para auditoría
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON public.tenant_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON public.tenant_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.tenant_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.tenant_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.tenant_audit_log(created_at);

-- Índices para configuraciones
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON public.system_settings(setting_key);

-- =====================================================================================
-- TRIGGERS PARA UPDATED_AT
-- =====================================================================================

-- Trigger para tenants
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_updated_at 
    BEFORE UPDATE ON public.tenants 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_users_updated_at 
    BEFORE UPDATE ON public.tenant_users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at 
    BEFORE UPDATE ON public.system_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================================
-- FUNCIONES AUXILIARES PARA TENANTS
-- =====================================================================================

-- Función para obtener el schema de un tenant
CREATE OR REPLACE FUNCTION get_tenant_schema(tenant_code_param VARCHAR)
RETURNS VARCHAR AS $$
BEGIN
    RETURN 'tenant_' || tenant_code_param;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Función para verificar si un schema de tenant existe
CREATE OR REPLACE FUNCTION tenant_schema_exists(tenant_code_param VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    schema_name VARCHAR;
    schema_exists BOOLEAN;
BEGIN
    schema_name := get_tenant_schema(tenant_code_param);
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.schemata 
        WHERE schema_name = schema_name
    ) INTO schema_exists;
    
    RETURN schema_exists;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener estadísticas de un tenant
CREATE OR REPLACE FUNCTION get_tenant_stats(tenant_code_param VARCHAR)
RETURNS JSONB AS $$
DECLARE
    schema_name VARCHAR;
    stats JSONB;
BEGIN
    schema_name := get_tenant_schema(tenant_code_param);
    
    IF NOT tenant_schema_exists(tenant_code_param) THEN
        RETURN '{"error": "Schema no existe"}';
    END IF;
    
    EXECUTE format('
        SELECT jsonb_build_object(
            ''products'', (SELECT COUNT(*) FROM %I.products WHERE active = true),
            ''clients'', (SELECT COUNT(*) FROM %I.clients WHERE active = true),
            ''sales'', (SELECT COUNT(*) FROM %I.sales),
            ''insights'', (SELECT COUNT(*) FROM %I.insights WHERE is_active = true)
        )', schema_name, schema_name, schema_name, schema_name
    ) INTO stats;
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================================
-- DATOS INICIALES DEL SISTEMA
-- =====================================================================================

-- Configuraciones iniciales del sistema
INSERT INTO public.system_settings (setting_key, setting_value, description) VALUES
('app_name', '"Fluxion AI"', 'Nombre de la aplicación'),
('app_version', '"1.0.0"', 'Versión actual del sistema'),
('default_timezone', '"America/Caracas"', 'Zona horaria por defecto'),
('max_file_upload_mb', '50', 'Tamaño máximo de archivo en MB'),
('session_timeout_hours', '24', 'Timeout de sesión en horas'),
('backup_retention_days', '30', 'Días de retención de backups'),
('maintenance_mode', 'false', 'Modo mantenimiento activado'),
('registration_enabled', 'true', 'Registro de nuevos tenants habilitado')
ON CONFLICT (setting_key) DO NOTHING;

-- Comentarios en las tablas
COMMENT ON TABLE public.tenants IS 'Tabla principal de tenants/clientes con schemas separados';
COMMENT ON TABLE public.tenant_users IS 'Usuarios por cada tenant con roles y permisos';
COMMENT ON TABLE public.user_sessions IS 'Sesiones activas de usuarios';
COMMENT ON TABLE public.tenant_audit_log IS 'Log de auditoría multi-tenant';
COMMENT ON TABLE public.system_settings IS 'Configuraciones globales del sistema';

COMMENT ON COLUMN public.tenants.tenant_code IS 'Código único del tenant (usado para schema)';
COMMENT ON COLUMN public.tenants.plan IS 'Plan de suscripción (basic, pro, enterprise)';
COMMENT ON COLUMN public.tenants.features IS 'Características habilitadas para el tenant';
COMMENT ON COLUMN public.tenants.settings IS 'Configuraciones específicas del tenant';
COMMENT ON COLUMN public.tenant_users.role IS 'Rol del usuario (admin, manager, user, viewer)';
COMMENT ON COLUMN public.tenant_users.permissions IS 'Permisos específicos del usuario';