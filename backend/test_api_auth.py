import jwt
import requests
from datetime import datetime, timedelta

# Configurações do Backend
SECRET_KEY = "pro_secret_key_lerprova_2026"
ALGORITHM = "HS256"
BASE_URL = "http://localhost:8000"

def simulate_auth():
    print(f"Testando endpoints em {BASE_URL}...")
    
    # 1. Gerar Token para o Professor Teste (simulando login)
    payload = {
        "sub": "professor@teste.com", 
        "user_id": 2, 
        "role": "professor",
        "exp": datetime.utcnow() + timedelta(hours=24)
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Testar Endpoints que estão falhando
    endpoints = ["/turmas", "/gabaritos", "/resultados"]
    
    for ep in endpoints:
        try:
            print(f"\nChamando {ep}...")
            # Usando GET para turmas e gabaritos
            verb = "GET"
            url = f"{BASE_URL}{ep}"
            
            # Nota: turmas.router tem prefixo /turmas, então o endpoint é /turmas
            # gabaritos.router não tem prefixo, endpoint é /gabaritos
            
            response = requests.get(url, headers=headers)
            print(f"Status: {response.status_code}")
            if response.status_code != 200:
                print(f"Erro: {response.text}")
            else:
                print("Sucesso!")
        except Exception as e:
            print(f"Erro de conexão: {e}")

if __name__ == "__main__":
    simulate_auth()
