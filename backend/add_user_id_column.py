import sqlite3
import os

DB_FILE = "lerprova_server.db"

def add_column():
    if not os.path.exists(DB_FILE):
        print(f"Banco de dados '{DB_FILE}' não encontrado.")
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    try:
        # Tentar selecionar a coluna para ver se existe
        cursor.execute("SELECT user_id FROM turmas LIMIT 1")
        print("Coluna 'user_id' já existe na tabela 'turmas'.")
    except sqlite3.OperationalError:
        print("Coluna 'user_id' não encontrada. Adicionando...")
        try:
            cursor.execute("ALTER TABLE turmas ADD COLUMN user_id INTEGER REFERENCES users(id)")
            conn.commit()
            print("Coluna 'user_id' adicionada com sucesso!")
        except Exception as e:
            print(f"Erro ao adicionar coluna: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    add_column()
