from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
import users_db
import models
from database import get_db
from dependencies import get_current_user
import logging
import json

router = APIRouter(prefix="/turmas", tags=["turmas"])
logger = logging.getLogger("lerprova-api")

@router.get("")
async def get_turmas(user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(models.Turma)
    if user.role != "admin":
        query = query.filter(models.Turma.user_id == user.id)
    
    turmas = query.all()
    # Retornar dicionários simples para evitar recursão de serialização
    return [
        {
            "id": t.id,
            "nome": t.nome,
            "disciplina": t.disciplina,
            "dias_semana": t.dias_semana, # Novo campo
            "user_id": t.user_id,
            "created_at": t.created_at.isoformat() if t.created_at else None
        } for t in turmas
    ]

@router.post("")
async def create_turma(data: dict, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    nome = data.get("nome")
    disciplina = data.get("disciplina")
    dias_semana = data.get("dias_semana") # JSON list ex: [0, 2]

    if not nome or not disciplina or not dias_semana:
        raise HTTPException(status_code=400, detail="Nome, Disciplina e Dias da Semana são obrigatórios")

    nova_turma = models.Turma(
        nome=nome,
        disciplina=disciplina,
        dias_semana=json.dumps(dias_semana) if isinstance(dias_semana, list) else dias_semana,
        user_id=user.id # Vincula a turma ao professor logado
    )
    db.add(nova_turma)
    db.commit()
    db.refresh(nova_turma)
    logger.info(f"Turma criada: {nova_turma.nome} pelo usuário {user.email}")
    return {"message": "Turma cadastrada com sucesso", "id": nova_turma.id}

@router.delete("/{turma_id}")
async def delete_turma(turma_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(models.Turma).filter(models.Turma.id == turma_id)
    
    # Se não for admin, garante que só pode deletar suas próprias turmas
    if user.role != "admin":
        query = query.filter(models.Turma.user_id == user.id)
        
    turma = query.first()
    
    if not turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada ou acesso negado")

    # O banco de dados agora cuida dos cascades via ondelete="CASCADE" no models.py
    try:
        db.delete(turma)
        db.commit()
        return {"message": "Turma excluída com sucesso"}
    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao excluir turma {turma_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao excluir turma: {str(e)}")

@router.get("/master")
async def get_master_turmas(user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Lista as turmas da base central (criadas por admins)."""
    # Busca usuários que são admin
    admin_ids = [u.id for u in db.query(users_db.User.id).filter(users_db.User.role == "admin").all()]
    
    master_turmas = db.query(models.Turma).filter(models.Turma.user_id.in_(admin_ids)).all()
    
    return [
        {
            "id": t.id,
            "nome": t.nome,
            "created_at": t.created_at.isoformat() if t.created_at else None
        } for t in master_turmas
    ]

class IncorporateRequest(BaseModel):
    master_turma_id: int
    disciplina: str

from pydantic import BaseModel

@router.post("/incorporate")
async def incorporate_turma(req: IncorporateRequest, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Copia uma turma master para o professor logado."""
    master = db.query(models.Turma).options(joinedload(models.Turma.alunos)).filter(models.Turma.id == req.master_turma_id).first()
    
    if not master:
        raise HTTPException(status_code=404, detail="Turma master não encontrada")
    
    # Cria a nova turma do professor
    nova_turma = models.Turma(
        nome=master.nome,
        disciplina=req.disciplina,
        user_id=user.id,
        dias_semana=master.dias_semana
    )
    db.add(nova_turma)
    db.flush()
    
    # Vincula todos os alunos
    for aluno in master.alunos:
        db.execute(
            models.aluno_turma.insert().values(
                aluno_id=aluno.id,
                turma_id=nova_turma.id
            )
        )
    
    db.commit()
    logger.info(f"Professor {user.email} incorporou turma {master.nome} como {req.disciplina}")
    
    return {"message": "Turma incorporada com sucesso", "id": nova_turma.id}
