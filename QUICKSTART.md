# ⚡ QUICKSTART - 5 MINUTOS PARA VER FUNCIONANDO

## 🎯 Objetivo
Colocar rodando localmente em 5 minutos

## 📋 Pré-requisitos (Instale já)
- [x] Node.js 20.19+ (https://nodejs.org)
- [x] npm (vem com Node.js)
- [ ] Opcional: Git Bash ou WSL para Windows

## 🚀 PASSO 1: Abra 2 Terminais

### Terminal 1: Backend
```bash
cd c:\projetos\LERPROVA\backend

# Verificar Python
python --version  # Deve ser 3.8+

# Instalar dependências
pip install -r requirements.txt

# Rodar servidor
python main.py
# ou
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Esperado quando rodar:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press ENTER to quit)
INFO:     Application startup complete
```

### Terminal 2: Frontend
```bash
cd c:\projetos\LERPROVA\frontend

# Instalar dependências (primeira vez apenas)
npm install

# Rodar servidor de desenvolvimento
npm run dev
```

**Esperado quando rodar:**
```
  VITE v7.3.1  ready in 1234 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

## 🌐 PASSO 2: Abra o Navegador

1. **Acesse:** http://localhost:5173
2. **Você deve ver:** Página de Login
3. **Faça login** com suas credenciais de teste

## ✅ PASSO 3: Teste as 3 Novas Features

### Feature 1: Billing (Faturamento)
```
URL: http://localhost:5173/configuracoes/faturamento

Você deve ver:
✓ Seu plano atual (Starter/Pro/School)
✓ Botões de upgrade
✓ Seletor de duração (1/3/6/12 meses)
✓ Informações de quota (turmas, correções)
```

### Feature 2: Relatórios
```
URL: http://localhost:5173/turmas/1/relatorio

Você deve ver:
✓ Seletor de formato (PDF/CSV/XLSX/JSON)
✓ Seletor de período
✓ Botão "Gerar Relatório"
✓ Se JSON selecionado, preview dos dados
```

### Feature 3: Notificações (Navbar)
```
Location: Canto superior direito da navbar

Você deve ver:
✓ Ícone de sino 🔔
✓ Badge com número (ex: 🔔 3)
✓ Clicar abre menu de notificações
✓ Marcar como lido funciona
```

## 🎤 Se Algo Não Funcionar

### "Cannot connect to localhost:8000"
```bash
# Checar se backend está rodando
# Terminal 1: Você vê "Uvicorn running on..."?
# Se não, rodar:
cd backend && python main.py
```

### "Page shows blank/error"
```bash
# Abrir console (F12 em Chrome)
# Procurar por erros vermelhos
# Se error é CORS, backend precisa de config:
# Adicionar em backend/main.py:
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    ...
)
```

### "Build failed"
```bash
# Limpar cache e reinstalar
cd frontend
rm -r node_modules package-lock.json
npm install
npm run dev
```

## 📱 Testar em Múltiplos Navegadores

```bash
# Firefox
# Abrir: http://localhost:5173

# Safari (Mac)
# Abrir: http://localhost:5173

# Edge
# Abrir: http://localhost:5173
```

## 🧪 Testes Rápidos

### Teste 1: Todos os endpoints respondendo?
```bash
# Windows PowerShell
curl http://localhost:8000/docs

# Resultado esperado:
# Status 200 (página de documentação Swagger)
```

### Teste 2: Frontend carrega?
```bash
curl http://localhost:5173

# Resultado esperado:
# HTML da página (começa com <!DOCTYPE html>)
```

### Teste 3: CORS funcionando?
```javascript
// Abrir console (F12) e rodar:
fetch('http://localhost:8000/billing/status')
  .then(r => r.json())
  .then(d => console.log('✓ CORS OK:', d))
  .catch(e => console.error('✗ CORS Erro:', e))
