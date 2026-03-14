from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import logging
import traceback
import os
import json
from google import genai
from google.genai import types
from agents.agent_tools import listar_turmas, listar_alunos_da_turma, resumo_frequencia_aluno

router = APIRouter(
    prefix="/api/agents",
    tags=["Agents AI"]
)

logger = logging.getLogger("lerprova-api.agents")

# ── System Prompt ──────────────────────────────────────────────────────────────
SYSTEM_PROMPT = (
    "Você é um assistente virtual inteligente integrado ao sistema 'LerProva'. "
    "Sua missão é ajudar professores e administradores escolares respondendo perguntas "
    "sobre turmas, alunos, frequência e provas, usando as ferramentas disponíveis para "
    "consultar dados reais do sistema. "
    "Seja sempre educado, responda em português do Brasil e mantenha respostas concisas."
)

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
    ]
)

# Mapa de ferramentas disponíveis
TOOL_MAP = {
    "listar_turmas": listar_turmas,
    "listar_alunos_da_turma": listar_alunos_da_turma,
    "resumo_frequencia_aluno": resumo_frequencia_aluno,
}

# Modelos em ordem de preferência para fallback
MODELS_TO_TRY = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
]

class ChatRequest(BaseModel):
    prompt: str

class ChatResponse(BaseModel):
    response: str


def execute_tool_call(name: str, args: dict) -> str:
    """Executa uma função de ferramenta e retorna o resultado como string."""
    try:
        fn = TOOL_MAP.get(name)
        if not fn:
            return f"Ferramenta '{name}' não encontrada."
        return fn(**args)
    except Exception as e:
        logger.error(f"Erro ao executar ferramenta '{name}': {e}")
        return f"Erro ao executar '{name}': {str(e)}"


@router.post("/chat", response_model=ChatResponse)
async def chat_with_agent(request: ChatRequest):
    """
    Envia uma mensagem para o assistente de IA com suporte a ferramentas de banco de dados.
    Implementa fallback entre modelos Gemini para garantir disponibilidade.
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
                        system_instruction=SYSTEM_PROMPT,
                        tools=[TOOLS_DECLARATION],
                    )
                )

                candidate = response.candidates[0] if response.candidates else None
                if not candidate:
                    break

                # Verifica se há chamadas de função a executar
                tool_calls = [p for p in candidate.content.parts if hasattr(p, "function_call") and p.function_call]

                if not tool_calls:
                    # Sem tool calls — pega o texto final
                    text = response.text
                    if text:
                        logger.info(f"Sucesso com modelo: {model_id}")
                        return ChatResponse(response=text)
                    break

                # Executa as ferramentas e adiciona os resultados à conversa
                contents.append(candidate.content)
                tool_results = []
                for part in tool_calls:
                    fc = part.function_call
                    args = dict(fc.args) if fc.args else {}
                    logger.info(f"Executando ferramenta: {fc.name}({args})")
                    result = execute_tool_call(fc.name, args)
                    logger.info(f"Resultado de {fc.name}: {result[:100]}")
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
            logger.warning(f"Falha no modelo {model_id}: {error_msg[:150]}")

            if "API_KEY" in error_msg or "PERMISSION_DENIED" in error_msg:
                break
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
