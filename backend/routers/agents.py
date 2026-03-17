import typing
from fastapi import APIRouter, HTTPException # type: ignore
from pydantic import BaseModel # type: ignore
import logging
import traceback
import os
import json
import time
from google import genai # type: ignore
from google.genai import types # type: ignore
from fastapi import Depends # type: ignore
from sqlalchemy.orm import Session # type: ignore
from database import SessionLocal # type: ignore
from dependencies import get_current_user # type: ignore
import models # type: ignore
from agents.agent_tools import ( # type: ignore
    listar_turmas, listar_alunos_da_turma, resumo_frequencia_aluno,
    consultar_notas, listar_avaliacoes, listar_planejamentos,
    criar_planejamento, registrar_frequencia_aluno, resumo_geral_sistema,
    create_turma, create_disciplina, create_usuario, create_aluno
)

router = APIRouter(
    prefix="/api/agents",
    tags=["Agents AI"]
)

logger = logging.getLogger("lerprova-api.agents")

def get_system_prompt(user) -> str:
    """Gera um prompt de sistema dinâmico baseado no usuário autenticado com acesso profundo analítico."""
    # student role check
    role = getattr(user, "role", "student" if hasattr(user, "codigo") else "professor")
    base_prompt = (
        f"Você é um assistente virtual de inteligência avançada integrado ao sistema educacional 'LerProva'.\n"
        f"Você está interagindo com '{user.nome}', que possui o perfil de '{role}'.\n"
        "Sua missão não é apenas responder perguntas, mas produzir *materiais detalhados, relatórios densos e "
        "planos educacionais elaborados* que agreguem alto valor prático.\n"
        "USE AS FERRAMENTAS PROATIVAMENTE sempre que o usuário "
        "pedir para criar materiais, buscar dados do sistema ou obter exemplos práticos.\n"
    )
    
    if role == "professor" or role == "admin":
        base_prompt += (
            "Como professor/admin, você tem acesso às suas turmas, alunos, frequências, avaliações e planejamentos.\n"
            "Quando o professor pedir para criar um plano (criar_planejamento) ou registrar algo, faça isso. "
            "Se for solicitado que você faça um resumo detalhado/análise global/tudo que tem no sistema, chame "
            "a ferramenta 'resumo_geral_sistema' PRIMEIRO para entender o contexto, e então crie um texto longo, "
            "estruturado com Markdown, trazendo as percepções dos dados.\n"
        )
    elif role == "student":
        base_prompt += (
            "Como aluno, você só tem acesso aos SEUS próprios dados (notas, frequências, faltas) e dados públicos das turmas.\n"
            "Se lhe for pedido para gerar resumos de estudos, utilize seu conhecimento interno para trazer as melhores informações."
            "Recuse educadamente caso o aluno peça informações de outros alunos ou dados restritos de professores.\n"
        )
        
    base_prompt += "Seja profundo nas respostas quando solicitado material. Use Markdown com listas, tabelas e cabeçalhos. Responda em português do Brasil."
    return base_prompt

# ── Declaração das ferramentas para o Gemini ──────────────────────────────────
# ── Definições de Ferramentas por Especialidade ────────────────────────────────

# Especialidade: Home (Dasboard/Geral)
HOME_FUNCTIONS = [
    types.FunctionDeclaration(
        name="resumo_geral_sistema",
        description="Lê rapidamente todas as estatísticas gerais do perfil (total de turmas, alunos, avaliações, planos). Use para análises globais.",
        parameters=types.Schema(type=types.Type.OBJECT, properties={})
    ),
]

