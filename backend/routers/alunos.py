from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import users_db
import models
from database import get_db
from dependencies import get_current_user
import logging
import uuid

router = APIRouter(tags=["alunos"])
logger = logging.getLogger("lerprova-api")

@router.post("/alunos")
async def create_aluno(data: dict, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    codigo = data.get("codigo")
    raw_turma_id = data.get("turma_id")
    nome = data.get("nome")
    
    # 1. Validar turma_id de forma segura
    try:
        turma_id = int(raw_turma_id) if raw_turma_id is not None and str(raw_turma_id).strip() != "" else None
    except (ValueError, TypeError):
        turma_id = None
        
    # Validar se o usuário tem permissão para adicionar nesta turma
    if turma_id and user.role != "admin":
        turma = db.query(models.Turma).filter(models.Turma.id == turma_id, models.Turma.user_id == user.id).first()
        if not turma:
            raise HTTPException(status_code=403, detail="Você não tem permissão para adicionar alunos nesta turma")
    
    # 1. Tentar encontrar aluno existente pelo código
    aluno = db.query(models.Aluno).filter(models.Aluno.codigo == codigo).first()
    
    if not aluno:
        # 2. Se não existir, criar novo
        token = data.get("qr_token")
        if not token:
            token = f"ALUNO-{uuid.uuid4().hex[:8].upper()}"

        aluno = models.Aluno(
            nome=nome,
            codigo=codigo,
            qr_token=token
        )
        db.add(aluno)
        db.flush() # Para pegar o ID
    
    # 3. Vincular à turma se fornecido e se ainda não estiver vinculado
    if turma_id:
        try:
            turma = db.query(models.Turma).filter(models.Turma.id == turma_id).first()
            if not turma:
                 logger.warning(f"Tentativa de vincular a turma inexistente: {turma_id}")
            elif turma not in aluno.turmas:
                logger.info(f"Vinculando aluno {aluno.id} à turma {turma_id}")
                aluno.turmas.append(turma)
        except Exception as e:
            logger.error(f"Erro ao vincular aluno à turma: {e}")
            # Não falha o processo todo se for apenas erro de vínculo (ex: já existe)
    
    try:
        db.commit()
        db.refresh(aluno)
    except Exception as e:
        logger.error(f"Erro no commit de criação de aluno: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao salvar aluno: {str(e)}")

    return {"message": "Aluno processado com sucesso", "id": aluno.id, "novo_cadastro": aluno.nome == nome}

@router.get("/alunos")
async def get_alunos(user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role == "admin":
        alunos = db.query(models.Aluno).all()
    else:
        # Se professor, retorna apenas alunos das suas turmas
        alunos = db.query(models.Aluno).join(models.Turma, models.Aluno.turmas).filter(models.Turma.user_id == user.id).distinct().all()
    
    return [
        {
            "id": a.id,
            "nome": a.nome,
            "codigo": a.codigo,
            "qr_token": a.qr_token,
            "turmas_nomes": [t.nome for t in a.turmas]
        } for a in alunos
    ]

@router.get("/alunos/turma/{turma_id}")
async def get_alunos_by_turma(turma_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Validar acesso à turma
    query = db.query(models.Turma).filter(models.Turma.id == turma_id)
    if user.role != "admin":
        query = query.filter(models.Turma.user_id == user.id)
    
    turma = query.first()
    if not turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada ou acesso negado")
    
    return [
        {
            "id": a.id,
            "nome": a.nome,
            "codigo": a.codigo,
            "qr_token": a.qr_token
        } for a in turma.alunos
    ]

@router.delete("/alunos/{aluno_id}")
async def delete_aluno(aluno_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    aluno = db.query(models.Aluno).filter(models.Aluno.id == aluno_id).first()
    if not aluno:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")

    if user.role != "admin":
        # Verifica se o aluno pertence a alguma turma do professor
        pertence = any(t.user_id == user.id for t in aluno.turmas)
        if not pertence:
             raise HTTPException(status_code=403, detail="Você só pode excluir alunos das suas turmas")

    db.delete(aluno)
    db.commit()
    return {"message": "Aluno excluído com sucesso"}

@router.delete("/turmas/{turma_id}/alunos/{aluno_id}")
async def unlink_aluno_from_turma(turma_id: int, aluno_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Validar acesso à turma
    turma_query = db.query(models.Turma).filter(models.Turma.id == turma_id)
    if user.role != "admin":
        turma_query = turma_query.filter(models.Turma.user_id == user.id)
        
    turma = turma_query.first()
    if not turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada ou acesso negado")

    aluno = db.query(models.Aluno).filter(models.Aluno.id == aluno_id).first()
    
    if not aluno:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    
    if aluno in turma.alunos:
        turma.alunos.remove(aluno)
        db.commit()
        return {"message": "Aluno removido da turma com sucesso"}
    
    return {"message": "Aluno não estava vinculado a esta turma"}
