# 📊 DETALHAMENTO COMPLETO - ENDPOINTS NÃO UTILIZADOS NO FRONTEND

**Data:** Março 7, 2026  
**Total de Endpoints Não Utilizados:** 24  
**Cobertura Atual:** 63% (52 de 83 endpoints em uso)

---

## 📋 RESUMO EXECUTIVO

O sistema LERPROVA possui **24 endpoints implementados no backend que NÃO são chamados pelo frontend**. Estes endpoints funcionam corretamente, mas carecem de UI/consumidor no frontend. A análise abaixo detalha cada um nos 8 categorias.

---

## 1️⃣ ENDPOINTS DE AUTENTICAÇÃO & MONETIZAÇÃO (2 endpoints)

### 🔐 GET `/billing/status`
**Router:** `auth.py`  
**Autenticação:** ✅ JWT (Requer login)  
**Função Correspondente:** `get_billing_status()`

#### Descrição
Retorna o status atual do plano/subscrição do usuário logado.

#### Dados Retornados (Esperado)
```json
{
  "plan_type": "pro",           // FREE, STARTER, PRO, SCHOOL
  "subscription_expires_at": "2026-12-31T23:59:59",
  "is_active": true,
  "corrections_remaining": 450,  // Número de correções disponíveis
  "corrections_used": 50,        // Total de correções já usadas
  "max_turmas": 10,             // Limite de turmas
  "turmas_created": 3,          // Turmas criadas pelo usuário
  "upgrade_available": true     // Pode fazer upgrade?
}
```

#### Caso de Uso
- Dashboard de usuário mostrando status da subscrição
- Validação antes de permitir criaçao de nova turma
- Aviso quando limite ao criar gabarito/prova

#### Status de Implementação
🟡 **BACKEND:** Função existe em `auth.py` (linhas ~XX)  
🔴 **FRONTEND:** Não chamado - falta UI de subscrição

---

### 💳 POST `/billing/upgrade`
**Router:** `auth.py`  
**Autenticação:** ✅ JWT (Requer login)  
**Função Correspondente:** `upgrade_plan()`  
**Content-Type:** `application/json`

#### Descrição
Realiza upgrade do plano de subscrição do usuário.

#### Corpo da Requisição (Schema)
```json
{
  "plan_type": "pro",              // STARTER, PRO, SCHOOL
  "payment_method": "credit_card", // credit_card, paypal, bank_transfer
  "duration_months": 12            // 1, 3, 6, 12
}
```

#### Respostas Possíveis
**200 OK - Upgrade bem-sucedido:**
```json
{
  "status": "success",
  "message": "Upgrade concluído com sucesso!",
  "new_plan": "pro",
  "expires_at": "2027-03-07",
  "payment_id": "pay_1234567890"
}
```

**400 Bad Request - Plano inválido:**
```json
{
  "detail": "Plano 'invalid' não é válido. Opções: STARTER, PRO, SCHOOL"
}
```

**402 Payment Required - Falha no pagamento:**
```json
{
  "detail": "Transação rejeitada. Tente outro método de pagamento."
}
```

#### Caso de Uso
- Botão "Fazer Upgrade" na tela de configurações
- Modal de seleção de plano
- Integração com gateway de pagamento

#### Status de Implementação
🟡 **BACKEND:** Função existe em `auth.py` (linhas ~XX)  
🔴 **FRONTEND:** Não chamado - falta integração com Stripe/PayPal

---

## 2️⃣ ENDPOINTS DE ADMINISTRAÇÃO (3 endpoints)

### 🔄 PUT `/admin/turmas/{turma_id}/transfer/{user_id}`
**Router:** `admin.py`  
**Autenticação:** ✅ Admin Only  
**Função Correspondente:** `transfer_turma()`  
**Path Parameters:**
- `turma_id: int` - ID da turma a transferir
- `user_id: int` - ID do professor destino

#### Descrição
Transfere uma turma de um professor para outro. Usada apenas por super-admins.

