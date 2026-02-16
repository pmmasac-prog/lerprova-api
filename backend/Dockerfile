# Hardened Dockerfile for Render (High Stability)
FROM python:3.10-slim

# Envs de estabilidade
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

# Instalar dependências de sistema (Essencial para OpenCV, Pyzbar e Bcrypt)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libffi-dev \
    libzbar0 \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Garantir ferramentas de build atualizadas
RUN pip install --upgrade pip setuptools wheel

# Copiar requirements e instalar com preferência para binários (evita falha de compilação por falta de RAM)
COPY requirements.txt .
RUN pip install --prefer-binary -r requirements.txt

# Copiar código
COPY . .

# Permissões da DB
RUN touch users.json && chmod 666 users.json

# Porta do Render
EXPOSE 8000

# Execução (Forma de shell para expansão de variável PORT)
CMD uvicorn main:app --host 0.0.0.0 --port $PORT
