FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema necesarias para reportlab / pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias de Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código del proyecto
COPY . .

# Crear directorios de datos
RUN mkdir -p data/reportes data/libros

EXPOSE 8000

ENV PORT=8000
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
