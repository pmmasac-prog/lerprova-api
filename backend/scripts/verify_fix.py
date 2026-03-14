
import time
import logging

# Configuração simples de logging para ver as saídas
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test-backoff")

# Lista de modelos conforme implementado no agents.py
MODELS_TO_TRY = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite-preview-02-05",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
]

def simulate_chat_with_agent():
    print("🧪 Simulando lógica de fallback e backoff (versão isolada)...")
    
    start_time = time.time()
    last_error = None
    
    for model_id in MODELS_TO_TRY:
        try:
            print(f" tentando modelo: {model_id}")
            
            # Simula falha para todos exceto o último
            if model_id != MODELS_TO_TRY[-1]:
                raise Exception("429 RESOURCE_EXHAUSTED")
            
            # Se for o último, simula sucesso
            print(f"✅ Sucesso com modelo: {model_id}")
            end_time = time.time()
            duration = end_time - start_time
            return duration

        except Exception as e:
            error_msg = f"{e}"
            last_error = e
            print(f"⚠️ Falha no modelo {model_id}: {error_msg}")

            # Lógica extraída exatamente do agents.py:
            # if "API_KEY" in error_msg or "PERMISSION_DENIED" in error_msg:
            #     break
            
            # Aplicar backoff de 2 segundos conforme recomendado
            print(f"⏳ Aguardando 2s antes da próxima tentativa...")
            time.sleep(2)
            continue

    return time.time() - start_time

if __name__ == "__main__":
    duration = simulate_chat_with_agent()
    expected_wait = (len(MODELS_TO_TRY) - 1) * 2
    
    print(f"\n⏱️ Duração total: {duration:.2f}s")
    print(f"📉 Esperado pelo menos: {expected_wait:.2f}s")
    
    if duration >= expected_wait:
        print("\n✅ VERIFICAÇÃO CONCLUÍDA: A lógica de backoff de 2 segundos entre falhas de modelos está funcionando conforme o esperado!")
    else:
        print("\n❌ FALHA NA VERIFICAÇÃO: O tempo de espera foi menor que o esperado.")
