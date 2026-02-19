from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, constr
from typing import List, Optional, Dict, Any, Set
from datetime import datetime, timedelta, date
from zoneinfo import ZoneInfo
import json

import users_db
import models
from database import get_db
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_
from dependencies import get_current_user

router = APIRouter(prefix="/planos", tags=["planejamento"])

APP_TZ = ZoneInfo("America/Fortaleza")


# =========================
# Schemas (Pydantic)
# =========================
class AulaCreate(BaseModel):
    ordem: Optional[int] = None
    titulo: constr(min_length=1, strip_whitespace=True)
    metodologia_recurso: Optional[List[str]] = Field(default_factory=list)
    bncc_skills: Optional[List[str]] = Field(default_factory=list)


class PlanoCreate(BaseModel):
    turma_id: int
    titulo: constr(min_length=1, strip_whitespace=True)
    disciplina: Optional[str] = None
    data_inicio: constr(pattern=r"^\d{4}-\d{2}-\d{2}$")  # YYYY-MM-DD
    aulas: List[AulaCreate]
    # 0=Segunda ... 6=Domingo (Python weekday())
    dias_semana: List[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4])
    intervalo_dias: int = 1  # mantido por compat, mas o agendamento usa dias_semana


class RegistroAulaCreate(BaseModel):
    percepcoes: Optional[List[str]] = Field(default_factory=list)
    observacoes: Optional[str] = None


# =========================
# Helpers
# =========================
def _parse_date_yyyy_mm_dd(value: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=422, detail="data_inicio/scheduled_date inválida. Use YYYY-MM-DD.")


def _now_local_date() -> date:
    return datetime.now(APP_TZ).date()


def _normalize_days(dias_semana: List[int]) -> List[int]:
    # garante range e ordenação
    clean = sorted({int(d) for d in dias_semana if 0 <= int(d) <= 6})
    if not clean:
        raise HTTPException(status_code=422, detail="dias_semana não pode ficar vazio e deve conter valores 0..6.")
    return clean


def _next_valid_day(d: date, allowed_weekdays: Set[int]) -> date:
    # avança até bater em weekday permitido
    guard = 0
    while d.weekday() not in allowed_weekdays:
        d += timedelta(days=1)
        guard += 1
        if guard > 14:
            raise HTTPException(status_code=400, detail="Falha ao calcular próxima data válida (dias_semana inválido?).")
    return d


def _build_schedule(data_inicio: date, dias_semana: List[int], n: int) -> List[date]:
    allowed = set(_normalize_days(dias_semana))
    cur = _next_valid_day(data_inicio, allowed)

    out: List[date] = []
    for i in range(n):
        if i == 0:
            out.append(cur)
            continue
        cur = cur + timedelta(days=1)
        cur = _next_valid_day(cur, allowed)
        out.append(cur)
    return out


def _rbac_check_turma(db: Session, user: users_db.User, turma_id: int) -> None:
    if user.role == "admin":
        return
    turma = (
        db.query(models.Turma)
        .filter(and_(models.Turma.id == turma_id, models.Turma.user_id == user.id))
        .first()
    )
    if not turma:
        raise HTTPException(status_code=403, detail="Acesso negado")


def _rbac_check_plano_owner(user: users_db.User, plano_user_id: int) -> None:
    if user.role != "admin" and plano_user_id != user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")


def _get_plano_with_aulas(db: Session, plano_id: int):
    return (
        db.query(models.Plano)
        .filter(models.Plano.id == plano_id)
        .options(joinedload(models.Plano.aulas))
        .first()
    )


def _reschedule_pending_from(
    db: Session,
    plano: models.Plano,
    start_ordem: int,
    start_date: Optional[date] = None,
) -> int:
    """
    Recalcula scheduled_date das aulas PENDING com ordem >= start_ordem,
    respeitando dias_semana do plano. Retorna quantas aulas foram alteradas.
    """
    dias = _normalize_days(json.loads(plano.dias_semana) if plano.dias_semana else [0, 1, 2, 3, 4])
    allowed = set(dias)

    pendentes = (
        db.query(models.AulaPlanejada)
        .filter(
            models.AulaPlanejada.plano_id == plano.id,
            models.AulaPlanejada.status == "pending",
            models.AulaPlanejada.ordem >= start_ordem,
        )
        .order_by(models.AulaPlanejada.ordem.asc())
        .all()
    )

    if not pendentes:
        return 0

    if start_date is None:
        # se não vier base, usa a data da primeira aula desta lista (normalizada para próximo dia válido)
        base = _parse_date_yyyy_mm_dd(pendentes[0].scheduled_date)
    else:
        base = start_date

    base = _next_valid_day(base, allowed)
    altered = 0

    cur = base
    for i, aula in enumerate(pendentes):
        if i > 0:
            cur = _next_valid_day(cur + timedelta(days=1), allowed)

        new_iso = cur.isoformat()
        if aula.scheduled_date != new_iso:
            aula.scheduled_date = new_iso
            altered += 1

    return altered