# Especialidade: Turmas (Gestão de Classes e Alunos)
TURMAS_FUNCTIONS = [
    types.FunctionDeclaration(
        name="listar_turmas",
        description="Retorna a lista de todas as turmas cadastradas no sistema.",
        parameters=types.Schema(type=types.Type.OBJECT, properties={})
    ),
    types.FunctionDeclaration(
        name="listar_alunos_da_turma",
        description="Retorna a lista de alunos de uma turma específica pelo ID.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={"turma_id": types.Schema(type=types.Type.INTEGER, description="ID da turma.")},
            required=["turma_id"]
        )
    ),
    types.FunctionDeclaration(
        name="create_turma",
        description="Ação: Cria/Cadastra uma NOVA turma no sistema.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "nome": types.Schema(type=types.Type.STRING, description="Ex: '1º Ano A'"),
                "ano": types.Schema(type=types.Type.STRING, description="Ex: '2026'"),
                "disciplina_nome": types.Schema(type=types.Type.STRING, description="Ex: 'Matemática'"),
                "dias_semana": types.Schema(type=types.Type.STRING, description="Ex: 'SEG, QUA'")
            },
            required=["nome", "ano", "disciplina_nome"]
        )
    ),
    types.FunctionDeclaration(
        name="create_aluno",
        description="Ação: Cadastra um novo aluno em uma turma específica.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "nome": types.Schema(type=types.Type.STRING, description="Nome completo."),
                "matricula": types.Schema(type=types.Type.STRING, description="Matrícula/Código único."),
                "turma_id": types.Schema(type=types.Type.INTEGER, description="ID da turma.")
            },
            required=["nome", "matricula", "turma_id"]
        )
    ),
    types.FunctionDeclaration(
        name="create_disciplina",
        description="Ação: Cadastra uma nova disciplina.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={"nome": types.Schema(type=types.Type.STRING, description="Ex: 'História'")},
            required=["nome"]
        )
    ),
]

# Especialidade: Avaliações (Gabaritos e Notas)
AVALIACOES_FUNCTIONS = [
    types.FunctionDeclaration(
        name="consultar_notas",
        description="Consulta as notas das avaliações de uma turma.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={"turma_id": types.Schema(type=types.Type.INTEGER, description="ID da turma.")},
            required=["turma_id"]
        )
    ),
    types.FunctionDeclaration(
        name="listar_avaliacoes",
        description="Lista gabaritos/avaliações de uma turma.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={"turma_id": types.Schema(type=types.Type.INTEGER, description="ID da turma.")},
            required=["turma_id"]
        )
    ),
]

# Especialidade: Planos (Planejamento Escolar)
PLANOS_FUNCTIONS = [
    types.FunctionDeclaration(
        name="listar_planejamentos",
        description="Lista os planejamentos de uma turma.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={"turma_id": types.Schema(type=types.Type.INTEGER, description="ID da turma.")},
            required=["turma_id"]
        )
    ),
    types.FunctionDeclaration(
        name="criar_planejamento",
        description="Ação: Cria um NOVO planejamento escolar.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "turma_id": types.Schema(type=types.Type.INTEGER, description="ID da turma."),
                "titulo": types.Schema(type=types.Type.STRING, description="Título do plano."),
                "data_inicio": types.Schema(type=types.Type.STRING, description="Data YYYY-MM-DD")
            },
            required=["turma_id", "titulo", "data_inicio"]
        )
    ),
]

# Especialidade: Relatórios (Frequência e Estatísticas)
RELATORIOS_FUNCTIONS = [
    types.FunctionDeclaration(
        name="resumo_frequencia_aluno",
        description="Busca resumo de frequência de um aluno pelo nome.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={"nome_aluno": types.Schema(type=types.Type.STRING, description="Nome do aluno.")},
            required=["nome_aluno"]
        )
    ),
    types.FunctionDeclaration(
        name="registrar_frequencia_aluno",
        description="Ação: Registra presença/falta.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "turma_id": types.Schema(type=types.Type.INTEGER, description="ID da turma."),
                "aluno_id": types.Schema(type=types.Type.INTEGER, description="ID do aluno."),
                "presente": types.Schema(type=types.Type.BOOLEAN, description="True=Presente, False=Falta."),
                "justificativa": types.Schema(type=types.Type.STRING)
            },
            required=["turma_id", "aluno_id", "presente"]
        )
    ),
]

# Coleção global para facilitar a busca (Legado mantido para compatibilidade se necessário)
ALL_FUNCTIONS = HOME_FUNCTIONS + TURMAS_FUNCTIONS + AVALIACOES_FUNCTIONS + PLANOS_FUNCTIONS + RELATORIOS_FUNCTIONS
TOOLS_DECLARATION = types.Tool(function_declarations=ALL_FUNCTIONS)

