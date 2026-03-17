from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import logging
import traceback
import os
import json
import time
from google import genai
from google.genai import types
from fastapi import Depends
from sqlalchemy.orm import Session
from dependencies import get_current_user
import models
from agents.agent_tools import (
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
TOOLS_DECLARATION = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="listar_turmas",
            description="Retorna a lista de todas as turmas cadastradas no sistema. Use quando o usuário perguntar sobre turmas disponíveis.",
            parameters=types.Schema(type=types.Type.OBJECT, properties={})
        ),
        types.FunctionDeclaration(
            name="listar_alunos_da_turma",
            description="Retorna a lista de alunos de uma turma específica pelo ID da turma.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "turma_id": types.Schema(
                        type=types.Type.INTEGER,
                        description="O ID numérico da turma."
                    )
                },
                required=["turma_id"]
            )
        ),
        types.FunctionDeclaration(
            name="resumo_frequencia_aluno",
            description="Busca o resumo de frequência (presenças, faltas, percentual) de um aluno pelo nome.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "nome_aluno": types.Schema(
                        type=types.Type.STRING,
                        description="O nome ou parte do nome do aluno."
                    )
                },
                required=["nome_aluno"]
            )
        ),
        types.FunctionDeclaration(
            name="consultar_notas",
            description="Consulta as notas das avaliações. Para professores, lista as notas da turma. Para alunos, lista apenas suas notas nessa turma.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "turma_id": types.Schema(type=types.Type.INTEGER, description="ID numérico da turma.")
                },
                required=["turma_id"]
            )
        ),
        types.FunctionDeclaration(
            name="listar_avaliacoes",
            description="Lista os gabaritos/avaliações cadastrados para uma turma específica.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "turma_id": types.Schema(type=types.Type.INTEGER, description="ID numérico da turma.")
                },
                required=["turma_id"]
            )
        ),
        types.FunctionDeclaration(
            name="listar_planejamentos",
            description="Lista os planejamentos (sequências didáticas) cadastrados para uma turma.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "turma_id": types.Schema(type=types.Type.INTEGER, description="ID numérico da turma.")
                },
                required=["turma_id"]
            )
        ),
        types.FunctionDeclaration(
            name="criar_planejamento",
            description="Ação: Cria um NOVO planejamento escolar para o professor em uma turma. Requer título e data inicial.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "turma_id": types.Schema(type=types.Type.INTEGER, description="ID numérico da turma."),
                    "titulo": types.Schema(type=types.Type.STRING, description="Título do planejamento. Ex: 'Frações e Decimais'"),
                    "data_inicio": types.Schema(type=types.Type.STRING, description="Data prevista de início (YYYY-MM-DD)")
                },
                required=["turma_id", "titulo", "data_inicio"]
            )
        ),
        types.FunctionDeclaration(
            name="registrar_frequencia_aluno",
            description="Ação: Registra ou altera a presença/falta de um aluno específico em uma turma.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "turma_id": types.Schema(type=types.Type.INTEGER, description="ID numérico da turma."),
                    "aluno_id": types.Schema(type=types.Type.INTEGER, description="ID numérico do aluno."),
                    "presente": types.Schema(type=types.Type.BOOLEAN, description="True para presente, False para falta."),
                    "justificativa": types.Schema(type=types.Type.STRING, description="(Opcional) Justificativa enviada para faltas.")
                },
                required=["turma_id", "aluno_id", "presente"]
            )
        ),
        types.FunctionDeclaration(
            name="resumo_geral_sistema",
            description="Lê rapidamente todas as estatísticas gerais do perfil (total de turmas, alunos, avaliações, planos). Use quando o usuário pedir análises globais do tipo 'o que tem no meu sistema' ou resumos amplos.",
            parameters=types.Schema(type=types.Type.OBJECT, properties={})
        ),
        types.FunctionDeclaration(
            name="create_turma",
            description="Ação: Cria/Cadastra uma NOVA turma no sistema para o professor atual.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "nome": types.Schema(type=types.Type.STRING, description="Nome da turma. Ex: '1º Ano A'"),
                    "ano": types.Schema(type=types.Type.STRING, description="Ano ou série. Ex: '2026' ou '1º Ano'"),
                    "disciplina_nome": types.Schema(type=types.Type.STRING, description="Nome da disciplina da turma. Ex: 'Matemática'"),
                    "dias_semana": types.Schema(type=types.Type.STRING, description="Dias da semana formatados. Ex: 'SEG, QUA, SEX'")
                },
                required=["nome", "ano", "disciplina_nome"]
            )
        ),
        types.FunctionDeclaration(
            name="create_disciplina",
            description="Ação: Cadastra ou valida uma disciplina no sistema para ser usada nas turmas.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "nome": types.Schema(type=types.Type.STRING, description="Nome da disciplina. Ex: 'História'"),
                    "codigo": types.Schema(type=types.Type.STRING, description="(Opcional) Código interno da disciplina.")
                },
                required=["nome"]
            )
        ),
        types.FunctionDeclaration(
            name="create_usuario",
            description="Ação: Cadastra um novo professor ou admin (Requer perfil admin).",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "nome": types.Schema(type=types.Type.STRING, description="Nome completo do usuário."),
                    "email": types.Schema(type=types.Type.STRING, description="E-mail de acesso."),
                    "role": types.Schema(type=types.Type.STRING, description="Papel: 'professor' ou 'admin'"),
                    "senha_padrao": types.Schema(type=types.Type.STRING, description="(Opcional) Senha provisória. Default: '123456'")
                },
                required=["nome", "email", "role"]
            )
        ),
        types.FunctionDeclaration(
            name="create_aluno",
            description="Ação: Cadastra um novo aluno em uma turma específica.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "nome": types.Schema(type=types.Type.STRING, description="Nome completo do aluno."),
                    "matricula": types.Schema(type=types.Type.STRING, description="Matrícula/Código único do aluno."),
                    "turma_id": types.Schema(type=types.Type.INTEGER, description="ID numérico da turma à qual o aluno pertencerá.")
                },
                required=["nome", "matricula", "turma_id"]
            )
        ),
    ]
)

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
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-2.5-pro",
    "gemini-pro-latest",
]

