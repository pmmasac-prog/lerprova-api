from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import users_db
import models
from database import get_db
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, distinct
from dependencies import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])

class UserCreate(BaseModel):
    nome: str
    email: str
    password: str
    role: str = "professor"
    escola: Optional[str] = ""
    disciplina: Optional[str] = ""

class UserUpdate(BaseModel):
    nome: Optional[str] = None
    role: Optional[str] = None
    escola: Optional[str] = None
    disciplina: Optional[str] = None

# Dependência para verificar se o usuário é admin via JWT
async def verify_admin(user = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    return user

@router.get("/users")
async def list_users(admin_user = Depends(verify_admin), db: Session = Depends(get_db)):
    users = db.query(users_db.User).all()
    # Retorna usuários sem o hash da senha e em formato dicionário simples
    return [
        {
            "id": u.id,
            "nome": u.nome,
            "email": u.email,
            "role": u.role,
            "escola": u.escola,
            "disciplina": u.disciplina,
            "is_active": u.is_active,
            "plan_type": u.plan_type,
            "total_corrections_used": u.total_corrections_used
        } for u in users
    ]

@router.post("/users")
async def create_new_user(user: UserCreate, admin_user = Depends(verify_admin), db: Session = Depends(get_db)):
    existing = users_db.get_user_by_email(db, user.email)
    if existing:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")
    
    new_user = users_db.create_user(db, user.dict())
    return {"message": "Usuário criado com sucesso", "user": {"id": new_user.id, "email": new_user.email}}

@router.delete("/users/{user_id}")
async def delete_user(user_id: int, admin_user = Depends(verify_admin), db: Session = Depends(get_db)):
    user = db.query(users_db.User).filter(users_db.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    if user.id == admin_user.id:
        raise HTTPException(status_code=400, detail="Não é possível excluir a si mesmo")
        
    db.delete(user)
    db.commit()
    return {"message": "Usuário removido com sucesso"}


@router.get("/turmas")
async def list_all_turmas(admin_user = Depends(verify_admin), db: Session = Depends(get_db)):
    # Retorna todas as turmas com info do professor
    turmas = db.query(models.Turma).options(joinedload(models.Turma.professor)).all()
    
    result = []
    for t in turmas:
        t_dict = {
            "id": t.id,
            "nome": t.nome,
            "disciplina": t.disciplina,
            "user_id": t.user_id,
            "professor_nome": t.professor.nome if t.professor else "Sem Professor",
            "professor_email": t.professor.email if t.professor else ""
        }
        result.append(t_dict)
    return result

@router.put("/turmas/{turma_id}/transfer/{user_id}")
async def transfer_turma(turma_id: int, user_id: int, admin_user = Depends(verify_admin), db: Session = Depends(get_db)):
    turma = db.query(models.Turma).filter(models.Turma.id == turma_id).first()
    if not turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada")
    
    new_prof = db.query(users_db.User).filter(users_db.User.id == user_id).first()
    if not new_prof:
         raise HTTPException(status_code=404, detail="Novo professor não encontrado")
         
    turma.user_id = user_id
    db.commit()
    
    return {"message": f"Turma '{turma.nome}' transferida para {new_prof.nome}"}

# --- GESTÃO ESCOLAR MASTER ---

class StudentImport(BaseModel):
    nome: str
    codigo: str

class RoomImport(BaseModel):
    nome: str
    alunos: List[StudentImport]

class SchoolImport(BaseModel):
    school_id: str
    school_name: str
    organization_name: Optional[str] = None

class AcademicYearImport(BaseModel):
    id: str
    school_id: str
    year_label: str
    official_class_start_date: str
    academic_year_end_date: str
    total_school_days: int

class PeriodImport(BaseModel):
    period_id: str
    academic_year_id: str
    period_number: int
    period_name: str
    start_date: str
    end_date: str

class EventImport(BaseModel):
    academic_year_id: str
    event_type_id: str
    title: str
    start_date: str
    end_date: str
    is_school_day: bool

@router.post("/import-master")
async def import_master_data(
    schools: List[SchoolImport],
    academic_years: List[AcademicYearImport],
    periods: List[PeriodImport],
    events: List[EventImport],
    admin_user = Depends(verify_admin), 
    db: Session = Depends(get_db)
):
    """
    Importação da estrutura completa de 2026 via JSON (Alcides César Meneses).
    """
    # 1. Escolas
    for s in schools:
        exists = db.query(models.School).filter(models.School.id == s.school_id).first()
        if not exists:
            db.add(models.School(id=s.school_id, school_name=s.school_name, organization_name=s.organization_name))
    
    # 2. Anos Letivos
    for ay in academic_years:
        exists = db.query(models.AcademicYear).filter(models.AcademicYear.id == ay.id).first()
        if not exists:
            db.add(models.AcademicYear(
                id=ay.id, school_id=ay.school_id, year_label=ay.year_label,
                start_date=ay.official_class_start_date, end_date=ay.academic_year_end_date,
                total_school_days=ay.total_school_days
            ))

    # 3. Períodos
    for p in periods:
        exists = db.query(models.Period).filter(models.Period.id == p.period_id).first()
        if not exists:
            db.add(models.Period(
                id=p.period_id, academic_year_id=p.academic_year_id,
                period_number=p.period_number, period_name=p.period_name,
                start_date=p.start_date, end_date=p.end_date
            ))

    # 4. Eventos
    for e in events:
        db.add(models.Event(
            academic_year_id=e.academic_year_id, event_type_id=e.event_type_id,
            title=e.title, start_date=e.start_date, end_date=e.end_date,
            is_school_day=e.is_school_day
        ))

    db.commit()
    return {"message": "Estrutura master importada com sucesso"}

@router.get("/schools")
async def list_schools(admin_user = Depends(verify_admin), db: Session = Depends(get_db)):
    """Lista as escolas reais do banco de dados."""
    schools = db.query(models.School).all()
    return [
        {
            "id": s.id,
            "name": s.school_name,
            "address": s.organization_name or "Endereço não informado",
            "units": 1 # Unidade padrão
        } for s in schools
    ]

@router.get("/calendar")
async def get_calendar_events(admin_user = Depends(verify_admin), db: Session = Depends(get_db)):
    """Busca o calendário mestre real (2026)."""
    events = db.query(models.Event).all()
    periods = db.query(models.Period).all()
    
    return {
        "events": [
            {
                "id": e.id,
                "title": e.title,
                "date": e.start_date,
                "type": "holiday" if not e.is_school_day else "activity",
                "description": f"Tipo: {e.event_type_id}"
            } for e in events
        ],
        "periods": [
            {
                "id": p.id,
                "name": p.period_name,
                "start": p.start_date,
                "end": p.end_date
            } for p in periods
        ]
    }

@router.get("/students")
async def list_all_students(admin_user = Depends(verify_admin), db: Session = Depends(get_db)):
    """Busca a lista real de todos os alunos no ecossistema."""
    students = db.query(models.Aluno).options(joinedload(models.Aluno.turmas)).all()
    return [
        {
            "id": s.id,
            "nome": s.nome,
            "codigo": s.codigo,
            "turma": s.turmas[0].nome if s.turmas else "Sem Turma",
            "unidade": "C.E. ALCIDES CÉSAR MENESES" # Default
        } for s in students
    ]

@router.post("/generate-carteirinha")
async def generate_student_card(aluno_id: int, admin_user = Depends(verify_admin), db: Session = Depends(get_db)):
    """
    Gera dados estruturados para a carteirinha (identidade estudantil).
    No futuro gerará PDF, por ora retorna o template de dados.
    """
    aluno = db.query(models.Aluno).filter(models.Aluno.id == aluno_id).first()
    if not aluno:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    
    return {
        "nome": aluno.nome,
        "matricula": aluno.codigo,
        "token": aluno.qr_token,
        "expiracao": "2026-12-31",
        "escola": "C.E. Alcides César Meneses"
    }

@router.get("/pendencias")
async def list_teacher_pendencies(admin_user = Depends(verify_admin), db: Session = Depends(get_db)):
    """Busca pendências críticas de todos os professores no ecossistema."""
    from datetime import datetime
    hoje = datetime.utcnow().date()
    
    # 1. Buscar todos os professores
    professores = db.query(users_db.User).filter(users_db.User.role == "professor").all()
    
    result = []
    for prof in professores:
        # Pendências de correção
        turmas_ids = [t.id for t in prof.turmas]
        if not turmas_ids:
            continue
            
        # -- Provas pendentes (Gabaritos sem todos os resultados)
        gabaritos = db.query(models.Gabarito).filter(
            models.Gabarito.turmas.any(models.Turma.id.in_(turmas_ids))
        ).all()
        
        provas_pendentes_count = 0
        for g in gabaritos:
            total_alunos = db.query(func.count(distinct(models.Aluno.id))).join(
                models.aluno_turma
            ).filter(
                models.aluno_turma.c.turma_id.in_([t.id for t in g.turmas])
            ).scalar() or 0
            
            resultados_count = db.query(func.count(models.Resultado.id)).filter(
                models.Resultado.gabarito_id == g.id
            ).scalar() or 0
            
            if total_alunos > resultados_count:
                provas_pendentes_count += 1
                
        # -- Aulas Esquecidas (Agendadas para o passado e ainda pendentes)
        aulas_esquecidas = db.query(models.AulaPlanejada).join(models.Plano).filter(
            models.Plano.user_id == prof.id,
            models.AulaPlanejada.scheduled_date < hoje.strftime("%Y-%m-%d"),
            models.AulaPlanejada.status == "pending"
        ).count()
        
        if provas_pendentes_count > 0 or aulas_esquecidas > 0:
            result.append({
                "professor_id": prof.id,
                "nome": prof.nome,
                "email": prof.email,
                "escola": prof.escola,
                "total_pendencias": provas_pendentes_count + aulas_esquecidas,
                "detalhes": {
                    "provas_sem_nota": provas_pendentes_count,
                    "aulas_esquecidas": aulas_esquecidas
                }
            })
            
    # Ordenar por maior número de pendências
    result.sort(key=lambda x: x["total_pendencias"], reverse=True)
    return result

@router.post("/notificar")
async def notify_professor(payload: dict, admin_user = Depends(verify_admin), db: Session = Depends(get_db)):
    """Simula o envio de uma notificação para o professor."""
    prof_id = payload.get("professor_id")
    prof = db.query(users_db.User).filter(users_db.User.id == prof_id).first()
    
    if not prof:
        raise HTTPException(status_code=404, detail="Professor não encontrado")
    
    # Criar a notificação real no banco de dados
    nova_notificacao = models.Notification(
        user_id=prof.id,
        title=payload.get("title", "Pendência Identificada"),
        message=payload.get("message", "Você tem pendências que precisam de sua atenção no sistema."),
        type=payload.get("type", "warning")
    )
    
    db.add(nova_notificacao)
    db.commit()
        
    return {
        "status": "success",
        "message": f"Professor {prof.nome} foi notificado com sucesso!",
        "channel": "db/push"
    }

class StudentImport(BaseModel):
    nome: str
    codigo: str
    nome_responsavel: Optional[str] = None
    telefone_responsavel: Optional[str] = None
    email_responsavel: Optional[str] = None
    data_nascimento: Optional[str] = None

class RoomImport(BaseModel):
    nome: str
    alunos: List[StudentImport]

@router.post("/import-master")
async def import_master_data(payload: List[RoomImport], admin_user = Depends(verify_admin), db: Session = Depends(get_db)):
    """
    Importação em massa de salas e alunos pela base central (ADM).
    """
    import random, string

    created_rooms = 0
    created_students = 0

    for room_data in payload:
        # 1. Cria a Turma (Master, vinculada ao ADM)
        nova_turma = models.Turma(
            nome=room_data.nome,
            disciplina="Base Central",
            user_id=admin_user.id
        )
        db.add(nova_turma)
        db.flush() # Para pegar o ID
        created_rooms += 1

        for stu in room_data.alunos:
            # 2. Verifica se o aluno já existe (pelo código/matrícula)
            aluno = db.query(models.Aluno).filter(models.Aluno.codigo == stu.codigo).first()
            
            if not aluno:
                # Gera QR token aleatório
                token = ''.join(random.choices(string.ascii_uppercase + string.digits, k=16))
                aluno = models.Aluno(
                    nome=stu.nome,
                    codigo=stu.codigo,
                    qr_token=token,
                    nome_responsavel=stu.nome_responsavel,
                    telefone_responsavel=stu.telefone_responsavel,
                    email_responsavel=stu.email_responsavel,
                    data_nascimento=stu.data_nascimento
                )
                db.add(aluno)
                db.flush()
                created_students += 1
            else:
                # Atualiza dados do responsável se fornecidos
                if stu.nome_responsavel:
                    aluno.nome_responsavel = stu.nome_responsavel
                if stu.telefone_responsavel:
                    aluno.telefone_responsavel = stu.telefone_responsavel
                if stu.email_responsavel:
                    aluno.email_responsavel = stu.email_responsavel
                if stu.data_nascimento:
                    aluno.data_nascimento = stu.data_nascimento
            
            # 3. Vincula o aluno à turma
            # Usa a tabela associativa models.aluno_turma
            db.execute(
                models.aluno_turma.insert().values(
                    aluno_id=aluno.id,
                    turma_id=nova_turma.id
                 )
            )

    db.commit()
    return {
        "message": "Importação concluída com sucesso",
        "turmas_criadas": created_rooms,
        "alunos_processados": created_students
    }


@router.get("/system-overview")
async def system_overview(admin_user=Depends(verify_admin), db: Session = Depends(get_db)):
    """Visão geral do sistema para o painel admin"""
    total_users = db.query(func.count(models.User.id)).scalar()
    total_turmas = db.query(func.count(models.Turma.id)).scalar()
    total_alunos = db.query(func.count(models.Aluno.id)).scalar()
    total_gabaritos = db.query(func.count(models.Gabarito.id)).scalar()
    total_resultados = db.query(func.count(models.Resultado.id)).scalar()
    total_eventos = db.query(func.count(models.Event.id)).scalar()
    total_freq = db.query(func.count(models.Frequencia.id)).scalar()
    total_planos = db.query(func.count(models.Plano.id)).scalar()
    total_schools = db.query(func.count(models.School.id)).scalar()

    # Média de notas
    avg_nota = db.query(func.avg(models.Resultado.nota)).scalar()

    # Frequência média (% presença)
    total_presencas = db.query(func.count(models.Frequencia.id)).filter(models.Frequencia.presente == True).scalar()
    pct_presenca = round((total_presencas / total_freq * 100), 1) if total_freq > 0 else 0

    return {
        "users": total_users,
        "turmas": total_turmas,
        "alunos": total_alunos,
        "gabaritos": total_gabaritos,
        "resultados": total_resultados,
        "eventos": total_eventos,
        "frequencia_registros": total_freq,
        "planos": total_planos,
        "schools": total_schools,
        "media_notas": round(avg_nota, 1) if avg_nota else 0,
        "pct_presenca": pct_presenca,
    }
