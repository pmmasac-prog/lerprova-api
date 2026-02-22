from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel, field_validator
from typing import Optional, List
import models
import users_db
from database import get_db
from dependencies import get_current_user
from utils.answers import parse_json_list, dump_json_list
import logging

router = APIRouter(tags=["gabaritos"])
logger = logging.getLogger("lerprova-api")


# ─────────────────────────────────────────────
# Modelos Pydantic
# ─────────────────────────────────────────────

class GabaritoCreate(BaseModel):
    titulo: Optional[str] = None
    assunto: Optional[str] = None
    disciplina: Optional[str] = None
    data: Optional[str] = None
    num_questoes: Optional[int] = 10
    questoes: Optional[int] = None       # alias legado
    respostas: Optional[List[Optional[str]]] = None
    turma_ids: Optional[List[int]] = []
    turma_id: Optional[int] = None       # alias legado
    periodo: Optional[int] = None


class GabaritoUpdate(BaseModel):
    titulo: Optional[str] = None
    assunto: Optional[str] = None
    disciplina: Optional[str] = None
    data: Optional[str] = None
    num_questoes: Optional[int] = None
    questoes: Optional[int] = None       # alias legado
    respostas: Optional[List[Optional[str]]] = None
    turma_ids: Optional[List[int]] = None
    periodo: Optional[int] = None


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _serialize_gabarito(g: models.Gabarito, db: Session) -> dict:
    """Serializa um Gabarito para dict, retornando respostas como lista Python."""
    count = db.query(models.Resultado).filter(models.Resultado.gabarito_id == g.id).count()
    respostas = parse_json_list(g.respostas_corretas, "respostas_corretas")
    return {
        "id": g.id,
        "turma_id": g.turmas[0].id if g.turmas else None,
        "turma_nome": ", ".join([t.nome for t in g.turmas]) if g.turmas else "N/A",
        "turma_ids": [t.id for t in g.turmas],
        "titulo": g.titulo or g.assunto,
        "assunto": g.assunto,
        "disciplina": g.disciplina,
        "data": g.data_prova or "",
        "num_questoes": g.num_questoes,
        "respostas_corretas": respostas,   # ← sempre lista, nunca string
        "periodo": g.periodo,
        "total_resultados": count,
    }


def _check_turma_access(user: users_db.User, turma_ids: list, db: Session):
    """Levanta 403 se o professor não tiver acesso a alguma das turmas."""
    if user.role != "admin" and turma_ids:
        owned = db.query(models.Turma).filter(
            models.Turma.id.in_(turma_ids),
            models.Turma.user_id == user.id
        ).count()
        if owned != len(turma_ids):
            raise HTTPException(status_code=403, detail="Acesso negado a uma ou mais turmas")


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

