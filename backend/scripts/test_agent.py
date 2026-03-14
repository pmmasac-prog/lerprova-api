import os
import sys
from dotenv import load_dotenv

# Ensure backend directory is in the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from agents.gemini_agent import get_lerprova_assistant

def test_agent():
    try:
        print("🤖 Inicializando Agente do LerProva (Gemini)...")
        agent = get_lerprova_assistant()
        
        pergunta = "Quais são as turmas cadastradas no sistema?"
        print(f"\nPergunta: {pergunta}")
        
        print("\nResposta da IA:\n" + "="*40)
        
        # O print_response do Agno imprime de forma formatada (como markdown no terminal)
        agent.print_response(pergunta, stream=True)
        
        print("\n" + "="*40)
        print("✅ Teste concluído com sucesso!")
        
    except ValueError as e:
        print(f"❌ Erro de Configuração: {e}")
        print("Verifique se a variável GEMINI_API_KEY está definida no seu arquivo .env")
    except Exception as e:
        print(f"❌ Erro inesperado: {e}")

if __name__ == "__main__":
    test_agent()
