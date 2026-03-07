"""
Script para otimizar o banco de dados - Adicionar índices em Foreign Keys
Melhora performance de JOINs significativamente
"""
import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from database import engine, SessionLocal
from sqlalchemy import text, inspect
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("optimize-db")

class DatabaseOptimizer:
    def __init__(self):
        self.engine = engine
        self.session = SessionLocal()
        self.inspector = inspect(engine)
    
    def optimize_indexes(self):
        """Adiciona índices em Foreign Keys para melhorar performance"""
        
        print("\n" + "="*70)
        print("⚡ OTIMIZAÇÃO - ADICIONAR ÍNDICES EM FOREIGN KEYS")
        print("="*70 + "\n")
        
        # Índices recomendados em Foreign Keys
        recommended_indexes = [
            ("turmas", "user_id", "idx_turmas_user_id"),
            ("resultados", "aluno_id", "idx_resultados_aluno_id"),
            ("resultados", "gabarito_id", "idx_resultados_gabarito_id"),
            ("frequencia", "turma_id", "idx_frequencia_turma_id"),
            ("frequencia", "aluno_id", "idx_frequencia_aluno_id"),
            ("planos", "turma_id", "idx_planos_turma_id"),
            ("planos", "user_id", "idx_planos_user_id"),
            ("aulas_planejadas", "plano_id", "idx_aulas_plano_id"),
            ("registros_aula", "aula_id", "idx_registros_aula_id"),
            ("registros_aula", "user_id", "idx_registros_user_id"),
            ("analytics_daily", "turma_id", "idx_analytics_turma_id"),
            ("notifications", "user_id", "idx_notifications_user_id"),
            ("academic_years", "school_id", "idx_academic_years_school_id"),
            ("periods", "academic_year_id", "idx_periods_academic_year_id"),
            ("events", "academic_year_id", "idx_events_academic_year_id"),
        ]
        
        # Índices em datas (para filtros e range queries)
        date_indexes = [
            ("events", "start_date", "idx_events_start_date"),
            ("events", "end_date", "idx_events_end_date"),
            ("periods", "start_date", "idx_periods_start_date"),
            ("aulas_planejadas", "scheduled_date", "idx_aulas_scheduled_date"),
        ]
        
        all_indexes = recommended_indexes + date_indexes
        
        created_count = 0
        skipped_count = 0
        error_count = 0
        
        for table_name, column_name, index_name in all_indexes:
            try:
                # Verificar se índice já existe
                existing_indexes = self.inspector.get_indexes(table_name)
                existing_names = [idx["name"] for idx in existing_indexes]
                
                if index_name in existing_names:
                    print(f"⏭️  {index_name} - JÁ EXISTE (pulando)")
                    skipped_count += 1
                    continue
                
                # Criar índice
                create_sql = f"CREATE INDEX {index_name} ON {table_name}({column_name})"
                self.session.execute(text(create_sql))
                self.session.commit()
                
                print(f"✅ {index_name} - CRIADO")
                created_count += 1
            
            except Exception as e:
                print(f"❌ {index_name} - ERRO: {str(e)[:60]}")
                error_count += 1
        
        print()
        print("="*70)
        print(f"📊 RESULTADO:")
        print(f"   • Índices criados: {created_count}")
        print(f"   • Índices já existentes: {skipped_count}")
        print(f"   • Erros: {error_count}")
        print("="*70 + "\n")
        
        return created_count, skipped_count, error_count
    
    def verify_indexes(self):
        """Verifica e lista todos os índices do banco"""
        print("📋 ÍNDICES CADASTRADOS NO BANCO:\n")
        
        tables = self.inspector.get_table_names()
        total_indexes = 0
        
        for table_name in sorted(tables):
            indexes = self.inspector.get_indexes(table_name)
            
            if indexes:
                print(f"🔍 {table_name}")
                for idx in indexes:
                    print(f"   • {idx['name']}: {', '.join(idx['column_names'])}")
                    total_indexes += 1
        
        print(f"\n✅ Total de índices: {total_indexes}\n")
    
    def close(self):
        self.session.close()


def main():
    optimizer = DatabaseOptimizer()
    
    try:
        # Verificar índices antes
        print("ANTES DA OTIMIZAÇÃO:")
        optimizer.verify_indexes()
        
        # Adicionar novos índices
        created, skipped, errors = optimizer.optimize_indexes()
        
        # Verificar índices depois
        print("DEPOIS DA OTIMIZAÇÃO:")
        optimizer.verify_indexes()
        
        # Resumo
        print("\n" + "="*70)
        if errors == 0:
            print("✅ OTIMIZAÇÃO CONCLUÍDA COM SUCESSO!")
        else:
            print(f"⚠️  OTIMIZAÇÃO CONCLUÍDA COM {errors} ERROS")
        print("="*70 + "\n")
        
        print("💡 Benefícios:")
        print("   • JOINs mais rápidos")
        print("   • Filtros por FK otimizados")
        print("   • Range queries em datas aceleradas")
        print("   • Sem mudança nos dados existentes")
        print()
        
        return True
    
    except Exception as e:
        print(f"\n❌ Erro: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        optimizer.close()


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
