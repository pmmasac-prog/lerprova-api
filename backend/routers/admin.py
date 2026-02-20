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
        
    return {
        "status": "success",
        "message": f"Professor {prof.nome} foi notificado com sucesso!",
        "channel": "email/push"
    }
