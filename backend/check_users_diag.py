from sqlalchemy import create_engine, text
import os

# Caminho do banco
DB_PATH = "sqlite:///c:/projetos/LERPROVA/backend/lerprova_server.db"

def check_users():
    print(f"Verificando banco em: {DB_PATH}")
    engine = create_engine(DB_PATH)
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT id, nome, email, role, plan_type FROM users"))
            print("\nID | Nome | Email | Role | Plan")
            print("-" * 50)
            for row in result:
                print(f"{row[0]} | {row[1]} | {row[2]} | {row[3]} | {row[4]}")
                
            # Verificar se a tabela de resultados existe tbm
            print("\nVerificando tabelas...")
            res = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
            tables = [r[0] for r in res]
            print(f"Tabelas encontradas: {', '.join(tables)}")
            
    except Exception as e:
        print(f"ERRO: {e}")

if __name__ == "__main__":
    check_users()
