"""
Script de Semeadura - Gestão Escolar 2026
Popula as tabelas: schools, academic_years, periods, events, alunos, turmas
Com dados reais da C.E. ALCIDES CÉSAR MENESES e alunos testáveis
"""
import sys
import os
from datetime import datetime, date

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal, engine
import models
from sqlalchemy.orm import Session

def seed_schools(db: Session):
    """Popula tabela de escolas"""
    print("🏫 Populando ESCOLAS...")
    
    schools_data = [
        {
            "id": "CEACM2026",
            "school_name": "C.E. ALCIDES CÉSAR MENESES",
            "organization_name": "Secretaria de Educação - Estado de São Paulo",
        },
        {
            "id": "EMJP2026",
            "school_name": "E.M. JOSÉ PAULO",
            "organization_name": "Secretaria de Educação - Município",
        },
    ]
    
    for school_data in schools_data:
        exists = db.query(models.School).filter(models.School.id == school_data["id"]).first()
        if not exists:
            school = models.School(**school_data, active=True)
            db.add(school)
            print(f"  ✅ Escola criada: {school_data['school_name']}")
        else:
            print(f"  ⏭️  Escola já existe: {school_data['school_name']}")
    
    db.commit()


def seed_academic_years(db: Session):
    """Popula tabela de anos letivos"""
    print("📚 Populando ANOS LETIVOS...")
    
    academic_years_data = [
        {
            "id": "2026",
            "school_id": "CEACM2026",
            "year_label": "2026",
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "total_school_days": 200,
            "notes": "Ano letivo completo de 2026"
        },
        {
            "id": "2026_EMJP",
            "school_id": "EMJP2026",
            "year_label": "2026",
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "total_school_days": 200,
            "notes": "Ano letivo 2026 - E.M. José Paulo"
        }
    ]
    
    for ay_data in academic_years_data:
        exists = db.query(models.AcademicYear).filter(models.AcademicYear.id == ay_data["id"]).first()
        if not exists:
            ay = models.AcademicYear(**ay_data)
            db.add(ay)
            print(f"  ✅ Ano letivo criado: {ay_data['year_label']} - {ay_data['school_id']}")
        else:
            print(f"  ⏭️  Ano letivo já existe: {ay_data['id']}")
    
    db.commit()


def seed_periods(db: Session):
    """Popula tabela de períodos (bimestres)"""
    print("📅 Populando PERÍODOS (Bimestres)...")
    
    periods_data = [
        # 1º Bimestre
        {
            "id": "P1_2026",
            "academic_year_id": "2026",
            "period_number": 1,
            "period_name": "1º Bimestre",
            "start_date": "2026-01-01",
            "end_date": "2026-03-31",
            "status": "active"
        },
        # 2º Bimestre
        {
            "id": "P2_2026",
            "academic_year_id": "2026",
            "period_number": 2,
            "period_name": "2º Bimestre",
            "start_date": "2026-04-01",
            "end_date": "2026-06-30",
            "status": "active"
        },
        # 3º Bimestre
        {
            "id": "P3_2026",
            "academic_year_id": "2026",
            "period_number": 3,
            "period_name": "3º Bimestre",
            "start_date": "2026-07-01",
            "end_date": "2026-09-30",
            "status": "active"
        },
        # 4º Bimestre
        {
            "id": "P4_2026",
            "academic_year_id": "2026",
            "period_number": 4,
            "period_name": "4º Bimestre",
            "start_date": "2026-10-01",
            "end_date": "2026-12-31",
            "status": "active"
        }
    ]
    
    for period_data in periods_data:
        exists = db.query(models.Period).filter(models.Period.id == period_data["id"]).first()
        if not exists:
            period = models.Period(**period_data)
            db.add(period)
            print(f"  ✅ Período criado: {period_data['period_name']}")
        else:
            print(f"  ⏭️  Período já existe: {period_data['id']}")
    
    db.commit()


