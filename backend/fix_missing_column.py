from sqlalchemy import text
from database import engine

def fix_schema():
    print("Verificando colunas na tabela 'turmas'...")
    try:
        with engine.connect() as conn:
            # Tenta ler a coluna para ver se existe
            try:
                conn.execute(text("SELECT dias_semana FROM turmas LIMIT 1"))
                print("A coluna 'dias_semana' já existe! ✅")
            except Exception:
                print("Coluna 'dias_semana' não encontrada. Adicionando...")
                conn.execute(text("ALTER TABLE turmas ADD COLUMN dias_semana VARCHAR NULL"))
                conn.commit()
                print("Coluna 'dias_semana' adicionada com sucesso! 🚀")
    except Exception as e:
        print(f"Erro ao tentar atualizar o esquema: {e}")

if __name__ == "__main__":
    fix_schema()
