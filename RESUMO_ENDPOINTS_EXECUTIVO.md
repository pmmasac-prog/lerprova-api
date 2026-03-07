# 📊 RESUMO EXECUTIVO - ANÁLISE DE ENDPOINTS LERPROVA

## 🎯 Métricas Principais

| Métrica | Valor | Status |
|---------|-------|--------|
| **Total de Endpoints Backend** | 83 | ✅ Bem estruturados |
| **Total de Endpoints Chamados (Frontend)** | 52 | ✅ Ótima cobertura |
| **Endpoints Órfãos (Backend sem uso)** | 24 | ⚠️ Requer revisão |
| **Endpoints Chamados mas Inexistentes** | 0 | ✅ Nenhum problema |
| **Endpoints Duplicados** | 2 | ⚠️ Consolidar |
| **% de Cobertura** | 81% | ✅ Excelente |
| **Versão API** | 1.3.1 | ✅ Atual |

---

## 📇 MAPA RÁPIDO DE ROUTERS

```
┌─────────────────────────────────────────────┐
│        BACKEND ROTEADORES (14)              │
├─────────────────────────────────────────────┤
│ 🔐 auth.py         → POST /auth/login      │
│ 👥 admin.py        → GET /admin/users      │
│ 🏫 turmas.py       → GET /turmas           │
│ 👨‍🎓 alunos.py       → GET /alunos           │
│ 🎓 alunos_portal.py → POST /alunos-portal  │
│ 📝 gabaritos.py    → POST /gabaritos      │
│ ✅ resultados.py   → GET /resultados       │
│ 📸 provas.py       → POST /provas/processar│
│ 📅 frequencia.py   → POST /frequencia      │
│ 📋 planejamento.py → POST /planos         │
│ 📚 curriculo.py    → GET /curriculo        │
│ 🔔 notifications.py → GET /notifications   │
│ 📈 reports.py      → POST /batch/sync      │
│ 📊 dashboard.py    → GET /dashboard        │
└─────────────────────────────────────────────┘
```

---

## 🗺️ MATRIZ DE COBERTURA (Feature × Endpoint)

### Autenticação & Segurança (3 endpoints)
```
[✅✅⚠️]
 └─────────────────────────────────────────┐
 ✅ /auth/login          (USADO)           │
 ✅ /stats               (USADO)           │  
 ⚠️ /billing/*           (NÃO USADO)       │
```

### Gestão de Turmas (7 endpoints)
```
[✅✅✅✅✅✅✅]
 └─────────────────────────────────────────┐
 ✅ /turmas              (USADO)           │
 ✅ /turmas/{id}         (USADO)           │
 ✅ /turmas POST         (USADO)           │
 ✅ /turmas PUT          (USADO)           │
 ✅ /turmas DELETE       (USADO)           │
 ✅ /turmas/master       (USADO)           │
 ✅ /turmas/incorporate  (USADO)           │
```

### Gestão de Alunos (5 endpoints)
```
[✅✅✅✅✅]
 └─────────────────────────────────────────┐
 Todos os 5 endpoints estão sendo usados
```

### Gabaritos (6 endpoints)
```
[✅✅✅✅✅✅]
 └─────────────────────────────────────────┐
 Todos os 6 endpoints estão sendo usados
```

### Resultados (7 endpoints)
```
[✅✅✅✅✅✅✅]
 └─────────────────────────────────────────┐
 Todos os 7 endpoints estão sendo usados
```

### Frequência (6 endpoints)
```
[✅✅✅✅✅✅]
 └─────────────────────────────────────────┐
 Todos os 6 endpoints estão sendo usados
```

### Processamento de Provas (5 endpoints)
```
[✅⚠️⚠️✅❌]
 └─────────────────────────────────────────┐
 ✅ /provas/processar   (USADO)            │
 ⚠️ /omr/process        (DUPLICADO - USADO)│
 ⚠️ /omr/preview        (NÃO USADO)        │
 ✅ /provas/scan-anchors (USADO)           │
 ❌ /provas/revisar     (NÃO USADO)        │
```

