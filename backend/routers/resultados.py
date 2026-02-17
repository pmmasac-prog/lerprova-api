from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
import models
import users_db
from database import get_db
from dependencies import get_current_user
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import json
import logging

router = APIRouter(tags=["resultados"])
logger = logging.getLogger("lerprova-api")

class ResultadoUpdate(BaseModel):
    respostas_aluno: Optional[List[str]] = None
    nota: Optional[float] = None
    acertos: Optional[int] = None

class ResultadoCreate(BaseModel):
    aluno_id: int
    gabarito_id: int
    respostas_aluno: Optional[List[str]] = None
    nota: Optional[float] = None
    acertos: Optional[int] = None

@router.get("/resultados")
async def get_resultados(user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(models.Resultado).options(
        joinedload(models.Resultado.aluno),
        joinedload(models.Resultado.gabarito).joinedload(models.Gabarito.turmas)
    )
    
    if user.role != "admin":
        query = query.join(models.Gabarito).filter(models.Gabarito.turmas.any(models.Turma.user_id == user.id))

    resultados = query.all()
    
    return [
        {
            "id": r.id,
            "aluno_id": r.aluno_id,
            "gabarito_id": r.gabarito_id,
            "acertos": r.acertos,
            "nota": r.nota,
            "respostas_aluno": r.respostas_aluno,
            "data": r.data_correcao.strftime("%Y-%m-%d %H:%M:%S") if r.data_correcao else None,
            "nome": r.aluno.nome if r.aluno else "N/A",
            "aluno_codigo": r.aluno.codigo if r.aluno else "N/A",
            "assunto": r.gabarito.titulo or r.gabarito.assunto if r.gabarito else "N/A",
            "periodo": r.gabarito.periodo if r.gabarito else None,
            "turma_id": r.gabarito.turmas[0].id if r.gabarito and r.gabarito.turmas else None
        } for r in resultados
    ]

@router.get("/resultados/turma/{turma_id}/aluno/{aluno_id}")
async def get_resultados_aluno_turma(turma_id: int, aluno_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        turma = db.query(models.Turma).filter(models.Turma.id == turma_id, models.Turma.user_id == user.id).first()
        if not turma:
            raise HTTPException(status_code=403, detail="Acesso negado a esta turma")

    resultados = db.query(models.Resultado).join(models.Gabarito).filter(
        models.Resultado.aluno_id == aluno_id,
        models.Gabarito.turmas.any(models.Turma.id == turma_id)
    ).all()
    
    resp = []
    for r in resultados:
        r_dict = r.__dict__.copy()
        if "_sa_instance_state" in r_dict: del r_dict["_sa_instance_state"]
        if r.gabarito:
            r_dict["assunto"] = r.gabarito.titulo or r.gabarito.assunto
            r_dict["data"] = r.data_correcao.strftime("%Y-%m-%d %H:%M:%S") if r.data_correcao else None
        resp.append(r_dict)
    return resp

@router.get("/resultados/turma/{turma_id}")
async def get_resultados_by_turma(turma_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        turma = db.query(models.Turma).filter(models.Turma.id == turma_id, models.Turma.user_id == user.id).first()
        if not turma:
            raise HTTPException(status_code=403, detail="Acesso negado a esta turma")

    resultados = db.query(models.Resultado).join(models.Gabarito).filter(
        models.Gabarito.turmas.any(models.Turma.id == turma_id)
    ).options(
        joinedload(models.Resultado.aluno),
        joinedload(models.Resultado.gabarito)
    ).all()

    resp = []
    for r in resultados:
        r_dict = r.__dict__.copy()
        if "_sa_instance_state" in r_dict: del r_dict["_sa_instance_state"]
        if r.aluno:
            r_dict["nome"] = r.aluno.nome
            r_dict["aluno_codigo"] = r.aluno.codigo
        if r.gabarito:
            r_dict["assunto"] = r.gabarito.titulo or r.gabarito.assunto
            r_dict["periodo"] = r.gabarito.periodo
            r_dict["turma_id"] = turma_id
        if r.data_correcao:
            r_dict["data"] = r.data_correcao.strftime("%Y-%m-%d %H:%M:%S")
        resp.append(r_dict)
    return resp

@router.get("/resultados/gabarito/{gabarito_id}")
async def get_resultados_by_gabarito(gabarito_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    gabarito = db.query(models.Gabarito).filter(models.Gabarito.id == gabarito_id).first()
    if not gabarito:
        raise HTTPException(status_code=404, detail="Gabarito não encontrado")

    if user.role != "admin":
        has_access = any(t.user_id == user.id for t in gabarito.turmas)
        if not has_access and gabarito.turmas:
             raise HTTPException(status_code=403, detail="Acesso negado a este gabarito")

    resultados = db.query(models.Resultado).filter(models.Resultado.gabarito_id == gabarito_id).all()
    resp = []
    for r in resultados:
        r_dict = r.__dict__.copy()
        if r.aluno:
            r_dict["nome"] = r.aluno.nome
        if "_sa_instance_state" in r_dict:
            del r_dict["_sa_instance_state"]
        resp.append(r_dict)
    return resp

@router.post("/resultados")
async def create_resultado_manual(data: ResultadoCreate, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    gabarito = db.query(models.Gabarito).filter(models.Gabarito.id == data.gabarito_id).first()
    if not gabarito:
        raise HTTPException(status_code=404, detail="Gabarito não encontrado")

    if user.role != "admin":
        has_access = any(t.user_id == user.id for t in gabarito.turmas)
        if not has_access and gabarito.turmas:
             raise HTTPException(status_code=403, detail="Você não tem permissão para lançar resultados neste gabarito")
    
    nota = 0.0
    acertos = 0
    total = gabarito.num_questoes
    
    if data.nota is not None:
        nota = data.nota
        if data.acertos is not None:
            acertos = data.acertos
        else:
            acertos = int((nota / 10) * total)
    elif data.respostas_aluno is not None:
        try:
            corretas = json.loads(gabarito.respostas_corretas) if gabarito.respostas_corretas else []
        except:
            corretas = []
        
        detectadas = data.respostas_aluno
        acertos = 0
        total_gab = len(corretas)
        for i in range(min(total_gab, len(detectadas))):
            if detectadas[i] == corretas[i]:
                acertos += 1
        
        nota = (acertos / total_gab) * 10 if total_gab > 0 else 0

    resultado_existente = db.query(models.Resultado).filter(
        models.Resultado.aluno_id == data.aluno_id,
        models.Resultado.gabarito_id == data.gabarito_id
    ).first()

    if resultado_existente:
        resultado_existente.acertos = acertos
        resultado_existente.nota = nota
        resultado_existente.respostas_aluno = json.dumps(data.respostas_aluno) if data.respostas_aluno else None
        resultado_existente.data_correcao = datetime.utcnow()
        db.commit()
        db.refresh(resultado_existente)
        return {"message": "Resultado atualizado com sucesso", "id": resultado_existente.id, "nota": nota}
    else:
        novo_resultado = models.Resultado(
            aluno_id=data.aluno_id,
            gabarito_id=data.gabarito_id,
            acertos=acertos,
            nota=nota,
            respostas_aluno=json.dumps(data.respostas_aluno) if data.respostas_aluno else None,
            data_correcao=datetime.utcnow()
        )
        db.add(novo_resultado)
        db.commit()
        db.refresh(novo_resultado)
        return {"message": "Resultado registrado com sucesso", "id": novo_resultado.id, "nota": nota}

@router.patch("/resultados/{resultado_id}")
async def update_resultado(resultado_id: int, data: ResultadoUpdate, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    resultado = db.query(models.Resultado).filter(models.Resultado.id == resultado_id).first()
    if not resultado:
        raise HTTPException(status_code=404, detail="Resultado não encontrado")
    
    gabarito = resultado.gabarito
    if not gabarito:
        raise HTTPException(status_code=400, detail="Gabarito associado não encontrado")

    if user.role != "admin":
        has_access = any(t.user_id == user.id for t in gabarito.turmas)
        if not has_access and gabarito.turmas:
             raise HTTPException(status_code=403, detail="Você não tem permissão para editar este resultado")
    
    if data.nota is not None:
        resultado.nota = data.nota
        if data.acertos is not None:
            resultado.acertos = data.acertos
        else:
            resultado.acertos = int((data.nota / 10) * gabarito.num_questoes)
            
    if data.respostas_aluno is not None:
        resultado.respostas_aluno = json.dumps(data.respostas_aluno)
        
    db.commit()
    db.refresh(resultado)
    return {"message": "Resultado atualizado com sucesso", "id": resultado.id}

@router.delete("/resultados/{resultado_id}")
async def delete_resultado(resultado_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    resultado = db.query(models.Resultado).filter(models.Resultado.id == resultado_id).first()
    if not resultado:
        raise HTTPException(status_code=404, detail="Resultado não encontrado")

    gabarito = resultado.gabarito
    if user.role != "admin" and gabarito:
        has_access = any(t.user_id == user.id for t in gabarito.turmas)
        if not has_access and gabarito.turmas:
             raise HTTPException(status_code=403, detail="Você não tem permissão para excluir este resultado")

    db.delete(resultado)
    db.commit()
    return {"message": "Resultado removido com sucesso"}
