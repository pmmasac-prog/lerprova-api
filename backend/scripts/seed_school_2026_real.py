"""
Script de Importação - Dados REAIS da C.E. Alcides César Meneses 2026
Usa o arquivo JSON com dados precisos do calendário e estrutura escolar
"""
import sys
import os
import json
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal, engine
import models

def load_calendar_json():
    """Carrega o arquivo JSON com dados reais"""
    json_path = os.path.join(os.path.dirname(__file__), '..', 'dados_app_gestao_escolar_2026.json')
    
    if not os.path.exists(json_path):
        print(f"❌ Arquivo não encontrado: {json_path}")
        return None
    
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Erro ao carregar JSON: {e}")
        return None


def seed_from_json():
    """Importa dados do JSON para o banco"""
    
    print("\n" + "="*60)
    print("🌱 IMPORTAÇÃO DE DADOS REAIS - C.E. ALCIDES CÉSAR MENESES 2026")
    print("="*60 + "\n")
    
    # Carregar JSON
    data = load_calendar_json()
    if not data:
        return False
    
    print("✅ JSON carregado com sucesso\n")
    
    # Garantir tabelas
    print("📋 Criando tabelas...")
    models.Base.metadata.create_all(bind=engine)
    print("  ✅ Tabelas verificadas\n")
    
    db = SessionLocal()
    
    try:
        # 1. Escolas
        print("🏫 Importando ESCOLAS...")
        for school_data in data.get('schools', []):
            exists = db.query(models.School).filter(
                models.School.id == school_data['school_id']
            ).first()
            
            if not exists:
                school = models.School(
                    id=school_data['school_id'],
                    school_name=school_data['school_name'],
                    organization_name=school_data.get('organization_name'),
                    active=school_data.get('active', True)
                )
                db.add(school)
                print(f"  ✅ {school_data['school_name']}")
            else:
                print(f"  ⏭️  {school_data['school_name']} já existe")
        
        db.commit()
        print()
        
        # 2. Anos Letivos
        print("📚 Importando ANOS LETIVOS...")
        for ay_data in data.get('academic_years', []):
            exists = db.query(models.AcademicYear).filter(
                models.AcademicYear.id == ay_data['academic_year_id']
            ).first()
            
            if not exists:
                ay = models.AcademicYear(
                    id=ay_data['academic_year_id'],
                    school_id=ay_data['school_id'],
                    year_label=ay_data['year_label'],
                    start_date=ay_data.get('pedagogical_start_date', ay_data.get('official_class_start_date')),
                    end_date=ay_data.get('academic_year_end_date'),
                    total_school_days=ay_data.get('total_school_days', 200),
                    notes=ay_data.get('notes')
                )
                db.add(ay)
                print(f"  ✅ {ay_data['year_label']}")
            else:
                print(f"  ⏭️  {ay_data['year_label']} já existe")
        
        db.commit()
        print()
        
        # 3. Períodos
        print("📅 Importando PERÍODOS...")
        for period_data in data.get('periods', []):
            exists = db.query(models.Period).filter(
                models.Period.id == period_data['period_id']
            ).first()
            
            if not exists:
                period = models.Period(
                    id=period_data['period_id'],
                    academic_year_id=period_data['academic_year_id'],
                    period_number=period_data['period_number'],
                    period_name=period_data['period_name'],
                    start_date=period_data['start_date'],
                    end_date=period_data['end_date'],
                    status=period_data.get('status', 'active')
                )
                db.add(period)
                print(f"  ✅ {period_data['period_name']} ({period_data['start_date']} a {period_data['end_date']})")
            else:
                print(f"  ⏭️  {period_data['period_name']} já existe")
        
        db.commit()
        print()
        
        # 4. Eventos
        print("🗓️  Importando EVENTOS...")
        event_count = 0
        for event_data in data.get('events', []):
            exists = db.query(models.Event).filter(
                models.Event.academic_year_id == event_data['academic_year_id'],
                models.Event.title == event_data['title']
            ).first()
            
            if not exists:
                event = models.Event(
                    academic_year_id=event_data['academic_year_id'],
                    event_type_id=event_data['event_type_id'],
                    title=event_data['title'],
                    start_date=event_data['start_date'],
                    end_date=event_data['end_date'],
                    is_school_day=not event_data['event_type_id'] in ['holiday', 'vacation'],
                    description=event_data.get('source_notes', '')
                )
                db.add(event)
                event_count += 1
        
        if event_count > 0:
            db.commit()
            print(f"  ✅ {event_count} evento(s) criado(s)")
        
        print()
        
        # Resumo final
        print("="*60)
        print("✅ IMPORTAÇÃO CONCLUÍDA COM SUCESSO!")
        print("="*60)
        print("\n📊 Dados Importados da C.E. Alcides César Meneses:")
        print(f"  • Escola: Centro de Ensino Alcides César Meneses")
        print(f"  • Ano Letivo: 2026")
        print(f"  • Períodos: {len(data.get('periods', []))}")
        print(f"  • Eventos: {len(data.get('events', []))}")
        print("\n🔗 Próximas etapas:")
        print("  • Acesse: http://localhost:3000/admin/calendario")
        print("  • Todos os eventos de 2026 estarão visíveis")
        print()
        
        return True
    
    except Exception as e:
        print(f"\n❌ Erro durante importação: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    
    finally:
        db.close()


if __name__ == "__main__":
    success = seed_from_json()
    sys.exit(0 if success else 1)