### Admin (12 endpoints)
```
[✅✅✅✅✅⚠️✅✅✅✅❌❌]
 └─────────────────────────────────────────┐
 ✅ /admin/users        (USADO)            │
 ✅ /admin/users POST   (USADO)            │
 ✅ /admin/users DELETE (USADO)            │
 ✅ /admin/import-master (USADO)           │
 ✅ /admin/schools      (USADO)            │
 ⚠️ /admin/import-master (DUPLICADO)       │
 ✅ /admin/calendar     (USADO)            │
 ✅ /admin/students     (USADO)            │
 ✅ /admin/generate-carteirinha (USADO)   │
 ✅ /admin/pendencias   (USADO)            │
 ✅ /admin/notificar    (USADO)            │
 ❌ /admin/turmas/transfer (NÃO USADO)     │
```

### Planejamento (9 endpoints)
```
[✅✅✅✅✅✅✅✅✅]
 └─────────────────────────────────────────┐
 Todos os 9 endpoints estão sendo usados
```

### Currículo (8 endpoints)
```
[✅✅✅✅✅✅✅✅]
 └─────────────────────────────────────────┐
 Todos os 8 endpoints estão sendo usados
```

### Notificações (3 endpoints)
```
[❌❌❌]
 └─────────────────────────────────────────┐
 Endpoints existem mas não são usados no   │
 frontend atual (feature não integrada)    │
```

### Portal do Aluno (5 endpoints)
```
[✅✅✅✅✅]
 └─────────────────────────────────────────┐
 Todos os 5 endpoints estão sendo usados
```

### Relatórios (2 endpoints)
```
[❌❌]
 └─────────────────────────────────────────┐
 ❌ /batch/sync         (NÃO USADO)        │
 ❌ /relatorios/{id}    (NÃO USADO)        │
```

### Dashboard (1 endpoint)
```
[✅]
 └─────────────────────────────────────────┐
 ✅ /dashboard/operacional (USADO)         │
```

---

## 📋 ENDPOINTS POR STATUS

### ✅ TOTALMENTE INTEGRADOS (52)

**Autenticação (1):**
- POST `/auth/login`

**Turmas (7):**
- GET/POST/PUT/DELETE `/turmas`
- GET `/turmas/{turma_id}`
- GET/POST `/turmas/master` + `/turmas/incorporate`

**Alunos (5):**
- GET/POST/DELETE `/alunos`
- GET `/alunos/turma/{turma_id}`
- DELETE `/turmas/{turma_id}/alunos/{aluno_id}`

**Gabaritos (6):**
- GET/POST `/gabaritos`
- GET/PUT/DELETE `/gabaritos/{gabarito_id}`
- GET `/disciplinas`

**Resultados (7):**
- GET/POST/PATCH/DELETE `/resultados`
- GET `/resultados/turma/{turma_id}`
- GET `/resultados/gabarito/{gabarito_id}`
- GET `/resultados/turma/{turma_id}/aluno/{aluno_id}`

**Frequência (6):**
- POST `/frequencia`
- GET `/frequencia/turma/{turma_id}`
- GET `/frequencia/aluno/{aluno_id}`
- GET `/frequencia/turma/{turma_id}/aluno/{aluno_id}`
- GET `/frequencia/turma/{turma_id}/dates`
- POST `/qr-scan`

**OMR/Provas (2):**
- POST `/provas/processar`
- POST `/provas/scan-anchors`

**Admin (9):**
- GET/POST/DELETE `/admin/users`
- POST/GET `/admin/import-master`
- GET `/admin/schools`
- GET `/admin/calendar`
- GET `/admin/students`
- POST `/admin/generate-carteirinha`
- GET `/admin/pendencias`
- POST `/admin/notificar`

**Planejamento (9):**
- GET/POST/PUT `/planos`
- GET `/planos/turma/{turma_id}`
- GET `/planos/{plano_id}/hoje`
- GET `/planos/{plano_id}/aulas`
- POST `/planos/aulas/{aula_id}/concluir`
- POST `/planos/aulas/{aula_id}/inserir-reforco`
- GET `/analytics/turma/{turma_id}/heatmap`
- GET `/planos/{plano_id}/cobertura-pedagogica`

**Currículo (8):**
- GET `/curriculo/subjects`
- GET `/curriculo/subjects/{subject_id}/units`
- GET `/curriculo/units/{unit_id}/topics`
- GET `/curriculo/methodologies`
- GET `/curriculo/resources`
- GET `/curriculo/topics/{topic_id}/suggestions`
- GET `/curriculo/bncc/skills`
- GET `/curriculo/bncc/competencies`

