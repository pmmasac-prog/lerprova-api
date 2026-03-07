#!/usr/bin/env python3
"""
Script para importar dados de gestão escolar via API
Alternativa a usar o endpoint POST /admin/import-master diretamente
"""

import requests
import json
import sys
import os
from pathlib import Path

# Configurar variáveis
API_URL = os.getenv("API_URL", "http://localhost:8000")
AUTH_TOKEN = os.getenv("AUTH_TOKEN", "")  # Deve ser passado como variável de ambiente

def load_json_data(filepath):
    """Carrega dados do arquivo JSON"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"❌ Arquivo não encontrado: {filepath}")
        return None
    except json.JSONDecodeError as e:
        print(f"❌ Erro ao fazer parse do JSON: {e}")
        return None


def import_via_api(data, auth_token):
    """Envia dados para importação via API"""
    
    if not auth_token:
        print("❌ Erro: AUTH_TOKEN não definido!")
        print("\nPara usar este script:")
        print("  1. Obtenha o token JWT do seu usuário admin")
        print("  2. Defina como variável de ambiente: AUTH_TOKEN=seu_token")
        print("  3. Execute: python scripts/import_school_data_via_api.py")
        return False
    
    endpoint = f"{API_URL}/admin/import-master"
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }
    
    print(f"📡 Enviando dados para: {endpoint}")
    print(f"📊 Dados a serem importados:")
    print(f"   • Escolas: {len(data.get('schools', []))}")
    print(f"   • Anos Letivos: {len(data.get('academic_years', []))}")
    print(f"   • Períodos: {len(data.get('periods', []))}")
    print(f"   • Eventos: {len(data.get('events', []))}")
    
    try:
        response = requests.post(
            endpoint,
            headers=headers,
            json=data,
            timeout=30
        )
        
        print(f"\n📨 Status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Importação bem-sucedida!")
            result = response.json()
            print(f"   Resposta: {result}")
            return True
        else:
            print(f"❌ Erro na importação!")
            print(f"   Status: {response.status_code}")
            try:
                print(f"   Detalhes: {response.json()}")
            except:
                print(f"   Resposta: {response.text}")
            return False
    
    except requests.exceptions.ConnectionError:
        print(f"❌ Erro: Não conseguiu conectar em {API_URL}")
        print("   Certifique-se de que o servidor está rodando")
        return False
    except requests.exceptions.Timeout:
        print(f"❌ Erro: Timeout ao conectar em {API_URL}")
        return False
    except Exception as e:
        print(f"❌ Erro: {e}")
        return False


def main():
    print("\n" + "="*60)
    print("📡 IMPORTAÇÃO DE DADOS VIA API")
    print("="*60 + "\n")
    
    # Determinar caminho do arquivo JSON
    current_dir = Path(__file__).parent.parent
    json_file = current_dir / "dados_app_gestao_escolar_2026.json"
    
    # Carregar dados
    print(f"📂 Carregando arquivo: {json_file}")
    data = load_json_data(str(json_file))
    
    if not data:
        print("❌ Falha ao carregar dados")
        sys.exit(1)
    
    print("✅ Dados carregados com sucesso\n")
    
    # Obter token de autenticação
    auth_token = os.getenv("AUTH_TOKEN", "")
    
    if not auth_token:
        print("⚠️  Variável AUTH_TOKEN não definida")
        print("\nPara obter o token:")
        print("  1. Faça login via POST /auth/login")
        print("  2. Use o token retornado")
        print("\nExemplo:")
        print('  AUTH_TOKEN="seu_jwt_token_aqui" python scripts/import_school_data_via_api.py')
        
        # Para testes, tentar login automaticamente se houver admin padrão
        print("\n🔐 Tentando login com usuário admin padrão...")
        
        try:
            login_response = requests.post(
                f"{API_URL}/auth/login",
                json={"email": "admin@lerprova.com", "password": "admin123"},
                timeout=10
            )
            
            if login_response.status_code == 200:
                login_data = login_response.json()
                auth_token = login_data.get("access_token")
                print(f"✅ Login bem-sucedido")
                print(f"   Token (primeiros 20 chars): {auth_token[:20]}...\n")
            else:
                print(f"❌ Login falhou: {login_response.status_code}\n")
        except Exception as e:
            print(f"❌ Erro ao tentar login automático: {e}\n")
    
    if not auth_token:
        print("❌ Não foi possível obter token de autenticação")
        sys.exit(1)
    
    # Importar via API
    success = import_via_api(data, auth_token)
    
    if success:
        print("\n" + "="*60)
        print("✅ IMPORTAÇÃO CONCLUÍDA!")
        print("="*60)
        print("\n🔗 Próximas etapas:")
        print("  • Visite: http://localhost:3000/admin/calendario")
        print("  • Consulte os dados via API:")
        print(f'    curl -H "Authorization: Bearer {auth_token[:20]}..." \\')
        print(f"         {API_URL}/admin/schools")
    else:
        print("\n" + "="*60)
        print("❌ IMPORTAÇÃO FALHOU")
        print("="*60)
        sys.exit(1)


if __name__ == "__main__":
    main()
