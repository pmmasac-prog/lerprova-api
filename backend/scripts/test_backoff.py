
import os
import sys
import time

# Ensure backend directory is in the path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from unittest.mock import MagicMock, patch
from pydantic import BaseModel

# Mocking modules before imports
sys.modules['fastapi'] = MagicMock()
sys.modules['pydantic'] = MagicMock()
sys.modules['sqlalchemy'] = MagicMock()
sys.modules['sqlalchemy.orm'] = MagicMock()
sys.modules['dependencies'] = MagicMock()
sys.modules['models'] = MagicMock()
# We need actual BaseModel for the request/response classes
from pydantic import BaseModel as ActualBaseModel
sys.modules['pydantic'].BaseModel = ActualBaseModel

# Mocking the agent tools to avoid DB connection
mock_tools = MagicMock()
sys.modules['agents.agent_tools'] = mock_tools

# Now we can safely import the router
# We need to mock os.getenv to return a dummy API key
with patch('os.getenv', return_value="dummy_key"):
    from routers.agents import MODELS_TO_TRY, ChatRequest, chat_with_agent

class MockUser:
    def __init__(self, nome, role="professor"):
        self.nome = nome
        self.role = role
        self.id = 1

async def test_fallback_logic():
    print("🧪 Testando lógica de fallback e backoff...")
    
    request = ChatRequest(prompt="Olá")
    user = MockUser(nome="Professor Teste")
    
    # Mocking the genai.Client
    with patch('routers.agents.genai.Client') as MockClient:
        mock_client_instance = MockClient.return_value
        # Configure the mock to fail for all but the last model
        responses = [Exception("429 Resource Exhausted") for _ in range(len(MODELS_TO_TRY) - 1)]
        
        # The last response should be a success
        mock_success_response = MagicMock()
        mock_success_response.candidates = [MagicMock()]
        mock_success_response.candidates[0].content.parts = []
        mock_success_response.text = "Resposta de sucesso do último modelo"
        responses.append(mock_success_response)
        
        mock_client_instance.models.generate_content.side_effect = responses
        
        start_time = time.time()
        try:
            response = await chat_with_agent(request, current_user=user)
            end_time = time.time()
            
            duration = end_time - start_time
            expected_wait = (len(MODELS_TO_TRY) - 1) * 2
            
            print(f"✅ Resposta recebida: {response.response}")
            print(f"⏱️ Duração total: {duration:.2f}s (Esperado pelo menos {expected_wait}s)")
            
            if duration >= expected_wait:
                print("✅ Lógica de backoff confirmada!")
            else:
                print("❌ Falha na lógica de backoff: tempo muito curto.")
                
        except Exception as e:
            print(f"❌ Erro durante o teste: {e}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_fallback_logic())
