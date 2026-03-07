"""
Script de Inicialização Completo - Gestão Escolar 2026
Garante que TODAS as tabelas estejam populadas corretamente
"""
import sys
import os
from pathlib import Path

# Adicionar o backend ao path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database import SessionLocal, engine
import models
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed-complete")


def ensure_tables():
    """Garante que todas as tabelas existem"""
    logger.info("📋 Criando tabelas...")
    models.Base.metadata.create_all(bind=engine)
    logger.info("   ✅ Tabelas criadas/verificadas")


def seed_complete_system():
    """Executa todo o seed do sistema"""
    
    print("\n" + "="*70)
    print("🌱 INICIALIZAÇÃO COMPLETA DO SISTEMA - GESTÃO ESCOLAR 2026")
    print("="*70 + "\n")
    
    ensure_tables()
    
    db = SessionLocal()
    
    try:
        # 1. Verificar e Popular Usuários Padrão
        logger.info("\n👤 Verificando usuários padrão...")
        from users_db import init_default_users
        init_default_users(db)
        logger.info("   ✅ Usuários padrão verificados")
        
        # 2. Verificar e Popular BNCC
        logger.info("\n📚 Verificando dados BNCC...")
        bncc_count = db.query(models.BNCCSkill).count()
        if bncc_count == 0:
            logger.info("   ⚠️  BNCC vazio. Iniciando seed...")
            try:
                from scripts.seed_bncc import seed_bncc
                seed_bncc()
                logger.info("   ✅ BNCC populado com sucesso")
            except Exception as e:
                logger.error(f"   ❌ Erro ao popular BNCC: {e}")
        else:
            logger.info(f"   ✅ BNCC já populado ({bncc_count} habilidades)")
        
        # 3. Verificar e Popular Calendário Escolar 2026
        logger.info("\n🗓️  Verificando calendário escolar...")
        schools_count = db.query(models.School).count()
        events_count = db.query(models.Event).count()
        periods_count = db.query(models.Period).count()
        
        if schools_count == 0 or events_count == 0:
            logger.info("   ⚠️  Calendário incompleto. Iniciando seed...")
            try:
                from scripts.seed_school_2026_real import seed_from_json
                seed_from_json()
                
                # Atualizar contagens
                schools_count = db.query(models.School).count()
                events_count = db.query(models.Event).count()
                periods_count = db.query(models.Period).count()
                years_count = db.query(models.AcademicYear).count()
                
                logger.info(f"\n   ✅ Calendário populado com sucesso:")
                logger.info(f"      • Escolas: {schools_count}")
                logger.info(f"      • Anos letivos: {years_count}")
                logger.info(f"      • Períodos: {periods_count}")
                logger.info(f"      • Eventos: {events_count}")
            except Exception as e:
                logger.error(f"   ❌ Erro ao popular calendário: {e}")
                import traceback
                traceback.print_exc()
        else:
            years_count = db.query(models.AcademicYear).count()
            logger.info(f"   ✅ Calendário já populado:")
            logger.info(f"      • Escolas: {schools_count}")
            logger.info(f"      • Anos letivos: {years_count}")
            logger.info(f"      • Períodos: {periods_count}")
            logger.info(f"      • Eventos: {events_count}")
        
        # 4. Resumo Final
        print("\n" + "="*70)
        print("✅ INICIALIZAÇÃO CONCLUÍDA COM SUCESSO")
        print("="*70)
        
        final_stats = {
            "users": db.query(models.User).count(),
            "schools": db.query(models.School).count(),
            "academic_years": db.query(models.AcademicYear).count(),
            "periods": db.query(models.Period).count(),
            "events": db.query(models.Event).count(),
            "turmas": db.query(models.Turma).count(),
            "alunos": db.query(models.Aluno).count(),
            "bncc_skills": db.query(models.BNCCSkill).count(),
        }
        
        print("\n📊 STATUS DO SISTEMA:")
        for key, value in final_stats.items():
            print(f"   • {key.upper()}: {value}")
        
        print("\n🚀 O sistema está pronto para uso!")
        print("   Acesse http://localhost:3000 para começar")
        print("="*70 + "\n")
        
        return True
    
    except Exception as e:
        logger.error(f"\n❌ Erro durante inicialização: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        db.close()


if __name__ == "__main__":
    success = seed_complete_system()
    sys.exit(0 if success else 1)
