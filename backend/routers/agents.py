from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import logging
import traceback
from agents.gemini_agent import get_lerprova_assistant

router = APIRouter(
    prefix="/api/agents",
    tags=["Agents AI"]
)

logger = logging.getLogger("lerprova-api.agents")

class ChatRequest(BaseModel):
    prompt: str

class ChatResponse(BaseModel):
    response: str

@router.post("/chat", response_model=ChatResponse)
async def chat_with_agent(request: ChatRequest):
    """
    Envia uma mensagem para o Agente de Inteligência Artificial usando o Gemini via Agno.
    Implementa fallback de modelos para garantir disponibilidade.
    """
    # Lista de modelos para tentar em ordem de preferência
    models_to_try = [
        "gemini-2.0-flash",
        "gemini-1.5-flash", 
        "gemini-1.5-flash-8b",
        "gemini-pro"
    ]
    
    last_exception = None
    
    for model_id in models_to_try:
        try:
            logger.info(f"Tentando comunicação com o Agente usando o modelo: {model_id}")
            agent = get_lerprova_assistant(model_id=model_id)
            
            # O agente retorna um objeto RunResponse com o conteúdo textual
            run_response = agent.run(request.prompt)
            
            # Validação básica de resposta
            if not run_response or not getattr(run_response, "content", None):
                 logger.warning(f"Modelo {model_id} retornou resposta vazia. Tentando próximo...")
                 continue

            logger.info(f"Sucesso com o modelo: {model_id}")
            return ChatResponse(response=run_response.content)
            
        except Exception as e:
            last_exception = e
            error_msg = str(e)
            logger.warning(f"Falha ao usar modelo {model_id}: {error_msg}")
            
            # Se for um erro que não vale a pena tentar outro (ex: erro de configuração de chave local)
            if "GEMINI_API_KEY is not set" in error_msg:
                break
                
            # Caso contrário, continua para o próximo modelo na lista
            continue
            
    # Se chegarmos aqui, todos os modelos falharam
    if last_exception:
        error_msg = str(last_exception)
        logger.error(f"Todos os modelos de IA falharam. Último erro: {error_msg}")
        logger.error(traceback.format_exc())
        
        if "404" in error_msg or "not found" in error_msg.lower():
            raise HTTPException(status_code=502, detail="Modelos de IA indisponíveis ou não encontrados no provedor.")
        if "429" in error_msg or "quota" in error_msg.lower():
            raise HTTPException(status_code=429, detail="Limite de cota excedido em todos os modelos disponíveis.")
            
        raise HTTPException(
            status_code=500, 
            detail=f"Não foi possível processar sua solicitação com a IA após várias tentativas: {error_msg[:100]}"
        )
    
    raise HTTPException(status_code=500, detail="Erro interno inesperado no serviço de IA.")
