from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import users_db
import models
from database import get_db
from dependencies import get_current_user
import logging

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
            "user_id": t.user_id,
            "created_at": t.created_at.isoformat() if t.created_at else None
        } for t in turmas
    ]

@router.post("")
async def create_turma(data: dict, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    nova_turma = models.Turma(
        nome=data.get("nome"),
        disciplina=data.get("disciplina"),
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

    # Limpar TODOS os registros relacionados para evitar FK violation
    try:
        db.query(models.Frequencia).filter(models.Frequencia.turma_id == turma_id).delete()
        db.query(models.Plano).filter(models.Plano.turma_id == turma_id).delete()
        # Limpar tabelas M2M
        from sqlalchemy import text
        db.execute(text("DELETE FROM aluno_turma WHERE turma_id = :tid"), {"tid": turma_id})
        db.execute(text("DELETE FROM gabarito_turma WHERE turma_id = :tid"), {"tid": turma_id})
        db.delete(turma)
        db.commit()
        return {"message": "Turma excluída com sucesso"}
    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao excluir turma {turma_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao excluir turma: {str(e)}")