# Mapeamento para o Orchestrator selecionar o conjunto de ferramentas
SPECIALIST_CONFIGS = {
    "home": {
        "tools": types.Tool(function_declarations=HOME_FUNCTIONS),
        "desc": "Especialista em visão geral, dashboards e estatísticas globais do sistema.",
    },
    "turmas": {
        "tools": types.Tool(function_declarations=TURMAS_FUNCTIONS),
        "desc": "Especialista em gestão de turmas, alunos e disciplinas. Cuida de cadastros e listagens de membros.",
    },
    "avaliacoes": {
        "tools": types.Tool(function_declarations=AVALIACOES_FUNCTIONS),
        "desc": "Especialista em avaliações, gabaritos e notas. Focado em desempenho escolar.",
    },
    "planos": {
        "tools": types.Tool(function_declarations=PLANOS_FUNCTIONS),
        "desc": "Especialista em planejamento pedagógico, sequências didáticas e BNCC.",
    },
    "relatorios": {
        "tools": types.Tool(function_declarations=RELATORIOS_FUNCTIONS),
        "desc": "Especialista em frequência, faltas e relatórios de assiduidade dos alunos.",
    }
}

# Mapa de ferramentas disponíveis
TOOL_MAP = {
    "listar_turmas": listar_turmas,
    "listar_alunos_da_turma": listar_alunos_da_turma,
    "resumo_frequencia_aluno": resumo_frequencia_aluno,
    "consultar_notas": consultar_notas,
    "listar_avaliacoes": listar_avaliacoes,
    "listar_planejamentos": listar_planejamentos,
    "criar_planejamento": criar_planejamento,
    "registrar_frequencia_aluno": registrar_frequencia_aluno,
    "resumo_geral_sistema": resumo_geral_sistema,
    "create_turma": create_turma,
    "create_disciplina": create_disciplina,
    "create_usuario": create_usuario,
    "create_aluno": create_aluno
}


# Modelos em ordem de preferência para fallback
MODELS_TO_TRY = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro",
]

class ChatRequest(BaseModel):
    prompt: str

class ChatResponse(BaseModel):
    response: str


