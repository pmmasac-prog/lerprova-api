#!/usr/bin/env python3
"""
Script de Teste - Verifica se todos os endpoints de calendário/eventos estão funcionando
Requer que a API esteja rodando em http://localhost:8000
"""

import requests
import json
import sys
from typing import Dict, Optional

# Configuração
BASE_URL = "http://localhost:8000"
ADMIN_EMAIL = "admin@lerprova.com"
ADMIN_PASSWORD = "senha123"

# Cores para output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_success(msg: str):
    print(f"{Colors.GREEN}✅ {msg}{Colors.END}")

def print_error(msg: str):
    print(f"{Colors.RED}❌ {msg}{Colors.END}")

def print_info(msg: str):
    print(f"{Colors.BLUE}ℹ️  {msg}{Colors.END}")

def print_warning(msg: str):
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.END}")

class CalendarAPITester:
    def __init__(self):
        self.token = None
        self.session = requests.Session()
    
    def test_health(self) -> bool:
        """Verifica se a API está rodando"""
        print("\n🔍 Testando saúde da API...")
        try:
            response = self.session.get(f"{BASE_URL}/health")
            if response.status_code == 200:
                print_success("API está respondendo")
                return True
            else:
                print_error(f"API retornou status {response.status_code}")
                return False
        except Exception as e:
            print_error(f"API não está respondendo: {e}")
            return False
    
    def login(self) -> bool:
        """Faz login e obtém token"""
        print("\n🔐 Autenticando...")
        try:
            response = self.session.post(
                f"{BASE_URL}/auth/login",
                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                if self.token:
                    print_success(f"Autenticado como {data.get('user', {}).get('nome', 'admin')}")
                    return True
                else:
                    print_error("Token não retornado na resposta")
                    return False
            else:
                print_error(f"Login falhou com status {response.status_code}")
                return False
        except Exception as e:
            print_error(f"Erro ao fazer login: {e}")
            return False
    
    def get_headers(self) -> Dict:
        """Retorna headers com autorização"""
        return {"Authorization": f"Bearer {self.token}"}
    
    def test_endpoint(self, method: str, path: str, name: str) -> Optional[Dict]:
        """Testa um endpoint genérico"""
        try:
            url = f"{BASE_URL}{path}"
            
            if method == "GET":
                response = self.session.get(url, headers=self.get_headers())
            else:
                response = self.session.post(url, headers=self.get_headers())
            
            if response.status_code == 200:
                data = response.json()
                count = data.get("count", data.get("summary", {}).get("events_count", "?"))
                print_success(f"{name} - {count} registros")
                return data
            else:
                print_error(f"{name} - Status {response.status_code}")
                print(f"   Resposta: {response.text[:200]}")
                return None
        except Exception as e:
            print_error(f"{name} - Erro: {e}")
            return None
    
    def run_all_tests(self) -> bool:
        """Executa todos os testes"""
        print("\n" + "="*70)
        print("   TESTE COMPLETO - ENDPOINTS DE CALENDÁRIO/EVENTOS")
        print("="*70)
        
        # 1. Verificar saúde
        if not self.test_health():
            return False
        
        # 2. Fazer login
        if not self.login():
            return False
        
        # 3. Testar endpoints
        print("\n📋 Testando endpoints...")
        
        endpoints = [
            ("GET", "/calendar/events", "📅 Lista de Eventos"),
            ("GET", "/calendar/periods", "📆 Períodos Letivos"),
            ("GET", "/calendar/academic-years", "📚 Anos Letivos"),
            ("GET", "/calendar/schools", "🏫 Escolas"),
            ("GET", "/calendar/full-calendar", "🗓️  Calendário Completo"),
        ]
        
        all_passed = True
        for method, path, name in endpoints:
            result = self.test_endpoint(method, path, name)
            if result is None:
                all_passed = False
        
        # 4. Testar filtros de tipo de evento
        print("\n📌 Testando filtros por tipo de evento...")
        event_types = [
            "holiday",      # Feriados
            "vacation",     # Férias
            "planning",     # Planejamento
            "meeting",      # Reuniões
            "administrative", # Administrativo
        ]
        
        for event_type in event_types:
            result = self.test_endpoint("GET", f"/calendar/events/{event_type}", 
                                       f"🔎 {event_type.upper()}")
            if result is None:
                all_passed = False
        
        # 5. Resumo final
        print("\n" + "="*70)
        if all_passed:
            print_success("TODOS OS TESTES PASSARAM! 🎉")
            print("\n📊 RESUMO:")
            print("   • API está operacional")
            print("   • Autenticação funcionando")
            print("   • Todos os endpoints respondendo")
            print("   • Dados sendo retornados corretamente")
            print("\n🚀 O sistema está PRONTO para uso!")
        else:
            print_warning("ALGUNS TESTES FALHARAM")
            print("\n❌ Verifique os erros acima e tente novamente")
        
        print("="*70 + "\n")
        
        return all_passed

def main():
    """Função principal"""
    print(f"\n🌍 URL da API: {BASE_URL}")
    print(f"👤 Login: {ADMIN_EMAIL}\n")
    
    tester = CalendarAPITester()
    success = tester.run_all_tests()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
