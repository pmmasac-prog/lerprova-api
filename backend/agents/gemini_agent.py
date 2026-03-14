from agno.agent import Agent
from agno.models.google import Gemini
import os
from dotenv import load_dotenv
from agents.agent_tools import listar_turmas, listar_alunos_da_turma, resumo_frequencia_aluno

load_dotenv()

# We check if the API key is present
api_key = os.getenv("GEMINI_API_KEY")

# Create a basic Agno Agent configured to use Google's Gemini Flash model
def get_lerprova_assistant():
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set in the environment variables.")
        
    return Agent(
        model=Gemini(id="gemini-2.5-flash"),
        tools=[listar_turmas, listar_alunos_da_turma, resumo_frequencia_aluno],
        description="Você é um assistente virtual inteligente integrado ao sistema 'LerProva'. "
                    "Sua missão é ajudar professores e administradores escolares respondendo perguntas "
                    "sobre o sistema educativo, análise de turmas, provas e fornecendo insights gerais de educação.",
        instructions=[
            "Seja sempre educado e responda em português do Brasil.",
            "Quando não souber algo, diga claramente que não possui essa informação ainda.",
            "Mantenha respostas concisas, mas completas e amigáveis."
        ],
        markdown=True
    )
