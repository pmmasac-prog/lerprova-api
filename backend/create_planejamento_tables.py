import sqlite3
import os

DB_FILE = "lerprova_server.db"

def create_planejamento_tables():
    if not os.path.exists(DB_FILE):
        print(f"Banco de dados '{DB_FILE}' não encontrado.")
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    try:
        # Tabela planos
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS planos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                turma_id INTEGER,
                user_id INTEGER,
                titulo TEXT,
                disciplina TEXT,
                data_inicio TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (turma_id) REFERENCES turmas(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        
        # Tabela aulas_planejadas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS aulas_planejadas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plano_id INTEGER,
                ordem INTEGER,
                titulo TEXT,
                scheduled_date TEXT,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (plano_id) REFERENCES planos(id) ON DELETE CASCADE
            )
        """)
        
        # Tabela registros_aula
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS registros_aula (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                aula_id INTEGER,
                user_id INTEGER,
                data_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                percepcoes TEXT,
                observacoes TEXT,
                ajustes_feitos TEXT,
                FOREIGN KEY (aula_id) REFERENCES aulas_planejadas(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        
        # Tabela analytics_daily
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS analytics_daily (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                turma_id INTEGER,
                data TEXT,
                engajamento_score REAL DEFAULT 0.0,
                alerta_score REAL DEFAULT 0.0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (turma_id) REFERENCES turmas(id)
            )
        """)
        
        conn.commit()
        print("✅ Tabelas de planejamento criadas com sucesso!")
        print("   - planos")
        print("   - aulas_planejadas")
        print("   - registros_aula")
        print("   - analytics_daily")
        
    except Exception as e:
        print(f"❌ Erro ao criar tabelas: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    create_planejamento_tables()