class ChatRequest(BaseModel):
    prompt: str

class ChatResponse(BaseModel):
    response: str


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
async def chat_with_agent(request: ChatRequest, current_user = Depends(get_current_user)):
    """
    Envia uma mensagem para o assistente de IA com suporte a ferramentas de banco de dados e RBAC integrado.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY não configurada no ambiente.")
        raise HTTPException(status_code=500, detail="Serviço de IA não configurado. Contate o administrador.")

    client = genai.Client(api_key=api_key)
    last_error = None

    for model_id in MODELS_TO_TRY:
        try:
            logger.info(f"Tentando modelo: {model_id}")

            # Histórico da conversa (começa com a mensagem do usuário)
            contents = [types.Content(role="user", parts=[types.Part(text=request.prompt)])]

            # Loop para resolver chamadas de ferramentas (function calling)
            for _ in range(5):  # max 5 rodadas de tool calling
                response = client.models.generate_content(
                    model=model_id,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=get_system_prompt(current_user),
                        tools=[TOOLS_DECLARATION],
                    )
                )

                candidate = response.candidates[0] if response.candidates else None
                if not candidate:
                    break

                # Verifica se há chamadas de função a executar
                tool_calls = []
                if candidate and candidate.content and candidate.content.parts:
                    tool_calls = [p for p in candidate.content.parts if hasattr(p, "function_call") and getattr(p, "function_call", None)] # type: ignore

                if not tool_calls:
                    # Sem tool calls — pega o texto final
                    text = response.text
                    if text:
                        logger.info(f"Sucesso com modelo: {model_id}")
                        return ChatResponse(response=text) # type: ignore
                    break

                # Executa as ferramentas e adiciona os resultados à conversa
                contents.append(candidate.content)
                tool_results = []
                for part in tool_calls:
                    fc = part.function_call
                    args = dict(fc.args) if fc.args else {}
                    logger.info(f"Executando ferramenta: {fc.name}({args}) via RBAC de {current_user.nome}")
                    result = execute_tool_call(fc.name, args, current_user)
                    result_str = str(result)
                    logger.info(f"Resultado de {fc.name}: {result_str[0:50]}") # type: ignore
                    tool_results.append(
                        types.Part(
                            function_response=types.FunctionResponse(
                                name=fc.name,
                                response={"result": result}
                            )
                        )
                    )
                contents.append(types.Content(role="tool", parts=tool_results))

            logger.warning(f"Modelo {model_id} não gerou resposta final.")
            continue

        except Exception as e:
            error_msg = str(e)
            last_error = e
            logger.warning(f"Falha no modelo {model_id}: {error_msg[0:150]}") # type: ignore

            if "API_KEY" in error_msg or "PERMISSION_DENIED" in error_msg:
                break
            
            # Se for 404 (NOT_FOUND), não adianta esperar, tenta o próximo modelo imediatamente
            if "404" in error_msg or "NOT_FOUND" in error_msg:
                logger.info(f"Modelo {model_id} não encontrado. Tentando próximo...")
                continue

            # Para outros erros (como 429), aplicar backoff de 2 segundos
            logger.info(f"Aguardando 2s antes da próxima tentativa após erro em {model_id}...")
            time.sleep(2)
            continue

    # Todos os modelos falharam
    error_msg = str(last_error) if last_error else "Erro desconhecido"
    logger.error(f"Todos os modelos de IA falharam. Último erro: {error_msg}")

    if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg or "quota" in error_msg.lower():
        raise HTTPException(
            status_code=429,
            detail="O assistente está temporariamente indisponível. Tente novamente em 1 minuto."
        )
    if "404" in error_msg or "NOT_FOUND" in error_msg:
        raise HTTPException(status_code=502, detail="Modelo de IA não encontrado no provedor.")

    raise HTTPException(status_code=500, detail="Erro interno ao processar a solicitação com a IA.")
