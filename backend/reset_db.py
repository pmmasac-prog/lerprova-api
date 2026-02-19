"""
Script de Reset do Banco de Dados
AVISO: Isso apagará TODOS os dados permanentemente e recriará as tabelas do zero.
"""
from database import engine, SessionLocal
import models
import users_db
import sys

def reset_database():
    print("Iniciando reset do banco de dados...")
    
    # 1. Confirmar se não for interativo (opcional)
    # print("Tem certeza que deseja apagar TUDO? (s/n)")
    # if input().lower() != 's': return

    # 2. Dropar todas as tabelas
    print("Limpando tabelas existentes...")
    models.Base.metadata.drop_all(bind=engine)
    
    # 3. Recriar todas as tabelas (Efeito 'No Migrations')
    print("Recriando tabelas a partir dos modelos atuais...")
    models.Base.metadata.create_all(bind=engine)
    
    # 4. Inicializar dados padrão
    print("Populando com usuários iniciais...")
    db = SessionLocal()
    try:
        users_db.init_default_users(db)
        print("Reset concluído com sucesso! ✅")
    except Exception as e:
        print(f"Erro ao popular banco: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    reset_database()
