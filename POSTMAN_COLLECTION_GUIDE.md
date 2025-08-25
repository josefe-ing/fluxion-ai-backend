# 📡 Fluxion AI Multi-Tenant API - Postman Collection Guide

## 🚀 Quick Start

1. **Import the Collection**
   - Import `Fluxion_AI_Multi-Tenant_API.postman_collection.json` into Postman
   - The collection includes pre-configured variables and test scripts

2. **Start the Server**
   ```bash
   cd backend
   DB_USER=jose BACKEND_PORT=3004 node server-multitenant.cjs
   ```

3. **Run the Demo Setup**
   - Execute the "🎯 Setup Complete Demo Environment" folder to create sample data
   - This will create a tenant, products, clients, and insights automatically

## 📊 Collection Overview

### 🏥 System Health (2 endpoints)
- Health check and system information
- No authentication required

### 🏢 Tenant Administration (6 endpoints)  
- Create, read, update, delete tenants
- **Important**: Admin endpoints don't require X-Tenant header

### 📦 Products API (9 endpoints)
- Full CRUD operations for products
- Search, filtering, and statistics
- Low stock monitoring

### 👥 Clients API (9 endpoints)
- Client management with business intelligence
- Overdue client detection
- Client behavior analysis

### 💰 Sales API (9 endpoints)
- Sales transaction management
- Payment status updates and cancellations
- Sales statistics and trends

### 📦 Inventory API (7 endpoints)
- Inventory movement tracking
- FIFO valuation calculations
- High-movement product analysis

### 🧠 Insights API (10 endpoints)
- AI-powered business insights generation
- Real-time Server-Sent Events (SSE)
- Automated opportunity detection

### 📊 Dashboard API (6 endpoints)
- Consolidated dashboard data
- KPI calculations and alerts
- Executive-level analytics

### 🧪 Testing & Demo Scenarios
- **Setup Complete Demo Environment**: Creates full demo data
- **Multi-Tenant Isolation Test**: Verifies tenant data separation

## 🔑 Authentication & Tenant Context

### Multi-Tenant Headers
All business endpoints (non-admin) require the tenant header:
```
X-Tenant: demo123
```

### Alternative Tenant Methods
The API also supports tenant specification via:
- URL parameter: `/api/tenant/demo123/products`
- Query parameter: `/api/products?tenant=demo123`
- Subdomain: `demo123.localhost:3004/api/products`

## 📝 Collection Variables

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `base_url` | `http://localhost:3004` | API server URL |
| `tenant_code` | `demo123` | Current tenant identifier |
| `test_product_id` | `1` | Auto-updated from product creation |
| `test_client_id` | `1` | Auto-updated from client creation |
| `test_sale_id` | `1` | Auto-updated from sale creation |

## 🎯 Testing Scenarios

### 1. **Basic Functionality Test**
Run this sequence to test core functionality:
1. System Health → Health Check
2. Tenant Administration → Create Tenant - Demo123
3. Products API → Create Product
4. Products API → Get All Products
5. Dashboard API → Dashboard Overview

### 2. **Multi-Tenant Isolation Test**
1. Create two tenants (demo123, test456)
2. Add products to demo123 tenant
3. Query products from both tenants
4. Verify tenant isolation (test456 should show no products)

### 3. **Complete Business Flow Test**
Execute the "🎯 Setup Complete Demo Environment" folder in order:
1. Create Demo Tenant
2. Create Sample Products  
3. Create Sample Client
4. Generate All Insights
5. Get Dashboard Overview

### 4. **Real-time Features Test**
1. Open "Insights Stream (SSE)" endpoint
2. In another tab, run "Generate All Insights"
3. Observe real-time insight notifications in the SSE stream

## 🔧 Troubleshooting

### Common Issues

1. **"Tenant not found" error**
   - Ensure X-Tenant header is set correctly
   - Verify tenant exists with "Get Tenant by Code" endpoint

2. **Database connection errors**
   - Check PostgreSQL is running on localhost:5432
   - Verify DB_USER=jose environment variable is set

3. **Port conflicts**
   - Default server runs on port 3004
   - Update base_url variable if using different port

4. **Column/table errors**
   - Run tenant creation to ensure proper schema setup
   - Check database permissions for user 'jose'

### Debug Tips

- Enable Postman Console to see request/response details
- Check server logs for detailed error messages
- Use "System Info" endpoint to verify server status
- Test admin endpoints first (no tenant header required)

## 🌟 Advanced Features

### Automated Test Scripts
Many requests include test scripts that:
- Extract IDs from responses and store in variables
- Verify response status codes
- Log success messages to console

### Environment Variables
The collection uses Postman variables for:
- Dynamic ID updates from create operations
- Consistent tenant context across requests
- Easy server URL configuration

### Venezuelan Business Context
Sample data includes:
- Realistic Venezuelan product names (Harina P.A.N.)
- Venezuelan addresses and phone numbers
- Local business practices (30-day payment terms)
- Venezuelan currency considerations

## 📚 API Documentation

Each endpoint includes:
- Clear descriptions and business context
- Required headers and parameters
- Sample request bodies with realistic data
- Expected response formats
- Error handling examples

## 🎉 Success Indicators

✅ **Multi-tenant system working correctly when:**
- Different tenants see isolated data
- All CRUD operations work with tenant context
- Dashboard shows consolidated tenant-specific metrics
- Insights generate automatically for each tenant
- Real-time SSE stream provides tenant-specific updates

---

**🚀 Ready to test! Start with the "Setup Complete Demo Environment" folder for the best experience.**