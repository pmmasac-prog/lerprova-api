from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import logging
import traceback
import os
from google import genai

router = APIRouter(
    prefix="/api/agents",
    tags=["Agents AI"]
)

logger = logging.getLogger("lerprova-api.agents")

# System prompt do assistente LerProva
SYSTEM_PROMPT = """Você é um assistente virtual inteligente integrado ao sistema 'LerProva'.
Sua missão é ajudar professores e administradores escolares respondendo perguntas
sobre o sistema educativo, análise de turmas, provas e fornecendo insights gerais de educação.
Seja sempre educado e responda em português do Brasil.
Quando não souber algo, diga claramente que não possui essa informação ainda.
Mantenha respostas concisas, mas completas e amigáveis."""

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

@router.post("/chat", response_model=ChatResponse)
async def chat_with_agent(request: ChatRequest):
    """
    Envia uma mensagem para o assistente de IA usando o SDK do Google Gemini.
    Implementa fallback entre modelos para garantir disponibilidade.
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

            response = client.models.generate_content(
                model=model_id,
                contents=f"{SYSTEM_PROMPT}\n\nUsuário: {request.prompt}",
            )

            text = response.text
            if not text:
                logger.warning(f"Modelo {model_id} retornou resposta vazia.")
                continue

            logger.info(f"Sucesso com modelo: {model_id}")
            return ChatResponse(response=text)

        except Exception as e:
            error_msg = str(e)
            last_error = e
            logger.warning(f"Falha no modelo {model_id}: {error_msg[:150]}")

            # Parar imediatamente em erros de configuração
            if "API_KEY" in error_msg or "PERMISSION_DENIED" in error_msg:
                break

            # Para cota ou modelo não encontrado, tenta o próximo
            continue

    # Todos os modelos falharam
    error_msg = str(last_error) if last_error else "Erro desconhecido"
    logger.error(f"Todos os modelos de IA falharam. Último erro: {error_msg}")
    logger.error(traceback.format_exc())

    if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg or "quota" in error_msg.lower():
        raise HTTPException(
            status_code=429,
            detail="O assistente está temporariamente indisponível por excesso de requisições. Tente novamente em 1 minuto."
        )
    if "404" in error_msg or "NOT_FOUND" in error_msg or "not found" in error_msg.lower():
        raise HTTPException(
            status_code=502,
            detail="Modelo de IA não encontrado no provedor."
        )

    raise HTTPException(
        status_code=500,
        detail="Erro interno ao processar a solicitação com a IA."
    )