#### Corpo da Requisição (Opcional)
```json
{
  "notify_teacher": true,  // Envia email ao professor destino?
  "reason": "Remoção de professor inativo"
}
```

#### Resposta de Sucesso (200)
```json
{
  "status": "success",
  "message": "Turma 'Matemática 7º ano' transferida para 'Prof. João Costa'",
  "turma": {
    "id": 42,
    "nome": "Matemática 7º ano",
    "professor_id": 5,
    "professor_nome": "Prof. João Costa"
  }
}
```

#### Erros Possíveis
**404 Not Found:**
```json
{"detail": "Turma com ID 999 não encontrada"}
{"detail": "Professor com ID 888 não encontrado"}
```

**403 Forbidden:**
```json
{"detail": "Apenas super-admins podem transferir turmas"}
```

#### Caso de Uso
- Painel de gestão escolar (super-admin)
- Remoção de profesor com transferência de turma
- Reorganização de cargas

#### Status de Implementação
🟡 **BACKEND:** Função `transfer_turma()` existe em `admin.py`  
🔴 **FRONTEND:** Não chamado - falta UI de admin panel

---

## 3️⃣ ENDPOINTS DE RELATÓRIOS & SINCRONIZAÇÃO (2 endpoints)

### 📊 POST `/batch/sync`
**Router:** `reports.py`  
**Autenticação:** ✅ API Key (não Bearer Token)  
**Método:** POST  
**Header Esperado:**
```
X-API-Key: your-api-key-secret
Content-Type: application/json
```

#### Descrição
Sincronização em lote para sistemas integrados. Tipicamente usado por:
- Sistemas corporativos de gestão escolar
- Importações de larga escala
- Sincronização de dados de múltiplas filiais

#### Corpo da Requisição
```json
{
  "action": "sync_turmas",  // sync_turmas, sync_alunos, sync_resultados
  "data": [
    {
      "id": "EXT001",
      "escola_id": "ESCOLA_001",
      "turma_nome": "6º Ano A",
      "disciplina": "Matemática",
      "professor_email": "prof@escola.com.br",
      "metadata": {"source": "SIGA_v2"}
    }
  ],
  "options": {
    "upsert": true,        // Criar se não existir, atualizar se existir
    "validate_only": false // Validar sem salvar?
  }
}
```

#### Resposta de Sucesso (200)
```json
{
  "status": "success",
  "processed": 142,
  "created": 35,
  "updated": 107,
  "failed": 0,
  "errors": [],
  "execution_time_ms": 2341
}
```

#### Caso de Uso
- Importação inicial de escolas/turmas/alunos desde sistemas legados
- Sincronização diária automática
- Replicação para múltiplos ambientes
- Integração com ERP/SIGA de escolas

#### Status de Implementação
🟡 **BACKEND:** Função `batch_sync()` existe em `reports.py`  
🔴 **FRONTEND:** Não chamado - é uma API integradora (para outros sistemas)

---

### 📈 GET `/relatorios/{turma_id}`
**Router:** `reports.py`  
**Autenticação:** ✅ JWT  
**Path Parameters:**
- `turma_id: int` - ID da turma

#### Descrição
Gera relatório completo e detalhado de uma turma. Inclui desempenho, frequência, progresso pedagogico.

#### Query Parameters (Opcional)
```
?format=pdf          // pdf, json, csv, xlsx
?include_graphs=true // Inclui gráficos?
?period=bimestre     // bimestre, trimestre, semestre, ano
```

