# ZAFESYS Suite

SaaS para gestión de ventas, técnicos e instalaciones de cerraduras inteligentes.

## Tech Stack

- **Backend**: FastAPI (Python 3.11+)
- **Database**: PostgreSQL + SQLAlchemy + Alembic
- **Frontend**: React + Vite + Tailwind CSS (coming soon)
- **Auth**: JWT

## Modules

1. **Leads/CRM** - Kanban board (Nuevo, En conversación, Potencial, Venta cerrada, Perdido)
2. **Products/Inventory** - CRUD de cerraduras con stock
3. **Installations** - Agenda, asignar técnico, confirmar pago, completar
4. **Technicians** - Lista, ver instalaciones del día
5. **Webhook ElevenLabs** - Recibe llamadas de Ana y crea leads automáticamente

## Getting Started

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload
```

### API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/register` - Register user
- `GET /api/v1/auth/me` - Get current user

### Leads
- `GET /api/v1/leads/` - List leads
- `GET /api/v1/leads/kanban` - Get kanban board data
- `POST /api/v1/leads/` - Create lead
- `PATCH /api/v1/leads/{id}/status` - Update lead status

### Products
- `GET /api/v1/products/` - List products
- `POST /api/v1/products/` - Create product
- `PATCH /api/v1/products/{id}/stock` - Update stock

### Technicians
- `GET /api/v1/technicians/` - List technicians
- `GET /api/v1/technicians/{id}/schedule` - Get day schedule

### Installations
- `GET /api/v1/installations/` - List installations
- `POST /api/v1/installations/` - Create installation
- `POST /api/v1/installations/{id}/complete` - Complete installation

### Webhooks
- `POST /api/v1/webhooks/elevenlabs/conversation` - ElevenLabs webhook

## Environment Variables

```
DATABASE_URL=postgresql://user:pass@localhost:5432/zafesys_suite
SECRET_KEY=your-secret-key
ELEVENLABS_WEBHOOK_SECRET=your-webhook-secret
```

## License

Proprietary - ZAFESYS Colombia
