from sqlalchemy import text, inspect, JSON
from sqlalchemy.dialects.postgresql import JSONB
import logging
import models
from database import engine, SessionLocal
from models import pwd_context

logger = logging.getLogger("lerprova-api")

def run_migrations(engine):
    """
    Função de bootstrap robusta para o banco de dados. 
    Usa transações e inspeção para garantir que o esquema esteja correto.
    """
    logger.info("Iniciando verificação de migrações (Modo Robusto)...")
    
    inspector = inspect(engine)
    is_postgres = engine.dialect.name == "postgresql"

    # Lista de colunas para converter para JSON/JSONB
    # Formato: (tabela, coluna, tipo_sql_original, nulo)
    json_migrations = [
        ("turmas", "dias_semana"),
        ("gabaritos", "respostas_corretas"),
        ("resultados", "respostas_aluno"),
        ("resultados", "status_list"),
        ("resultados", "confidence_scores"),
        ("planos", "dias_semana"),
        ("aulas_planejadas", "metodologia_recurso"),
        ("aulas_planejadas", "bncc_skills"),
        ("registros_aula", "percepcoes"),
        ("registros_aula", "ajustes_feitos"),
    ]

    try:
        # engine.begin() garante COMMIT ao fim do bloco ou ROLLBACK em caso de erro
        with engine.begin() as conn:
            for table, col in json_migrations:
                if not inspector.has_table(table):
                    logger.warning(f"Tabela '{table}' ainda não existe. Pulando migração de JSON.")
                    continue
                    
                columns = [c["name"] for c in inspector.get_columns(table)]
                
                if col not in columns:
                    logger.warning(f"Coluna '{col}' não encontrada em '{table}'. Adicionando como JSON...")
                    # No Postgres usamos JSONB, outros (SQLite) usam JSON (que vira TEXT internamente mas é validado pelo SA)
                    col_type = "JSONB" if is_postgres else "JSON"
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type} NULL"))
                    logger.info(f"Coluna '{col}' adicionada com sucesso.")
                else:
                    # Se a coluna existe mas queremos garantir que seja JSONB no Postgres
                    if is_postgres:
                        # Verifica o tipo atual (simplificado)
                        current_type = next(c["type"] for c in inspector.get_columns(table) if c["name"] == col)
                        if not str(current_type).upper().startswith("JSON"):
                            logger.info(f"Convertendo coluna '{col}' em '{table}' para JSONB...")
                            # No Postgres, conversão de VARCHAR/TEXT para JSONB precisa do USING
                            conn.execute(text(f"ALTER TABLE {table} ALTER COLUMN {col} TYPE JSONB USING {col}::jsonb"))
                            logger.info(f"Coluna '{col}' convertida para JSONB.")

            # Migrações para a tabela USERS
            columns_users = [c["name"] for c in inspector.get_columns("users")]
            
            if "escola" not in columns_users:
                logger.info("Adicionando coluna 'escola' em 'users'...")
                conn.execute(text("ALTER TABLE users ADD COLUMN escola VARCHAR NULL"))
                
            if "disciplina" not in columns_users:
                logger.info("Adicionando coluna 'disciplina' em 'users'...")
                conn.execute(text("ALTER TABLE users ADD COLUMN disciplina VARCHAR NULL"))

            if "plan_type" not in columns_users:
                logger.info("Adicionando coluna 'plan_type' em 'users'...")
                conn.execute(text("ALTER TABLE users ADD COLUMN plan_type VARCHAR DEFAULT 'free'"))

            if "subscription_expires_at" not in columns_users:
                logger.info("Adicionando coluna 'subscription_expires_at' em 'users'...")
                conn.execute(text("ALTER TABLE users ADD COLUMN subscription_expires_at TIMESTAMP NULL"))

            if "total_corrections_used" not in columns_users:
                logger.info("Adicionando coluna 'total_corrections_used' em 'users'...")
                conn.execute(text("ALTER TABLE users ADD COLUMN total_corrections_used INTEGER DEFAULT 0"))

            # Migrações para a tabela TURMAS
            columns_turmas = [c["name"] for c in inspector.get_columns("turmas")]
            
            if "disciplina" not in columns_turmas:
                logger.info("Adicionando coluna 'disciplina' em 'turmas'...")
                conn.execute(text("ALTER TABLE turmas ADD COLUMN disciplina VARCHAR NULL"))

            if "quantidade_aulas" not in columns_turmas:
                logger.info("Adicionando coluna 'quantidade_aulas' em 'turmas'...")
                conn.execute(text("ALTER TABLE turmas ADD COLUMN quantidade_aulas INTEGER DEFAULT 1"))

            if "user_id" not in columns_turmas:
                logger.info("Adicionando coluna 'user_id' em 'turmas'...")
                # Nota: Em SQLite o REFERENCES em ALTER TABLE pode ser limitado, mas o SA cuidará disso se possível.
                conn.execute(text("ALTER TABLE turmas ADD COLUMN user_id INTEGER NULL"))

            # Migrações para RESULTADOS (continuação...)
            columns_resultados = [c["name"] for c in inspector.get_columns("resultados")]
            
            if "needs_review" not in columns_resultados:
                logger.info("Adicionando coluna 'needs_review' em 'resultados'...")
                conn.execute(text("ALTER TABLE resultados ADD COLUMN needs_review BOOLEAN DEFAULT FALSE"))
                
            if "review_reasons" not in columns_resultados:
                res_type = "JSONB" if is_postgres else "JSON"
                logger.info(f"Adicionando coluna 'review_reasons' ({res_type}) em 'resultados'...")
                conn.execute(text(f"ALTER TABLE resultados ADD COLUMN review_reasons {res_type} NULL"))
                
            if "review_status" not in columns_resultados:
                logger.info("Adicionando coluna 'review_status' em 'resultados'...")
                conn.execute(text("ALTER TABLE resultados ADD COLUMN review_status VARCHAR DEFAULT 'confirmed'"))

            if "avg_confidence" not in columns_resultados:
                logger.info("Adicionando coluna 'avg_confidence' em 'resultados'...")
                conn.execute(text("ALTER TABLE resultados ADD COLUMN avg_confidence FLOAT DEFAULT 0.0"))

            if "layout_version" not in columns_resultados:
                logger.info("Adicionando coluna 'layout_version' em 'resultados'...")
                conn.execute(text("ALTER TABLE resultados ADD COLUMN layout_version VARCHAR DEFAULT 'v1'"))

            if "anchors_found" not in columns_resultados:
                logger.info("Adicionando coluna 'anchors_found' em 'resultados'...")
                conn.execute(text("ALTER TABLE resultados ADD COLUMN anchors_found INTEGER DEFAULT 0"))

            # Migrações para a tabela AULAS_PLANEJADAS
            if inspector.has_table("aulas_planejadas"):
                columns_aulas_plan = [c["name"] for c in inspector.get_columns("aulas_planejadas")]
                if "objetivo" not in columns_aulas_plan:
                    logger.info("Adicionando coluna 'objetivo' em 'aulas_planejadas'...")
                    conn.execute(text("ALTER TABLE aulas_planejadas ADD COLUMN objetivo VARCHAR NULL"))

            # Migrações para a tabela ALUNOS
            columns_alunos = [c["name"] for c in inspector.get_columns("alunos")]
            if "hashed_password" not in columns_alunos:
                logger.info("Adicionando coluna 'hashed_password' em 'alunos'...")
                conn.execute(text("ALTER TABLE alunos ADD COLUMN hashed_password VARCHAR NULL"))
                
                # Hash de '123456' via passlib.context (bcrypt)
                default_hash = pwd_context.hash("123456")
                conn.execute(text(f"UPDATE alunos SET hashed_password = '{default_hash}' WHERE hashed_password IS NULL"))
                logger.info("Senha padrão '123456' definida para alunos existentes.")
            
            # Novas colunas para gestão de frequência e responsáveis
            if "data_nascimento" not in columns_alunos:
                logger.info("Adicionando coluna 'data_nascimento' em 'alunos'...")
                conn.execute(text("ALTER TABLE alunos ADD COLUMN data_nascimento VARCHAR NULL"))
            
            if "nome_responsavel" not in columns_alunos:
                logger.info("Adicionando coluna 'nome_responsavel' em 'alunos'...")
                conn.execute(text("ALTER TABLE alunos ADD COLUMN nome_responsavel VARCHAR NULL"))
            
            if "telefone_responsavel" not in columns_alunos:
                logger.info("Adicionando coluna 'telefone_responsavel' em 'alunos'...")
                conn.execute(text("ALTER TABLE alunos ADD COLUMN telefone_responsavel VARCHAR NULL"))
            
            if "email_responsavel" not in columns_alunos:
                logger.info("Adicionando coluna 'email_responsavel' em 'alunos'...")
                conn.execute(text("ALTER TABLE alunos ADD COLUMN email_responsavel VARCHAR NULL"))
            
            if "situacao_matricula" not in columns_alunos:
                logger.info("Adicionando coluna 'situacao_matricula' em 'alunos'...")
                conn.execute(text("ALTER TABLE alunos ADD COLUMN situacao_matricula VARCHAR DEFAULT 'ativo'"))

            if "nfc_id" not in columns_alunos:
                logger.info("Adicionando coluna 'nfc_id' em 'alunos'...")
                conn.execute(text("ALTER TABLE alunos ADD COLUMN nfc_id VARCHAR NULL"))
                # Criar índice único (se não existir)
                try:
                    conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_alunos_nfc_id ON alunos(nfc_id)"))
                except:
                    pass  # Índice já existe ou DB não suporta IF NOT EXISTS

            # Migrações para a tabela FREQUENCIA
            if inspector.has_table("frequencia"):
                columns_frequencia = [c["name"] for c in inspector.get_columns("frequencia")]
                
                if "justificativa" not in columns_frequencia:
                    logger.info("Adicionando coluna 'justificativa' em 'frequencia'...")
                    conn.execute(text("ALTER TABLE frequencia ADD COLUMN justificativa VARCHAR NULL"))
                
                if "falta_justificada" not in columns_frequencia:
                    logger.info("Adicionando coluna 'falta_justificada' em 'frequencia'...")
                    conn.execute(text("ALTER TABLE frequencia ADD COLUMN falta_justificada BOOLEAN DEFAULT FALSE"))
                
                if "observacao" not in columns_frequencia:
                    logger.info("Adicionando coluna 'observacao' em 'frequencia'...")
                    conn.execute(text("ALTER TABLE frequencia ADD COLUMN observacao TEXT NULL"))
                
                if "hora_entrada" not in columns_frequencia:
                    logger.info("Adicionando coluna 'hora_entrada' em 'frequencia'...")
                    conn.execute(text("ALTER TABLE frequencia ADD COLUMN hora_entrada VARCHAR NULL"))
            
    except Exception as e:
        logger.error(f"FALHA CRÍTICA NA MIGRAÇÃO: {e}")
        return False

    logger.info("Bootstrap do banco de dados concluído com sucesso.")
    return True

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_migrations(engine)