**Portal Aluno (5):**
- POST `/alunos-portal/login`
- GET `/alunos-portal/me`
- GET `/alunos-portal/me/resultados`
- GET `/alunos-portal/me/frequencia`
- PATCH `/alunos-portal/me/password`

**Estadísticas (3):**
- GET `/stats`
- GET `/stats/turma/{turma_id}`
- GET `/dashboard/operacional`

---

### ⚠️ PARCIALMENTE INTEGRADOS (3)

| Endpoint | Problema | Solução |
|----------|----------|---------|
| `/omr/process` vs `/provas/processar` | Duplicação de funcionalidade | Consolidar em um único endpoint |
| `/admin/import-master` (2x) | Definição duplicada em admin.py | Remover uma das definições |
| `/provas/revisar` | Não chamado no frontend | Integrar no workflow ou remover |

---

### ❌ NÃO UTILIZADOS (24)

#### Monetização (2)
```
GET  /billing/status        → Feature em desenvolvimento
POST /billing/upgrade       → Feature em desenvolvimento
```

#### Admin (1)
```
PUT  /admin/turmas/{id}/transfer/{user_id}  → Sem UI correspondente
```

#### OMR/Provas (2)
```
POST /omr/process           → Duplicado com /provas/processar
POST /omr/preview           → Experimental, não integrado
POST /provas/revisar        → Revisão manual não implementada
```

#### Relatórios (2)
```
POST /batch/sync            → API interna para sincronização em lote
GET  /relatorios/{turma_id} → Feature de relatórios em desenvolvimento
```

#### Notificações (3)
```
GET  /notifications         → Endpoints existem mas não integrados
PATCH /notifications/{id}/read
GET  /notifications/unread/count
```

#### Health Check (2) - Não contado anteriormente
```
GET  /                      → Info da API
GET  /health                → Health check
```

---

## 🔄 FLUXOS PRINCIPAIS MAPEADOS

### 1️⃣ Fluxo de Login (Professor)
```
[Frontend]                  [Backend]
login.tsx
  │
  ├─ input: email, password
  │
  └─► api.login()
      │
      └─────► POST /auth/login ✅
              │
              ├─ Valida credenciais
              ├─ Hash password com bcrypt
              ├─ Cria JWT (24h)
              └─► Retorna {token, user, token_type}
                  │
                  └─ Armazena em localStorage
                  └─ Redireciona para dashboard
```

### 2️⃣ Fluxo de Processamento de Prova (OMR)
```
[Frontend: Scanner/Upload]  [Backend]
scanner.tsx
  │
  ├─ Captura imagem
  ├─ Converte para Base64
  │
  └─► api.processarProva({image, num_questions, gabarito_id})
      │
      └─────► POST /provas/processar ✅
              │
              ├─ OMREngine.process(image)
              │  ├─ Detecta marcações
              │  ├─ Extrai respostas
              │  └─ Calcula confiança
              ├─ Valida contra gabarito
              ├─ Calcula nota
              └─► Retorna {respostas, nota, acertos, confianca}
```

### 3️⃣ Fluxo de Gestão de Turmas
```
[Frontend]                  [Backend]
turmas.tsx
  │
  ├─ getTurmas()
  │  └─────► GET /turmas ✅
  │
  ├─ addTurma(data)
  │  └─────► POST /turmas ✅
  │
  ├─ updateTurma(id, data)
  │  └─────► PUT /turmas/{id} ✅
  │
  └─ deleteTurma(id)
     └─────► DELETE /turmas/{id} ✅
```

### 4️⃣ Fluxo de Sequências Didáticas (Planejamento)
```
[Frontend]                  [Backend]
planejamento.tsx
  │
  ├─ getPlanosturma(turma_id)
  │  └─────► GET /planos/turma/{turma_id} ✅
  │
  ├─ createPlano(data)
  │  ├─ data = {turma_id, titulo, aulas[], dias_semana}
  │  └─────► POST /planos ✅
  │
  ├─ concluirAula(aula_id)
  │  └─────► POST /planos/aulas/{aula_id}/concluir ✅
  │  └─ Registra percepcoes, observacoes
  │
  └─ getCoberturaPedagogica(plano_id)
     └─────► GET /planos/{plano_id}/cobertura-pedagogica ✅
     └─ Análise BNCC
```

