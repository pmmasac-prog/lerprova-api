import jwt
from datetime import datetime, timedelta
import os

# Parametros do auth_utils.py
SECRET_KEY = "pro_secret_key_lerprova_2026"
ALGORITHM = "HS256"

def test_token():
    print("Iniciando teste de Token...")
    
    # 1. Gerar Token (Simulando auth_utils.py)
    data = {"sub": "professor@teste.com", "user_id": 1, "role": "professor"}
    expire = datetime.utcnow() + timedelta(minutes=60)
    to_encode = data.copy()
    to_encode.update({"exp": expire})
    
    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    print(f"Token gerado: {token}")
    
    # 2. Decodificar Token
    try:
        decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        print(f"Decodificação Sucesso: {decoded}")
        if decoded.get("sub") == data["sub"]:
            print("VALIDAÇÃO OK: Payload íntegro.")
        else:
            print("FALHA: Payload inconsistente.")
    except Exception as e:
        print(f"ERRO NA DECODIFICAÇÃO: {e}")

if __name__ == "__main__":
    test_token()
