# 🚀 Fluxion AI - Backend Service

Sistema de gestión de inventario con IA proactiva - Servicio Backend

## 🏗️ Arquitectura
- **Framework**: Node.js + TypeScript + Express
- **Puerto**: 3000
- **Base de datos**: PostgreSQL + TimescaleDB
- **Cache**: Redis
- **Autenticación**: JWT

## 🚀 Desarrollo

```bash
# Instalar dependencias
npm install

# Desarrollo
npm run dev

# Tests  
npm test

# Build
npm run build
```

## 📊 Endpoints Principales
- `GET /health` - Health check
- `POST /auth/login` - Autenticación
- `GET /api/inventory` - Inventario
- `GET /api/alerts` - Alertas proactivas

## 🔗 Servicios Relacionados
- AI Engine: Puerto 8000
- Frontend: Puerto 3001
- PostgreSQL: Puerto 5432
- Redis: Puerto 6379
