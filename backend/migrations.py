from sqlalchemy import text
import logging

logger = logging.getLogger("lerprova-api")

def run_migrations(engine):
    """
    Função de bootstrap para o banco de dados. 
    Garante que colunas críticas adicionadas recentemente existam no banco.
    """
    logger.info("Verificando migrações pendentes...")
    
    try:
        with engine.connect() as conn:
            # 1. Verificar coluna dias_semana na tabela turmas
            try:
                # O SELECT 0 funciona tanto em SQLite quanto Postgres para checar existência
                conn.execute(text("SELECT dias_semana FROM turmas LIMIT 0"))
            except Exception:
                logger.warning("Coluna 'dias_semana' não encontrada em 'turmas'. Adicionando...")
                conn.execute(text("ALTER TABLE turmas ADD COLUMN dias_semana VARCHAR(255) NULL"))
                conn.commit()
                logger.info("Coluna 'dias_semana' adicionada com sucesso.")
            
            # Adicione aqui outras migrações incrementais se necessário
            
    except Exception as e:
        logger.error(f"Erro ao executar migrações manuais: {e}")
        return False

    logger.info("Bootstrap do banco de dados concluído.")
    return True

