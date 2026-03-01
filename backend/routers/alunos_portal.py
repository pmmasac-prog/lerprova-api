from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import models
import auth_utils
from database import get_db
from dependencies import get_current_user
import logging

router = APIRouter(prefix="/alunos-portal", tags=["alunos-portal"])
logger = logging.getLogger("lerprova-api")

@router.post("/login")
async def aluno_login(data: dict, db: Session = Depends(get_db)):
    codigo = data.get("codigo")
    password = data.get("password")
    
    if not codigo or not password:
        raise HTTPException(status_code=400, detail="Código e senha são obrigatórios")
    
    aluno = db.query(models.Aluno).filter(models.Aluno.codigo == codigo).first()
    if not aluno:
        raise HTTPException(status_code=401, detail="Código ou senha inválidos")
        
    from models import pwd_context
    if not aluno.hashed_password:
        # Se por algum motivo não tiver hash, assume 123456 como fallback inicial
        aluno.hashed_password = pwd_context.hash("123456")
        db.commit()

    if not pwd_context.verify(password, aluno.hashed_password):
        raise HTTPException(status_code=401, detail="Código ou senha inválidos")
        
    token = auth_utils.create_access_token(data={"sub": aluno.codigo, "role": "student"})
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": aluno.id,
            "nome": aluno.nome,
            "codigo": aluno.codigo,
            "role": "student"
        }
    }

@router.get("/me")
async def get_aluno_me(current_aluno: models.Aluno = Depends(get_current_user)):
    return {
        "id": current_aluno.id,
        "nome": current_aluno.nome,
        "codigo": current_aluno.codigo,
        "qr_token": current_aluno.qr_token
    }

@router.get("/me/resultados")
async def get_aluno_resultados(current_aluno: models.Aluno = Depends(get_current_user), db: Session = Depends(get_db)):
    # Resultados do aluno com informações do gabarito
    resultados = db.query(models.Resultado).filter(models.Resultado.aluno_id == current_aluno.id).all()
    
    return [
        {
            "id": r.id,
            "gabarito_titulo": r.gabarito.titulo,
            "disciplina": r.gabarito.disciplina,
            "acertos": r.acertos,
            "total_questoes": r.gabarito.num_questoes,
            "nota": r.nota,
            "data": r.data_correcao.isoformat() if r.data_correcao else None
        } for r in resultados
    ]

@router.get("/me/frequencia")
async def get_aluno_frequencia(current_aluno: models.Aluno = Depends(get_current_user), db: Session = Depends(get_db)):
    freqs = db.query(models.Frequencia).filter(models.Frequencia.aluno_id == current_aluno.id).all()
    
    # Agrupar por turma se necessário ou apenas listar
    return [
        {
            "data": f.data,
            "turma": f.turma.nome,
            "presente": f.presente
        } for f in freqs
    ]

@router.patch("/me/password")
async def change_aluno_password(data: dict, current_aluno: models.Aluno = Depends(get_current_user), db: Session = Depends(get_db)):
    new_password = data.get("new_password")
    if not new_password or len(new_password) < 4:
        raise HTTPException(status_code=400, detail="Senha deve ter pelo menos 4 caracteres")
        
    from models import pwd_context
    current_aluno.hashed_password = pwd_context.hash(new_password)
    db.commit()
    
    return {"message": "Senha alterada com sucesso"}
