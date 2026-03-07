# HISTÓRICO COMPLETO DE DESENVOLVIMENTO: PROJETO LERPROVA (JAN-MAR 2026)

Este documento registra a evolução cronológica de todas as funcionalidades solicitadas e implementadas no ecossistema LERPROVA desde o seu início.

## 1. INFRAESTRUTURA E CORE DO SISTEMA
*   **Arquitetura Monorepo (Fev 2026):** Configuração inicial unindo Frontend (React/Vite), Backend (FastAPI/Python) e Mobile (React Native).
*   **Migração de Dados:** Transição estratégica de SQLite para **PostgreSQL (Render.com)** para garantir persistência em produção.
*   **Segurança e Autenticação:** Implementação de JWT (JSON Web Tokens), `passlib` para senhas e sistema de Roles (Admin vs Professor).
*   **Resiliência de Banco:** Criação de scripts de migração automática (`migrations.py`) para evitar perda de dados durante atualizações de esquema.

## 2. MOTOR OMR (CORREÇÃO DE PROVAS)
*   **Evolução Tecnológica:** Saída do `pyzbar` para um motor próprio baseado em **OpenCV**, permitindo leitura de fotos de baixa qualidade.
*   **Layout Calibrado (Square Anchors):** Substituição de círculos por **Âncoras Quadradas (14mm)** e bolhas de 7mm para precisão milimétrica em papel A4.
*   **Correção de Perspectiva:** Implementação de algoritmos para tratar fotos inclinadas (iPhone 16 Pro Max), eliminando a distorção diagonal.
*   **Workflow de Revisão:** Sistema de "needs_review" para questões ambíguas ou marcas rasuradas, com interface de confirmação manual.

## 3. PLANEJAMENTO E GESTÃO PEDAGÓGICA (O DIFERENCIAL)
*   **Integração BNCC:** Importação completa da Base Nacional Comum Curricular (Habilidades, Competências, Áreas).
*   **Planejamento Studio (V1 a V2):**
    *   **V1:** Criação de sequências didáticas simples vinculadas a turmas.
    *   **V2 (Studio):** Interface avançada com 4 zonas de trabalho (Conteúdo, BNCC, Metodologia, Avaliação).
*   **Radar Pedagógico:** Visualização de cobertura de habilidades por bimestre, permitindo ao professor saber o que já foi ensinado e o que falta.
*   **Registro de Aula:** Sistema de "1-clique" para marcar aula dada, com campo para percepções e ajustes.

## 4. PORTAL DO ALUNO E INTERAÇÃO
*   **Ecossistema do Aluno:** Lançamento de interface específica para estudantes acompanharem notas e frequência.
*   **QR Code Dinâmico:** Geração de identificadores únicos por aluno para acesso sem senha tradicional.
*   **Chamada QR (Presença):** Funcionalidade de registro de presença em sala de aula via leitura de QR Code direto no celular do professor.

## 5. GESTÃO ESCOLAR (MODELO MASTER)
*   **Hierarquia Administrativa:** Implementação de Escolas, Anos Letivos e Períodos Acadêmicos (Bimestres).
*   **Importação 2026:** Suporte a arquivos JSON e CSV para importação massiva da base de dados de redes de ensino (Ex: **C.E. Alcides César Meneses**).
*   **Admin Cockpit:** Painel de controle para diretores/coordenadores monitorarem pendências de correção e engajamento dos professores.

## 6. REDESIGN E UX (DASHBOARD OPERACIONAL)
*   **Semáforo de Turmas:** Interface visual (Verde, Amarelo, Vermelho) para indicar o estado de cada turma (atrasos em provas ou registros).
*   **Ranking de Engajamento:** Estatísticas de acertos e desempenho médio por aluno e por turma em tempo real no Dashboard.
*   **Ação Primária Inteligente:** Botões dinâmicos que sugerem a tarefa mais urgente (ex: "Corrigir Provas pendentes" ou "Registrar Aula de hoje").

---
**Status Final (07/03/2026):** O sistema opera na Versão 1.3.1, estabilizado após a Grande Restauração de Março, com foco em Gestão de 2026 e Planejamento Integrado à BNCC.