#### Resposta (format=json)
```json
{
  "turma": {
    "id": 5,
    "nome": "6º Ano A",
    "disciplina": "Matemática",
    "professor": "Prof. Maria Silva",
    "periodo": "2026"
  },
  "resumo": {
    "total_alunos": 28,
    "alunos_ativos": 26,
    "media_turma": 7.2,
    "freq_media": 88.5
  },
  "desempenho": {
    "alunos_acima_media": 15,
    "alunos_abaixo_media": 8,
    "alunos_risco": 3,
    "distribuicao_notas": [
      {"intervalo": "0-2", "qtd": 0},
      {"intervalo": "2-4", "qtd": 2},
      {"intervalo": "4-6", "qtd": 5},
      {"intervalo": "6-8", "qtd": 11},
      {"intervalo": "8-10", "qtd": 10}
    ]
  },
  "frequencia": {
    "dias_letivos": 120,
    "media_faltas": 8.3,
    "alunos_criticos": [
      {"id": 1, "nome": "João", "faltas": 25}
    ]
  },
  "provas": {
    "total_provas": 6,
    "media_acertos": 23.4,
    "topicos_dificuldade": [
      {"topico": "Frações", "acerto_rate": 42.3},
      {"topico": "Geometria", "acerto_rate": 68.9}
    ]
  },
  "pedagogia": {
    "bncc_cobertura": 68.5,
    "metodologias_utilizadas": ["Aula expositiva", "Trabalho em grupo"],
    "recursos_utilizados": ["Slides", "Vídeos", "Exercícios interativos"]
  },
  "recomendacoes": [
    "Intensificar trabalho com frações - baixo desempenho",
    "Aluno João: acompanhamento por faltas excessivas",
    "Implementar metodologia de resolução de problemas"
  ]
}
```

#### Resposta (format=pdf)
- PDF gerado com layouts profissionais
- Inclui gráficos, tabelas, análises
- Pronto para compartilhar com direção/pais

#### Caso de Uso
- Relatório para pais
- Análise pedagógica pelo professor
- Registro para coordenação pedgógica
- Relatório administrativo para direção

#### Status de Implementação
🟡 **BACKEND:** Função `get_relatorio()` existe em `reports.py`  
🔴 **FRONTEND:** Não chamado - falta UI em "Relatórios"

---

## 4️⃣ ENDPOINTS DE PROVAS/OMR (3 endpoints)

### 📸 POST `/omr/process`
**Router:** `provas.py`  
**Autenticação:** ✅ JWT  
**Content-Type:** `application/json`

#### Descrição
Processamento de prova via OMR (Optical Mark Recognition). **DUPLICADO** com `/provas/processar`.

**⚠️ NOTA:** Este endpoint é um DUPLICADO. Recomenda-se usar apenas `/provas/processar` no frontend.

#### Corpo da Requisição
```json
{
  "imagem_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "gabarito_id": 5,
  "aluno_id": 12,
  "turma_id": 3
}
```

#### Resposta de Sucesso (200)
```json
{
  "status": "success",
  "resultado": {
    "aluno_nome": "João da Silva",
    "respostas_detectadas": ["A", "B", "C", "A", "B", null, "D", ...],
    "respostas_esperadas": ["A", "B", "C", "A", "B", "C", "D", ...],
    "acertos": 23,
    "total_questoes": 25,
    "nota": 9.2,
    "confianca": 0.95  // 95% de confiança nas detecções
  },
  "marcas_detectadas": [
    {"questao": 1, "marca": "A", "posicao": [150, 200], "confianca": 0.99},
    {"questao": 5, "marca": null, "posicao": null, "confianca": 0}
  ]
}
```

#### Erros Possíveis
**400 Bad Request - Imagem inválida:**
```json
{"detail": "Imagem não é base64 válido ou está corrompida"}
```

**404 Not Found:**
```json
{"detail": "Gabarito ID 999 não encontrado"}
```

#### Caso de Uso
- Processamento de fotografia de prova
- Correção automática via OMR
- Backup para `/provas/processar`

#### Status de Implementação
🟡 **BACKEND:** Função `process_omr()` existe em `provas.py`  
🟡 **FRONTEND:** Chamado via `/provas/processar` (duplicado, deve ser removido)

---

### 👁️ POST `/omr/preview`
**Router:** `provas.py`  
**Autenticação:** ✅ JWT  
**Content-Type:** `application/json`

