"""
Relatórios Avançados de Frequência e Evasão - LERPROVA
====================================================
Módulo completo para gestão de frequência escolar com:
- Monitoramento de infrequência
- Alertas de faltas consecutivas
- Detecção de risco de evasão
- Acompanhamento de alunos em risco
- Relatórios gerenciais
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_, desc
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta, date
import models
from database import get_db
from dependencies import get_current_user
import logging

router = APIRouter(prefix="/admin/reports", tags=["admin-reports"])
logger = logging.getLogger("lerprova-api")


# ==================== SCHEMAS ====================

class PeriodoRequest(BaseModel):
    data_inicio: str  # YYYY-MM-DD
    data_fim: str     # YYYY-MM-DD
    turma_id: Optional[int] = None
    turno: Optional[str] = None


class AcompanhamentoRequest(BaseModel):
    aluno_id: int
    alerta_id: Optional[int] = None
    tipo_acao: str
    responsavel_acao: str
    resultado: Optional[str] = None
    observacao: Optional[str] = None
    data_retorno_previsto: Optional[str] = None


class AtualizarStatusAlunoRequest(BaseModel):
    aluno_id: int
    situacao_matricula: str  # ativo, infrequente, em_risco, abandono_presumido, evadido, transferido


class ConfiguracaoFrequenciaRequest(BaseModel):
    faixa_regular: Optional[float] = 90.0
    faixa_atencao: Optional[float] = 85.0
    faixa_risco: Optional[float] = 75.0
    faltas_atencao: Optional[int] = 2
    faltas_alerta: Optional[int] = 3
    faltas_critico: Optional[int] = 5
    faltas_abandono: Optional[int] = 7


# ==================== FUNÇÕES AUXILIARES ====================

def get_dias_letivos(db: Session, data_inicio: str, data_fim: str) -> List[str]:
    """Retorna lista de dias letivos no período (dias úteis por padrão, excluindo feriados)"""
    # Buscar dias letivos cadastrados
    dias_cadastrados = db.query(models.DiaLetivo).filter(
        models.DiaLetivo.data >= data_inicio,
        models.DiaLetivo.data <= data_fim,
        models.DiaLetivo.is_school_day == True
    ).all()
    
    if dias_cadastrados:
        return [d.data for d in dias_cadastrados]
    
    # Se não houver dias letivos cadastrados, considerar dias úteis
    # excluindo eventos marcados como não-letivos
    eventos_nao_letivos = db.query(models.Event).filter(
        models.Event.start_date <= data_fim,
        models.Event.end_date >= data_inicio,
        models.Event.is_school_day == False
    ).all()
    
    datas_nao_letivas = set()
    for evt in eventos_nao_letivos:
        start = datetime.strptime(evt.start_date, "%Y-%m-%d").date()
        end = datetime.strptime(evt.end_date, "%Y-%m-%d").date()
        current = start
        while current <= end:
            datas_nao_letivas.add(current.strftime("%Y-%m-%d"))
            current += timedelta(days=1)
    
    # Gerar dias úteis (segunda a sexta)
    dias_letivos = []
    start_date = datetime.strptime(data_inicio, "%Y-%m-%d").date()
    end_date = datetime.strptime(data_fim, "%Y-%m-%d").date()
    current = start_date
    
    while current <= end_date:
        # 0 = segunda, 4 = sexta
        if current.weekday() < 5 and current.strftime("%Y-%m-%d") not in datas_nao_letivas:
            dias_letivos.append(current.strftime("%Y-%m-%d"))
        current += timedelta(days=1)
    
    return dias_letivos


def calcular_faltas_consecutivas(db: Session, aluno_id: int, dias_letivos: List[str]) -> dict:
    """Calcula faltas consecutivas e última presença do aluno"""
    if not dias_letivos:
        return {"consecutivas": 0, "ultima_presenca": None, "dias_sem_entrada": 0}
    
    presencas = db.query(models.Frequencia).filter(
        models.Frequencia.aluno_id == aluno_id,
        models.Frequencia.data.in_(dias_letivos),
        models.Frequencia.presente == True
    ).all()
    
    datas_presentes = {p.data for p in presencas}
    
    # Calcular faltas consecutivas (do mais recente para o mais antigo)
    dias_ordenados = sorted(dias_letivos, reverse=True)
    faltas_consecutivas = 0
    ultima_presenca = None
    
    for dia in dias_ordenados:
        if dia in datas_presentes:
            ultima_presenca = dia
            break
        faltas_consecutivas += 1
    
    # Calcular dias sem entrada
    hoje = datetime.now().strftime("%Y-%m-%d")
    dias_sem_entrada = 0
    if ultima_presenca:
        for dia in dias_ordenados:
            if dia <= hoje and dia > ultima_presenca:
                dias_sem_entrada += 1
    else:
        dias_sem_entrada = len([d for d in dias_ordenados if d <= hoje])
    
    return {
        "consecutivas": faltas_consecutivas,
        "ultima_presenca": ultima_presenca,
        "dias_sem_entrada": dias_sem_entrada
    }


def calcular_score_risco(frequencia_pct: float, faltas_consecutivas: int, 
                         frequencia_anterior: float = None, faltas_alternadas: int = 0) -> dict:
    """Calcula score de risco de evasão baseado em múltiplos fatores"""
    score = 0
    motivos = []
    
    # Fator 1: Frequência baixa
    if frequencia_pct < 75:
        score += 40
        motivos.append(f"frequência crítica ({frequencia_pct:.1f}%)")
    elif frequencia_pct < 85:
        score += 25
        motivos.append(f"frequência em risco ({frequencia_pct:.1f}%)")
    elif frequencia_pct < 90:
        score += 10
        motivos.append(f"frequência em atenção ({frequencia_pct:.1f}%)")
    
    # Fator 2: Faltas consecutivas
    if faltas_consecutivas >= 7:
        score += 35
        motivos.append(f"{faltas_consecutivas} faltas consecutivas (possível abandono)")
    elif faltas_consecutivas >= 5:
        score += 25
        motivos.append(f"{faltas_consecutivas} faltas consecutivas")
    elif faltas_consecutivas >= 3:
        score += 15
        motivos.append(f"{faltas_consecutivas} faltas consecutivas")
    elif faltas_consecutivas >= 2:
        score += 5
        motivos.append(f"{faltas_consecutivas} faltas consecutivas")
    
    # Fator 3: Queda de frequência
    if frequencia_anterior is not None:
        queda = frequencia_anterior - frequencia_pct
        if queda >= 15:
            score += 20
            motivos.append(f"queda de {queda:.1f}% na frequência")
        elif queda >= 10:
            score += 10
            motivos.append(f"queda de {queda:.1f}% na frequência")
    
    # Fator 4: Faltas alternadas
    if faltas_alternadas >= 5:
        score += 10
        motivos.append(f"{faltas_alternadas} faltas alternadas no período")
    
    # Determinar nível
    if score >= 60:
        nivel = "critico"
    elif score >= 40:
        nivel = "alto"
    elif score >= 20:
        nivel = "medio"
    else:
        nivel = "baixo"
    
    # Ação recomendada
    acoes = {
        "critico": "Busca ativa urgente - risco de abandono",
        "alto": "Contato imediato com responsável",
        "medio": "Monitorar e notificar coordenação",
        "baixo": "Acompanhamento de rotina"
    }
    
    return {
        "score": min(score, 100),
        "nivel": nivel,
        "motivo_principal": motivos[0] if motivos else "sem alertas",
        "motivos": motivos,
        "acao_recomendada": acoes[nivel]
    }


def extrair_turno(turma_nome: str) -> str:
    """Extrai o turno do nome da turma"""
    if not turma_nome:
        return "Não definido"
    lower = turma_nome.lower()
    if "noite" in lower or "noturno" in lower:
        return "Noturno"
    if "tarde" in lower or "vespertino" in lower:
        return "Vespertino"
    if "manhã" in lower or "manha" in lower or "matutino" in lower:
        return "Matutino"
    if "integral" in lower:
        return "Integral"
    return "Não definido"


def get_turno_aluno(aluno) -> str:
    """Busca o turno do aluno a partir de suas turmas"""
    if not aluno.turmas:
        return "Não definido"
    
    # Verificar cada turma do aluno
    turnos = set()
    for turma in aluno.turmas:
        turno = extrair_turno(turma.nome)
        if turno != "Não definido":
            turnos.add(turno)
    
    # Se tiver múltiplos turnos diferentes, indicar "Integral" ou listar
    if len(turnos) == 0:
        return "Não definido"
    elif len(turnos) == 1:
        return list(turnos)[0]
    elif "Matutino" in turnos and "Vespertino" in turnos:
        return "Integral"
    else:
        return "/".join(turnos)


def get_primeira_frequencia(db: Session, aluno_id: int = None) -> str:
    """Retorna a data da primeira frequência registrada"""
    query = db.query(func.min(models.Frequencia.data))
    if aluno_id:
        query = query.filter(models.Frequencia.aluno_id == aluno_id)
    
    primeira_data = query.scalar()
    return primeira_data


def get_dias_com_frequencia(db: Session, data_inicio: str, data_fim: str) -> List[str]:
    """Retorna lista de datas onde houve registro de frequência (dias que efetivamente tiveram aula).
    Fins de semana são automaticamente excluídos."""
    dias_registrados = db.query(
        func.distinct(models.Frequencia.data)
    ).filter(
        models.Frequencia.data >= data_inicio,
        models.Frequencia.data <= data_fim
    ).all()
    
    dias = sorted([d[0] for d in dias_registrados if d[0]])
    
    # Excluir sabados (5) e domingos (6) da contagem
    dias_uteis = [
        d for d in dias
        if datetime.strptime(d, "%Y-%m-%d").weekday() < 5
    ]
    
    return dias_uteis


def calcular_idade(data_nascimento: str) -> int:
    """Calcula idade a partir da data de nascimento"""
    if not data_nascimento:
        return None
    try:
        nascimento = datetime.strptime(data_nascimento, "%Y-%m-%d").date()
        hoje = date.today()
        idade = hoje.year - nascimento.year - ((hoje.month, hoje.day) < (nascimento.month, nascimento.day))
        return idade
    except:
        return None


# ==================== FUNÇÕES OTIMIZADAS (BATCH) ====================

def carregar_frequencias_batch(db: Session, dias: List[str], aluno_ids: List[int] = None) -> dict:
    """Carrega todas as frequências de uma vez e retorna dict por aluno_id"""
    query = db.query(models.Frequencia).filter(models.Frequencia.data.in_(dias))
    if aluno_ids:
        query = query.filter(models.Frequencia.aluno_id.in_(aluno_ids))
    
    frequencias = query.all()
    
    # Organiza por aluno_id
    resultado = {}
    for f in frequencias:
        if f.aluno_id not in resultado:
            resultado[f.aluno_id] = []
        resultado[f.aluno_id].append(f)
    
    return resultado


def carregar_primeiras_frequencias_batch(db: Session, aluno_ids: List[int]) -> dict:
    """Carrega primeira frequência de todos os alunos em uma query"""
    resultados = db.query(
        models.Frequencia.aluno_id,
        func.min(models.Frequencia.data).label('primeira')
    ).filter(
        models.Frequencia.aluno_id.in_(aluno_ids)
    ).group_by(models.Frequencia.aluno_id).all()
    
    return {r.aluno_id: r.primeira for r in resultados}


def carregar_acompanhamentos_batch(db: Session, aluno_ids: List[int], tipo_acao: str = None) -> dict:
    """Carrega último acompanhamento de cada aluno"""
    from sqlalchemy.orm import aliased
    from sqlalchemy import select
    
    # Subquery para pegar o id do último acompanhamento de cada aluno
    subq = db.query(
        models.AcompanhamentoAluno.aluno_id,
        func.max(models.AcompanhamentoAluno.id).label('max_id')
    ).filter(
        models.AcompanhamentoAluno.aluno_id.in_(aluno_ids)
    )
    
    if tipo_acao:
        subq = subq.filter(models.AcompanhamentoAluno.tipo_acao == tipo_acao)
    
    subq = subq.group_by(models.AcompanhamentoAluno.aluno_id).subquery()
    
    # Query principal
    acompanhamentos = db.query(models.AcompanhamentoAluno).join(
        subq, models.AcompanhamentoAluno.id == subq.c.max_id
    ).all()
    
    return {a.aluno_id: a for a in acompanhamentos}


def calcular_faltas_consecutivas_batch(frequencias_aluno: List, dias_ordenados: List[str]) -> dict:
    """Calcula faltas consecutivas usando lista de frequências em memória"""
    if not dias_ordenados:
        return {"consecutivas": 0, "ultima_presenca": None, "dias_sem_entrada": 0}
    
    datas_presentes = {f.data for f in frequencias_aluno if f.presente}
    
    # Calcular faltas consecutivas (do mais recente para o mais antigo)
    faltas_consecutivas = 0
    ultima_presenca = None
    
    for dia in dias_ordenados:
        if dia in datas_presentes:
            ultima_presenca = dia
            break
        faltas_consecutivas += 1
    
    # Calcular dias sem entrada
    hoje = datetime.now().strftime("%Y-%m-%d")
    dias_sem_entrada = 0
    if ultima_presenca:
        for dia in dias_ordenados:
            if dia <= hoje and dia > ultima_presenca:
                dias_sem_entrada += 1
    else:
        dias_sem_entrada = len([d for d in dias_ordenados if d <= hoje])
    
    return {
        "consecutivas": faltas_consecutivas,
        "ultima_presenca": ultima_presenca,
        "dias_sem_entrada": dias_sem_entrada
    }


# ==================== ENDPOINTS ====================

@router.get("/configuracao")
async def get_configuracao_frequencia(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retorna configurações atuais de frequência"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    config = db.query(models.ConfiguracaoFrequencia).first()
    if not config:
        # Criar configuração padrão
        config = models.ConfiguracaoFrequencia()
        db.add(config)
        db.commit()
        db.refresh(config)
    
    return {
        "faixa_regular": config.faixa_regular,
        "faixa_atencao": config.faixa_atencao,
        "faixa_risco": config.faixa_risco,
        "faltas_atencao": config.faltas_atencao,
        "faltas_alerta": config.faltas_alerta,
        "faltas_critico": config.faltas_critico,
        "faltas_abandono": config.faltas_abandono,
        "frequencia_minima_ldb": config.frequencia_minima_ldb,
        "notificar_responsavel_menor": config.notificar_responsavel_menor,
        "dias_para_notificar": config.dias_para_notificar
    }


@router.post("/configuracao")
async def update_configuracao_frequencia(
    request: ConfiguracaoFrequenciaRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Atualiza configurações de frequência"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    config = db.query(models.ConfiguracaoFrequencia).first()
    if not config:
        config = models.ConfiguracaoFrequencia()
        db.add(config)
    
    for key, value in request.dict(exclude_unset=True).items():
        setattr(config, key, value)
    
    db.commit()
    return {"message": "Configurações atualizadas com sucesso"}


# ==================== 1. RELATÓRIO DE INFREQUÊNCIA POR PERÍODO (OTIMIZADO) ====================

@router.post("/infrequencia")
async def relatorio_infrequencia(
    request: PeriodoRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Relatório de infrequência por período.
    OTIMIZADO: Batch loading de frequências e primeira frequência.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    dias_com_frequencia = get_dias_com_frequencia(db, request.data_inicio, request.data_fim)
    
    if not dias_com_frequencia:
        return {
            "alunos": [], 
            "total_dias_letivos": 0, 
            "dias_com_frequencia": 0,
            "periodo": {"inicio": request.data_inicio, "fim": request.data_fim},
            "mensagem": "Nenhum registro de frequência encontrado no período"
        }
    
    dias_ordenados = sorted(dias_com_frequencia)
    
    query = db.query(models.Aluno).options(joinedload(models.Aluno.turmas))
    if request.turma_id:
        query = query.join(models.aluno_turma).filter(models.aluno_turma.c.turma_id == request.turma_id)
    
    alunos = query.all()
    aluno_ids = [a.id for a in alunos]
    
    # BATCH: Carregar todas frequências e primeiras frequências de uma vez
    frequencias_batch = carregar_frequencias_batch(db, dias_com_frequencia, aluno_ids)
    primeiras_freq_batch = carregar_primeiras_frequencias_batch(db, aluno_ids)
    
    resultado = []
    
    for aluno in alunos:
        turno = get_turno_aluno(aluno)
        turma_nomes = [t.nome for t in aluno.turmas]
        turma_str = ", ".join(turma_nomes) if turma_nomes else "Sem turma"
        
        if request.turno and turno != request.turno:
            continue
        
        # Usar batch para primeira frequência
        primeira_freq = primeiras_freq_batch.get(aluno.id)
        if not primeira_freq:
            continue
        
        dias_validos = [d for d in dias_ordenados if d >= primeira_freq]
        if not dias_validos:
            continue
        
        total_dias_letivos = len(dias_validos)
        
        # Usar batch de frequências
        freqs_aluno = frequencias_batch.get(aluno.id, [])
        freqs_validas = [f for f in freqs_aluno if f.data in dias_validos]
        
        # Deduplicar por data: aluno em múltiplas turmas no mesmo dia conta só 1x
        # Regra: PRESENTE se esteve em ao menos uma turma naquele dia
        por_data = {}
        for f in freqs_validas:
            if f.data not in por_data:
                por_data[f.data] = {"presente": False, "falta_justificada": False}
            if f.presente:
                por_data[f.data]["presente"] = True
            if getattr(f, "falta_justificada", False) and not f.presente:
                por_data[f.data]["falta_justificada"] = True

        dias_presentes = sum(1 for d in por_data.values() if d["presente"])
        dias_ausentes = total_dias_letivos - dias_presentes
        faltas_justificadas = sum(1 for d in por_data.values() if not d["presente"] and d["falta_justificada"])
        faltas_nao_justificadas = dias_ausentes - faltas_justificadas
        
        frequencia_pct = (dias_presentes / total_dias_letivos * 100) if total_dias_letivos > 0 else 0
        
        # Calcular faltas consecutivas em memória
        info_consecutivas = calcular_faltas_consecutivas_batch(freqs_aluno, sorted(dias_validos, reverse=True))
        
        risco = calcular_score_risco(frequencia_pct, info_consecutivas["consecutivas"])
        
        if frequencia_pct >= 90:
            classificacao = "regular"
        elif frequencia_pct >= 85:
            classificacao = "atencao"
        elif frequencia_pct >= 75:
            classificacao = "risco"
        else:
            classificacao = "critico"
        
        resultado.append({
            "aluno_id": aluno.id,
            "aluno_nome": aluno.nome,
            "aluno_codigo": aluno.codigo,
            "turma": turma_str,
            "turno": turno,
            "total_dias_letivos": total_dias_letivos,
            "dias_presentes": dias_presentes,
            "dias_ausentes": dias_ausentes,
            "frequencia_percentual": round(frequencia_pct, 2),
            "responsavel": aluno.nome_responsavel,
            "telefone": aluno.telefone_responsavel,
            "faltas_justificadas": faltas_justificadas,
            "faltas_nao_justificadas": faltas_nao_justificadas,
            "faltas_consecutivas": info_consecutivas["consecutivas"],
            "ultima_presenca": info_consecutivas["ultima_presenca"],
            "primeira_frequencia": primeira_freq,
            "status_risco": risco["nivel"],
            "classificacao": classificacao,
            "situacao_matricula": aluno.situacao_matricula or "ativo"
        })
    
    resultado.sort(key=lambda x: x["frequencia_percentual"])
    
    return {
        "alunos": resultado,
        "dias_aula_registrados": len(dias_com_frequencia),
        "periodo": {"inicio": request.data_inicio, "fim": request.data_fim},
        "total_alunos": len(resultado),
        "resumo": {
            "regulares": len([a for a in resultado if a["classificacao"] == "regular"]),
            "atencao": len([a for a in resultado if a["classificacao"] == "atencao"]),
            "risco": len([a for a in resultado if a["classificacao"] == "risco"]),
            "criticos": len([a for a in resultado if a["classificacao"] == "critico"])
        }
    }


# ==================== 2. RELATÓRIO DE FALTAS CONSECUTIVAS (OTIMIZADO) ====================

@router.get("/faltas-consecutivas")
async def relatorio_faltas_consecutivas(
    minimo: int = Query(2, description="Mínimo de faltas consecutivas"),
    turma_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Relatório de faltas consecutivas.
    OTIMIZADO: Batch loading de frequências e acompanhamentos.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    # Período: últimos 45 dias
    hoje = datetime.now().strftime("%Y-%m-%d")
    inicio = (datetime.now() - timedelta(days=45)).strftime("%Y-%m-%d")
    dias_com_frequencia = get_dias_com_frequencia(db, inicio, hoje)
    
    if not dias_com_frequencia:
        return {"alunos": [], "total": 0, "mensagem": "Nenhum registro de frequência encontrado"}
    
    dias_ordenados = sorted(dias_com_frequencia, reverse=True)
    
    query = db.query(models.Aluno).options(joinedload(models.Aluno.turmas))
    if turma_id:
        query = query.join(models.aluno_turma).filter(models.aluno_turma.c.turma_id == turma_id)
    
    alunos = query.filter(models.Aluno.situacao_matricula != "transferido").all()
    aluno_ids = [a.id for a in alunos]
    
    # BATCH: Carregar todas frequências e primeiras frequências
    frequencias_batch = carregar_frequencias_batch(db, dias_com_frequencia, aluno_ids)
    primeiras_freq_batch = carregar_primeiras_frequencias_batch(db, aluno_ids)
    acompanhamentos_batch = carregar_acompanhamentos_batch(db, aluno_ids)
    
    resultado = []
    
    for aluno in alunos:
        # Verificar primeira frequência (do batch)
        primeira_freq = primeiras_freq_batch.get(aluno.id)
        if not primeira_freq:
            continue
        
        dias_validos = [d for d in dias_ordenados if d >= primeira_freq]
        if not dias_validos:
            continue
        
        # Calcular faltas consecutivas em memória
        freqs_aluno = frequencias_batch.get(aluno.id, [])
        info = calcular_faltas_consecutivas_batch(freqs_aluno, dias_validos)
        
        if info["consecutivas"] >= minimo:
            turma_nomes = [t.nome for t in aluno.turmas]
            turno = get_turno_aluno(aluno)
            
            # Determinar nível de alerta
            if info["consecutivas"] >= 7:
                nivel = "abandono"
                status = "Possível abandono"
            elif info["consecutivas"] >= 5:
                nivel = "critico"
                status = "Crítico"
            elif info["consecutivas"] >= 3:
                nivel = "alerta"
                status = "Alerta"
            else:
                nivel = "atencao"
                status = "Atenção"
            
            # Usar acompanhamento do batch
            acompanhamento = acompanhamentos_batch.get(aluno.id)
            status_contato = "Pendente"
            if acompanhamento:
                if acompanhamento.resultado == "sucesso":
                    status_contato = "Contatado"
                elif acompanhamento.resultado == "sem_retorno":
                    status_contato = "Sem retorno"
                else:
                    status_contato = "Em andamento"
            
            resultado.append({
                "aluno_id": aluno.id,
                "aluno_nome": aluno.nome,
                "aluno_codigo": aluno.codigo,
                "turma": turma_nomes[0] if turma_nomes else "Sem turma",
                "turno": turno,
                "faltas_consecutivas": info["consecutivas"],
                "ultima_presenca": info["ultima_presenca"],
                "dias_sem_entrada": info["dias_sem_entrada"],
                "responsavel": aluno.nome_responsavel,
                "telefone": aluno.telefone_responsavel,
                "nivel": nivel,
                "status_alerta": status,
                "status_contato": status_contato
            })
    
    # Ordenar por quantidade de faltas (maior primeiro)
    resultado.sort(key=lambda x: x["faltas_consecutivas"], reverse=True)
    
    return {
        "alunos": resultado,
        "total": len(resultado),
        "por_nivel": {
            "abandono": len([a for a in resultado if a["nivel"] == "abandono"]),
            "critico": len([a for a in resultado if a["nivel"] == "critico"]),
            "alerta": len([a for a in resultado if a["nivel"] == "alerta"]),
            "atencao": len([a for a in resultado if a["nivel"] == "atencao"])
        }
    }


# ==================== 3. ALUNOS EM RISCO DE EVASÃO (OTIMIZADO) ====================

@router.post("/risco-evasao")
async def relatorio_risco_evasao(
    request: PeriodoRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Relatório de alunos em risco de evasão.
    OTIMIZADO: Batch loading de frequências.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    dias_com_frequencia = get_dias_com_frequencia(db, request.data_inicio, request.data_fim)
    
    if not dias_com_frequencia:
        return {"alunos_em_risco": [], "total": 0, "mensagem": "Nenhum registro de frequência encontrado"}
    
    # Período anterior para comparação
    duracao = (datetime.strptime(request.data_fim, "%Y-%m-%d") - 
               datetime.strptime(request.data_inicio, "%Y-%m-%d")).days
    periodo_ant_fim = (datetime.strptime(request.data_inicio, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
    periodo_ant_inicio = (datetime.strptime(request.data_inicio, "%Y-%m-%d") - timedelta(days=duracao+1)).strftime("%Y-%m-%d")
    dias_freq_anterior = get_dias_com_frequencia(db, periodo_ant_inicio, periodo_ant_fim)
    
    query = db.query(models.Aluno).options(joinedload(models.Aluno.turmas))
    if request.turma_id:
        query = query.join(models.aluno_turma).filter(models.aluno_turma.c.turma_id == request.turma_id)
    
    alunos = query.filter(
        models.Aluno.situacao_matricula.in_(["ativo", "infrequente", "em_risco"])
    ).all()
    aluno_ids = [a.id for a in alunos]
    
    # BATCH: Carregar todas frequências e primeiras frequências de uma vez
    todos_dias = list(set(dias_com_frequencia + (dias_freq_anterior or [])))
    frequencias_batch = carregar_frequencias_batch(db, todos_dias, aluno_ids)
    primeiras_freq_batch = carregar_primeiras_frequencias_batch(db, aluno_ids)
    
    resultado = []
    
    for aluno in alunos:
        primeira_freq = primeiras_freq_batch.get(aluno.id)
        if not primeira_freq:
            continue
        
        dias_validos = [d for d in dias_com_frequencia if d >= primeira_freq]
        if not dias_validos:
            continue
        
        total_dias = len(dias_validos)
        freqs_aluno = frequencias_batch.get(aluno.id, [])
        
        # Frequência atual (em memória)
        freqs_periodo = [f for f in freqs_aluno if f.data in dias_validos]
        presencas = len([f for f in freqs_periodo if f.presente])
        freq_atual = (presencas / total_dias * 100) if total_dias > 0 else 100
        
        # Frequência anterior (em memória)
        freq_anterior = None
        if dias_freq_anterior:
            dias_ant_validos = [d for d in dias_freq_anterior if d >= primeira_freq]
            if dias_ant_validos:
                freqs_ant = [f for f in freqs_aluno if f.data in dias_ant_validos]
                presencas_ant = len([f for f in freqs_ant if f.presente])
                freq_anterior = (presencas_ant / len(dias_ant_validos) * 100) if dias_ant_validos else None
        
        # Faltas consecutivas (em memória)
        info_consec = calcular_faltas_consecutivas_batch(freqs_aluno, sorted(dias_validos, reverse=True))
        
        # Faltas alternadas
        todas_faltas = len([f for f in freqs_periodo if not f.presente])
        faltas_alternadas = max(0, todas_faltas - info_consec["consecutivas"])
        
        risco = calcular_score_risco(
            freq_atual,
            info_consec["consecutivas"],
            freq_anterior,
            faltas_alternadas
        )
        
        if risco["nivel"] in ["medio", "alto", "critico"]:
            turma_nomes = [t.nome for t in aluno.turmas]
            turno = get_turno_aluno(aluno)
            
            resultado.append({
                "aluno_id": aluno.id,
                "aluno_nome": aluno.nome,
                "aluno_codigo": aluno.codigo,
                "turma": turma_nomes[0] if turma_nomes else "Sem turma",
                "turno": turno,
                "score_risco": risco["score"],
                "nivel_risco": risco["nivel"],
                "motivo_principal": risco["motivo_principal"],
                "motivos": risco["motivos"],
                "acao_recomendada": risco["acao_recomendada"],
                "frequencia_atual": round(freq_atual, 2),
                "frequencia_anterior": round(freq_anterior, 2) if freq_anterior else None,
                "faltas_consecutivas": info_consec["consecutivas"],
                "ultima_presenca": info_consec["ultima_presenca"],
                "dias_sem_entrada": info_consec["dias_sem_entrada"],
                "dias_aula": total_dias,
                "responsavel": aluno.nome_responsavel,
                "telefone": aluno.telefone_responsavel
            })
    
    resultado.sort(key=lambda x: x["score_risco"], reverse=True)
    
    return {
        "alunos_em_risco": resultado,
        "total": len(resultado),
        "por_nivel": {
            "critico": len([a for a in resultado if a["nivel_risco"] == "critico"]),
            "alto": len([a for a in resultado if a["nivel_risco"] == "alto"]),
            "medio": len([a for a in resultado if a["nivel_risco"] == "medio"])
        },
        "periodo": {"inicio": request.data_inicio, "fim": request.data_fim}
    }


# ==================== 4. POSSÍVEL EVASÃO / ABANDONO ====================

@router.get("/evasao-abandono")
async def relatorio_evasao_abandono(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Relatório de possível evasão/abandono.
    
    Classificação:
    - ativo: frequência regular
    - infrequente: frequência baixa mas comparece
    - em_risco: indicadores de risco
    - abandono_presumido: 5-7 dias letivos sem entrada
    - evadido_confirmado: confirmado pela escola
    - transferido: transferência oficial
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    # Período: últimos 30 dias
    hoje = datetime.now().strftime("%Y-%m-%d")
    inicio = (datetime.now() - timedelta(days=45)).strftime("%Y-%m-%d")
    dias_letivos = get_dias_letivos(db, inicio, hoje)
    
    alunos = db.query(models.Aluno).options(joinedload(models.Aluno.turmas)).all()
    
    categorias = {
        "ativo": [],
        "infrequente": [],
        "em_risco": [],
        "abandono_presumido": [],
        "evadido_confirmado": [],
        "transferido": []
    }
    
    for aluno in alunos:
        info = calcular_faltas_consecutivas(db, aluno.id, dias_letivos)
        turma_nomes = [t.nome for t in aluno.turmas]
        
        aluno_data = {
            "aluno_id": aluno.id,
            "aluno_nome": aluno.nome,
            "aluno_codigo": aluno.codigo,
            "turma": turma_nomes[0] if turma_nomes else "",
            "faltas_consecutivas": info["consecutivas"],
            "ultima_presenca": info["ultima_presenca"],
            "dias_sem_entrada": info["dias_sem_entrada"],
            "situacao_atual": aluno.situacao_matricula or "ativo"
        }
        
        # Classificar baseado no status atual ou calcular
        if aluno.situacao_matricula == "transferido":
            categorias["transferido"].append(aluno_data)
        elif aluno.situacao_matricula == "evadido":
            categorias["evadido_confirmado"].append(aluno_data)
        elif info["consecutivas"] >= 7:
            categorias["abandono_presumido"].append(aluno_data)
        elif info["consecutivas"] >= 5:
            categorias["abandono_presumido"].append(aluno_data)
        elif info["consecutivas"] >= 3:
            categorias["em_risco"].append(aluno_data)
        elif info["consecutivas"] >= 2 or aluno.situacao_matricula == "infrequente":
            categorias["infrequente"].append(aluno_data)
        else:
            categorias["ativo"].append(aluno_data)
    
    return {
        "categorias": categorias,
        "resumo": {
            "total_alunos": len(alunos),
            "ativos": len(categorias["ativo"]),
            "infrequentes": len(categorias["infrequente"]),
            "em_risco": len(categorias["em_risco"]),
            "abandono_presumido": len(categorias["abandono_presumido"]),
            "evadidos": len(categorias["evadido_confirmado"]),
            "transferidos": len(categorias["transferido"])
        }
    }


# ==================== 5. MENORES COM COMUNICAÇÃO OBRIGATÓRIA (OTIMIZADO) ====================

@router.get("/menores-comunicacao")
async def relatorio_menores_comunicacao(
    minimo_faltas: int = Query(3, description="Mínimo de faltas para alerta"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Relatório de menores de idade com comunicação obrigatória aos responsáveis.
    OTIMIZADO: Carrega todos os dados em batch para evitar N+1 queries.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    # Período: últimos 45 dias
    hoje = datetime.now().strftime("%Y-%m-%d")
    inicio = (datetime.now() - timedelta(days=45)).strftime("%Y-%m-%d")
    dias_letivos = get_dias_letivos(db, inicio, hoje)
    total_dias = len(dias_letivos)
    dias_ordenados = sorted(dias_letivos, reverse=True)
    
    # Buscar alunos (apenas menores de 18)
    alunos = db.query(models.Aluno).options(joinedload(models.Aluno.turmas)).filter(
        models.Aluno.situacao_matricula.in_(["ativo", "infrequente", "em_risco"])
    ).all()
    
    # Filtrar menores de 18 e coletar IDs
    alunos_menores = []
    for aluno in alunos:
        idade = calcular_idade(aluno.data_nascimento)
        if idade is None or idade < 18:
            aluno._idade_calc = idade
            alunos_menores.append(aluno)
    
    if not alunos_menores:
        return {"alunos": [], "total": 0, "por_situacao": {}}
    
    aluno_ids = [a.id for a in alunos_menores]
    
    # BATCH: Carregar todas frequências de uma vez
    frequencias_batch = carregar_frequencias_batch(db, dias_letivos, aluno_ids)
    
    # BATCH: Carregar últimos acompanhamentos
    acompanhamentos_batch = carregar_acompanhamentos_batch(db, aluno_ids, "aviso_responsavel")
    
    resultado = []
    
    for aluno in alunos_menores:
        # Usar dados em memória (sem queries adicionais)
        freqs_aluno = frequencias_batch.get(aluno.id, [])
        
        # Calcular faltas consecutivas em memória
        info = calcular_faltas_consecutivas_batch(freqs_aluno, dias_ordenados)
        
        # Calcular frequência em memória
        presencas = len([f for f in freqs_aluno if f.presente])
        freq_pct = (presencas / total_dias * 100) if total_dias > 0 else 100
        
        # Faltas em memória
        faltas_totais = total_dias - presencas
        faltas_justificadas = len([f for f in freqs_aluno if not f.presente and f.falta_justificada])
        faltas_nao_justificadas = faltas_totais - faltas_justificadas
        
        # Critérios para comunicação
        need_contact = (
            info["consecutivas"] >= minimo_faltas or
            freq_pct < 85 or
            info["dias_sem_entrada"] >= 5
        )
        
        if need_contact:
            # Usar acompanhamento do batch
            ultimo_contato = acompanhamentos_batch.get(aluno.id)
            
            # Determinar motivo do alerta
            if info["consecutivas"] >= 5:
                motivo = f"{info['consecutivas']} faltas consecutivas"
            elif info["dias_sem_entrada"] >= 5:
                motivo = f"{info['dias_sem_entrada']} dias sem entrada"
            elif freq_pct < 75:
                motivo = f"Frequência crítica ({freq_pct:.1f}%)"
            elif freq_pct < 85:
                motivo = f"Frequência em risco ({freq_pct:.1f}%)"
            else:
                motivo = f"{info['consecutivas']} faltas consecutivas"
            
            # Status de situação
            if ultimo_contato:
                if ultimo_contato.resultado == "sucesso":
                    situacao = "resolvido"
                elif ultimo_contato.resultado == "sem_retorno":
                    situacao = "sem_retorno"
                else:
                    situacao = "avisado"
                data_ultimo_aviso = ultimo_contato.data_acao.strftime("%Y-%m-%d")
            else:
                situacao = "pendente"
                data_ultimo_aviso = None
            
            turma_nomes = [t.nome for t in aluno.turmas]
            
            resultado.append({
                "aluno_id": aluno.id,
                "aluno_nome": aluno.nome,
                "aluno_codigo": aluno.codigo,
                "turma": turma_nomes[0] if turma_nomes else "",
                "idade": aluno._idade_calc,
                "responsavel": aluno.nome_responsavel,
                "contato": aluno.telefone_responsavel or aluno.email_responsavel,
                "quantidade_faltas": faltas_totais,
                "faltas_nao_justificadas": faltas_nao_justificadas,
                "faltas_consecutivas": info["consecutivas"],
                "ultima_entrada": info["ultima_presenca"],
                "frequencia_percentual": round(freq_pct, 2),
                "motivo_alerta": motivo,
                "data_ultimo_aviso": data_ultimo_aviso,
                "situacao": situacao
            })
    
    # Ordenar: pendentes primeiro, depois por faltas
    resultado.sort(key=lambda x: (0 if x["situacao"] == "pendente" else 1, -x["faltas_consecutivas"]))
    
    return {
        "alunos": resultado,
        "total": len(resultado),
        "por_situacao": {
            "pendente": len([a for a in resultado if a["situacao"] == "pendente"]),
            "avisado": len([a for a in resultado if a["situacao"] == "avisado"]),
            "sem_retorno": len([a for a in resultado if a["situacao"] == "sem_retorno"]),
            "resolvido": len([a for a in resultado if a["situacao"] == "resolvido"])
        }
    }


# ==================== 6. RELATÓRIO GERENCIAL (OTIMIZADO) ====================

@router.post("/gerencial")
async def relatorio_gerencial(
    request: PeriodoRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Relatório gerencial completo.
    OTIMIZADO: Uma única query para frequências, processamento em memória.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    dias_letivos = get_dias_letivos(db, request.data_inicio, request.data_fim)
    total_dias = len(dias_letivos)
    
    if total_dias == 0:
        return {"message": "Nenhum dia letivo no período"}
    
    # BATCH: Carregar todos os alunos com turmas
    todos_alunos = db.query(models.Aluno).options(joinedload(models.Aluno.turmas)).all()
    aluno_ids = [a.id for a in todos_alunos]
    
    # BATCH: Carregar todas as frequências do período de uma vez
    frequencias_batch = carregar_frequencias_batch(db, dias_letivos, aluno_ids)
    
    # Construir mapa aluno->turmas
    aluno_turmas = {}
    turma_alunos = {}
    for aluno in todos_alunos:
        aluno_turmas[aluno.id] = aluno.turmas
        for turma in aluno.turmas:
            if turma.id not in turma_alunos:
                turma_alunos[turma.id] = []
            turma_alunos[turma.id].append(aluno)
    
    # Processar turmas
    turmas = db.query(models.Turma).all()
    turmas_data = []
    
    for turma in turmas:
        alunos_turma = turma_alunos.get(turma.id, [])
        if not alunos_turma:
            continue
        
        total_presencas = 0
        alunos_risco = 0
        alunos_criticos = 0
        
        for aluno in alunos_turma:
            # Usar frequências do batch (memória)
            freqs_aluno = frequencias_batch.get(aluno.id, [])
            presencas = len([f for f in freqs_aluno if f.presente])
            
            total_presencas += presencas
            freq_pct = (presencas / total_dias * 100) if total_dias > 0 else 100
            
            if freq_pct < 75:
                alunos_criticos += 1
            elif freq_pct < 85:
                alunos_risco += 1
        
        taxa_media = (total_presencas / (len(alunos_turma) * total_dias) * 100) if len(alunos_turma) > 0 else 0
        
        turmas_data.append({
            "turma_id": turma.id,
            "turma_nome": turma.nome,
            "turno": extrair_turno(turma.nome),
            "total_alunos": len(alunos_turma),
            "taxa_frequencia": round(taxa_media, 2),
            "alunos_risco": alunos_risco,
            "alunos_criticos": alunos_criticos
        })
    
    # Ordenar por taxa de frequência (menor primeiro)
    turmas_data.sort(key=lambda x: x["taxa_frequencia"])
    
    # Top 10 alunos com mais faltas (usando batch)
    alunos_mais_faltas = []
    for aluno in todos_alunos:
        freqs_aluno = frequencias_batch.get(aluno.id, [])
        presencas = len([f for f in freqs_aluno if f.presente])
        faltas = total_dias - presencas
        
        if faltas > 0:
            turma_nomes = [t.nome for t in aluno.turmas]
            alunos_mais_faltas.append({
                "aluno_id": aluno.id,
                "aluno_nome": aluno.nome,
                "turma": turma_nomes[0] if turma_nomes else "",
                "total_faltas": faltas,
                "frequencia": round((1 - faltas/total_dias) * 100, 2) if total_dias > 0 else 100
            })
    
    alunos_mais_faltas.sort(key=lambda x: x["total_faltas"], reverse=True)
    
    # Alertas abertos (query simples)
    alertas_abertos = db.query(models.AlertaFrequencia).filter(
        models.AlertaFrequencia.status == "aberto"
    ).count()
    
    # Alunos recuperados
    recuperados = db.query(models.AcompanhamentoAluno).filter(
        models.AcompanhamentoAluno.aluno_retornou == True,
        models.AcompanhamentoAluno.data_acao >= request.data_inicio
    ).count()
    
    # Taxa média geral (calculada do batch)
    total_presencas_geral = sum(
        len([f for f in freqs if f.presente]) 
        for freqs in frequencias_batch.values()
    )
    
    total_registros_esperados = len(todos_alunos) * total_dias
    taxa_geral = (total_presencas_geral / total_registros_esperados * 100) if total_registros_esperados > 0 else 0
    
    return {
        "periodo": {"inicio": request.data_inicio, "fim": request.data_fim},
        "dias_letivos": total_dias,
        "resumo_geral": {
            "total_alunos": len(todos_alunos),
            "taxa_frequencia_geral": round(taxa_geral, 2),
            "alertas_abertos": alertas_abertos,
            "alunos_recuperados": recuperados
        },
        "turmas_por_frequencia": turmas_data[:10],
        "alunos_mais_faltas": alunos_mais_faltas[:10],
        "turmas_em_risco": [t for t in turmas_data if t["taxa_frequencia"] < 85]
    }


# ==================== GESTÃO DE ACOMPANHAMENTO ====================

@router.post("/acompanhamento")
async def registrar_acompanhamento(
    request: AcompanhamentoRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Registra uma ação de acompanhamento para um aluno"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    aluno = db.query(models.Aluno).filter(models.Aluno.id == request.aluno_id).first()
    if not aluno:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    
    acompanhamento = models.AcompanhamentoAluno(
        aluno_id=request.aluno_id,
        alerta_id=request.alerta_id,
        tipo_acao=request.tipo_acao,
        responsavel_acao=request.responsavel_acao,
        resultado=request.resultado,
        observacao=request.observacao,
        data_retorno_previsto=request.data_retorno_previsto
    )
    
    db.add(acompanhamento)
    
    # Se houver alerta associado, atualizar status
    if request.alerta_id:
        alerta = db.query(models.AlertaFrequencia).filter(
            models.AlertaFrequencia.id == request.alerta_id
        ).first()
        if alerta:
            alerta.status = "em_acompanhamento"
    
    db.commit()
    db.refresh(acompanhamento)
    
    return {
        "message": "Acompanhamento registrado com sucesso",
        "id": acompanhamento.id
    }


@router.get("/acompanhamento/aluno/{aluno_id}")
async def listar_acompanhamentos_aluno(
    aluno_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Lista histórico de acompanhamentos de um aluno"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    acompanhamentos = db.query(models.AcompanhamentoAluno).filter(
        models.AcompanhamentoAluno.aluno_id == aluno_id
    ).order_by(desc(models.AcompanhamentoAluno.data_acao)).all()
    
    return [{
        "id": a.id,
        "tipo_acao": a.tipo_acao,
        "data_acao": a.data_acao.isoformat() if a.data_acao else None,
        "responsavel_acao": a.responsavel_acao,
        "resultado": a.resultado,
        "observacao": a.observacao,
        "aluno_retornou": a.aluno_retornou,
        "data_retorno_aluno": a.data_retorno_aluno
    } for a in acompanhamentos]


@router.put("/acompanhamento/{acompanhamento_id}/retorno")
async def registrar_retorno_aluno(
    acompanhamento_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Marca que o aluno retornou após acompanhamento"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    acomp = db.query(models.AcompanhamentoAluno).filter(
        models.AcompanhamentoAluno.id == acompanhamento_id
    ).first()
    
    if not acomp:
        raise HTTPException(status_code=404, detail="Acompanhamento não encontrado")
    
    acomp.aluno_retornou = True
    acomp.data_retorno_aluno = datetime.now().strftime("%Y-%m-%d")
    acomp.resultado = "sucesso"
    
    # Atualizar status do aluno
    aluno = db.query(models.Aluno).filter(models.Aluno.id == acomp.aluno_id).first()
    if aluno:
        aluno.situacao_matricula = "ativo"
    
    # Resolver alertas abertos
    db.query(models.AlertaFrequencia).filter(
        models.AlertaFrequencia.aluno_id == acomp.aluno_id,
        models.AlertaFrequencia.status.in_(["aberto", "em_acompanhamento"])
    ).update({"status": "resolvido", "data_resolucao": datetime.now()})
    
    db.commit()
    
    return {"message": "Retorno do aluno registrado com sucesso"}


@router.put("/aluno/status")
async def atualizar_status_aluno(
    request: AtualizarStatusAlunoRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Atualiza o status de matrícula do aluno"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    aluno = db.query(models.Aluno).filter(models.Aluno.id == request.aluno_id).first()
    if not aluno:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    
    valid_status = ["ativo", "infrequente", "em_risco", "abandono_presumido", "evadido", "transferido"]
    if request.situacao_matricula not in valid_status:
        raise HTTPException(status_code=400, detail=f"Status inválido. Use: {valid_status}")
    
    aluno.situacao_matricula = request.situacao_matricula
    db.commit()
    
    return {"message": f"Status do aluno atualizado para: {request.situacao_matricula}"}


# ==================== ALERTAS ====================

@router.get("/alertas")
async def listar_alertas(
    status: Optional[str] = Query(None, description="Filtrar por status: aberto, em_acompanhamento, resolvido"),
    nivel: Optional[str] = Query(None, description="Filtrar por nível: atencao, alerta, risco, critico"),
    limit: int = Query(50, description="Limite de resultados"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Lista alertas de frequência"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    query = db.query(models.AlertaFrequencia).options(
        joinedload(models.AlertaFrequencia.aluno)
    )
    
    if status:
        query = query.filter(models.AlertaFrequencia.status == status)
    if nivel:
        query = query.filter(models.AlertaFrequencia.nivel_risco == nivel)
    
    alertas = query.order_by(desc(models.AlertaFrequencia.data_geracao)).limit(limit).all()
    
    return [{
        "id": a.id,
        "aluno_id": a.aluno_id,
        "aluno_nome": a.aluno.nome if a.aluno else None,
        "tipo_alerta": a.tipo_alerta,
        "nivel_risco": a.nivel_risco,
        "motivo": a.motivo,
        "data_geracao": a.data_geracao.isoformat() if a.data_geracao else None,
        "status": a.status,
        "faltas_consecutivas": a.faltas_consecutivas,
        "frequencia_percentual": a.frequencia_percentual,
        "ultima_presenca": a.ultima_presenca,
        "acao_recomendada": a.acao_recomendada
    } for a in alertas]


@router.post("/gerar-alertas")
async def gerar_alertas_automaticos(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Gera alertas automáticos baseados nas regras configuradas"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    try:
        # Buscar configurações ou usar padrão
        config = db.query(models.ConfiguracaoFrequencia).first()
        
        # Valores padrão se não existir configuração
        faixa_risco = config.faixa_risco if config else 75.0
        faixa_atencao = config.faixa_atencao if config else 85.0
        faltas_abandono = config.faltas_abandono if config else 7
        faltas_critico = config.faltas_critico if config else 5
        faltas_alerta = config.faltas_alerta if config else 3
        
        # Período: últimos 45 dias - buscar dias com frequência
        hoje = datetime.now().strftime("%Y-%m-%d")
        inicio = (datetime.now() - timedelta(days=45)).strftime("%Y-%m-%d")
        dias_com_frequencia = get_dias_com_frequencia(db, inicio, hoje)
        
        if not dias_com_frequencia:
            return {"message": "Nenhum dia com frequência registrada", "total_alertas": 0}
        
        total_dias = len(dias_com_frequencia)
        
        alunos = db.query(models.Aluno).filter(
            or_(
                models.Aluno.situacao_matricula.in_(["ativo", "infrequente", "em_risco"]),
                models.Aluno.situacao_matricula == None
            )
        ).all()
        
        alertas_criados = 0
        
        for aluno in alunos:
            try:
                # Verificar se já existe alerta aberto recente
                alerta_existente = db.query(models.AlertaFrequencia).filter(
                    models.AlertaFrequencia.aluno_id == aluno.id,
                    models.AlertaFrequencia.status == "aberto",
                    models.AlertaFrequencia.data_geracao >= datetime.now() - timedelta(days=7)
                ).first()
                
                if alerta_existente:
                    continue
                
                # Buscar primeira frequência do aluno
                primeira_freq = get_primeira_frequencia(db, aluno.id)
                if not primeira_freq:
                    continue
                
                # Filtrar dias válidos para este aluno
                dias_validos = [d for d in dias_com_frequencia if d >= primeira_freq]
                if not dias_validos:
                    continue
                
                info = calcular_faltas_consecutivas(db, aluno.id, dias_validos)
                
                # Calcular frequência
                presencas = db.query(models.Frequencia).filter(
                    models.Frequencia.aluno_id == aluno.id,
                    models.Frequencia.data.in_(dias_validos),
                    models.Frequencia.presente == True
                ).count()
                
                freq_pct = (presencas / len(dias_validos) * 100) if dias_validos else 100
                
                # Verificar gatilhos
                tipo_alerta = None
                nivel_risco = None
                motivo = None
                acao = None
                
                if info["consecutivas"] >= faltas_abandono:
                    tipo_alerta = "abandono_presumido"
                    nivel_risco = "critico"
                    motivo = f"{info['consecutivas']} faltas consecutivas - possível abandono"
                    acao = "Busca ativa urgente"
                elif info["consecutivas"] >= faltas_critico:
                    tipo_alerta = "faltas_consecutivas"
                    nivel_risco = "critico"
                    motivo = f"{info['consecutivas']} faltas consecutivas"
                    acao = "Contato imediato com responsável"
                elif info["consecutivas"] >= faltas_alerta:
                    tipo_alerta = "faltas_consecutivas"
                    nivel_risco = "alerta"
                    motivo = f"{info['consecutivas']} faltas consecutivas"
                    acao = "Notificar coordenação"
                elif freq_pct < faixa_risco:
                    tipo_alerta = "baixa_frequencia"
                    nivel_risco = "risco"
                    motivo = f"Frequência em {freq_pct:.1f}%"
                    acao = "Monitorar e contatar"
                elif freq_pct < faixa_atencao:
                    tipo_alerta = "baixa_frequencia"
                    nivel_risco = "atencao"
                    motivo = f"Frequência em {freq_pct:.1f}%"
                    acao = "Acompanhar"
                
                if tipo_alerta:
                    novo_alerta = models.AlertaFrequencia(
                        aluno_id=aluno.id,
                        tipo_alerta=tipo_alerta,
                        nivel_risco=nivel_risco,
                        motivo=motivo,
                        faltas_consecutivas=info["consecutivas"],
                        frequencia_percentual=freq_pct,
                        ultima_presenca=info["ultima_presenca"],
                        dias_sem_entrada=info["dias_sem_entrada"],
                        acao_recomendada=acao
                    )
                    db.add(novo_alerta)
                    alertas_criados += 1
                    
                    # Atualizar situação do aluno
                    if nivel_risco == "critico":
                        aluno.situacao_matricula = "em_risco"
                    elif nivel_risco in ["risco", "alerta"]:
                        aluno.situacao_matricula = "infrequente"
                        
            except Exception as e:
                logger.error(f"Erro ao processar aluno {aluno.id}: {e}")
                continue
        
        db.commit()
        
        return {
            "message": f"{alertas_criados} alertas gerados",
            "total_alertas": alertas_criados
        }
        
    except Exception as e:
        logger.error(f"Erro ao gerar alertas: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao gerar alertas: {str(e)}")


# ==================== DASHBOARD RESUMO ====================

@router.get("/dashboard")
async def dashboard_frequencia(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Dashboard resumido de frequência para a tela principal"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    # Período: mês atual
    hoje = datetime.now()
    inicio_mes = hoje.replace(day=1).strftime("%Y-%m-%d")
    hoje_str = hoje.strftime("%Y-%m-%d")
    dias_letivos = get_dias_letivos(db, inicio_mes, hoje_str)
    total_dias = len(dias_letivos)
    
    total_alunos = db.query(models.Aluno).filter(
        models.Aluno.situacao_matricula != "transferido"
    ).count()
    
    # Alertas abertos
    alertas_abertos = db.query(models.AlertaFrequencia).filter(
        models.AlertaFrequencia.status == "aberto"
    ).count()
    
    alertas_criticos = db.query(models.AlertaFrequencia).filter(
        models.AlertaFrequencia.status == "aberto",
        models.AlertaFrequencia.nivel_risco == "critico"
    ).count()
    
    # Situação dos alunos
    situacao = db.query(
        models.Aluno.situacao_matricula,
        func.count(models.Aluno.id)
    ).group_by(models.Aluno.situacao_matricula).all()
    
    situacao_dict = {s[0] or "ativo": s[1] for s in situacao}
    
    # Taxa de frequência média do mês
    if total_dias > 0 and total_alunos > 0:
        total_presencas = db.query(models.Frequencia).filter(
            models.Frequencia.data.in_(dias_letivos),
            models.Frequencia.presente == True
        ).count()
        taxa_media = (total_presencas / (total_alunos * total_dias)) * 100
    else:
        taxa_media = 0
    
    # Pendências de comunicação (menores sem contato)
    # Simplificado para evitar queries complexas
    pendencias = db.query(models.AlertaFrequencia).filter(
        models.AlertaFrequencia.status == "aberto",
        models.AlertaFrequencia.nivel_risco.in_(["critico", "alerta"])
    ).count()
    
    return {
        "total_alunos": total_alunos,
        "taxa_frequencia_mes": round(taxa_media, 2),
        "dias_letivos_mes": total_dias,
        "alertas": {
            "abertos": alertas_abertos,
            "criticos": alertas_criticos
        },
        "situacao_alunos": {
            "ativos": situacao_dict.get("ativo", 0),
            "infrequentes": situacao_dict.get("infrequente", 0),
            "em_risco": situacao_dict.get("em_risco", 0),
            "abandono_presumido": situacao_dict.get("abandono_presumido", 0),
            "evadidos": situacao_dict.get("evadido", 0)
        },
        "pendencias_comunicacao": pendencias,
        "periodo": {"inicio": inicio_mes, "fim": hoje_str}
    }


# ==================== HISTÓRICO DETALHADO DE FREQUÊNCIA ====================

@router.get("/aluno/{aluno_id}/historico-frequencia")
async def historico_frequencia_aluno(
    aluno_id: int,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retorna histórico detalhado de frequência com datas de presença e ausência"""
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(status_code=403, detail="Acesso restrito")
    
    aluno = db.query(models.Aluno).filter(models.Aluno.id == aluno_id).first()
    if not aluno:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    
    # Período padrão: últimos 60 dias
    if not data_fim:
        data_fim = datetime.now().strftime("%Y-%m-%d")
    if not data_inicio:
        data_inicio = (datetime.now() - timedelta(days=60)).strftime("%Y-%m-%d")
    
    # Buscar todas as frequências do aluno no período
    frequencias = db.query(models.Frequencia).filter(
        models.Frequencia.aluno_id == aluno_id,
        models.Frequencia.data >= data_inicio,
        models.Frequencia.data <= data_fim
    ).order_by(models.Frequencia.data.desc()).all()
    
    datas_presente = []
    datas_ausente = []
    datas_justificada = []
    
    for freq in frequencias:
        data_str = freq.data if isinstance(freq.data, str) else freq.data.strftime("%Y-%m-%d") if freq.data else None
        if not data_str:
            continue
            
        turma_nome = ""
        disciplina_nome = ""
        
        # Tentar obter turma
        if freq.turma_id:
            turma = db.query(models.Turma).filter(models.Turma.id == freq.turma_id).first()
            if turma:
                turma_nome = turma.nome
        
        registro = {
            "data": data_str,
            "turma": turma_nome,
            "disciplina": disciplina_nome,
            "observacao": getattr(freq, 'observacao', '') or ""
        }
        
        if freq.presente:
            datas_presente.append(registro)
        elif getattr(freq, 'justificada', False):
            datas_justificada.append(registro)
        else:
            datas_ausente.append(registro)
    
    # Calcular estatísticas
    total_registros = len(frequencias)
    total_presencas = len(datas_presente)
    total_ausencias = len(datas_ausente)
    total_justificadas = len(datas_justificada)
    
    frequencia_percentual = (total_presencas / total_registros * 100) if total_registros > 0 else 0
    
    # Buscar turmas do aluno (via relacionamento direto)
    turmas_info = []
    for turma in aluno.turmas:
        turmas_info.append({
            "id": turma.id,
            "nome": turma.nome,
            "turno": getattr(turma, 'turno', None)
        })
    
    return {
        "aluno": {
            "id": aluno.id,
            "nome": aluno.nome,
            "matricula": aluno.codigo,
            "nome_responsavel": getattr(aluno, 'nome_responsavel', None),
            "telefone_responsavel": getattr(aluno, 'telefone_responsavel', None),
            "email_responsavel": getattr(aluno, 'email_responsavel', None)
        },
        "turmas": turmas_info,
        "periodo": {
            "inicio": data_inicio,
            "fim": data_fim
        },
        "estatisticas": {
            "total_registros": total_registros,
            "presencas": total_presencas,
            "ausencias": total_ausencias,
            "justificadas": total_justificadas,
            "frequencia_percentual": round(frequencia_percentual, 1)
        },
        "datas_presente": datas_presente,
        "datas_ausente": datas_ausente,
        "datas_justificada": datas_justificada
    }