def seed_events(db: Session):
    """Popula tabela de eventos do calendário"""
    print("🗓️  Populando EVENTOS DO CALENDÁRIO...")
    
    events_data = [
        # Feriados 2026
        {"title": "Confraternização Universal", "start_date": "2026-01-01", "end_date": "2026-01-01", "is_school_day": False, "event_type_id": "holiday"},
        {"title": "Tiradentes", "start_date": "2026-04-21", "end_date": "2026-04-21", "is_school_day": False, "event_type_id": "holiday"},
        {"title": "Dia do Trabalho", "start_date": "2026-05-01", "end_date": "2026-05-01", "is_school_day": False, "event_type_id": "holiday"},
        {"title": "Corpus Christi", "start_date": "2026-05-14", "end_date": "2026-05-14", "is_school_day": False, "event_type_id": "holiday"},
        {"title": "Independência do Brasil", "start_date": "2026-09-07", "end_date": "2026-09-07", "is_school_day": False, "event_type_id": "holiday"},
        {"title": "Nossa Senhora Aparecida", "start_date": "2026-10-12", "end_date": "2026-10-12", "is_school_day": False, "event_type_id": "holiday"},
        {"title": "Finados", "start_date": "2026-11-02", "end_date": "2026-11-02", "is_school_day": False, "event_type_id": "holiday"},
        {"title": "Proclamação da República", "start_date": "2026-11-15", "end_date": "2026-11-15", "is_school_day": False, "event_type_id": "holiday"},
        {"title": "Consciência Negra", "start_date": "2026-11-20", "end_date": "2026-11-20", "is_school_day": False, "event_type_id": "holiday"},
        {"title": "Natal", "start_date": "2026-12-25", "end_date": "2026-12-25", "is_school_day": False, "event_type_id": "holiday"},
        
        # Provas/Avaliações
        {"title": "Avaliação Diagnóstica 1º Bimestre", "start_date": "2026-02-15", "end_date": "2026-02-19", "is_school_day": True, "event_type_id": "exam"},
        {"title": "Avaliação Bimestral 1º Bimestre", "start_date": "2026-03-15", "end_date": "2026-03-20", "is_school_day": True, "event_type_id": "exam"},
        {"title": "Avaliação Bimestral 2º Bimestre", "start_date": "2026-06-15", "end_date": "2026-06-20", "is_school_day": True, "event_type_id": "exam"},
        {"title": "Avaliação Bimestral 3º Bimestre", "start_date": "2026-09-15", "end_date": "2026-09-20", "is_school_day": True, "event_type_id": "exam"},
        {"title": "Avaliação Final 4º Bimestre", "start_date": "2026-11-15", "end_date": "2026-11-20", "is_school_day": True, "event_type_id": "exam"},
        
        # Eventos Administrativos
        {"title": "Planejamento Pedagógico", "start_date": "2026-01-30", "end_date": "2026-02-02", "is_school_day": False, "event_type_id": "planning"},
        {"title": "Reunião de Pais 1º Bimestre", "start_date": "2026-03-28", "end_date": "2026-03-28", "is_school_day": False, "event_type_id": "meeting"},
        {"title": "Reunião de Pais 2º Bimestre", "start_date": "2026-06-28", "end_date": "2026-06-28", "is_school_day": False, "event_type_id": "meeting"},
        {"title": "Reunião de Pais 3º Bimestre", "start_date": "2026-09-26", "end_date": "2026-09-26", "is_school_day": False, "event_type_id": "meeting"},
        {"title": "Entrega de Boletins Finais", "start_date": "2026-12-18", "end_date": "2026-12-18", "is_school_day": False, "event_type_id": "administrative"},
    ]
    
    event_count = 0
    for event_data in events_data:
        # Verificar se evento similar já existe
        exists = db.query(models.Event).filter(
            models.Event.academic_year_id == "2026",
            models.Event.title == event_data["title"]
        ).first()
        
        if not exists:
            event = models.Event(
                academic_year_id="2026",
                event_type_id=event_data["event_type_id"],
                title=event_data["title"],
                start_date=event_data["start_date"],
                end_date=event_data["end_date"],
                is_school_day=event_data["is_school_day"],
                description=f"Evento: {event_data['event_type_id'].upper()}"
            )
            db.add(event)
            event_count += 1
    
    if event_count > 0:
        db.commit()
        print(f"  ✅ {event_count} evento(s) criado(s)")
    else:
        print(f"  ⏭️  Todos os eventos já existem")


