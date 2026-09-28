FROM python:3.11-slim

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies (GDAL, PostGIS libs, Tesseract OCR)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gdal-bin \
    libgdal-dev \
    tesseract-ocr \
    tesseract-ocr-eng \
    libpq-dev \
    && rm -rf /var/lib/apt-get/lists/*

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY . .

# Expose port (Render dynamically assigns PORT)
EXPOSE 8000

# Run uvicorn on port provided by Render environment
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
