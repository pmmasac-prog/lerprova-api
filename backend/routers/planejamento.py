from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta, date
import json
import users_db
import auth_utils
import models
from database import get_db
from sqlalchemy.orm import Session, joinedload
from dependencies import get_current_user

router = APIRouter(prefix="/planos", tags=["planejamento"])

class PlanoCreate(BaseModel):
    turma_id: int
    titulo: str
    disciplina: Optional[str] = None
    data_inicio: str  # YYYY-MM-DD
    aulas: List[dict]  # [{"ordem": 1, "titulo": "Intro"}, ...]
    intervalo_dias: int = 2

class RegistroAulaCreate(BaseModel):
    percepcoes: Optional[List[str]] = []
    observacoes: Optional[str] = None

@router.post("")
async def create_plano(data: PlanoCreate, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # RBAC: Validar acesso à turma
    if user.role != "admin":
        turma = db.query(models.Turma).filter(models.Turma.id == data.turma_id, models.Turma.user_id == user.id).first()
        if not turma:
            raise HTTPException(status_code=403, detail="Você não tem permissão para criar planos nesta turma")
    
    # Criar plano
    novo_plano = models.Plano(
        turma_id=data.turma_id,
        user_id=user.id,
        titulo=data.titulo,
        disciplina=data.disciplina,
        data_inicio=data.data_inicio
    )
    db.add(novo_plano)
    db.flush()
    
    # Calcular datas e criar aulas
    start_date = datetime.strptime(data.data_inicio, "%Y-%m-%d").date()
    for i, aula_data in enumerate(data.aulas):
        scheduled = start_date + timedelta(days=i * data.intervalo_dias)
        nova_aula = models.AulaPlanejada(
            plano_id=novo_plano.id,
            ordem=aula_data.get("ordem", i + 1),
            titulo=aula_data["titulo"],
            scheduled_date=scheduled.isoformat()
        )
        db.add(nova_aula)
    
    db.commit()
    db.refresh(novo_plano)
    return {"message": "Plano criado com sucesso", "id": novo_plano.id}

@router.get("/turma/{turma_id}")
async def get_planos_turma(turma_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # RBAC
    if user.role != "admin":
        turma = db.query(models.Turma).filter(models.Turma.id == turma_id, models.Turma.user_id == user.id).first()
        if not turma:
            raise HTTPException(status_code=403, detail="Acesso negado")
    
    planos = db.query(models.Plano).filter(models.Plano.turma_id == turma_id).options(joinedload(models.Plano.aulas)).all()
    
    result = []
    for p in planos:
        total_aulas = len(p.aulas)
        aulas_done = len([a for a in p.aulas if a.status == "done"])
        result.append({
            "id": p.id,
            "titulo": p.titulo,
            "disciplina": p.disciplina,
            "data_inicio": p.data_inicio,
            "total_aulas": total_aulas,
            "aulas_concluidas": aulas_done,
            "progresso": int((aulas_done / total_aulas) * 100) if total_aulas > 0 else 0
        })
    
    return result

@router.get("/{plano_id}/hoje")
async def get_aula_hoje(plano_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    plano = db.query(models.Plano).filter(models.Plano.id == plano_id).options(joinedload(models.Plano.aulas)).first()
    if not plano:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    
    # RBAC
    if user.role != "admin" and plano.user_id != user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    hoje = date.today().isoformat()
    
    # Critério 1: scheduled_date == hoje
    aula_hoje = next((a for a in plano.aulas if a.scheduled_date == hoje), None)
    
    # Fallback: primeira aula status != done
    if not aula_hoje:
        aula_hoje = next((a for a in plano.aulas if a.status != "done"), None)
    
    if not aula_hoje:
        return {"message": "Nenhuma aula pendente"}
    
    return {
        "id": aula_hoje.id,
        "titulo": aula_hoje.titulo,
        "ordem": aula_hoje.ordem,
        "scheduled_date": aula_hoje.scheduled_date,
        "status": aula_hoje.status
    }

# Registrar rotas de aulas separadamente ou no mesmo router
@router.post("/aulas/{aula_id}/concluir")
async def concluir_aula(aula_id: int, data: RegistroAulaCreate, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    aula = db.query(models.AulaPlanejada).filter(models.AulaPlanejada.id == aula_id).first()
    if not aula:
        raise HTTPException(status_code=404, detail="Aula não encontrada")
    
    plano = aula.plano
    if user.role != "admin" and plano.user_id != user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    # Marcar como done
    aula.status = "done"
    
    # Registrar percepções (ou "Normal" se vazio)
    percepcoes = data.percepcoes if data.percepcoes else []
    percepcoes_str = json.dumps(percepcoes) if percepcoes else json.dumps(["Normal"])
    
    ajustes = {}
    sugestao_reforco = False
    
    # Regra: "tempo" → recalcular datas
    if "tempo" in percepcoes:
        aulas_futuras = db.query(models.AulaPlanejada).filter(
            models.AulaPlanejada.plano_id == plano.id,
            models.AulaPlanejada.ordem > aula.ordem,
            models.AulaPlanejada.status == "pending"
        ).all()
        
        for a in aulas_futuras:
            current_date = datetime.strptime(a.scheduled_date, "%Y-%m-%d").date()
            a.scheduled_date = (current_date + timedelta(days=1)).isoformat()
        
        ajustes["datas_recalculadas"] = len(aulas_futuras)
    
    # Regra: "duvida" → sugerir reforço
    if "duvida" in percepcoes:
        sugestao_reforco = True
    
    # Criar registro
    registro = models.RegistroAula(
        aula_id=aula_id,
        user_id=user.id,
        percepcoes=percepcoes_str,
        observacoes=data.observacoes,
        ajustes_feitos=json.dumps(ajustes) if ajustes else None
    )
    db.add(registro)
    
    # Atualizar analytics_daily
    hoje = date.today().isoformat()
    analytics = db.query(models.AnalyticsDaily).filter(
        models.AnalyticsDaily.turma_id == plano.turma_id,
        models.AnalyticsDaily.data == hoje
    ).first()
    
    if not analytics:
        analytics = models.AnalyticsDaily(turma_id=plano.turma_id, data=hoje)
        db.add(analytics)
    
    # Calcular scores
    if "engajados" in percepcoes or "lab" in percepcoes:
        analytics.engajamento_score = 0.8
    if "duvida" in percepcoes or "tempo" in percepcoes:
        analytics.alerta_score = 0.6
    
    db.commit()
    
    return {
        "message": "Aula concluída com sucesso",
        "ajustes_feitos": ajustes,
        "sugestao_reforco": sugestao_reforco
    }

@router.post("/aulas/{aula_id}/inserir-reforco")
async def inserir_reforco(aula_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    aula = db.query(models.AulaPlanejada).filter(models.AulaPlanejada.id == aula_id).first()
    if not aula:
        raise HTTPException(status_code=404, detail="Aula não encontrada")
    
    plano = aula.plano
    if user.role != "admin" and plano.user_id != user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    # Inserir aula de reforço após a atual
    nova_ordem = aula.ordem + 0.5  # Hack: usar decimal para manter ordem
    reforco_date = (datetime.strptime(aula.scheduled_date, "%Y-%m-%d").date() + timedelta(days=2)).isoformat()
    
    reforco = models.AulaPlanejada(
        plano_id=plano.id,
        ordem=int(nova_ordem * 10),  # Converter para int
        titulo=f"Reforço: {aula.titulo}",
        scheduled_date=reforco_date,
        status="pending"
    )
    db.add(reforco)
    db.flush()
    
    # Recalcular datas das aulas futuras
    aulas_futuras = db.query(models.AulaPlanejada).filter(
        models.AulaPlanejada.plano_id == plano.id,
        models.AulaPlanejada.ordem > aula.ordem,
        models.AulaPlanejada.id != reforco.id,
        models.AulaPlanejada.status == "pending"
    ).all()
    
    for a in aulas_futuras:
        current_date = datetime.strptime(a.scheduled_date, "%Y-%m-%d").date()
        a.scheduled_date = (current_date + timedelta(days=2)).isoformat()
    
    db.commit()
    
    return {
        "message": "Reforço inserido com sucesso",
        "ajustes_feitos": {
            "reforco_inserido": True,
            "datas_recalculadas": len(aulas_futuras)
        }
    }

@router.get("/analytics/turma/{turma_id}/heatmap")
async def get_heatmap(turma_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # RBAC
    if user.role != "admin":
        turma = db.query(models.Turma).filter(models.Turma.id == turma_id, models.Turma.user_id == user.id).first()
        if not turma:
            raise HTTPException(status_code=403, detail="Acesso negado")
    
    # Últimos 15 dias
    hoje = date.today()
    inicio = hoje - timedelta(days=14)
    
    analytics = db.query(models.AnalyticsDaily).filter(
        models.AnalyticsDaily.turma_id == turma_id,
        models.AnalyticsDaily.data >= inicio.isoformat()
    ).all()
    
    result = []
    for a in analytics:
        result.append({
            "data": a.data,
            "engajamento": a.engajamento_score,
            "alerta": a.alerta_score
        })
    
    return result
