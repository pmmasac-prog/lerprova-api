"""
Script de teste para verificar se a API de calendário está funcionando
e os eventos estão sendo retornados corretamente
"""
import requests
import json
from datetime import datetime

# URLs de teste
BASE_URL = "http://localhost:8000"

def test_calendar_endpoint():
    """Testa se o endpoint do calendário retorna eventos"""
    print("\n" + "="*60)
    print("🔍 DIAGNÓSTICO DA API DE CALENDÁRIO")
    print("="*60 + "\n")
    
    # Primeiro, vamos verificar saúde da API
    print("1️⃣  Verificando saúde da API...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"   ✅ API respondendo: {response.status_code}")
    except Exception as e:
        print(f"   ❌ API não respondendo: {e}")
        return False
    
    # Testar login como admin (necessário para /calendar)
    print("\n2️⃣  Tentando fazer login como admin...")
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": "admin@lerprova.com", "password": "senha123"}
        )
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            print(f"   ✅ Login bem-sucedido")
        else:
            print(f"   ⚠️  Login retornou {response.status_code}")
            token = None
    except Exception as e:
        print(f"   ❌ Erro no login: {e}")
        token = None
    
    # Testar endpoint de calendário
    print("\n3️⃣  Testando endpoint /admin/calendar...")
    try:
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        response = requests.get(f"{BASE_URL}/admin/calendar", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            events_count = len(data.get("events", []))
            periods_count = len(data.get("periods", []))
            print(f"   ✅ Endpoint respondendo")
            print(f"      • Eventos na resposta: {events_count}")
            print(f"      • Períodos na resposta: {periods_count}")
            
            if events_count > 0:
                first_event = data["events"][0]
                print(f"\n   📋 Primeiro evento:")
                print(f"      • ID: {first_event.get('id')}")
                print(f"      • Título: {first_event.get('title')}")
                print(f"      • Data: {first_event.get('date')}")
                print(f"      • Tipo: {first_event.get('type')}")
            
        else:
            print(f"   ❌ Endpoint retornou {response.status_code}")
            print(f"      Resposta: {response.text[:200]}")
    except Exception as e:
        print(f"   ❌ Erro ao chamar endpoint: {e}")
    
    # Verificar banco de dados diretamente
    print("\n4️⃣  Verificando banco de dados...")
    try:
        from database import SessionLocal
        from models import Event, Period, School, AcademicYear
        
        db = SessionLocal()
        
        schools = db.query(School).count()
        academic_years = db.query(AcademicYear).count()
        periods = db.query(Period).count()
        events = db.query(Event).count()
        
        print(f"   ✅ Conectado ao banco de dados")
        print(f"      • Escolas: {schools}")
        print(f"      • Anos letivos: {academic_years}")
        print(f"      • Períodos: {periods}")
        print(f"      • Eventos: {events}")
        
        if events == 0:
            print(f"\n   ⚠️  AVISO: Banco de dados não tem eventos!")
            print(f"      Execute: python backend/scripts/seed_school_2026_real.py")
        
        # Mostrar alguns eventos
        if events > 0:
            sample_events = db.query(Event).limit(3).all()
            print(f"\n   📋 Amostra de eventos no BD:")
            for evt in sample_events:
                print(f"      • {evt.title} ({evt.event_type_id}) - {evt.start_date}")
        
        db.close()
    except Exception as e:
        print(f"   ❌ Erro ao verificar BD: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "="*60)
    print("✅ DIAGNÓSTICO CONCLUÍDO")
    print("="*60 + "\n")

if __name__ == "__main__":
    test_calendar_endpoint()
