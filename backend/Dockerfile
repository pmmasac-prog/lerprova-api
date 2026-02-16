# Use uma imagem base oficial do Python
FROM python:3.11-slim

# Evitar que o Python gere arquivos .pyc e permitir logs em tempo real
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Instalar dependências do sistema necessárias para o OpenCV, Pyzbar e compilação
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libzbar0 \
    libffi-dev \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Definir diretório de trabalho
WORKDIR /app

# Upgrade pip and setuptools
RUN pip install --upgrade pip setuptools

# Copiar apenas requirements primeiro para aproveitar o cache do Docker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar o restante do código
COPY . .

# Criar arquivo de usuários padrão se não existir (o users_db.py já faz isso, mas garante permissão)
RUN touch users.json && chmod 666 users.json

# Expor a porta que o Render vai usar (lida pela variável de ambiente PORT)
EXPOSE 8000

# Comando para rodar a aplicação
# Render define a variável $PORT automaticamente
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