```

## 🎬 Demonstração Rápida

### Cenário: Testar Billing Screen
```
1. Ir para /configuracoes/faturamento
2. Ver dropdown com "Starter" selecionado
3. Clicar em "Pro"
4. Selecionar "3 meses"
5. Clicar "Upgrade para PRO"
6. Deve mostrar alert: "✅ Upgrade para PRO realizado"
```

### Cenário: Testar Relatórios
```
1. Ir para /turmas/1/relatorio
2. Seletor mostra: "PDF" (padrão)
3. Mudar para "CSV"
4. Clicar "Gerar Relatório"
5. Arquivo CSV deve baixar
```

### Cenário: Testar Notificações
```
1. Observar navbar (topo direito)
2. Ver ícone 🔔 com badge (ex: 🔔 3)
3. Clicar no sino
4. Menu abre com lista de notificações
5. Clicar em notificação
6. Marcar como lido (checkbox)
```

## 📊 Performance Check

```bash
# Abrir Chrome DevTools
# F12 → Performance tab

# Clicar em gravar, depois:
# 1. Clicar em novo endpoint
# 2. Fazer ação (gerar relatório, upgrade)
# 3. Parar gravação

# Verificar:
✓ Carregamento < 2 segundos
✓ Nenhum erro vermelho no console
✓ Sem memory leaks
```

## 🔐 Dados de Teste

Se precisar fazer login:
```
Email: professor@test.com
Senha: test123

Ou admin:
Email: admin@test.com
Senha: admin123
```

*Se não funcionar, checar `backend/users_db.py` ou criar novo user via admin*

## 📝 Commandos Úteis

```bash
# Limpar cache npm
npm cache clean --force

# Reinstalar dependências
rm -r node_modules && npm install

# Kill processo na porta 5173 (Windows)
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Kill processo na porta 8000 (Windows)
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Reiniciar tudo
npx kill-port 5173 8000
npm run dev  # Em terminal 2
python main.py  # Em terminal 1
```

## ✨ Screenshots Esperados

### Landing (depois de login)
```
┌─────────────────────────────────┐
│ Logo  Dashboard | Turmas | ... 🔔│
├─────────────────────────────────┤
│                                 │
│  Bem-vindo, Professor João!     │
│  Turmas: 5  Alunos: 150         │
│                                 │
│  [Botão: Nova Turma] ...        │
└─────────────────────────────────┘
```

### Billing Screen
```
┌─────────────────────────────────┐
│ 💳 Gestão de Assinatura         │
├─────────────────────────────────┤
│ Seu Plano: STARTER              │
│ Expira em: 15 dias              │
│                                 │
│ [Starter] [Pro] [School] ← tabs │
│ Duração: [1] [3] [6] [12] ← meses
│ Preço: R$29/mês                 │
│ [Fazer Upgrade →]               │
└─────────────────────────────────┘
```

### Reports Screen
```
┌─────────────────────────────────┐
│ 📊 Relatórios da Turma          │
├─────────────────────────────────┤
│ Formato: [PDF ▼]                │
│ Período: [Bimestre ▼]           │
│                                 │
│ [Gerar Relatório →]             │
│                                 │
│ Preview:                        │
│ Turma: Biologia 3A              │
│ Alunos: 25                      │
│ Média: 7.5                      │
└─────────────────────────────────┘
```

## 🎓 Próximos Passos

Depois que confirmar que tudo funciona:

1. **Deploy Staging:** Vercel ou servidor teste
2. **Testes Completos:** Todos navegadores + dispositivos
3. **UAT:** Validação com usuários reais
4. **Deploy Produção:** Sem downtime
5. **Monitoring:** Verificar logs e erros

## 📞 Precisa de Ajuda?

1. **Documentação completa:** `/CHECKLIST_IMPLEMENTACAO_24_ENDPOINTS.md`
2. **Deployment guide:** `/GUIA_DEPLOYMENT.md`
3. **Troubleshooting:** Seção "Problemas Comuns" no guia
4. **Console do navegador:** F12 → Console → procurar por erros

## 🎉 Conclusão

Você agora tem 24 novos endpoints funcionando no LERPROVA! 

**Parabéns!** 🚀

---

*Tempo estimado: 5 minutos*  
*Próximo: Explorar cada feature em detalhe*
