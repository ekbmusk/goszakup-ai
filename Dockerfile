FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -U pip && \
    pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/
COPY data/raw/ ./data/raw/
COPY data/models/ ./data/models/
COPY main.py .



EXPOSE 8008

# API_PORT передаётся через env (8008 dev / 8009 prod)
CMD sh -c "uvicorn src.api.routes:app --host 0.0.0.0 --port ${API_PORT:-8008}"
