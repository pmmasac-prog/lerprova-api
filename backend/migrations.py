from sqlalchemy import text
import logging

logger = logging.getLogger("lerprova-api")

def run_migrations(engine):
    """
    Script de migração para garantir que colunas novas existam no banco de dados.
    Seguro para rodar múltiplas vezes (IF NOT EXISTS / try-except).
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

        # 5. Garantir dias_semana em planos
        try:
            connection.execute(text("ALTER TABLE planos ADD COLUMN IF NOT EXISTS dias_semana TEXT"))
            connection.commit()
            logger.info("Migração: Coluna 'dias_semana' garantida na tabela 'planos'")
        except Exception as e:
            logger.warning(f"Migração (dias_semana): {e}")

        # ===== FASE 29: Migração Estrutural =====

        # 6. Migrar aluno.turma_id → aluno_turma (M2M) e depois dropar coluna
        try:
            # Popula M2M com base no turma_id antigo (se existir)
            connection.execute(text("""
                INSERT INTO aluno_turma (aluno_id, turma_id)
                SELECT id, turma_id FROM alunos
                WHERE turma_id IS NOT NULL
                ON CONFLICT DO NOTHING
            """))
            connection.commit()
            logger.info("Migração: Dados de alunos.turma_id copiados para aluno_turma")
        except Exception as e:
            logger.warning(f"Migração (aluno_turma populate): {e}")

        try:
            connection.execute(text("ALTER TABLE alunos DROP COLUMN IF EXISTS turma_id"))
            connection.commit()
            logger.info("Migração: Coluna 'turma_id' removida da tabela 'alunos'")
        except Exception as e:
            logger.warning(f"Migração (drop alunos.turma_id): {e}")

        # 7. Migrar gabarito.turma_id → gabarito_turma (M2M) e depois dropar coluna
        try:
            connection.execute(text("""
                INSERT INTO gabarito_turma (gabarito_id, turma_id)
                SELECT id, turma_id FROM gabaritos
                WHERE turma_id IS NOT NULL
                ON CONFLICT DO NOTHING
            """))
            connection.commit()
            logger.info("Migração: Dados de gabaritos.turma_id copiados para gabarito_turma")
        except Exception as e:
            logger.warning(f"Migração (gabarito_turma populate): {e}")

        try:
            connection.execute(text("ALTER TABLE gabaritos DROP COLUMN IF EXISTS turma_id"))
            connection.commit()
            logger.info("Migração: Coluna 'turma_id' removida da tabela 'gabaritos'")
        except Exception as e:
            logger.warning(f"Migração (drop gabaritos.turma_id): {e}")

        # 8. Auditoria OMR em resultados
        try:
            connection.execute(text("ALTER TABLE resultados ADD COLUMN IF NOT EXISTS status_list TEXT"))
            connection.execute(text("ALTER TABLE resultados ADD COLUMN IF NOT EXISTS confidence_scores TEXT"))
            connection.execute(text("ALTER TABLE resultados ADD COLUMN IF NOT EXISTS avg_confidence FLOAT DEFAULT 0.0"))
            connection.execute(text("ALTER TABLE resultados ADD COLUMN IF NOT EXISTS layout_version VARCHAR"))
            connection.execute(text("ALTER TABLE resultados ADD COLUMN IF NOT EXISTS anchors_found INTEGER DEFAULT 0"))
            connection.commit()
            logger.info("Migração: Campos de auditoria OMR garantidos na tabela 'resultados'")
        except Exception as e:
            logger.warning(f"Migração (resultado audit): {e}")

        # 9. Adicionar ON DELETE CASCADE na FK frequencia → turmas
        try:
            # Dropar constraint antiga e recriar com CASCADE
            connection.execute(text("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
                               WHERE constraint_name = 'frequencia_turma_id_fkey'
                               AND table_name = 'frequencia') THEN
                        ALTER TABLE frequencia DROP CONSTRAINT frequencia_turma_id_fkey;
                        ALTER TABLE frequencia ADD CONSTRAINT frequencia_turma_id_fkey
                            FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE CASCADE;
                    END IF;
                END $$;
            """))
            connection.commit()
            logger.info("Migração: FK frequencia.turma_id agora com ON DELETE CASCADE")
        except Exception as e:
            logger.warning(f"Migração (frequencia cascade): {e}")

        # 10. Adicionar ON DELETE CASCADE na FK frequencia → alunos
        try:
            connection.execute(text("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
                               WHERE constraint_name = 'frequencia_aluno_id_fkey'
                               AND table_name = 'frequencia') THEN
                        ALTER TABLE frequencia DROP CONSTRAINT frequencia_aluno_id_fkey;
                        ALTER TABLE frequencia ADD CONSTRAINT frequencia_aluno_id_fkey
                            FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE;
                    END IF;
                END $$;
            """))
            connection.commit()
            logger.info("Migração: FK frequencia.aluno_id agora com ON DELETE CASCADE")
        except Exception as e:
            logger.warning(f"Migração (frequencia aluno cascade): {e}")
