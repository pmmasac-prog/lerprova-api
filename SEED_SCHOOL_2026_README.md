# 🌱 SEMEADURA DE DADOS - GESTÃO ESCOLAR 2026

## 📋 O que será populado

O script `seed_school_2026.py` irá popular automaticamente com dados REAIS de:

### 1. **Escolas**
- ✅ C.E. ALCIDES CÉSAR MENESES
- ✅ E.M. JOSÉ PAULO

### 2. **Calendário 2026**
- ✅ Ano Letivo 2026 (01/01 até 31/12)
- ✅ 4 Bimestres (1º, 2º, 3º, 4º)
- ✅ 20 Eventos:
  - Feriados nacionais (Carnaval, Tiradentes, Dia do Trabalho, etc.)
  - Datas de Avaliações (diagnóstica, bimestral, final)
  - Reuniões de Pais
  - Planejamento Pedagógico

### 3. **Alunos Testáveis** (20 alunos)
```
2026001 - João Silva Santos
2026002 - Maria Clara Oliveira
2026003 - Pedro Martins Costa
... (17 mais)
```

### 4. **Turmas (Salas)** com Alunos Vinculados
- 1EM-A - Português (5 alunos)
- 1EM-B - Matemática (5 alunos)
- 2EM-A - Ciências (5 alunos)
- 2EM-B - História (5 alunos)

---

## 🚀 Como Executar

### Opção 1: Pelo Terminal PowerShell (RECOMENDADO)

```powershell
# 1. Ativar virtualenv (se não estiver ativado)
& c:\projetos\LERPROVA\.venv\Scripts\Activate.ps1

# 2. Navegar para o backend
cd c:\projetos\LERPROVA\backend

# 3. Executar script de semeadura
python scripts/seed_school_2026.py
```

### Opção 2: Executar via Python direto

```bash
cd c:\projetos\LERPROVA\backend
python -m scripts.seed_school_2026
```

---

## ✅ Resultado Esperado

Ao executar com sucesso, você verá:

```
============================================================
🌱 INICIANDO SEMEADURA - GESTÃO ESCOLAR 2026
============================================================

📋 Criando tabelas (se não existirem)...
  ✅ Tabelas verificadas

🏫 Populando ESCOLAS...
  ✅ Escola criada: C.E. ALCIDES CÉSAR MENESES
  ✅ Escola criada: E.M. JOSÉ PAULO

📚 Populando ANOS LETIVOS...
  ✅ Ano letivo criado: 2026 - CEACM2026

... (mais linhas)

============================================================
✅ SEMEADURA CONCLUÍDA COM SUCESSO!
============================================================
```

---

## 🔗 Como Testar os Dados Populados

### 1. **Listar Escolas**
```bash
curl -X GET "http://localhost:8000/admin/schools" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### 2. **Obter Calendário 2026**
```bash
curl -X GET "http://localhost:8000/admin/calendar" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### 3. **Listar Todos os Alunos**
```bash
curl -X GET "http://localhost:8000/admin/students" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### 4. **Gerar Carteirinha de Aluno**
```bash
curl -X POST "http://localhost:8000/admin/generate-carteirinha?aluno_id=1" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

---

## 🛠️ Solução de Problemas

### Problema: "ModuleNotFoundError: No module named 'database'"

**Solução:** Certifique-se de estar na pasta `backend/` ao executar:
```powershell
cd c:\projetos\LERPROVA\backend
python scripts/seed_school_2026.py
```

### Problema: Dados já existem (mensagens "⏭️ Já existe")

**Solução:** Isso é NORMAL! O script verifica duplicatas. Se quiser limpar e recriar:
```powershell
# Reset COMPLETO do banco
python reset_db.py

# Depois execute novamente a semeadura
python scripts/seed_school_2026.py
```

### Problema: "Nenhum usuário admin encontrado"

**Solução:** Crie um usuário admin primeiro:
```powershell
# Ver users_db.py para instruções ou use:
python -c "from users_db import init_default_users; from database import SessionLocal; db = SessionLocal(); init_default_users(db)"
```

---

## 📊 Verificar Dados no Banco

### Via SQLite Browser:
```bash
# Abrir banco SQLite
sqlite3 lerprova.db

# Listar escolas
SELECT * FROM schools;

# Listar períodos
SELECT * FROM periods;

# Listar alunos
SELECT * FROM alunos;

# Listar turmas
SELECT * FROM turmas;

# Listar eventos
SELECT title, start_date, end_date, is_school_day FROM events LIMIT 5;
```

---

## 🔍 Para Que Foi Criado

Este seed popula as tabelas necessárias para que os endpoints de **Gestão Escolar** funcionem:

| Endpoint | Descrição |
|----------|-----------|
| `GET /admin/schools` | ✅ Retorna escolas populadas |
| `GET /admin/calendar` | ✅ Retorna calendário 2026 com eventos |
| `GET /admin/students` | ✅ Retorna 20 alunos com dados reais |
| `POST /admin/generate-carteirinha` | ✅ Gera carteirinha de aluno |
| `GET /turmas` | ✅ Retorna turmas criadas |
| `GET /alunos` | ✅ Retorna alunos cadastrados |

---

## 📝 Se Quiser Adicionar Mais Dados

Edite o arquivo `backend/scripts/seed_school_2026.py` e:

1. Adicione mais **escolas** na função `seed_schools()`
2. Adicione mais **períodos** na função `seed_periods()`
3. Adicione mais **eventos** na função `seed_events()`
4. Adicione mais **alunos** na função `seed_alunos()`
5. Adicione mais **turmas** na função `seed_turmas()`

Depois execute novamente: `python scripts/seed_school_2026.py`

---

**Última atualização:** 7 de Março de 2026
