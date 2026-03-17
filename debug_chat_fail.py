
import os
import sys
import typing

# Setup paths
sys.path.append(os.getcwd())
sys.path.append(os.path.join(os.getcwd(), "backend"))

import models
from database import SessionLocal
from google import genai
from google.genai import types

api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

# Mocking a user
class MockUser:
    id = 4
    nome = "Reginaldo"
    role = "professor"
    email = "r@alcides.com"

current_user = MockUser()
prompt = "oi"

# Try Orchestrator
routing_prompt = f"Categoria do pedido '{prompt}': home, turmas, avaliacoes, planos, relatorios."
try:
    res = client.models.generate_content(model="gemini-2.0-flash", contents=routing_prompt)
    print(f"Orchestrator result: {res.text}")
except Exception as e:
    print(f"Orchestrator failed: {e}")

# Try Specialist
contents = [types.Content(role="user", parts=[types.Part(text=prompt)])]
try:
    res = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction="Você é um assistente do sistema LerProva.",
            temperature=0.7
        )
    )
    print(f"Specialist result: {res.text}")
except Exception as e:
    print(f"Specialist failed: {e}")
    import traceback
    traceback.print_exc()