def seed_alunos(db: Session):
    """Popula tabela de alunos testáveis"""
    print("👥 Populando ALUNOS TESTÁVEIS...")
    
    alunos_data = [
        # Alunos para teste
        {"nome": "João Silva Santos", "codigo": "2026001", "email": "joao.silva@example.com", "data_nasc": "2008-05-15"},
        {"nome": "Maria Clara Oliveira", "codigo": "2026002", "email": "maria.clara@example.com", "data_nasc": "2008-07-22"},
        {"nome": "Pedro Martins Costa", "codigo": "2026003", "email": "pedro.martins@example.com", "data_nasc": "2008-09-10"},
        {"nome": "Ana Carolina Ferreira", "codigo": "2026004", "email": "ana.carolina@example.com", "data_nasc": "2008-11-03"},
        {"nome": "Lucas Pereira Gomes", "codigo": "2026005", "email": "lucas.pereira@example.com", "data_nasc": "2008-02-28"},
        {"nome": "Beatriz Mendes Lima", "codigo": "2026006", "email": "beatriz.mendes@example.com", "data_nasc": "2008-04-11"},
        {"nome": "Fernando Alves Rodrigues", "codigo": "2026007", "email": "fernando.alves@example.com", "data_nasc": "2008-06-19"},
        {"nome": "Camila Souza Moreira", "codigo": "2026008", "email": "camila.souza@example.com", "data_nasc": "2008-08-27"},
        {"nome": "Rafael Tavares Dias", "codigo": "2026009", "email": "rafael.tavares@example.com", "data_nasc": "2008-10-05"},
        {"nome": "Isabela Costa Barbosa", "codigo": "2026010", "email": "isabela.costa@example.com", "data_nasc": "2008-12-14"},
        
        # Alunos adicionais para turmas maiores
        {"nome": "Gustavo Henrique Silva", "codigo": "2026011", "email": "gustavo.henrique@example.com", "data_nasc": "2008-01-25"},
        {"nome": "Sofia Ribeiro Santos", "codigo": "2026012", "email": "sofia.ribeiro@example.com", "data_nasc": "2008-03-09"},
        {"nome": "Diego Martins Nunes", "codigo": "2026013", "email": "diego.martins@example.com", "data_nasc": "2008-05-17"},
        {"nome": "Juliana Lima Costa", "codigo": "2026014", "email": "juliana.lima@example.com", "data_nasc": "2008-07-31"},
        {"nome": "Matheus Rocha Pereira", "codigo": "2026015", "email": "matheus.rocha@example.com", "data_nasc": "2008-09-12"},
        {"nome": "Victoria Campos Silva", "codigo": "2026016", "email": "victoria.campos@example.com", "data_nasc": "2008-11-22"},
        {"nome": "Bruno Eduardo Oliveira", "codigo": "2026017", "email": "bruno.eduardo@example.com", "data_nasc": "2008-02-07"},
        {"nome": "Amanda Barbosa Costa", "codigo": "2026018", "email": "amanda.barbosa@example.com", "data_nasc": "2008-04-18"},
        {"nome": "Cristian Felipe Gomes", "codigo": "2026019", "email": "cristian.felipe@example.com", "data_nasc": "2008-06-25"},
        {"nome": "Gabriela Ferreira Alves", "codigo": "2026020", "email": "gabriela.ferreira@example.com", "data_nasc": "2008-08-30"},
    ]
    
    aluno_count = 0
    for aluno_data in alunos_data:
        exists = db.query(models.Aluno).filter(models.Aluno.codigo == aluno_data["codigo"]).first()
        if not exists:
            aluno = models.Aluno(
                nome=aluno_data["nome"],
                codigo=aluno_data["codigo"],
                email=aluno_data.get("email"),
                data_nascimento=aluno_data.get("data_nasc"),
                active=True
            )
            db.add(aluno)
            aluno_count += 1
    
    if aluno_count > 0:
        db.commit()
        print(f"  ✅ {aluno_count} aluno(s) criado(s)")
    else:
        print(f"  ⏭️  Todos os alunos já existem")


