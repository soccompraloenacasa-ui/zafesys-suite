FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Stamp existing migrations if needed, then upgrade to head
CMD ["sh", "-c", "alembic stamp 003_tech_pin 2>/dev/null || true; alembic upgrade head && python run.py"]
