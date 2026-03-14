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
    """
    try:
        agent = get_lerprova_assistant()
        
        # O agente retorna um objeto RunResponse com o conteúdo textual
        run_response = agent.run(request.prompt)
        
        return ChatResponse(response=run_response.content)
        
    except ValueError as ve:
         logger.error(f"Erro de configuração do Agent: {ve}")
         raise HTTPException(status_code=500, detail=str(ve))
    except Exception as e:
        logger.error(f"Erro ao comunicar com o Agent: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erro interno ao processar a requisição com a IA.")