def seed_turmas(db: Session):
    """Popula tabela de turmas (salas)"""
    print("🏫 Populando TURMAS (SALAS)...")
    
    # Primeiro, garantir que temos um usuário admin para vincular as turmas master
    from users_db import User
    admin_user = db.query(User).filter(User.role == "admin").first()
    
    if not admin_user:
        print("  ⚠️  Nenhum usuário admin encontrado. Criando turmas sem vínculo.")
        admin_id = None
    else:
        admin_id = admin_user.id
        print(f"  📌 Usando admin ID: {admin_id}")
    
    turmas_data = [
        {
            "nome": "1EM-A - Português",
            "disciplina": "Língua Portuguesa",
            "escola": "C.E. ALCIDES CÉSAR MENESES",
            "alunos_codigos": ["2026001", "2026002", "2026003", "2026004", "2026005"],
        },
        {
            "nome": "1EM-B - Matemática",
            "disciplina": "Matemática",
            "escola": "C.E. ALCIDES CÉSAR MENESES",
            "alunos_codigos": ["2026006", "2026007", "2026008", "2026009", "2026010"],
        },
        {
            "nome": "2EM-A - Ciências",
            "disciplina": "Biologia",
            "escola": "C.E. ALCIDES CÉSAR MENESES",
            "alunos_codigos": ["2026011", "2026012", "2026013", "2026014", "2026015"],
        },
        {
            "nome": "2EM-B - História",
            "disciplina": "História",
            "escola": "C.E. ALCIDES CÉSAR MENESES",
            "alunos_codigos": ["2026016", "2026017", "2026018", "2026019", "2026020"],
        },
    ]
    
    turma_count = 0
    for turma_data in turmas_data:
        exists = db.query(models.Turma).filter(models.Turma.nome == turma_data["nome"]).first()
        
        if not exists:
            turma = models.Turma(
                nome=turma_data["nome"],
                disciplina=turma_data["disciplina"],
                user_id=admin_id,  # Vinculado ao admin para ser "master"
                created_at=datetime.utcnow()
            )
            db.add(turma)
            db.flush()  # Força insert para pegar o ID
            
            # Adicionar alunos à turma
            for aluno_codigo in turma_data["alunos_codigos"]:
                aluno = db.query(models.Aluno).filter(models.Aluno.codigo == aluno_codigo).first()
                if aluno:
                    # Adicionar aluno à turma via tabela de associação
                    if aluno not in turma.alunos:
                        turma.alunos.append(aluno)
            
            turma_count += 1
            print(f"  ✅ Turma criada: {turma_data['nome']} ({len(turma_data['alunos_codigos'])} alunos)")
        else:
            print(f"  ⏭️  Turma já existe: {turma_data['nome']}")
    
    if turma_count > 0:
        db.commit()
        print(f"  ✅ {turma_count} turma(s) criada(s) com alunos vinculados")
    else:
        print(f"  ⏭️  Todas as turmas já existem")


def main():
    """Executa todo o processo de semeadura"""
    print("\n" + "="*60)
    print("🌱 INICIANDO SEMEADURA - GESTÃO ESCOLAR 2026")
    print("="*60 + "\n")
    
    # Garantir que as tabelas existem
    print("📋 Criando tabelas (se não existirem)...")
    models.Base.metadata.create_all(bind=engine)
    print("  ✅ Tabelas verificadas\n")
    
    db = SessionLocal()
    
    try:
        seed_schools(db)
        print()
        
        seed_academic_years(db)
        print()
        
        seed_periods(db)
        print()
        
        seed_events(db)
        print()
        
        seed_alunos(db)
        print()
        
        seed_turmas(db)
        print()
        
        print("="*60)
        print("✅ SEMEADURA CONCLUÍDA COM SUCESSO!")
        print("="*60)
        print("\n📊 Resumo do que foi populado:")
        print("  • Escolas: C.E. ALCIDES CÉSAR MENESES + E.M. JOSÉ PAULO")
        print("  • Anos Letivos: 2026")
        print("  • Períodos: 4 bimestres")
        print("  • Eventos: 20 eventos (feriados, provas, reuniões)")
        print("  • Alunos: 20 alunos testáveis")
        print("  • Turmas: 4 turmas com alunos vinculados")
        print("\n🔗 Links úteis:")
        print("  • GET /admin/schools → Lista de escolas")
        print("  • GET /admin/calendar → Calendário 2026")
        print("  • GET /admin/students → Lista de alunos")
        print("  • POST /admin/generate-carteirinha/{aluno_id} → Gerar carteirinha")
        print()
    
    except Exception as e:
        print(f"\n❌ Erro durante semeadura: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    
    finally:
        db.close()


if __name__ == "__main__":
    main()
