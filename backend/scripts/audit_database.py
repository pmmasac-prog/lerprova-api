"""
Script de Auditoria Completa do Banco de Dados
Verifica tabelas, colunas, relacionamentos e integridade referencial
"""
import sys
import os
from pathlib import Path
from datetime import datetime

# Adicionar o backend ao path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database import SessionLocal, engine
import models
from sqlalchemy import inspect, text
import json

class DatabaseAudit:
    def __init__(self):
        self.engine = engine
        self.session = SessionLocal()
        self.inspector = inspect(engine)
        self.report = {
            "timestamp": datetime.now().isoformat(),
            "database_url": str(engine.url).replace(engine.url.password or '', '***') if hasattr(engine.url, 'password') else str(engine.url),
            "tables": [],
            "relationships": [],
            "foreign_keys": [],
            "issues": [],
            "statistics": {},
            "recommendations": []
        }
    
    def run_audit(self):
        """Executa auditoria completa"""
        print("\n" + "="*80)
        print("🔍 AUDITORIA COMPLETA DO BANCO DE DADOS LERPROVA")
        print("="*80 + "\n")
        
        self.audit_tables()
        self.audit_relationships()
        self.audit_foreign_keys()
        self.audit_data_integrity()
        self.audit_statistics()
        self.generate_recommendations()
        
        print("\n" + "="*80)
        print("✅ AUDITORIA CONCLUÍDA")
        print("="*80 + "\n")
        
        return self.report
    
    def audit_tables(self):
        """Audita todas as tabelas"""
        print("📋 AUDITANDO TABELAS...\n")
        
        tables = self.inspector.get_table_names()
        print(f"Total de tabelas: {len(tables)}\n")
        
        for table_name in sorted(tables):
            table_info = {
                "name": table_name,
                "columns": [],
                "row_count": 0,
                "primary_key": None,
                "indexes": []
            }
            
            # Colunas
            columns = self.inspector.get_columns(table_name)
            table_info["columns"] = [
                {
                    "name": col["name"],
                    "type": str(col["type"]),
                    "nullable": col["nullable"],
                    "default": str(col.get("default", "N/A"))
                }
                for col in columns
            ]
            
            # Primary Key
            pk = self.inspector.get_pk_constraint(table_name)
            if pk and pk.get("constrained_columns"):
                table_info["primary_key"] = pk["constrained_columns"]
            
            # Contagem de registros
            try:
                result = self.session.execute(text(f"SELECT COUNT(*) as cnt FROM {table_name}"))
                row = result.fetchone()
                table_info["row_count"] = row[0] if row else 0
            except Exception as e:
                table_info["row_count"] = f"Erro: {str(e)}"
            
            # Índices
            indexes = self.inspector.get_indexes(table_name)
            table_info["indexes"] = [
                {"name": idx["name"], "columns": idx["column_names"]}
                for idx in indexes
            ]
            
            self.report["tables"].append(table_info)
            
            # Print
            print(f"✅ {table_name}")
            print(f"   • Colunas: {len(columns)}")
            print(f"   • Registros: {table_info['row_count']}")
            print(f"   • PK: {table_info['primary_key']}")
            print(f"   • Índices: {len(indexes)}")
            print()
    
    def audit_relationships(self):
        """Audita relacionamentos entre entidades"""
        print("🔗 AUDITANDO RELACIONAMENTOS...\n")
        
        # Mapping de modelos
        model_mapping = {
            "users": models.User,
            "turmas": models.Turma,
            "alunos": models.Aluno,
            "gabaritos": models.Gabarito,
            "resultados": models.Resultado,
            "frequencia": models.Frequencia,
            "planos": models.Plano,
            "aulas_planejadas": models.AulaPlanejada,
            "registros_aula": models.RegistroAula,
            "analytics_daily": models.AnalyticsDaily,
            "bncc_skills": models.BNCCSkill,
            "bncc_competencies": models.BNCCCompetency,
            "notifications": models.Notification,
            "schools": models.School,
            "academic_years": models.AcademicYear,
            "periods": models.Period,
            "events": models.Event,
        }
        
        relationships_found = []
        
        # Analisar modelos
        for table_name, model_class in model_mapping.items():
            if not hasattr(model_class, "__mapper__"):
                continue
            
            mapper = model_class.__mapper__
            
            # Relacionamentos
            for rel_name, rel in mapper.relationships.items():
                relationship_info = {
                    "from_table": table_name,
                    "from_model": model_class.__name__,
                    "relationship": rel_name,
                    "target_table": rel.mapper.class_.__tablename__,
                    "target_model": rel.mapper.class_.__name__,
                    "type": str(rel.direction),
                    "cascade": str(rel.cascade),
                    "back_populates": rel.back_populates
                }
                relationships_found.append(relationship_info)
                self.report["relationships"].append(relationship_info)
                
                print(f"✅ {model_class.__name__}.{rel_name}")
                print(f"   • Tipo: {rel.direction}")
                print(f"   • Target: {rel.mapper.class_.__name__} ({rel.mapper.class_.__tablename__})")
                print(f"   • Back: {rel.back_populates}")
                print(f"   • Cascade: {rel.cascade}")
                print()
        
        print(f"Total de relacionamentos encontrados: {len(relationships_found)}\n")
    
    def audit_foreign_keys(self):
        """Audita foreign keys"""
        print("🔑 AUDITANDO FOREIGN KEYS...\n")
        
        tables = self.inspector.get_table_names()
        fk_count = 0
        
        for table_name in sorted(tables):
            fks = self.inspector.get_foreign_keys(table_name)
            
            if fks:
                print(f"📍 Tabela: {table_name}")
                
                for fk in fks:
                    fk_info = {
                        "table": table_name,
                        "columns": fk["constrained_columns"],
                        "referred_table": fk["referred_table"],
                        "referred_columns": fk["referred_columns"],
                        "ondelete": fk.get("ondelete", "RESTRICT"),
                        "onupdate": fk.get("onupdate", "RESTRICT")
                    }
                    self.report["foreign_keys"].append(fk_info)
                    
                    print(f"   ✅ {fk['constrained_columns'][0]} → {fk['referred_table']}.{fk['referred_columns'][0]}")
                    print(f"      • ON DELETE: {fk.get('ondelete', 'RESTRICT')}")
                    print(f"      • ON UPDATE: {fk.get('onupdate', 'RESTRICT')}")
                    fk_count += 1
                
                print()
        
        print(f"Total de Foreign Keys: {fk_count}\n")
    
    def audit_data_integrity(self):
        """Verifica integridade referencial dos dados"""
        print("✔️  AUDITANDO INTEGRIDADE REFERENCIAL...\n")
        
        try:
            # Verificar turmas sem professor
            turmas_no_prof = self.session.execute(
                text("SELECT id, nome FROM turmas WHERE user_id IS NULL")
            ).fetchall()
            if turmas_no_prof:
                issue = f"⚠️  {len(turmas_no_prof)} turmas sem professor associado"
                print(issue)
                self.report["issues"].append(issue)
            else:
                print("✅ Todas as turmas têm professor")
            
            # Verificar resultados sem aluno
            resultados_no_aluno = self.session.execute(
                text("SELECT id FROM resultados WHERE aluno_id IS NULL")
            ).fetchall()
            if resultados_no_aluno:
                issue = f"⚠️  {len(resultados_no_aluno)} resultados sem aluno"
                print(issue)
                self.report["issues"].append(issue)
            else:
                print("✅ Todos os resultados têm aluno")
            
            # Verificar resultados sem gabarito
            resultados_no_gabarito = self.session.execute(
                text("SELECT id FROM resultados WHERE gabarito_id IS NULL")
            ).fetchall()
            if resultados_no_gabarito:
                issue = f"⚠️  {len(resultados_no_gabarito)} resultados sem gabarito"
                print(issue)
                self.report["issues"].append(issue)
            else:
                print("✅ Todos os resultados têm gabarito")
            
            # Verificar frequência sem turma
            freq_no_turma = self.session.execute(
                text("SELECT id FROM frequencia WHERE turma_id IS NULL")
            ).fetchall()
            if freq_no_turma:
                issue = f"⚠️  {len(freq_no_turma)} registros de frequência sem turma"
                print(issue)
                self.report["issues"].append(issue)
            else:
                print("✅ Todos os registros de frequência têm turma")
            
            # Verificar eventos sem ano letivo
            eventos_no_year = self.session.execute(
                text("SELECT id FROM events WHERE academic_year_id IS NULL")
            ).fetchall()
            if eventos_no_year:
                issue = f"⚠️  {len(eventos_no_year)} eventos sem ano letivo"
                print(issue)
                self.report["issues"].append(issue)
            else:
                print("✅ Todos os eventos têm ano letivo")
            
            # Verificar notificações sem usuário
            notifs_no_user = self.session.execute(
                text("SELECT id FROM notifications WHERE user_id IS NULL")
            ).fetchall()
            if notifs_no_user:
                issue = f"⚠️  {len(notifs_no_user)} notificações sem usuário"
                print(issue)
                self.report["issues"].append(issue)
            else:
                print("✅ Todas as notificações têm usuário")
            
            print()
        except Exception as e:
            print(f"❌ Erro ao verificar integridade: {e}\n")
            self.report["issues"].append(f"Erro de integridade: {str(e)}")
    
    def audit_statistics(self):
        """Coleta estatísticas gerais"""
        print("📊 COLETANDO ESTATÍSTICAS...\n")
        
        stats = {}
        
        try:
            stats["users"] = self.session.execute(text("SELECT COUNT(*) FROM users")).scalar()
            stats["turmas"] = self.session.execute(text("SELECT COUNT(*) FROM turmas")).scalar()
            stats["alunos"] = self.session.execute(text("SELECT COUNT(*) FROM alunos")).scalar()
            stats["gabaritos"] = self.session.execute(text("SELECT COUNT(*) FROM gabaritos")).scalar()
            stats["resultados"] = self.session.execute(text("SELECT COUNT(*) FROM resultados")).scalar()
            stats["frequencia"] = self.session.execute(text("SELECT COUNT(*) FROM frequencia")).scalar()
            stats["planos"] = self.session.execute(text("SELECT COUNT(*) FROM planos")).scalar()
            stats["aulas_planejadas"] = self.session.execute(text("SELECT COUNT(*) FROM aulas_planejadas")).scalar()
            stats["bncc_skills"] = self.session.execute(text("SELECT COUNT(*) FROM bncc_skills")).scalar()
            stats["bncc_competencies"] = self.session.execute(text("SELECT COUNT(*) FROM bncc_competencies")).scalar()
            stats["notifications"] = self.session.execute(text("SELECT COUNT(*) FROM notifications")).scalar()
            stats["schools"] = self.session.execute(text("SELECT COUNT(*) FROM schools")).scalar()
            stats["academic_years"] = self.session.execute(text("SELECT COUNT(*) FROM academic_years")).scalar()
            stats["periods"] = self.session.execute(text("SELECT COUNT(*) FROM periods")).scalar()
            stats["events"] = self.session.execute(text("SELECT COUNT(*) FROM events")).scalar()
            
            self.report["statistics"] = stats
            
            for key, value in sorted(stats.items()):
                print(f"   • {key}: {value}")
            
            print()
        except Exception as e:
            print(f"❌ Erro ao coletar estatísticas: {e}\n")
    
    def generate_recommendations(self):
        """Gera recomendações de melhoria"""
        print("💡 GERANDO RECOMENDAÇÕES...\n")
        
        recommendations = []
        
        # Verificar tabelas de associação
        assoc_tables = [t for t in self.inspector.get_table_names() if "_" in t and len(t) > 15]
        if assoc_tables:
            recommendations.append(
                "✅ Tabelas de associação M2M encontradas e bem nomeadas: " + 
                ", ".join(assoc_tables)
            )
        
        # Verificar cascades
        fks_no_cascade = [fk for fk in self.report["foreign_keys"] 
                         if fk.get("ondelete") not in ["CASCADE", "SET NULL"]]
        if fks_no_cascade:
            recommendations.append(
                f"⚠️  {len(fks_no_cascade)} Foreign Keys sem CASCADE - considere adicionar para melhorar limpeza de dados órfãos"
            )
        else:
            recommendations.append("✅ Todos os Foreign Keys têm política de deleção apropriada")
        
        # Verificar índices
        total_indexes = sum(len(t["indexes"]) for t in self.report["tables"])
        if total_indexes > 0:
            recommendations.append(f"✅ {total_indexes} índices encontrados para otimização de queries")
        else:
            recommendations.append("⚠️  Considere adicionar índices em colunas frequentemente consultadas")
        
        # Dados
        if self.report["statistics"].get("events", 0) > 0:
            recommendations.append(f"✅ Calendário populado com {self.report['statistics']['events']} eventos")
        else:
            recommendations.append("⚠️  Execute seed de calendário para popular eventos")
        
        if self.report["statistics"].get("bncc_skills", 0) > 0:
            recommendations.append(f"✅ BNCC populada com {self.report['statistics']['bncc_skills']} habilidades")
        else:
            recommendations.append("⚠️  Execute seed de BNCC")
        
        self.report["recommendations"] = recommendations
        
        for rec in recommendations:
            print(f"   {rec}")
        
        print()
    
    def close(self):
        """Fecha sessão"""
        self.session.close()


def main():
    audit = DatabaseAudit()
    
    try:
        report = audit.run_audit()
        audit.close()
        
        # Salvar relatório em JSON
        report_file = Path(__file__).parent.parent.parent / "AUDIT_REPORT.json"
        with open(report_file, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False, default=str)
        
        print(f"📄 Relatório JSON salvo em: {report_file}\n")
        
        return report
    
    except Exception as e:
        print(f"\n❌ Erro durante auditoria: {e}")
        import traceback
        traceback.print_exc()
        return None
    
    finally:
        audit.close()


if __name__ == "__main__":
    main()
