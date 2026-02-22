from sqlalchemy import text, inspect, JSON
from sqlalchemy.dialects.postgresql import JSONB
import logging

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
            
    except Exception as e:
        logger.error(f"FALHA CRÍTICA NA MIGRAÇÃO: {e}")
        return False

    logger.info("Bootstrap do banco de dados concluído com sucesso.")
    return True

