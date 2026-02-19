from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
import models
import users_db
from database import get_db
from dependencies import get_current_user
from utils.answers import parse_json_list, dump_json_list
import json
import logging

router = APIRouter(tags=["gabaritos"])
logger = logging.getLogger("lerprova-api")

@router.post("/gabaritos")
async def create_gabarito(data: dict, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Normalizar respostas via util central
    num_questoes = int(data.get("questoes") or data.get("num_questoes") or 10)
    corretas = parse_json_list(data.get("respostas"), "respostas")

    if corretas and len(corretas) != num_questoes:
        raise HTTPException(status_code=422, detail=f"respostas deve ter {num_questoes} itens, recebeu {len(corretas)}")

    turma_ids = data.get("turma_ids", [])
    if data.get("turma_id") and int(data.get("turma_id")) not in turma_ids:
        turma_ids.append(int(data.get("turma_id")))

    if user.role != "admin" and turma_ids:
        user_turmas_count = db.query(models.Turma).filter(models.Turma.id.in_(turma_ids), models.Turma.user_id == user.id).count()
        if user_turmas_count != len(turma_ids):
             raise HTTPException(status_code=403, detail="Você não tem permissão para criar provas para turmas que não são suas")

    novo_gabarito = models.Gabarito(
        titulo=data.get("titulo", data.get("assunto")),
        assunto=data.get("assunto"),
        disciplina=data.get("disciplina"),
        data_prova=data.get("data"),
        num_questoes=num_questoes,
        respostas_corretas=dump_json_list(corretas),
        periodo=data.get("periodo")
    )

    if turma_ids:
        turmas = db.query(models.Turma).filter(models.Turma.id.in_(turma_ids)).all()
        novo_gabarito.turmas = turmas

    db.add(novo_gabarito)
    db.commit()
    db.refresh(novo_gabarito)
    return {"message": "Gabarito criado com sucesso", "id": novo_gabarito.id}

@router.put("/gabaritos/{gabarito_id}")
async def update_gabarito(gabarito_id: int, data: dict, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    gabarito = db.query(models.Gabarito).filter(models.Gabarito.id == gabarito_id).first()
    if not gabarito:
        raise HTTPException(status_code=404, detail="Gabarito não encontrado")
    
    if user.role != "admin":
        has_access = any(t.user_id == user.id for t in gabarito.turmas)
        if not has_access and gabarito.turmas:
              raise HTTPException(status_code=403, detail="Acesso negado a este gabarito")

    if "titulo" in data or "assunto" in data:
        gabarito.titulo = data.get("titulo", data.get("assunto"))
        gabarito.assunto = data.get("assunto", gabarito.assunto)
    
    if "disciplina" in data:
        gabarito.disciplina = data.get("disciplina")
    
    if "data" in data:
        gabarito.data_prova = data.get("data")
    
    if "num_questoes" in data or "questoes" in data:
        gabarito.num_questoes = int(data.get("questoes") or data.get("num_questoes") or gabarito.num_questoes)
    
    if "respostas" in data:
        corretas = parse_json_list(data.get("respostas"), "respostas")
        if corretas and gabarito.num_questoes and len(corretas) != gabarito.num_questoes:
            raise HTTPException(status_code=422, detail=f"respostas deve ter {gabarito.num_questoes} itens")
        gabarito.respostas_corretas = dump_json_list(corretas)

    if "periodo" in data:
        gabarito.periodo = data.get("periodo")

    if "turma_ids" in data:
        turma_ids = data.get("turma_ids", [])
        if user.role != "admin" and turma_ids:
             user_turmas_count = db.query(models.Turma).filter(models.Turma.id.in_(turma_ids), models.Turma.user_id == user.id).count()
             if user_turmas_count != len(turma_ids):
                  raise HTTPException(status_code=403, detail="Você não pode vincular este gabarito a turmas que não são suas")

        turmas = db.query(models.Turma).filter(models.Turma.id.in_(turma_ids)).all()
        gabarito.turmas = turmas

    db.commit()
    return {"message": "Gabarito atualizado com sucesso"}

@router.get("/gabaritos")
async def get_gabaritos(user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(models.Gabarito).options(joinedload(models.Gabarito.turmas))
    
    if user.role != "admin":
        query = query.filter(models.Gabarito.turmas.any(models.Turma.user_id == user.id))

    gabaritos = query.all()
    
    result = []
    for g in gabaritos:
        count = db.query(models.Resultado).filter(models.Resultado.gabarito_id == g.id).count()
        g_dict = {
            "id": g.id,
            "turma_id": g.turmas[0].id if g.turmas else None,
            "turma_nome": ", ".join([t.nome for t in g.turmas]) if g.turmas else "N/A",
            "turma_ids": [t.id for t in g.turmas],
            "titulo": g.titulo,
            "assunto": g.assunto,
            "disciplina": g.disciplina,
            "data": g.data_prova or "",
            "num_questoes": g.num_questoes,
            "respostas_corretas": g.respostas_corretas,
            "periodo": g.periodo,
            "total_resultados": count
        }
        result.append(g_dict)
    
    return result

@router.get("/disciplinas")
async def get_disciplinas(db: Session = Depends(get_db)):
    disc_turmas = db.query(models.Turma.disciplina).filter(models.Turma.disciplina != None).distinct().all()
    disc_gabas = db.query(models.Gabarito.disciplina).filter(models.Gabarito.disciplina != None).distinct().all()
    
    all_discs = set([d[0] for d in disc_turmas] + [d[0] for d in disc_gabas])
    return sorted(list(all_discs))

@router.delete("/gabaritos/{gabarito_id}")
async def delete_gabarito(gabarito_id: int, user: users_db.User = Depends(get_current_user), db: Session = Depends(get_db)):
    gabarito = db.query(models.Gabarito).filter(models.Gabarito.id == gabarito_id).first()
    if not gabarito:
        raise HTTPException(status_code=404, detail="Gabarito não encontrado")

    if user.role != "admin":
        has_access = any(t.user_id == user.id for t in gabarito.turmas)
        if not has_access and gabarito.turmas:
             raise HTTPException(status_code=403, detail="Acesso negado para excluir este gabarito")

    db.delete(gabarito)
    db.commit()
    return {"message": "Gabarito excluído com sucesso"}
