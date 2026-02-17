from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from datetime import datetime
import users_db
import models
import auth_utils
from database import get_db
from dependencies import get_current_user
import logging

router = APIRouter(tags=["auth"])
logger = logging.getLogger("lerprova-api")

@router.get("/stats")
async def get_stats(user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Filtros baseados no papel do usuário
    if user.role != "admin":
        turmas_count = db.query(models.Turma).filter(models.Turma.user_id == user.id).count()
        alunos_count = db.query(models.Aluno).join(models.Turma, models.Aluno.turmas).filter(models.Turma.user_id == user.id).distinct().count()
        provas_count = db.query(models.Resultado).join(models.Gabarito).filter(models.Gabarito.turmas.any(models.Turma.user_id == user.id)).count()
    else:
        turmas_count = db.query(models.Turma).count()
        alunos_count = db.query(models.Aluno).count()
        provas_count = db.query(models.Resultado).count()
        
    return {
        "turmas": turmas_count,
        "alunos": alunos_count,
        "provas_corrigidas": provas_count,
        "professor": user.nome
    }

@router.get("/stats/turma/{turma_id}")
async def get_stats_turma(turma_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Validar Acesso à Turma (RBAC)
    turma = db.query(models.Turma).filter(models.Turma.id == turma_id).first()
    if not turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada")
    
    if user.role != "admin" and turma.user_id != user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")
        
    resultados = db.query(models.Resultado).join(models.Gabarito).filter(models.Gabarito.turmas.any(models.Turma.id == turma_id)).all()
    
    total_provas = len(resultados)
    media_geral = sum(r.nota for r in resultados) / total_provas if total_provas > 0 else 0
    
    return {
        "turma": turma.nome,
        "total_provas": total_provas,
        "media_geral": round(media_geral, 1),
        "alunos_count": len(turma.alunos)
    }

@router.get("/billing/status")
async def get_billing_status(user: users_db.User = Depends(get_current_user)):
    return {
        "plan": user.plan_type,
        "corrections_used": user.total_corrections_used,
        "is_pro": user.plan_type in ["pro", "school"],
        "expires_at": user.subscription_expires_at
    }

@router.post("/billing/upgrade")
async def upgrade_plan(data: dict, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Simulação de upgrade para Pro (Em prod, aqui integraria com o Webhook do Mercado Pago)
    target_plan = data.get("plan", "pro")
    user.plan_type = target_plan
    db.commit()
    return {"message": f"Sucesso! Seu plano foi atualizado para {target_plan}.", "plan": user.plan_type}

@router.post("/auth/login")
async def login(data: dict, db: Session = Depends(get_db)):
    email = data.get("email")
    password = data.get("password")
    
    user = users_db.get_user_by_email(db, email)
    
    if user and user.verify_password(password):
        # Gerar Token JWT Real
        token = auth_utils.create_access_token(data={"sub": user.email, "user_id": user.id, "role": user.role})
        
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "nome": user.nome,
                "email": user.email,
                "escola": user.escola,
                "role": user.role
            }
        }
    
    raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")
