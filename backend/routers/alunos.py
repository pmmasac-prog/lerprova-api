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
    nome_responsavel = data.get("nome_responsavel")
    telefone_responsavel = data.get("telefone_responsavel")
    email_responsavel = data.get("email_responsavel")
    data_nascimento = data.get("data_nascimento")
    
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
            qr_token=token,
            nome_responsavel=nome_responsavel,
            telefone_responsavel=telefone_responsavel,
            email_responsavel=email_responsavel,
            data_nascimento=data_nascimento
        )
        db.add(aluno)
        db.flush() # Para pegar o ID
    else:
        # Atualizar dados do responsável se fornecidos
        if nome_responsavel:
            aluno.nome_responsavel = nome_responsavel
        if telefone_responsavel:
            aluno.telefone_responsavel = telefone_responsavel
        if email_responsavel:
            aluno.email_responsavel = email_responsavel
        if data_nascimento:
            aluno.data_nascimento = data_nascimento
    
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


@router.put("/alunos/{aluno_id}")
async def update_aluno(aluno_id: int, data: dict, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Atualiza os dados de um aluno, incluindo contato do responsável"""
    aluno = db.query(models.Aluno).filter(models.Aluno.id == aluno_id).first()
    if not aluno:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")

    # Validar permissão
    if user.role != "admin":
        pertence = any(t.user_id == user.id for t in aluno.turmas)
        if not pertence:
            raise HTTPException(status_code=403, detail="Você só pode editar alunos das suas turmas")

    # Atualizar campos se fornecidos
    if "nome" in data and data["nome"]:
        aluno.nome = data["nome"]
    if "codigo" in data and data["codigo"]:
        aluno.codigo = data["codigo"]
    if "nome_responsavel" in data:
        aluno.nome_responsavel = data["nome_responsavel"] or None
    if "telefone_responsavel" in data:
        aluno.telefone_responsavel = data["telefone_responsavel"] or None
    if "email_responsavel" in data:
        aluno.email_responsavel = data["email_responsavel"] or None
    if "data_nascimento" in data:
        aluno.data_nascimento = data["data_nascimento"] or None
        
    try:
        db.commit()
        db.refresh(aluno)
    except Exception as e:
        logger.error(f"Erro ao atualizar aluno: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar aluno: {str(e)}")

    return {
        "message": "Aluno atualizado com sucesso",
        "aluno": {
            "id": aluno.id,
            "nome": aluno.nome,
            "codigo": aluno.codigo,
            "nome_responsavel": aluno.nome_responsavel,
            "telefone_responsavel": aluno.telefone_responsavel,
            "email_responsavel": aluno.email_responsavel,
            "data_nascimento": aluno.data_nascimento
        }
    }


@router.get("/alunos/{aluno_id}")
async def get_aluno(aluno_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Retorna os dados completos de um aluno"""
    aluno = db.query(models.Aluno).filter(models.Aluno.id == aluno_id).first()
    if not aluno:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")

    # Validar permissão
    if user.role != "admin":
        pertence = any(t.user_id == user.id for t in aluno.turmas)
        if not pertence:
            raise HTTPException(status_code=403, detail="Acesso negado")

    return {
        "id": aluno.id,
        "nome": aluno.nome,
        "codigo": aluno.codigo,
        "qr_token": aluno.qr_token,
        "nome_responsavel": aluno.nome_responsavel,
        "telefone_responsavel": aluno.telefone_responsavel,
        "email_responsavel": aluno.email_responsavel,
        "data_nascimento": aluno.data_nascimento,
        "turmas": [{"id": t.id, "nome": t.nome} for t in aluno.turmas]
    }
