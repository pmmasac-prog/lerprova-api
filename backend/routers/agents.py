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
        
        # O Agno as vezes não levanta exceção se o provider falhar, mas o conteúdo vem vazio ou com erro
        if not run_response or not run_response.content:
             logger.error("Resposta do Agente veio vazia ou nula.")
             raise HTTPException(status_code=502, detail="O provedor de IA não retornou uma resposta válida.")

        return ChatResponse(response=run_response.content)
        
    except ValueError as ve:
         logger.error(f"Erro de configuração do Agent: {ve}")
         raise HTTPException(status_code=500, detail=str(ve))
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Erro ao comunicar com o Agent: {error_msg}")
        logger.error(traceback.format_exc())
        
        # Mapeamento de erros comuns para status codes apropriados
        if "404" in error_msg or "not found" in error_msg.lower():
            raise HTTPException(status_code=502, detail="Modelo de IA não encontrado no provedor.")
        if "429" in error_msg or "quota" in error_msg.lower():
            raise HTTPException(status_code=429, detail="Limite de requisições da IA atingido. Tente novamente mais tarde.")
        
        raise HTTPException(
            status_code=500, 
            detail=f"Erro interno ao processar a requisição com a IA: {error_msg[:100]}"
        )