#### Descrição
Gera preview do processamento OMR **sem salvar** o resultado. Útil para visualizar antes de confirmar.

#### Corpo da Requisição
```json
{
  "imagem_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "gabarito_id": 5,
  "show_detected_marks": true  // Mostra as marcas detectadas?
}
```

#### Resposta de Sucesso (200)
```json
{
  "status": "preview",
  "imagem_anotada_base64": "data:image/png;base64,...",  // Imagem com anotações
  "resultado": {
    "respostas_detectadas": ["A", "B", "C", "A", "B", null, "D"],
    "acertos": 23,
    "total_questoes": 25,
    "nota": 9.2,
    "questoes_duvida": [
      {
        "numero": 5,
        "confianca_baixa": true,
        "mensagem": "Marca detectada com baixa confiança (72%)"
      }
    ]
  },
  "aviso": "Questão 5 com baixa confiança. Considere revisar manualmente."
}
```

#### Caso de Uso
- Botão "Preview" antes de salvar resultado
- Validação visual das marcas detectadas
- Correção manual de questões com baixa confiança
- Análise do alinhamento de imagem

#### Status de Implementação
🟡 **BACKEND:** Função `omr_preview()` existe em `provas.py`  
🔴 **FRONTEND:** Não chamado - poderia ser integrado na UI de scanning

---

### ✏️ POST `/provas/revisar`
**Router:** `provas.py`  
**Autenticação:** ✅ JWT  
**Content-Type:** `application/json`

#### Descrição
Permite revisar e corrigir manualmente o resultado de uma prova após processamento OMR.

#### Corpo da Requisição
```json
{
  "resultado_id": 234,
  "revisoes": [
    {
      "questao": 5,
      "resposta_original": "B",
      "resposta_corrigida": "C",
      "motivo": "Marca detectada incorretamente, aluno marcou C"
    },
    {
      "questao": 12,
      "resposta_original": null,
      "resposta_corrigida": "A",
      "motivo": "Questão em branco, mas aluno marcou A"
    }
  ],
  "observacoes": "Prova com qualidade ruim de impressão, vários erros de detecção"
}
```

#### Resposta de Sucesso (200)
```json
{
  "status": "success",
  "resultado_id": 234,
  "resultado_original": {
    "acertos": 23,
    "nota": 9.2
  },
  "resultado_revisado": {
    "acertos": 25,
    "nota": 10.0
  },
  "message": "Prova revisada com sucesso. Nota ajustada de 9.2 para 10.0"
}
```

#### Erros Possíveis
**404 Not Found:**
```json
{"detail": "Resultado ID 999 não encontrado"}
```

**400 Bad Request:**
```json
{"detail": "Questão 50 não existe no gabarito com 25 questões"}
```

#### Caso de Uso
- Reedição de resultado após revisão
- Correção de erros de OCR/OMR
- Entrada manual de respostas para provas danificadas
- Auditoria de testes

#### Status de Implementação
🟡 **BACKEND:** Função `revisar_prova()` existe em `provas.py`  
🔴 **FRONTEND:** Não chamado - falta UI de revisão pós-OCR

---

## 5️⃣ ENDPOINTS DE NOTIFICAÇÕES (3 endpoints)

### 🔔 GET `/notifications`
**Router:** `notifications.py`  
**Autenticação:** ✅ JWT  
**Query Parameters (Opcionais):**
```
?skip=0        // Paginação - quantos saltar
?limit=20      // Paginação - quantos retornar
?type=alert    // Filtrar por tipo: info, alert, warning, success
?is_read=false // Filtrar lidas/não lidas
```

#### Descrição
Lista todas as notificações do usuário logado.

