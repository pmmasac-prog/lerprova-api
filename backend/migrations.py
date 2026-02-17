from sqlalchemy import text
import logging

logger = logging.getLogger("lerprova-api")

def run_migrations(engine):
    """
    Script de migração simples para garantir que colunas novas existam no banco de dados.
    Especialmente útil para o Render onde o banco é persistente.
    """
    with engine.connect() as connection:
        # 1. Garantir user_id em turmas
        try:
            connection.execute(text("ALTER TABLE turmas ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)"))
            connection.commit()
            logger.info("Migração: Coluna 'user_id' garantida na tabela 'turmas'")
        except Exception as e:
            logger.warning(f"Migração (user_id): {e}")

        # 2. Garantir periodo em gabaritos
        try:
            connection.execute(text("ALTER TABLE gabaritos ADD COLUMN IF NOT EXISTS periodo INTEGER"))
            connection.commit()
            logger.info("Migração: Coluna 'periodo' garantida na tabela 'gabaritos'")
        except Exception as e:
            logger.warning(f"Migração (periodo): {e}")
            
        # 3. Garantir plan_type em users
        try:
            connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_type VARCHAR DEFAULT 'free'"))
            connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP"))
            connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS total_corrections_used INTEGER DEFAULT 0"))
            connection.commit()
            logger.info("Migração: Colunas de monetização garantidas na tabela 'users'")
        except Exception as e:
            logger.warning(f"Migração (users): {e}")

        # 4. Garantir disciplina em turmas e gabaritos
        try:
            connection.execute(text("ALTER TABLE turmas ADD COLUMN IF NOT EXISTS disciplina VARCHAR"))
            connection.execute(text("ALTER TABLE gabaritos ADD COLUMN IF NOT EXISTS disciplina VARCHAR"))
            connection.commit()
            logger.info("Migração: Coluna 'disciplina' garantida")
        except Exception as e:
            logger.warning(f"Migração (disciplina): {e}")