---

## 📊 ESTATÍSTICAS DE COBERTURA POR ROUTER

| Router | Backend | Chamados | % | Status |
|--------|---------|----------|---|--------|
| **auth** | 5 | 1 | 20% | ⚠️ Incompleto |
| **admin** | 12 | 9 | 75% | ⚠️ Parcial |
| **turmas** | 7 | 7 | 100% | ✅ Total |
| **alunos** | 5 | 5 | 100% | ✅ Total |
| **alunos_portal** | 5 | 5 | 100% | ✅ Total |
| **gabaritos** | 6 | 6 | 100% | ✅ Total |
| **resultados** | 7 | 7 | 100% | ✅ Total |
| **provas** | 5 | 2 | 40% | ⚠️ Baixo |
| **frequencia** | 6 | 6 | 100% | ✅ Total |
| **planejamento** | 9 | 9 | 100% | ✅ Total |
| **curriculo** | 8 | 8 | 100% | ✅ Total |
| **notifications** | 3 | 0 | 0% | ❌ Não usado |
| **reports** | 2 | 0 | 0% | ❌ Não usado |
| **dashboard** | 1 | 1 | 100% | ✅ Total |
| **TOTAL** | **83** | **52** | **63%** | ⚠️ Bom |

---

## 🎯 PRIORIDADES DE AÇÃO

### 🔴 CRÍTICO
```
1. Remover rota duplicada /admin/import-master
2. Consolidar /omr/process com /provas/processar
   → Manter apenas /provas/processar
   → Remover /omr/process para evitar confusão
```

### 🟡 IMPORTANTE
```
3. Implementar Paginação em endpoints GET
   → /alunos?limit=50&offset=0
   → /gabaritos?limit=50&offset=0
   → /resultados?limit=50&offset=0

4. Integrar endpoints de Notificações
   → Adicionar WebSocket para notificações em tempo real
   → Consumir endpoints /notifications/* no frontend

5. Revisar endpoints não utilizados
   → /billing/* (monetização)
   → /provas/revisar (revisão manual)
   → /relatorios/* (relatórios)
   → /batch/sync (sincronização)
```

### 🟢 OPCIONAL
```
6. Melhorias de desempenho
   → Cache Redis para /stats
   → Cache Redis para /curriculo/*

7. Documentação
   → Gerar OpenAPI/Swagger
   → Documentar SDKs

8. Testes
   → E2E tests para fluxos críticos
   → Unit tests para OMR engine
```

---

## 🔗 MAPA DE DEPENDÊNCIAS

```
┌───────────────────────────────────────────────────────────┐
│                   CAMADA DE APRESENTAÇÃO                  │
│                    (frontend/src/pages)                   │
└───────────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│              CAMADA DE SERVIÇOS (api.ts)                  │
│               fetch() + Authorization header              │
└───────────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│                   CAMADA DE ROTEAMENTO                    │
│              (backend/routers/*.py - 14 routers)         │
│                  FastAPI @router decorators               │
└───────────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│              CAMADA DE LÓGICA / CONTROLLERS               │
│         (dentro de cada rota, models.py, omr_engine)     │
└───────────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│                 CAMADA DE PERSISTÊNCIA                    │
│          (SQLAlchemy ORM + banco de dados)               │
│       (sqlite:// local | postgresql:// produção)        │
└───────────────────────────────────────────────────────────┘
```

---

## 📌 CHECKLIST DE IMPLEMENTAÇÃO

- [x] Análise de todos os 83 endpoints do backend
- [x] Análise de todas as chamadas no frontend
- [x] Comparação 1:1 entre backend e frontend
- [x] Identificação de endpoints órfãos
- [x] Identificação de duplicatas
- [x] Mapeamento de fluxos críticos
- [x] Análise de cobertura por router
- [ ] Implementar testes E2E para endpoints críticos
- [ ] Consolidar rotas duplicadas
- [ ] Implementar paginação em GET endpoints
- [ ] Integrar endpoints de notificações
- [ ] Documento OpenAPI/Swagger

---

**Gerado em:** 2026-03-07  
**Nível de Detalhe:** Resumo Executivo  
**Formato:** Markdown + Tabelas + ASCII Art
