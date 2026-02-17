from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from database import Base, engine
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from datetime import datetime
from models import User, pwd_context

# Funções auxiliares
def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()

def create_user(db: Session, user_data: dict):
    # Criptografar a senha antes de salvar
    password = user_data.pop("password")
    hashed_password = pwd_context.hash(password)
    
    db_user = User(**user_data, hashed_password=hashed_password)
    # Garantir que novos usuários comecem no plano free se não for especificado
    if not db_user.plan_type:
        db_user.plan_type = "free"
        
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# Script de Inicialização
def init_default_users(db: Session):
    if db.query(User).count() == 0:
        print("Inicializando usuários padrão no banco de dados...")
        # Admin
        create_user(db, {
            "nome": "Administrador",
            "email": "admin@lerprova.com",
            "password": "admin123",
            "role": "admin",
            "escola": "Sistema Central"
        })
        # Professor
        create_user(db, {
            "nome": "Professor Teste",
            "email": "professor@teste.com",
            "password": "123456",
            "role": "professor",
            "escola": "Escola Demo",
            "disciplina": "Matemática",
            "plan_type": "free"
        })
        # Professor Pro para Testes
        create_user(db, {
            "nome": "Professor Premium",
            "email": "pro@teste.com",
            "password": "pro123",
            "role": "professor",
            "escola": "Escola de Elite",
            "plan_type": "pro"
        })