@router.post("/gabaritos")
async def create_gabarito(
    data: GabaritoCreate,
    user: users_db.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    num_questoes = data.questoes or data.num_questoes or 10
    corretas = parse_json_list(data.respostas, "respostas") if data.respostas else []

    if corretas and len(corretas) != num_questoes:
        raise HTTPException(
            status_code=422,
            detail=f"respostas deve ter {num_questoes} itens, recebeu {len(corretas)}"
        )

    # Consolidar turma_ids (compatibilidade com turma_id legado)
    turma_ids = list(data.turma_ids or [])
    if data.turma_id and data.turma_id not in turma_ids:
        turma_ids.append(data.turma_id)

    _check_turma_access(user, turma_ids, db)

    titulo = data.titulo or data.assunto
    novo = models.Gabarito(
        titulo=titulo,
        assunto=data.assunto,
        disciplina=data.disciplina,
        data_prova=data.data,
        num_questoes=num_questoes,
        respostas_corretas=dump_json_list(corretas),
        periodo=data.periodo,
    )

    if turma_ids:
        novo.turmas = db.query(models.Turma).filter(models.Turma.id.in_(turma_ids)).all()

    db.add(novo)
    db.commit()
    db.refresh(novo)

    return {"message": "Gabarito criado com sucesso", "id": novo.id}


@router.put("/gabaritos/{gabarito_id}")
async def update_gabarito(
    gabarito_id: int,
    data: GabaritoUpdate,
    user: users_db.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    gabarito = db.query(models.Gabarito).options(
        joinedload(models.Gabarito.turmas)
    ).filter(models.Gabarito.id == gabarito_id).first()

    if not gabarito:
        raise HTTPException(status_code=404, detail="Gabarito não encontrado")

    if user.role != "admin":
        has_access = any(t.user_id == user.id for t in gabarito.turmas)
        if not has_access and gabarito.turmas:
            raise HTTPException(status_code=403, detail="Acesso negado a este gabarito")

    if data.titulo is not None:
        gabarito.titulo = data.titulo
    if data.assunto is not None:
        gabarito.assunto = data.assunto
    if data.disciplina is not None:
        gabarito.disciplina = data.disciplina
    if data.data is not None:
        gabarito.data_prova = data.data
    if data.periodo is not None:
        gabarito.periodo = data.periodo

    num_questoes = data.questoes or data.num_questoes
    if num_questoes is not None:
        gabarito.num_questoes = num_questoes

    if data.respostas is not None:
        corretas = parse_json_list(data.respostas, "respostas")
        if corretas and gabarito.num_questoes and len(corretas) != gabarito.num_questoes:
            raise HTTPException(
                status_code=422,
                detail=f"respostas deve ter {gabarito.num_questoes} itens"
            )
        gabarito.respostas_corretas = dump_json_list(corretas)

    if data.turma_ids is not None:
        _check_turma_access(user, data.turma_ids, db)
        gabarito.turmas = db.query(models.Turma).filter(
            models.Turma.id.in_(data.turma_ids)
        ).all()

    db.commit()
    return {"message": "Gabarito atualizado com sucesso"}


@router.get("/gabaritos")
async def get_gabaritos(
    user: users_db.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.Gabarito).options(joinedload(models.Gabarito.turmas))

    if user.role != "admin":
        query = query.filter(models.Gabarito.turmas.any(models.Turma.user_id == user.id))

    gabaritos = query.all()
    return [_serialize_gabarito(g, db) for g in gabaritos]


@router.get("/gabaritos/{gabarito_id}")
async def get_gabarito(
    gabarito_id: int,
    user: users_db.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    g = db.query(models.Gabarito).options(
        joinedload(models.Gabarito.turmas)
    ).filter(models.Gabarito.id == gabarito_id).first()

    if not g:
        raise HTTPException(status_code=404, detail="Gabarito não encontrado")

    if user.role != "admin":
        has_access = any(t.user_id == user.id for t in g.turmas)
        if not has_access:
            raise HTTPException(status_code=403, detail="Acesso negado")

    return _serialize_gabarito(g, db)


@router.delete("/gabaritos/{gabarito_id}")
async def delete_gabarito(
    gabarito_id: int,
    user: users_db.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    gabarito = db.query(models.Gabarito).options(
        joinedload(models.Gabarito.turmas)
    ).filter(models.Gabarito.id == gabarito_id).first()

    if not gabarito:
        raise HTTPException(status_code=404, detail="Gabarito não encontrado")

    if user.role != "admin":
        has_access = any(t.user_id == user.id for t in gabarito.turmas)
        if not has_access and gabarito.turmas:
            raise HTTPException(status_code=403, detail="Acesso negado para excluir este gabarito")

    db.delete(gabarito)
    db.commit()
    return {"message": "Gabarito excluído com sucesso"}


@router.get("/disciplinas")
async def get_disciplinas(db: Session = Depends(get_db)):
    disc_turmas = db.query(models.Turma.disciplina).filter(models.Turma.disciplina != None).distinct().all()
    disc_gabas = db.query(models.Gabarito.disciplina).filter(models.Gabarito.disciplina != None).distinct().all()
    all_discs = set([d[0] for d in disc_turmas] + [d[0] for d in disc_gabas])
    return sorted(list(all_discs))
