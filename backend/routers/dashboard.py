"""
Dashboard Operacional — Motor de Prioridade (Ranking Engine)
Decide automaticamente "o que o professor deve fazer agora".
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, distinct
from datetime import datetime, timedelta
import json
import logging

import models
import users_db
from database import get_db
from dependencies import get_current_user

router = APIRouter(tags=["dashboard"])
logger = logging.getLogger("lerprova-api")

# ============================================================
#  CONSTANTES DO MOTOR
# ============================================================
NOTA_CORTE = 6.0          # Abaixo disso = "baixo desempenho"
PCT_CRITICO = 0.30        # 30% abaixo do corte = turma crítica
CONFIDENCE_MIN = 0.85     # Abaixo = revisar ambíguas
DIAS_COBRAR = 3           # Dias após prova para cobrar faltantes


def _clamp(val, lo=0, hi=100):
    return max(lo, min(hi, val))


# ============================================================
#  GERAR CANDIDATOS DE AÇÃO
# ============================================================

def _gerar_acoes_corrigir_prova(db: Session, turmas_ids: list, hoje: str):
    """CORRIGIR_PROVA — gabaritos com alunos pendentes de nota."""
    acoes = []
    gabaritos = db.query(models.Gabarito).filter(
        models.Gabarito.turmas.any(models.Turma.id.in_(turmas_ids))
    ).options(joinedload(models.Gabarito.turmas)).all()

    for g in gabaritos:
        # Quantos alunos estão nas turmas deste gabarito?
        turma_ids_gab = [t.id for t in g.turmas if t.id in turmas_ids]
        if not turma_ids_gab:
            continue

        total_alunos = db.query(func.count(distinct(models.Aluno.id))).join(
            models.aluno_turma
        ).filter(
            models.aluno_turma.c.turma_id.in_(turma_ids_gab)
        ).scalar() or 0

        resultados_count = db.query(func.count(models.Resultado.id)).filter(
            models.Resultado.gabarito_id == g.id
        ).scalar() or 0

        pendentes = total_alunos - resultados_count
        if pendentes <= 0:
            continue

        # Calcular urgência baseama na data da prova
        urgencia = 10
        if g.data_prova:
            try:
                data_prova = datetime.strptime(g.data_prova, "%Y-%m-%d").date()
                dias = (datetime.strptime(hoje, "%Y-%m-%d").date() - data_prova).days
                if dias > 7:
                    urgencia = 40
                elif dias >= 0:
                    urgencia = 30
                elif dias >= -2:
                    urgencia = 20
            except:
                pass

        impacto = min(30, int((pendentes / max(total_alunos, 1)) * 30))
        score = _clamp(urgencia + impacto + (10 if pendentes > 15 else 0))

        turma_nome = g.turmas[0].nome if g.turmas else "Turma"
        acoes.append({
            "type": "CORRIGIR_PROVA",
            "title": f"Corrigir prova — {turma_nome}",
            "subtitle": f"{pendentes} aluno{'s' if pendentes != 1 else ''} aguardando nota",
            "cta_label": "INICIAR CORREÇÃO",
            "route": "/dashboard/gabarito",
            "payload": {"gabarito_id": g.id, "turma_id": turma_ids_gab[0]},
            "score": score,
            "why": [
                f"{pendentes} alunos sem nota",
                f"Prova: {g.titulo or g.assunto or 'Sem título'}"
            ]
        })
    return acoes


def _gerar_acoes_revisar_ambiguas(db: Session, turmas_ids: list):
    """REVISAR_AMBIGUAS — resultados com baixa confiança OMR."""
    acoes = []
    resultados = db.query(models.Resultado).filter(
        models.Resultado.avg_confidence < CONFIDENCE_MIN,
        models.Resultado.avg_confidence > 0,
        models.Resultado.gabarito_id.isnot(None)
    ).join(models.Gabarito).filter(
        models.Gabarito.turmas.any(models.Turma.id.in_(turmas_ids))
    ).options(
        joinedload(models.Resultado.gabarito).joinedload(models.Gabarito.turmas)
    ).all()

    if not resultados:
        return []

    # Agrupar por gabarito
    por_gabarito = {}
    for r in resultados:
        gid = r.gabarito_id
        if gid not in por_gabarito:
            por_gabarito[gid] = {"gabarito": r.gabarito, "count": 0}
        por_gabarito[gid]["count"] += 1

    for gid, info in por_gabarito.items():
        count = info["count"]
        g = info["gabarito"]
        turma_nome = g.turmas[0].nome if g.turmas else "Turma"

        score = _clamp(25 + (15 if count > 3 else 5) + min(15, count * 3))
        acoes.append({
            "type": "REVISAR_AMBIGUAS",
            "title": f"Revisar leituras — {turma_nome}",
            "subtitle": f"{count} leitura{'s' if count != 1 else ''} com baixa confiança",
            "cta_label": "REVISAR AGORA",
            "route": "/dashboard/relatorios",
            "payload": {"gabarito_id": gid},
            "score": score,
            "why": [f"{count} resultados com confiança < 85%"]
        })
    return acoes


def _gerar_acoes_registrar_aula(db: Session, user_id: int, hoje: str):
    """REGISTRAR_AULA — aulas agendadas para hoje com status pending."""
    acoes = []
    aulas = db.query(models.AulaPlanejada).join(models.Plano).filter(
        models.Plano.user_id == user_id,
        models.AulaPlanejada.scheduled_date == hoje,
        models.AulaPlanejada.status == "pending"
    ).options(
        joinedload(models.AulaPlanejada.plano).joinedload(models.Plano.turma)
    ).all()

    for aula in aulas:
        turma_nome = aula.plano.turma.nome if aula.plano and aula.plano.turma else "Turma"
        score = _clamp(50)  # Aula hoje tem prioridade natural alta
        acoes.append({
            "type": "REGISTRAR_AULA",
            "title": f"Aula agora — {turma_nome}",
            "subtitle": f"Conteúdo: {aula.titulo}",
            "cta_label": "ABRIR AULA",
            "route": "/dashboard/planejamento",
            "payload": {"aula_id": aula.id, "plano_id": aula.plano_id},
            "score": score,
            "why": ["Aula agendada para hoje"]
        })
    return acoes


def _gerar_acoes_cobrar_faltantes(db: Session, turmas_ids: list, hoje: str):
    """COBRAR_FALTANTES — alunos sem resultado X dias após a prova."""
    acoes = []
    try:
        limite = (datetime.strptime(hoje, "%Y-%m-%d") - timedelta(days=DIAS_COBRAR)).strftime("%Y-%m-%d")
    except:
        return []

    gabaritos = db.query(models.Gabarito).filter(
        models.Gabarito.turmas.any(models.Turma.id.in_(turmas_ids)),
        models.Gabarito.data_prova <= limite,
        models.Gabarito.data_prova.isnot(None)
    ).options(joinedload(models.Gabarito.turmas)).all()

    for g in gabaritos:
        turma_ids_gab = [t.id for t in g.turmas if t.id in turmas_ids]
        if not turma_ids_gab:
            continue

        alunos_turma = db.query(models.Aluno.id).join(
            models.aluno_turma
        ).filter(
            models.aluno_turma.c.turma_id.in_(turma_ids_gab)
        ).distinct().all()
        alunos_ids = [a[0] for a in alunos_turma]

        if not alunos_ids:
            continue

        alunos_com_resultado = db.query(models.Resultado.aluno_id).filter(
            models.Resultado.gabarito_id == g.id,
            models.Resultado.aluno_id.in_(alunos_ids)
        ).distinct().all()
        ids_com_resultado = {r[0] for r in alunos_com_resultado}

        faltantes = len(alunos_ids) - len(ids_com_resultado)
        if faltantes <= 0:
            continue

        turma_nome = g.turmas[0].nome if g.turmas else "Turma"
        score = _clamp(20 + min(20, faltantes * 2))
        acoes.append({
            "type": "COBRAR_FALTANTES",
            "title": f"Alunos sem prova — {turma_nome}",
            "subtitle": f"{faltantes} aluno{'s' if faltantes != 1 else ''} não fizeram a prova",
            "cta_label": "VER LISTA",
            "route": f"/dashboard/turma/{turma_ids_gab[0]}",
            "payload": {"gabarito_id": g.id, "turma_id": turma_ids_gab[0]},
            "score": score,
            "why": [f"{faltantes} alunos sem nota", f"Prova aplicada há mais de {DIAS_COBRAR} dias"]
        })
    return acoes


def _gerar_alertas_reforco(db: Session, turmas_ids: list):
    """CRIAR_REFORCO — turmas com muitos alunos abaixo do corte."""
    alertas = []
    for tid in turmas_ids:
        resultados = db.query(models.Resultado).join(models.Gabarito).filter(
            models.Gabarito.turmas.any(models.Turma.id == tid)
        ).all()

        if len(resultados) < 3:
            continue

        abaixo = sum(1 for r in resultados if (r.nota or 0) < NOTA_CORTE)
        pct = abaixo / len(resultados)

        if pct >= 0.25:
            turma = db.query(models.Turma).filter(models.Turma.id == tid).first()
            if not turma:
                continue
            alertas.append({
                "type": "CRIAR_REFORCO",
                "title": f"{turma.nome} precisa de reforço",
                "subtitle": f"{int(pct * 100)}% dos alunos abaixo da média ({NOTA_CORTE})",
                "cta_label": "GERAR PLANO",
                "route": "/dashboard/planejamento",
                "payload": {"turma_id": tid},
                "score": _clamp(20 + int(pct * 30)),
                "why": [f"{abaixo} alunos abaixo de {NOTA_CORTE}"]
            })
    return alertas


# ============================================================
#  SEMÁFORO DAS TURMAS
# ============================================================

def _calcular_semaforo(db: Session, turma_id: int, hoje: str):
    """Retorna estado da turma: ok, atencao, critico."""
    # Checar provas pendentes
    gabaritos = db.query(models.Gabarito).filter(
        models.Gabarito.turmas.any(models.Turma.id == turma_id)
    ).all()

    total_alunos = db.query(func.count(distinct(models.Aluno.id))).join(
        models.aluno_turma
    ).filter(
        models.aluno_turma.c.turma_id == turma_id
    ).scalar() or 0

    tem_pendente = False
    tem_critico = False

    for g in gabaritos:
        resultados_count = db.query(func.count(models.Resultado.id)).filter(
            models.Resultado.gabarito_id == g.id
        ).scalar() or 0

        if total_alunos > 0 and resultados_count < total_alunos:
            pct_sem_nota = (total_alunos - resultados_count) / total_alunos
            if pct_sem_nota > 0.50:
                tem_critico = True
            else:
                tem_pendente = True

        # Checar desempenho
        resultados = db.query(models.Resultado).filter(
            models.Resultado.gabarito_id == g.id
        ).all()
        if resultados:
            abaixo = sum(1 for r in resultados if (r.nota or 0) < NOTA_CORTE)
            if len(resultados) > 0 and abaixo / len(resultados) > PCT_CRITICO:
                tem_critico = True

    # Checar aula pendente hoje
    aula_pendente = db.query(models.AulaPlanejada).join(models.Plano).filter(
        models.Plano.turma_id == turma_id,
        models.AulaPlanejada.scheduled_date == hoje,
        models.AulaPlanejada.status == "pending"
    ).first()

    if tem_critico:
        return "critico"
    if tem_pendente or aula_pendente:
        return "atencao"
    return "ok"


# ============================================================
#  HISTÓRICO RECENTE
# ============================================================

def _historico_recente(db: Session, turmas_ids: list, limit: int = 5):
    """Últimas ações registradas."""
    items = []

    # Últimas correções
    resultados = db.query(models.Resultado).join(models.Gabarito).filter(
        models.Gabarito.turmas.any(models.Turma.id.in_(turmas_ids))
    ).options(
        joinedload(models.Resultado.aluno),
        joinedload(models.Resultado.gabarito).joinedload(models.Gabarito.turmas)
    ).order_by(models.Resultado.data_correcao.desc()).limit(limit).all()

    for r in resultados:
        turma_nome = r.gabarito.turmas[0].nome if r.gabarito and r.gabarito.turmas else ""
        items.append({
            "icon": "check-circle",
            "text": f"Prova corrigida — {turma_nome}",
            "detail": f"{r.aluno.nome if r.aluno else 'Aluno'} • Nota {r.nota:.1f}" if r.nota else "",
            "timestamp": r.data_correcao.isoformat() if r.data_correcao else None
        })

    # Últimas aulas registradas
    aulas = db.query(models.AulaPlanejada).join(models.Plano).filter(
        models.Plano.turma_id.in_(turmas_ids),
        models.AulaPlanejada.status == "done"
    ).options(
        joinedload(models.AulaPlanejada.plano).joinedload(models.Plano.turma)
    ).order_by(models.AulaPlanejada.id.desc()).limit(limit).all()

    for a in aulas:
        turma_nome = a.plano.turma.nome if a.plano and a.plano.turma else ""
        items.append({
            "icon": "book-open",
            "text": f"Aula registrada — {turma_nome}",
            "detail": a.titulo,
            "timestamp": a.scheduled_date
        })

    # Ordenar por timestamp desc e pegar top N
    items.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
    return items[:limit]


# ============================================================
#  ENDPOINT PRINCIPAL
# ============================================================

@router.get("/dashboard/operacional")
async def dashboard_operacional(
    user: users_db.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    hoje = datetime.utcnow().strftime("%Y-%m-%d")

    # 1. Turmas do professor
    if user.role == "admin":
        turmas = db.query(models.Turma).all()
    else:
        turmas = db.query(models.Turma).filter(models.Turma.user_id == user.id).all()

    turmas_ids = [t.id for t in turmas]

    if not turmas_ids:
        return {
            "primary_action": {
                "type": "ORGANIZAR_TURMA",
                "title": "Crie sua primeira turma",
                "subtitle": "Comece cadastrando uma turma e seus alunos",
                "cta_label": "CRIAR TURMA",
                "route": "/dashboard/turmas",
                "payload": {},
                "score": 100,
                "why": ["Você ainda não tem turmas cadastradas"]
            },
            "alerts": [],
            "classes_status": [],
            "recent_activity": []
        }

    # 2. Gerar todos os candidatos de ação
    todas_acoes = []
    todas_acoes.extend(_gerar_acoes_registrar_aula(db, user.id, hoje))
    todas_acoes.extend(_gerar_acoes_corrigir_prova(db, turmas_ids, hoje))
    todas_acoes.extend(_gerar_acoes_revisar_ambiguas(db, turmas_ids))
    todas_acoes.extend(_gerar_acoes_cobrar_faltantes(db, turmas_ids, hoje))
    todas_acoes.extend(_gerar_alertas_reforco(db, turmas_ids))

    # 3. Ordenar por score
    todas_acoes.sort(key=lambda x: x["score"], reverse=True)

    # 4. Ação prioritária = top 1
    if todas_acoes:
        primary = todas_acoes[0]
    else:
        primary = {
            "type": "DIA_LIVRE",
            "title": "Dia livre",
            "subtitle": "Nenhuma tarefa urgente. Que tal revisar uma turma?",
            "cta_label": "VER TURMAS",
            "route": "/dashboard/turmas",
            "payload": {},
            "score": 0,
            "why": ["Tudo em dia! 🎉"]
        }

    # 5. Alertas = próximos 3 (excluindo o primary)
    alertas = todas_acoes[1:4] if len(todas_acoes) > 1 else []

    # 6. Semáforo por turma
    classes_status = []
    for t in turmas:
        estado = _calcular_semaforo(db, t.id, hoje)
        classes_status.append({
            "turma_id": t.id,
            "nome": t.nome,
            "disciplina": t.disciplina,
            "estado": estado
        })
    # Ordem: crítico primeiro, depois atenção, depois ok
    ordem = {"critico": 0, "atencao": 1, "ok": 2}
    classes_status.sort(key=lambda x: ordem.get(x["estado"], 3))

    # 7. Histórico recente
    historico = _historico_recente(db, turmas_ids)

    return {
        "primary_action": primary,
        "alerts": alertas,
        "classes_status": classes_status,
        "recent_activity": historico
    }
