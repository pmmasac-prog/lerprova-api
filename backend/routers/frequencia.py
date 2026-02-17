from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import models
import users_db
from database import get_db
from dependencies import get_current_user
import logging

router = APIRouter(tags=["frequencia"])
logger = logging.getLogger("lerprova-api")

@router.post("/frequencia")
async def save_frequencia(data: dict, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    turma_id = data.get("turma_id")
    data_frequencia = data.get("data")
    alunos_lista = data.get("alunos", [])

    if user.role != "admin":
         turma = db.query(models.Turma).filter(models.Turma.id == turma_id, models.Turma.user_id == user.id).first()
         if not turma:
              raise HTTPException(status_code=403, detail="Você não tem permissão para lançar frequência nesta turma")

    existing = db.query(models.Frequencia).filter(
        models.Frequencia.turma_id == turma_id,
        models.Frequencia.data == data_frequencia
    ).all()
    
    for e in existing:
        db.delete(e)
    
    count = 0
    for item in alunos_lista:
        freq = models.Frequencia(
            turma_id=turma_id,
            aluno_id=item.get("id") or item.get("aluno_id"),
            data=data_frequencia,
            presente=item.get("presente", False)
        )
        db.add(freq)
        count += 1
    
    db.commit()
    return {"message": "Frequência salva com sucesso", "registros": count}

@router.get("/frequencia/turma/{turma_id}")
async def get_frequencia_turma(turma_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
         turma = db.query(models.Turma).filter(models.Turma.id == turma_id, models.Turma.user_id == user.id).first()
         if not turma:
              raise HTTPException(status_code=403, detail="Acesso negado a esta turma")
    return db.query(models.Frequencia).filter(models.Frequencia.turma_id == turma_id).all()

@router.get("/frequencia/aluno/{aluno_id}")
async def get_frequencia_aluno(aluno_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(models.Frequencia).filter(models.Frequencia.aluno_id == aluno_id)
    
    if user.role != "admin":
        query = query.join(models.Turma).filter(models.Turma.user_id == user.id)

    freqs = query.all()
    total_aulas = len(freqs)
    total_presencas = len([f for f in freqs if f.presente])
    
    percentage = 0
    if total_aulas > 0:
        percentage = int((total_presencas / total_aulas) * 100)
        
    return {
        "aluno_id": aluno_id,
        "total_aulas": total_aulas,
        "total_presencas": total_presencas,
        "percentual": f"{percentage}%"
    }

@router.get("/frequencia/turma/{turma_id}/dates")
async def get_frequencia_dates_turma(turma_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
         turma = db.query(models.Turma).filter(models.Turma.id == turma_id, models.Turma.user_id == user.id).first()
         if not turma:
              raise HTTPException(status_code=403, detail="Acesso negado")
              
    dates = db.query(models.Frequencia.data).filter(models.Frequencia.turma_id == turma_id).distinct().all()
    return [d[0] for d in dates]

@router.get("/frequencia/turma/{turma_id}/aluno/{aluno_id}")
async def get_frequencia_aluno_turma(turma_id: int, aluno_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        turma = db.query(models.Turma).filter(models.Turma.id == turma_id, models.Turma.user_id == user.id).first()
        if not turma:
            raise HTTPException(status_code=403, detail="Acesso negado a esta turma")

    freqs = db.query(models.Frequencia).filter(
        models.Frequencia.turma_id == turma_id,
        models.Frequencia.aluno_id == aluno_id
    ).all()
    
    total_presencas = len([f for f in freqs if f.presente])
    total_aulas = len(freqs)
    
    percentage = 0
    if total_aulas > 0:
        percentage = int((total_presencas / total_aulas) * 100)
        
    return {
        "aluno_id": aluno_id,
        "turma_id": turma_id,
        "total_aulas": total_aulas,
        "total_presencas": total_presencas,
        "percentual": f"{percentage}%",
        "historico": [
            {"data": f.data, "presente": f.presente} for f in freqs
        ]
    }