def _shift_ordens_after(db: Session, plano_id: int, after_ordem: int, delta: int) -> int:
    """
    Incrementa ordem das aulas com ordem > after_ordem em 'delta'.
    Retorna quantas linhas foram afetadas.
    """
    futuras = (
        db.query(models.AulaPlanejada)
        .filter(models.AulaPlanejada.plano_id == plano_id, models.AulaPlanejada.ordem > after_ordem)
        .order_by(models.AulaPlanejada.ordem.desc())
        .all()
    )
    for a in futuras:
        a.ordem = a.ordem + delta
    return len(futuras)


# =========================
# Routes
# =========================
@router.post("")
async def create_plano(
    data: PlanoCreate,
    user: users_db.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    turma = db.query(models.Turma).filter(models.Turma.id == data.turma_id).first()
    if not turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada")

    # Usa dados da turma (prioridade) ou do payload se não houver na turma (fallback)
    dias_semana_raw = turma.dias_semana or json.dumps(data.dias_semana)
    disciplina = turma.disciplina or data.disciplina
    
    dias = _normalize_days(json.loads(dias_semana_raw))
    
    if not data.aulas:
        raise HTTPException(status_code=422, detail="Você precisa enviar pelo menos 1 aula.")

    # cria plano
    novo_plano = models.Plano(
        turma_id=data.turma_id,
        user_id=user.id,
        titulo=data.titulo,
        disciplina=disciplina,
        data_inicio=data.data_inicio,
        dias_semana=dias_semana_raw,
    )
    db.add(novo_plano)
    db.flush()

    # agenda aulas
    start_date = _parse_date_yyyy_mm_dd(data.data_inicio)
    schedule = _build_schedule(start_date, dias, len(data.aulas))

    for i, aula_in in enumerate(data.aulas):
        ordem = aula_in.ordem if (aula_in.ordem and aula_in.ordem > 0) else (i + 1)
        nova_aula = models.AulaPlanejada(
            plano_id=novo_plano.id,
            ordem=ordem,
            titulo=aula_in.titulo,
            scheduled_date=schedule[i].isoformat(),
            metodologia_recurso=json.dumps(aula_in.metodologia_recurso, ensure_ascii=False) if aula_in.metodologia_recurso else None,
            bncc_skills=json.dumps(aula_in.bncc_skills, ensure_ascii=False) if aula_in.bncc_skills else None,
            status="pending",
        )
        db.add(nova_aula)

    db.commit()
    db.refresh(novo_plano)
    return {"message": "Plano criado com sucesso", "id": novo_plano.id}


@router.get("/turma/{turma_id}")
async def get_planos_turma(
    turma_id: int,
    user: users_db.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _rbac_check_turma(db, user, turma_id)

    planos = (
        db.query(models.Plano)
        .filter(models.Plano.turma_id == turma_id)
        .options(joinedload(models.Plano.aulas))
        .all()
    )

    result = []
    for p in planos:
        total_aulas = len(p.aulas)
        aulas_done = len([a for a in p.aulas if a.status == "done"])
        progresso = int((aulas_done / total_aulas) * 100) if total_aulas > 0 else 0
        result.append(
            {
                "id": p.id,
                "titulo": p.titulo,
                "disciplina": p.disciplina,
                "data_inicio": p.data_inicio,
                "total_aulas": total_aulas,
                "aulas_concluidas": aulas_done,
                "progresso": progresso,
            }
        )

    return result


@router.get("/{plano_id}/hoje")
async def get_aula_hoje(
    plano_id: int,
    user: users_db.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plano = _get_plano_with_aulas(db, plano_id)
    if not plano:
        raise HTTPException(status_code=404, detail="Plano não encontrado")

    _rbac_check_plano_owner(user, plano.user_id)

    hoje = _now_local_date().isoformat()

    # Critério 1: scheduled_date == hoje
    aula_hoje = next((a for a in plano.aulas if a.scheduled_date == hoje), None)

    # Fallback: primeira aula pending
    if not aula_hoje:
        aula_hoje = next((a for a in sorted(plano.aulas, key=lambda x: x.ordem) if a.status == "pending"), None)

    if not aula_hoje:
        return {"message": "Nenhuma aula pendente"}

    return {
        "id": aula_hoje.id,
        "titulo": aula_hoje.titulo,
        "ordem": aula_hoje.ordem,
        "scheduled_date": aula_hoje.scheduled_date,
        "status": aula_hoje.status,
    }


@router.get("/{plano_id}/aulas")
async def get_plano_aulas(
    plano_id: int,
    user: users_db.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plano = db.query(models.Plano).filter(models.Plano.id == plano_id).first()
    if not plano:
        raise HTTPException(status_code=404, detail="Plano não encontrado")

    _rbac_check_plano_owner(user, plano.user_id)

    aulas = (
        db.query(models.AulaPlanejada)
        .filter(models.AulaPlanejada.plano_id == plano_id)
        .order_by(models.AulaPlanejada.ordem.asc())
        .all()
    )

    return [
        {
            "id": a.id,
            "titulo": a.titulo,
            "ordem": a.ordem,
            "scheduled_date": a.scheduled_date,
            "status": a.status,
            "metodologia_recurso": json.loads(a.metodologia_recurso) if a.metodologia_recurso else [],
            "bncc_skills": json.loads(a.bncc_skills) if a.bncc_skills else [],
            "registros": [
                {
                    "percepcoes": json.loads(r.percepcoes) if r.percepcoes else [],
                    "observacoes": r.observacoes,
                    "data": r.data_registro.isoformat() if r.data_registro else None,
                }
                for r in getattr(a, "registros", []) or []
            ],
        }
        for a in aulas
    ]


@router.post("/aulas/{aula_id}/concluir")
async def concluir_aula(
    aula_id: int,
    data: RegistroAulaCreate,
    user: users_db.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    aula = db.query(models.AulaPlanejada).filter(models.AulaPlanejada.id == aula_id).first()
    if not aula:
        raise HTTPException(status_code=404, detail="Aula não encontrada")

    plano = aula.plano
    _rbac_check_plano_owner(user, plano.user_id)

    if aula.status == "done":
        # idempotência básica
        return {"message": "Aula já estava concluída", "ajustes_feitos": {}, "sugestao_reforco": False}

    aula.status = "done"

    percepcoes = [p for p in (data.percepcoes or []) if isinstance(p, str)]
    percepcoes_str = json.dumps(percepcoes if percepcoes else ["Normal"], ensure_ascii=False)

    ajustes: Dict[str, Any] = {}
    sugestao_reforco = "duvida" in percepcoes

    # Regras:
    # 1) "tempo" -> re-sincroniza futuras a partir da próxima ordem (respeitando dias_semana)
    if "tempo" in percepcoes:
        # base: dia seguinte à aula atual, normalizado
        base = _parse_date_yyyy_mm_dd(aula.scheduled_date) + timedelta(days=1)
        changed = _reschedule_pending_from(db, plano, start_ordem=aula.ordem + 1, start_date=base)
        ajustes["datas_recalculadas"] = changed

    # Criar registro
    registro = models.RegistroAula(
        aula_id=aula_id,
        user_id=user.id,
        percepcoes=percepcoes_str,
        observacoes=data.observacoes,
        ajustes_feitos=json.dumps(ajustes, ensure_ascii=False) if ajustes else None,
    )
    db.add(registro)

    # Atualizar analytics_daily
    hoje_iso = _now_local_date().isoformat()
    analytics = (
        db.query(models.AnalyticsDaily)
        .filter(and_(models.AnalyticsDaily.turma_id == plano.turma_id, models.AnalyticsDaily.data == hoje_iso))
        .first()
    )
    if not analytics:
        analytics = models.AnalyticsDaily(turma_id=plano.turma_id, data=hoje_iso)
        db.add(analytics)

    if "engajados" in percepcoes or "lab" in percepcoes:
        analytics.engajamento_score = 0.8
    if "duvida" in percepcoes or "tempo" in percepcoes:
        analytics.alerta_score = 0.6

    # Inteligência pedagógica: 3 dúvidas consecutivas -> adiar próxima avaliação/prova em 7 dias (respeitando dias_semana)
    if "duvida" in percepcoes:
        ultimos_registros = (
            db.query(models.RegistroAula)
            .join(models.AulaPlanejada)
            .filter(
                models.AulaPlanejada.plano_id == plano.id,
                models.AulaPlanejada.ordem <= aula.ordem,
            )
            .order_by(models.AulaPlanejada.ordem.desc())
            .limit(3)
            .all()
        )

        duvidas_consecutivas = 0
        for reg in ultimos_registros:
            perc = json.loads(reg.percepcoes) if reg.percepcoes else []
            if "duvida" in perc:
                duvidas_consecutivas += 1
            else:
                break

        if duvidas_consecutivas >= 3:
            proxima_prova = (
                db.query(models.AulaPlanejada)
                .filter(
                    models.AulaPlanejada.plano_id == plano.id,
                    models.AulaPlanejada.ordem > aula.ordem,
                    models.AulaPlanejada.status == "pending",
                    or_(
                        models.AulaPlanejada.titulo.ilike("%avaliação%"),
                        models.AulaPlanejada.titulo.ilike("%avaliacao%"),
                        models.AulaPlanejada.titulo.ilike("%prova%"),
                    ),
                )
                .order_by(models.AulaPlanejada.ordem.asc())
                .first()
            )

            if proxima_prova:
                dias = _normalize_days(json.loads(plano.dias_semana) if plano.dias_semana else [0, 1, 2, 3, 4])
                allowed = set(dias)

                old_date = _parse_date_yyyy_mm_dd(proxima_prova.scheduled_date)
                new_date = old_date + timedelta(days=7)
                new_date = _next_valid_day(new_date, allowed)

                proxima_prova.scheduled_date = new_date.isoformat()
                ajustes["avaliação_adiada"] = proxima_prova.titulo

                # Re-sincroniza as pendentes após a prova a partir do dia seguinte ao novo_date
                changed_after = _reschedule_pending_from(
                    db,
                    plano,
                    start_ordem=proxima_prova.ordem + 1,
                    start_date=new_date + timedelta(days=1),
                )
                ajustes["sequencia_reordenada_pos_prova"] = changed_after

    db.commit()

    # Progresso atualizado
    plano_full = _get_plano_with_aulas(db, plano.id)
    done = len([a for a in plano_full.aulas if a.status == "done"]) if plano_full and plano_full.aulas else 0
    total = len(plano_full.aulas) if plano_full and plano_full.aulas else 0
    progresso = int((done / total) * 100) if total > 0 else 0

    return {
        "message": "Aula concluída com sucesso",
        "ajustes_feitos": ajustes,
        "sugestao_reforco": sugestao_reforco,
        "updated_plan_state": {"id": plano.id, "progresso": progresso},
    }


@router.post("/aulas/{aula_id}/inserir-reforco")
async def inserir_reforco(
    aula_id: int,
    user: users_db.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    aula = db.query(models.AulaPlanejada).filter(models.AulaPlanejada.id == aula_id).first()
    if not aula:
        raise HTTPException(status_code=404, detail="Aula não encontrada")

    plano = aula.plano
    _rbac_check_plano_owner(user, plano.user_id)

    if aula.status != "pending" and aula.status != "done":
        raise HTTPException(status_code=400, detail="Status da aula inválido para inserir reforço.")

    # 1) Shift das ordens futuras para abrir espaço imediatamente após a aula atual
    afetadas = _shift_ordens_after(db, plano.id, after_ordem=aula.ordem, delta=1)

    # 2) Inserir reforço com ordem aula.ordem + 1
    reforco = models.AulaPlanejada(
        plano_id=plano.id,
        ordem=aula.ordem + 1,
        titulo=f"Reforço: {aula.titulo}",
        scheduled_date=aula.scheduled_date,  # temporário: vai ser re-sincronizado
        status="pending",
    )
    db.add(reforco)
    db.flush()

    # 3) Re-sincronizar datas das pendentes a partir do reforço (inclusive) respeitando dias_semana
    # Base: dia seguinte à aula atual
    base = _parse_date_yyyy_mm_dd(aula.scheduled_date) + timedelta(days=1)
    changed = _reschedule_pending_from(db, plano, start_ordem=reforco.ordem, start_date=base)

    db.commit()

    return {
        "message": "Reforço inserido com sucesso",
        "ajustes_feitos": {
            "reforco_inserido": True,
            "ordens_deslocadas": afetadas,
            "datas_recalculadas": changed,
        },
    }


@router.get("/analytics/turma/{turma_id}/heatmap")
async def get_heatmap(
    turma_id: int,
    user: users_db.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _rbac_check_turma(db, user, turma_id)

    hoje = _now_local_date()
    inicio = hoje - timedelta(days=14)

    analytics = (
        db.query(models.AnalyticsDaily)
        .filter(
            models.AnalyticsDaily.turma_id == turma_id,
            models.AnalyticsDaily.data >= inicio.isoformat(),
        )
        .all()
    )

    return [
        {"data": a.data, "engajamento": a.engajamento_score, "alerta": a.alerta_score}
        for a in analytics
    ]
