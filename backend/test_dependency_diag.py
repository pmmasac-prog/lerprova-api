import sys
import os
sys.path.append('backend')

import asyncio
from database import SessionLocal
import models
import auth_utils
from dependencies import get_current_user

async def diagnose():
    db = SessionLocal()
    # 1. Gerar um token para o Professor Teste
    email = "professor@teste.com"
    token = auth_utils.create_access_token({"sub": email})
    print(f"Token gerado para {email}: {token[:20]}...")
    
    # 2. Simular a chamada da dependência
    auth_header = f"Bearer {token}"
    print(f"Tentando autenticar com header: {auth_header[:25]}...")
    
    try:
        user = await get_current_user(authorization=auth_header, db=db)
        print(f"Sucesso! Usuário encontrado: {user.nome} (ID: {user.id}, Role: {user.role})")
    except Exception as e:
        print(f"FALHA na dependência: {e}")
        if hasattr(e, 'detail'):
            print(f"Detalhe: {e.detail}")

if __name__ == "__main__":
    asyncio.run(diagnose())