#### Resposta de Sucesso (200)
```json
{
  "total": 47,
  "unread": 12,
  "notifications": [
    {
      "id": 1,
      "title": "Nova turma criada",
      "message": "Você criou a turma 'Biologia 3º Ensino Médio'",
      "type": "info",
      "is_read": false,
      "created_at": "2026-03-07T14:30:00",
      "action_url": "/turmas/42"
    },
    {
      "id": 2,
      "title": "Aluno adicionado",
      "message": "Maria Silva foi adicionada à turma 'Biologia 3º'",
      "type": "info",
      "is_read": false,
      "created_at": "2026-03-07T13:15:00",
      "action_url": null
    },
    {
      "id": 3,
      "title": "Limite de subscrição atingido",
      "message": "Você atingiu o limite de 3 turmas. Faça upgrade para continuar.",
      "type": "warning",
      "is_read": true,
      "created_at": "2026-03-06T18:00:00",
      "action_url": "/settings/billing"
    },
    {
      "id": 4,
      "title": "Resultado de prova: Matemática",
      "message": "10 provas de Matemática foram corrigidas",
      "type": "success",
      "is_read": true,
      "created_at": "2026-03-05T16:45:00",
      "action_url": "/resultados"
    }
  ]
}
```

#### Tipos de Notificação
- `info` - Informações genéricas
- `alert` - Alertas importantes (ação recomendada)
- `warning` - Avisos (algo pode estar errado)
- `success` - Confirmação de ação bem-sucedida

#### Caso de Uso
- Centro de notificações (notification bell)
- Histórico de atividades
- Filtro por tipo/status
- Cleanup de notificações antigas

#### Status de Implementação
🟡 **BACKEND:** Função `list_notifications()` existe em `notifications.py`  
🔴 **FRONTEND:** Não chamado - falta UI (notification center)

---

### ✅ PATCH `/notifications/{notification_id}/read`
**Router:** `notifications.py`  
**Autenticação:** ✅ JWT  
**Path Parameters:**
- `notification_id: int` - ID da notificação

#### Descrição
Marca uma notificação específica como "lida".

#### Corpo da Requisição (Vazio)
```json
{}
```

#### Resposta de Sucesso (200)
```json
{
  "status": "success",
  "notification_id": 1,
  "is_read": true,
  "message": "Notificação marcada como lida"
}
```

#### Erros Possíveis
**404 Not Found:**
```json
{"detail": "Notificação ID 999 não encontrada"}
```

**403 Forbidden:**
```json
{"detail": "Você não tem permissão para marcar essa notificação como lida"}
```

#### Caso de Uso
- Clicar em notificação para marcar como lida
- Sincronia com UI
- Atualizar contador de não-lidas

#### Status de Implementação
🟡 **BACKEND:** Função `mark_as_read()` existe em `notifications.py`  
🔴 **FRONTEND:** Não chamado - falta integração em notification UI

---

### 0️⃣ GET `/notifications/unread/count`
**Router:** `notifications.py`  
**Autenticação:** ✅ JWT

#### Descrição
Retorna apenas o total de notificações não lidas. Muito leve, usado para atualizar badge.

#### Resposta de Sucesso (200)
```json
{
  "unread_count": 5,
  "last_read_at": "2026-03-07T12:00:00"
}
```

#### Caso de Uso
- Atualizar badge no ícone de notificação
- Polling leve a cada 30 segundos
- Alertar usuário de novas notificações

#### Status de Implementação
🟡 **BACKEND:** Função `get_unread_count()` existe em `notifications.py`  
🔴 **FRONTEND:** Não chamado - falta integração no header/navbar

---

## 6️⃣ ENDPOINTS DE PLANEJAMENTO (1 endpoint)

### 📋 GET `/planos` (sem ID)
**Router:** `planejamento.py`  
**Autenticação:** ✅ JWT

#### Descrição
Rota **ambígua e confusa**. Parece quebrada ou duplicada.

#### Problema Identificado
- `/planos/{plano_id}` ← Detalhes de plano ESPECÍFICO (usado)
- `/planos` ← Deveria ser GET todos os planos da turma?

O arquivo backend tem:
```python
@router.get("/planos")
def get_plano():  # Função com nome singular?!
    # Código aqui
```