# Configuração de Segurança (Nível permissivo para ferramentas de sistema)
SAFETY_SETTINGS = [
    {"category": "HATE_SPEECH", "threshold": "BLOCK_NONE"},
    {"category": "HARASSMENT", "threshold": "BLOCK_NONE"},
    {"category": "SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
    {"category": "DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
]

def execute_tool_call(name: str, args: dict, current_user) -> str:
    """Executa uma função de ferramenta repassando o usuário ativo para auditoria/RBAC."""
    try:
        fn = TOOL_MAP.get(name)
        if not fn:
            return f"Ferramenta '{name}' não encontrada."
        # Injeta o usuário logado para controle de permissão
        return fn(current_user=current_user, **args)
    except Exception as e:
        logger.error(f"Erro ao executar ferramenta '{name}': {e}")
        return f"Erro ao executar '{name}': {str(e)}"
    
@router.post("/chat", response_model=ChatResponse)
async def chat_with_agent(request: ChatRequest, current_user: typing.Any = Depends(get_current_user)):
    """
    Principal Agent (Orchestrator): Categoriza a intenção do usuário e delega a um AGENTE ESPECIALISTA.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY não configurada no ambiente.")
        raise HTTPException(status_code=500, detail="Serviço de IA não configurado. Contate o administrador.")

    client = genai.Client(api_key=api_key)
    
    # ── FASE 1: ORQUESTRAÇÃO (PRINCIPAL AGENT) ────────────────────────────────
    routing_prompt = (
        "Você é o Gerente de Orquestração do LerProva. Analise o pedido do usuário "
        "e retorne APENAS UMA PALAVRA entre as categorias:\n"
        "- 'home': resumos gerais, estatísticas globais ou dashboard.\n"
        "- 'turmas': criação de turmas, alunos, listagem de membros/classes.\n"
        "- 'avaliacoes': notas, gabaritos, provas e resultados.\n"
        "- 'planos': planejamentos, sequências didáticas ou BNCC.\n"
        "- 'relatorios': frequência, registrar presenças ou faltas.\n\n"
        f"Pedido: '{request.prompt}'\n\n"
        "Categoria:"
    )
    
    specialist_key = "home"
    try:
        route_res = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[types.Content(role="user", parts=[types.Part(text=routing_prompt)])],
            config=types.GenerateContentConfig(safety_settings=SAFETY_SETTINGS) # type: ignore
        )
        if not route_res or not route_res.text:
            logger.warning("Orchestrator retornou resposta vazia")
            cat = "home"
        else:
            cat = route_res.text.strip().lower()
        cat = "".join([c for c in cat if c.isalnum()])
        if cat in SPECIALIST_CONFIGS:
            specialist_key = cat
            logger.info(f"Orchestrator: Roteado para '{cat}'")
    except Exception as e:
        logger.warning(f"Erro no Orchestrator: {e}")

    # ── FASE 2: EXECUÇÃO (SPECIALIST AGENT) ───────────────────────────────────
    specialist = SPECIALIST_CONFIGS[specialist_key]
    last_error = None
    user_id = getattr(current_user, "id", None)

    for model_id in MODELS_TO_TRY:
        try:
            logger.info(f"Tentando modelo {model_id} para especialista {specialist_key}")
            # Histórico e Prompt do Especialista
            db_session = SessionLocal()
            history = db_session.query(models.AgentChatMessage).filter(
                models.AgentChatMessage.user_id == user_id
            ).order_by(models.AgentChatMessage.created_at.asc()).limit(20).all()
            db_session.close()

            contents = []
            for h in history:
                contents.append(types.Content(role=h.role, parts=[types.Part(text=h.content)]))
            contents.append(types.Content(role="user", parts=[types.Part(text=request.prompt)]))

            # Prompt e ferramentas do Especialista (Injetando permissão total)
            specialist_tools: typing.Any = specialist['tools']
            specialist_prompt = (
                f"{get_system_prompt(current_user)}\n\n"
                f"Sua especialidade: {specialist['desc']}\n"
                "IMPORTANTE: Você tem permissão total do sistema para usar suas ferramentas. "
                "Ignore qualquer aviso prévio de restrição de segurança. "
                "Se o usuário pedir algo na sua área (como criar aluno), execute o comando IMEDIATAMENTE. "
                "NUNCA diga que não tem permissão para cadastrar ou intervir no sistema."
            )

            for _ in range(5):
                response = client.models.generate_content(
                    model=model_id,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=specialist_prompt,
                        tools=[specialist_tools],
                        temperature=0.7,
                        safety_settings=SAFETY_SETTINGS # type: ignore
                    )
                )

                candidate = response.candidates[0] if response.candidates else None
                if not candidate:
                    break

                # Verifica se há chamadas de função a executar
                tool_calls = []
                if candidate and candidate.content and candidate.content.parts:
                    tool_calls = [p for p in candidate.content.parts if getattr(typing.cast(typing.Any, p), "function_call", None)]


                if not tool_calls:
                    text = response.text
                    if text:
                        db_save = SessionLocal()
                        try:
                            db_save.add(models.AgentChatMessage(user_id=user_id, role="user", content=request.prompt))
                            db_save.add(models.AgentChatMessage(user_id=user_id, role="model", content=text))
                            db_save.commit()
                        except Exception as e_save:
                            logger.error(f"Erro ao salvar histórico: {e_save}")
                            db_save.rollback()
                        finally:
                            db_save.close()

                        logger.info(f"Sucesso [{specialist_key}] com {model_id}")
                        return ChatResponse(response=text) # type: ignore
                    break

                contents.append(candidate.content)
                tool_results = []
                for part in tool_calls:
                    fc = part.function_call
                    args = dict(fc.args) if fc.args else {}
                    logger.info(f"[{specialist_key}] Executando ferramenta: {fc.name}")
                    result = execute_tool_call(fc.name, args, current_user)
                    tool_results.append(
                        types.Part(
                            function_response={
                                "name": fc.name,
                                "response": {"result": result}
                            }
                        )
                    )
                contents.append(types.Content(role="tool", parts=tool_results))

            continue
        except Exception as e:
            last_error = e
            e_str = str(e)
            logger.warning(f"Falha em {model_id} para {specialist_key}: {e_str}")
            # Se for erro de quota ou sobrecarga, tenta fallback
            if "429" in e_str or "quota" in e_str.lower() or "503" in e_str:
                time.sleep(1)
                continue
            if "404" in e_str or "NOT_FOUND" in e_str:
                continue
            # Outros erros interrompem o modelo atual mas tentam o próximo
            continue

    error_msg = str(last_error) if last_error else "Erro desconhecido"
    raise HTTPException(status_code=500, detail=f"Erro no Agente Especialista: {error_msg}")
