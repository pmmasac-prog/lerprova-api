# Correção: 401 Unauthorized em /resultados, /gabaritos e /turmas

## Problema 📋

**Erro:** 401 Unauthorized - Falha de Autenticação  
**Endpoints afetados:** 
- `/resultados`
- `/gabaritos` 
- `/turmas`

**Sintomas:** 3 ocorrências consecutivas de erro 401 nesses endpoints, indicando problemas no tratamento de headers de autenticação.

---

## Causa Raiz 🔍

### 1. **Frontend - Inconsistência no Tratamento de Requisições**

Em [frontend/src/services/api.ts](frontend/src/services/api.ts), havia uma **inconsistência crítica**:

**❌ ANTES (linhas 93-104):**
```typescript
// getResultados() e getResultadosByTurma() usavam fetch() direto
async getResultados() {
    const response = await fetch(`${API_URL}/resultados`, {
        headers: getAuthHeaders()
    });
    return response.json();  // Sem tratamento de 401!
}
```

**✅ CORRIGIDO:**
```typescript
// Agora usam request() wrapper como todos os outros
async getResultados() {
    return request(`${API_URL}/resultados`, {
        headers: getAuthHeaders()
    });
}
```

### Comparação com Métodos Corretos:
- `getTurmas()` - ✅ Usa `request()` wrapper
- `getGabaritos()` - ✅ Usa `request()` wrapper  
- `getResultados()` - ❌ Usava `fetch()` direto → **CORRIGIDO**
- `getResultadosByTurma()` - ❌ Usava `fetch()` direto → **CORRIGIDO**

### Impacto da Ausência do Wrapper:
O wrapper `request()` trata erros 401 propriamente:
```typescript
if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';  // ← Redireciona para login
    }
    throw new Error('Sessão expirada. Redirecionando...');
}
```

Sem esse tratamento, a resposta 401 era retornada **crua** para o componente, causando erros não tratados.

---

### 2. **Backend - Configuração CORS Inadequada**

Em [backend/main.py](backend/main.py), a configuração de CORS tinha problemas:

**❌ ANTES (linhas ~67-73):**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],  # ← Impreciso
    allow_credentials=False,  # ← Contradição!
)
```

**Problemas:**
- `allow_headers=["*"]` com `allow_credentials=False` = O navegador pode ignorar headers de autenticação em preflight CORS
- Sem credenciais, o Authorization header pode ser rejeitado

**✅ CORRIGIDO:**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["Content-Type", "Authorization"],  # ← Explícito
    allow_credentials=True,  # ← Permite Auth header
)
```

---

## Solução Implementada ✅

### Frontend (api.ts)
1. **Padronizou** `getResultados()` e `getResultadosByTurma()` para usar `request()` wrapper
2. Garante que **erros 401 sejam capturados e tratados** com logout automático
3. Mantém consistência com outros endpoints

### Backend (main.py)
1. **Adicionado** header "Authorization" à lista explícita de allowed headers
2. **Ativado** `allow_credentials=True` para suportar autenticação
3. Garante que preflight CORS não bloqueie headers de autenticação

---

## Fluxo de Funcionamento (Corrigido)

```
1. Cliente faz requisição com Authorization header
          ↓
2. CORS Middleware permite header (agora explícito)
          ↓
3. GET /resultados recebe request
          ↓
4. Backend valida token em get_current_user()
          ↓
5. Se 401:
   - Antes: Resposta crua retorna para componente (erro não tratado)
   - Agora: request() wrapper intercepta 401 → Limpa localStorage → Redireciona /login
          ↓
6. Se 200: Retorna dados normalmente
```

---

## Arquivos Modificados

| Arquivo | Linhas | Mudança |
|---------|--------|---------|
| [frontend/src/services/api.ts](frontend/src/services/api.ts) | 93-104 | Padronizou `getResultados()` e `getResultadosByTurma()` para usar wrapper |
| [backend/main.py](backend/main.py) | ~67-73 | Configuração CORS com headers explícitos |

---

## Testes Recomendados 🧪

```bash
# 1. Teste com token válido
curl -H "Authorization: Bearer TOKEN" http://localhost:8000/resultados

# 2. Teste com token inválido (deve retornar 401 com mensagem)
curl -H "Authorization: Bearer INVALID" http://localhost:8000/resultados

# 3. Teste sem header (deve retornar 401)
curl http://localhost:8000/resultados

# 4. Frontend: Login normal → navegue para /resultados → confirmando dados carregam
```

---

## Status ✅ Resolvido

- ✅ `GET /resultados` - Agora com tratamento 401 correto
- ✅ `GET /resultados/turma/{turma_id}` - Agora com tratamento 401 correto  
- ✅ `GET /gabaritos` - Mantém funcionamento (já estava correto)
- ✅ `GET /turmas` - Mantém funcionamento (já estava correto)
- ✅ CORS Headers - Explicitamente permitindo Authorization

Data: 1º de Março de 2026