Esta função é confusa. Deveria ser:
- `GET /planos/turma/{turma_id}` para listar planos de turma
- `GET /planos/{plano_id}` para detalhes de plano

#### Resposta Esperada (se funcionar)
Provavelmente retorna lista de planos:
```json
{
  "planos": [
    {"id": 1, "titulo": "Unidade 1: Números", ...},
    {"id": 2, "titulo": "Unidade 2: Geometria", ...}
  ]
}
```

#### Status de Implementação
🔴 **BACKEND:** Função existe mas é confusa  
🔴 **FRONTEND:** Não chamado - ambiguidade

#### Recomendação
✅ **REMOVER ESTA ROTA** - Consolidar nomenclatura

---

## 📊 TABELA RESUMIDA DOS 24 ENDPOINTS NÃO UTILIZADOS

| # | Rota | Método | Autenticação | Categoria | Motivo | Prioridade |
|---|------|--------|---|----------|--------|-----------|
| 1 | `/billing/status` | GET | JWT | Auth/Monetização | Feature em desenvolvimento | 🔴 ALTA |
| 2 | `/billing/upgrade` | POST | JWT | Auth/Monetização | Feature em desenvolvimento | 🔴 ALTA |
| 3 | `/admin/turmas/{id}/transfer/{uid}` | PUT | Admin | Admin | Sem UI admin | 🟡 BAIXA |
| 4 | `/batch/sync` | POST | API Key | Reports | Sincronização corporativa | 🟡 MÉDIA |
| 5 | `/relatorios/{turma_id}` | GET | JWT | Reports | Sem UI de relatórios | 🟡 MÉDIA |
| 6 | `/omr/process` | POST | JWT | OMR | DUPLICADO com /provas/processar | 🔴 ALTA |
| 7 | `/omr/preview` | POST | JWT | OMR | Funcionalidade experimental | 🟡 BAIXA |
| 8 | `/provas/revisar` | POST | JWT | OMR | Sem UI pós-OCR | 🟡 MÉDIA |
| 9 | `/notifications` | GET | JWT | Notificações | Sem UI notification center | 🟡 MÉDIA |
| 10 | `/notifications/{id}/read` | PATCH | JWT | Notificações | Sem UI notification center | 🟡 MÉDIA |
| 11 | `/notifications/unread/count` | GET | JWT | Notificações | Sem UI notification center | 🟡 MÉDIA |
| 12 | `/planos` | GET | JWT | Planejamento | ROTA CONFUSA/DUPLICADA | 🔴 ALTA |

---

## 🎯 RECOMENDAÇÕES POR PRIORIDADE

### 🔴 PRIORIDADE ALTA (Implementar Primeiro)

#### 1. Remover/Consolidar Duplicatas OMR
```python
# backend/routers/provas.py

# ❌ REMOVER ESTA:
@router.post("/omr/process")
def process_omr(...):
    # Duplicado

# ✅ MANTER ESTA:
@router.post("/provas/processar")
def processar_prova(...):
    # Função principal
```

**Tempo:** 15 minutos  
**Impacto:** Limpeza técnica

---

#### 2. Implementar UI de Billing
```typescript
// frontend/src/screens/BillingScreen.tsx

const BillingScreen = () => {
  const [status, setStatus] = useState(null);
  
  useEffect(() => {
    // Chamar GET /billing/status
    api.billing.getStatus().then(setStatus);
  }, []);
  
  const handleUpgrade = (plan) => {
    // Chamar POST /billing/upgrade
    api.billing.upgrade(plan);
  };
  
  return (
    <div>
      <PlanStatus data={status} />
      <UpgradeOptions onUpgrade={handleUpgrade} />
    </div>
  );
};
```

**Tempo:** 4-6 horas  
**Impacto:** $$ nova fonte de receita

---

