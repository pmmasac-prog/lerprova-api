# 📅 GUIA DE ACESSO - CALENDÁRIO E EVENTOS

## ✅ Status do Sistema

O banco de dados da Gestão Escolar 2026 foi **TOTALMENTE POPULADO** com:

- ✅ **1 Escola** - Centro de Ensino Alcides César Meneses
- ✅ **1 Ano Letivo** - 2026
- ✅ **4 Períodos Letivos** - Divididos ao longo do ano
- ✅ **65 Eventos** - Feriados, férias, planejamentos, reuniões, etc.
- ✅ **209 Habilidades BNCC** - Mapeadas por disciplina

---

## 🔌 ENDPOINTS DE CALENDÁRIO

Todos os endpoints requerem autenticação via Bearer Token.

### 1. Listar Todos os Eventos
```http
GET /calendar/events
Authorization: Bearer {seu_token}
```

**Resposta de Exemplo:**
```json
{
  "success": true,
  "count": 65,
  "data": [
    {
      "id": 1,
      "title": "Confraternização Universal",
      "type": "holiday",
      "start_date": "2026-01-01",
      "end_date": "2026-01-01",
      "is_school_day": false,
      "description": "",
      "academic_year_id": "school_centro_ensino_alcides_cesar_meneses_2026"
    },
    ...
  ]
}
```

### 2. Filtrar Eventos por Tipo
```http
GET /calendar/events/{event_type}
Authorization: Bearer {seu_token}
```

**Tipos disponíveis:**
- `holiday` - Feriados
- `vacation` - Férias/Pausa Docente
- `planning` - Planejamento Pedagógico
- `meeting` - Reuniões com Pais/Colegiado
- `administrative` - Eventos Administrativos
- `assessment` - Avaliações (SEAMA)
- `term_milestone` - Marcos do Ano Letivo
- `commemorative` - Datas Comemorativas/Cívicas
- `make_up_class` - Reposição de Aulas
- `assessment_other` - Outros Processos Avaliativos

**Exemplo - Listar Feriados:**
```http
GET /calendar/events/holiday
Authorization: Bearer {seu_token}
```

### 3. Listar Períodos Letivos
```http
GET /calendar/periods
Authorization: Bearer {seu_token}
```

**Resposta:**
```json
{
  "success": true,
  "count": 4,
  "data": [
    {
      "id": "school_centro_ensino_alcides_cesar_meneses_2026_p1",
      "number": 1,
      "name": "1º período",
      "start_date": "2026-02-09",
      "end_date": "2026-04-24",
      "status": "active",
      "academic_year_id": "school_centro_ensino_alcides_cesar_meneses_2026"
    },
    ...
  ]
}
```

### 4. Listar Anos Letivos
```http
GET /calendar/academic-years
Authorization: Bearer {seu_token}
```

### 5. Listar Escolas
```http
GET /calendar/schools
Authorization: Bearer {seu_token}
```

### 6. Calendário Completo (Todas as Informações)
```http
GET /calendar/full-calendar
Authorization: Bearer {seu_token}
```

**Retorna em uma única chamada:**
- Escolas
- Anos Letivos
- Períodos
- Eventos
- Resumo com contagens totais

---

## 🔐 COMO OBTER TOKEN DE AUTENTICAÇÃO

### 1. Fazer Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "admin@lerprova.com",
  "password": "senha123"
}
```

**Resposta:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "nome": "Admin",
    "email": "admin@lerprova.com",
    "role": "admin"
  }
}
```

### 2. Usar o Token
Adicione o token no header de todas as requisições:
```http
Authorization: Bearer {access_token}
```

---

## 📊 ESTRUTURA DOS DADOS

### Evento (Event)
```
{
  "id": integer,
  "title": string,                    // Ex: "Confraternização Universal"
  "type": string,                     // calendar event_type_id
  "start_date": string (YYYY-MM-DD),  // Data de início
  "end_date": string (YYYY-MM-DD),    // Data de término
  "is_school_day": boolean,           // É dia letivo?
  "description": string,              // Observações/notas
  "academic_year_id": string          // ID do ano letivo
}
```

### Período (Period)
```
{
  "id": string,
  "number": integer (1-4),            // Número do período
  "name": string,                     // Ex: "1º período"
  "start_date": string (YYYY-MM-DD),
  "end_date": string (YYYY-MM-DD),
  "status": string,                   // "active", "completed"
  "academic_year_id": string
}
```

---

## 🚀 EXEMPLOS DE USO COM cURL

### Obter Token
```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@lerprova.com",
    "password": "senha123"
  }'
```

### Listar Todos os Eventos
```bash
TOKEN="seu_token_aqui"
curl -X GET http://localhost:8000/calendar/events \
  -H "Authorization: Bearer $TOKEN"
```

### Listar Apenas Feriados
```bash
TOKEN="seu_token_aqui"
curl -X GET http://localhost:8000/calendar/events/holiday \
  -H "Authorization: Bearer $TOKEN"
```

### Obter Calendário Completo
```bash
TOKEN="seu_token_aqui"
curl -X GET http://localhost:8000/calendar/full-calendar \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📝 EXEMPLOS DE EVENTOS POPULADOS

### Feriados
- 01/01/2026 - Confraternização Universal
- 13/02/2026 - Carnaval
- 29/03/2026 - Páscoa
- ... (e mais)

### Férias Docentes
- 07/01 a 21/01/2026 - Férias Docentes

### Planejamento Pedagógico
- 22/01 a 30/01/2026 - Jornada Pedagógica / Planejamento 2026
- 09/02/2026 - Planejamento Coletivo
- ... (e mais)

### Marcos do Ano Letivo
- 09/02/2026 - 1º período e início do ano letivo
- 24/04/2026 - Fim do 1º período
- 27/04/2026 - Início do 2º período
- ... (e mais)

---

## ⚠️ POSSÍVEIS PROBLEMAS E SOLUÇÕES

### Erro: "401 Unauthorized"
**Causa:** Token ausente ou inválido
**Solução:** Verifique se está enviando um token válido no header `Authorization`

### Erro: "0 eventos retornados"
**Causa:** Dados não foram populados
**Solução:** Execute o script de inicialização:
```bash
python backend/scripts/init_complete_system.py
```

### Erro ao conectar à API
**Causa:** Backend não está rodando
**Solução:** Inicie o backend:
```bash
cd backend
python main.py
```

---

## 🔄 ATUALIZAR DADOS

### Re-executar Seed (sem perder dados existentes)
```bash
python backend/scripts/seed_school_2026_real.py
```
O script só cria dados novos, não sobrescreve os existentes.

### Inicialização Completa
```bash
python backend/scripts/init_complete_system.py
```
Verifica tudo e garante que o sistema está pronto.

---

## 📞 SUPORTE

Para problemas ou dúvidas:
1. Verifique se o backend está rodando: `http://localhost:8000/health`
2. Verifique a conexão com banco de dados nos logs
3. Execute novamente o script de inicialização completa
4. Valide seu token JWT

---

**Última atualização:** 07/03/2026
**Versão da API:** 1.3.1