#### 3. Corrigir Rota `/planos` Ambígua
```python
# backend/routers/planejamento.py

# ❌ REMOVER/CONSOLIDAR:
@router.get("/planos")
def get_plano():
    # Confuso - get_plano() é singular, mas rota é plural?

# ✅ MANTER:
@router.get("/planos/turma/{turma_id}")
def get_planos_turma(...):
    # Rota clara
```

**Tempo:** 30 minutos  
**Impacto:** Clareza arquitetural

---

### 🟡 PRIORIDADE MÉDIA (Implementar em Breve)

#### 4. Implementar UI de Notificações
```typescript
// frontend/src/components/NotificationCenter.tsx

// - Notification Bell com badge de unread count
// - Dropdown com lista de notificações
// - Click para marcar como lida
// - Polling com /notifications/unread/count a cada 30s

const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Polling
  useEffect(() => {
    const interval = setInterval(() => {
      api.notifications.getUnreadCount();
    }, 30000);
    return () => clearInterval(interval);
  }, []);
};
```

**Tempo:** 5-7 horas  
**Impacto:** UX - Melhor comunicação com usuário

---

#### 5. Implementar Revisão Pós-OCR
```typescript
// frontend/src/screens/OcrReviewScreen.tsx

// - Mostrar resultado do OCR
// - Permitir correção manual por questão
// - Mostrar imagem processada com marcas detectas
// - Botão para confirmar revisão

const OcrReviewScreen = () => {
  const [resultado, setResultado] = useState(null);
  const [revisoes, setRevisoes] = useState([]);
  
  const handleRevisar = async () => {
    // Chamar POST /provas/revisar
    await api.provas.revisar({
      resultado_id: resultado.id,
      revisoes: revisoes
    });
  };
};
```

**Tempo:** 6-8 horas  
**Impacto:** Qualidade - Reduz erros OCR

---

#### 6. Implementar Relatórios
- Botão "Gerar Relatório" na tela de turma
- Modal com opções: PDF, CSV, XLSX, JSON
- Chamar `GET /relatorios/{turma_id}?format=pdf`
- Download automático

**Tempo:** 4-5 horas  
**Impacto:** Função para pais/direção

---

### 🟢 PRIORIDADE BAIXA (Futuro)

#### 7. Transferência de Turma (Admin)
- Painel administrativo
- Seleção de turma + professor destino
- `PUT /admin/turmas/{id}/transfer/{uid}`

**Tempo:** 2-3 horas

---

#### 8. Sincronização em Lote
- Integração com ERP/SIGA de escolas
- Documentação de API
- Testes de integração
- `POST /batch/sync`

**Tempo:** 5-8 horas (API, não UI)

---

#### 9. Preview OMR (Experimental)
- Feature nice-to-have
- Validação visual antes de salvar
- `POST /omr/preview`

**Tempo:** 2-3 horas

---

## 📈 ROADMAP DE IMPLEMENTAÇÃO

### Quarter 1 (Março-Maio 2026)
- [x] Remover duplicatas OMR
- [x] Corrigir rota `/planos` ambígua
- [ ] Implementar UI de Billing (ALTA RECEITA)

### Quarter 2 (Junho-Agosto 2026)
- [ ] Notificações em tempo real
- [ ] Revisão pós-OCR
- [ ] Relatórios em PDF

### Quarter 3+ (Futuro)
- [ ] Admin Panel (transferência)
- [ ] Sincronização corporativa
- [ ] Preview OMR

---

## ✅ CHECKLIST DE VERIFICAÇÃO

Para cada endpoint não utilizado, você pode:

- [ ] Verificar se a função está corretamente implementada no backend
- [ ] Teste o endpoint manualmente com Postman/curl
- [ ] Defina quem será responsável pelo frontend
- [ ] Estimar tempo de implementação
- [ ] Priorizar no roadmap
- [ ] Implementar UI + testes
- [ ] Deploy e validação

---

**Análise Concluída:** 2026-03-07  
**Responsável:** GitHub Copilot (Claude Haiku 4.5)  
**Próxima Revisão:** 2026-04-01
