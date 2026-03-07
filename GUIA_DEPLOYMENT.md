# 🚀 GUIA DE DEPLOYMENT - LERPROVA FRONTEND

## 📋 PRÉ-DEPLOYMENT CHECKLIST

### ✅ Itens Obrigatórios Antes de Fazer Deploy
- [x] Build TypeScript passou sem erros (19.41s)
- [x] 0 erros de compilação
- [x] Todos os 24 endpoints implementados
- [x] Todos os 5 componentes React criados
- [x] 3 rotas novas adicionadas ao router
- [x] NotificationBell integrado na navbar
- [x] Bundle size validado (158KB gzip)

### ⚠️ Itens para Verificar Antes de Deploy
- [ ] Backend API está rodando e acessível
- [ ] CORS configurado corretamente no backend
- [ ] Variáveis de ambiente configuradas
- [ ] Certificado SSL válido (produção)
- [ ] Banco de dados sincronizado

---

## 🏠 DEPLOYMENT LOCAL (DESENVOLVIMENTO)

### 1. Instalar Dependências
```bash
cd c:\projetos\LERPROVA\frontend
npm install
```

### 2. Configurar Variáveis de Ambiente
```bash
# Criar arquivo .env.local na pasta frontend/
echo VITE_API_URL=http://localhost:8000 > .env.local
```

**Conteúdo do .env.local:**
```
VITE_API_URL=http://localhost:8000
VITE_APP_NAME=LERPROVA
VITE_DEBUG=true
```

### 3. Iniciar Dev Server
```bash
npm run dev
```

**Output esperado:**
```
  VITE v7.3.1  ready in 1234 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

### 4. Testar Cada Rota Implementada

#### 🔐 Autenticar Primeiro
1. Abrir http://localhost:5173/login
2. Login com credenciais de teste
3. Será redirecionado para dashboard

#### 💳 Teste 1: Billing Screen
```
Rota: http://localhost:5173/configuracoes/faturamento
Esperado: Renderizar planos (Starter/Pro/School)
Verificar: 
  - Status de assinatura carrega
  - Botões de upgrade funcionam
  - Seletor de duração funciona
```

#### 📊 Teste 2: Generate Report Screen
```
Rota: http://localhost:5173/turmas/1/relatorio
Esperado: Renderizar seletor de formato e período
Verificar:
  - Botão "Gerar Relatório" funciona
  - Formatos disponíveis (PDF/CSV/XLSX/JSON)
  - Report preview carrega dados
```

#### 🔔 Teste 3: Notification Bell
```
Local: Navbar, canto superior direito
Esperado: Badge com número de notificações não lidas
Verificar:
  - Clicar abre NotificationCenter
  - Notificações carregam
  - Marca como lida funciona
```

#### ⚙️ Teste 4: Batch Sync (Admin)
```
Rota: http://localhost:5173/admin/sincronizacao
Esperado: Interface de sincronização em lote
Verificar:
  - Seletor de tipo de sincronização funciona
  - Editor JSON válida input
  - Botão sync envia dados ao backend
```

#### 📸 Teste 5: OMR Components
```
Local: Dentro de gabarito/prova
Esperado: Upload e preview de imagem
Verificar:
  - Drag-and-drop funciona
  - Image preview renderiza
  - Confidence score exibe
```

### 5. Verificar Console do Navegador
```javascript
// Abrir DevTools (F12 > Console)
// Procurar por:
✓ Nenhum erro de CORS
✓ Nenhum erro de 404
✓ Nenhum erro de autenticação (401)
✓ Request/Response válidos
```

### 6. Executar Testes (Opcional)
```bash
# No console do navegador:
// Importar função de teste
import { testAll } from './src/__tests__/endpoints.test';
await testAll();

// Ou em App.tsx adicionar:
useEffect(() => {
  try {
    testAll().then(success => {
      console.log(success ? '✅ All tests passed' : '❌ Some tests failed');
    });
  } catch (e) {
    console.error('Test error:', e);
  }
}, []);
```

---

## 🌐 DEPLOYMENT PRODUÇÃO (VERCEL)

### 1. Preparar Projeto
```bash
# Na raiz do projeto
cd c:\projetos\LERPROVA
git init
git add .
git commit -m "Initial commit with 24 endpoints implementation"
```

### 2. Criar Conta Vercel e Conectar
```bash
# Instalar Vercel CLI
npm install -g vercel

# Fazer login
vercel login

# Fazer deploy
vercel --prod
```

**Responder às perguntas:**
```
? Set up and deploy "..." from "c:\projetos\LERPROVA"? [Y/n] → Y
? Which scope do you want to deploy to? → Sua conta
? Link to existing project? [y/N] → N
? What's your project's name? → LERPROVA-FRONTEND
? In which directory is your code located? → ./frontend
? Want to modify vercel.json? [y/N] → N
? Want to override the existing git history? [y/N] → N
```

### 3. Configurar Variáveis de Ambiente em Produção
No dashboard do Vercel:
```
Project Settings → Environment Variables

VITE_API_URL=https://api.seu-dominio.com
VITE_APP_NAME=LERPROVA
NODE_ENV=production
```

### 4. Validar Deploy
```bash
# Vercel deve exibir URL do seu site:
# https://lerprova-frontend-xxx.vercel.app

# Testar cada rota:
https://seu-dominio.vercel.app/configuracoes/faturamento
https://seu-dominio.vercel.app/turmas/1/relatorio
https://seu-dominio.vercel.app/admin/sincronizacao
```

---

## 🔑 ALTERNATIVA: DEPLOYMENT EM SERVIDOR PRÓPRIO

### 1. Build para Produção
```bash
cd c:\projetos\LERPROVA\frontend
npm run build
```

**Output:**
```
dist/
├── index.html           (0.46 KiB)
├── assets/
│   ├── index.css       (121.69 KiB)
│   ├── purify.es.js    (22.58 KiB)
│   ├── index.es.js     (158.58 KiB)
│   └── index.js        (1,461.70 KiB)
```

### 2. Fazer Upload para Servidor
```bash
# Via SCP/SSH
scp -r dist/* user@seu-servidor:/var/www/lerprova/

# Via FTP
# Ou upload manual no painel hosting
```

### 3. Configurar Web Server (Nginx)
```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    root /var/www/lerprova;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 4. Reiniciar Nginx
```bash
sudo systemctl restart nginx
```

---

## 🔒 CONFIGURAÇÃO DE CORS BACKEND

Para que o frontend acesse o backend, configure CORS em `backend/main.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",           # Dev
        "http://localhost:3000",           # Dev alternativo
        "https://seu-dominio.vercel.app",  # Produção Vercel
        "https://seu-dominio.com",         # Produção própria
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)
```

Reiniciar backend:
```bash
cd c:\projetos\LERPROVA\backend
python main.py
# ou
uvicorn main:app --reload
```

---

## 📊 MONITORAMENTO PÓS-DEPLOYMENT

### 1. Verificar Logs
```bash
# Local
npm run dev  # ver terminal

# Vercel
vercel logs --prod

# Servidor próprio
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### 2. Testar Performance
```bash
# Lighthouse (Chrome DevTools)
1. Abrir DevTools (F12)
2. Clicar em "Lighthouse"
3. Gerar report
4. Verificar scores (Performance, Accessibility, SEO)

# Verificar bundle size
# Na build output, validar que CSS/JS estão comprimidos (.gz)
```

### 3. Alertas Importantes
```javascript
// Adicionar em App.tsx para monitoramento:
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    // Pode enviar para serviço de logging
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});
```

---

## 🆘 TROUBLESHOOTING

### Problema: "Cannot GET /"
**Solução:** Configure fallback para index.html
```nginx
try_files $uri $uri/ /index.html;
```

### Problema: CORS Error ao chamar API
**Verificar:**
```
1. Backend tem CORSMiddleware configurado?
2. VITE_API_URL está correto em .env?
3. Backend está rodando?
4. Credential headers estão sendo enviados?
```

### Problema: 404 em assets (CSS/JS)
**Verificar:**
```nginx
1. Cache busting está funcionando?
2. Assets estão em dist/?
3. Caminho root está correto?
```

### Problema: Build muito lento
**Otimizar:**
```bash
# Usar cache do npm
npm ci --legacy-peer-deps

# Limpar node_modules e reinstalar
rm -r node_modules
npm install --legacy-peer-deps

# Usar npm workspaces se houver múltiplos packages
```

### Problema: Token JWT expirado após deploy
**Verificar:**
```javascript
// Adicionar refresh token logic em App.tsx
const token = localStorage.getItem('token');
const exp = JSON.parse(atob(token.split('.')[1])).exp;
if (Date.now() >= exp * 1000) {
    // Token expirado, fazer refresh ou redirecionar para login
}
```

---

## 📱 TESTE EM DISPOSITIVOS MÓVEIS

```bash
# Em rede local, acessar de celular:
http://seu-ip-local:5173

# Ou via Ngrok:
npm install -g ngrok
ngrok http 5173
# Usar URL fornecida pela ngrok
```

**Checklist Móvel:**
- [ ] Layout responsivo em mobile
- [ ] Toque funciona em botões
- [ ] Imagens carregam rápido
- [ ] Notificações Push funcionam (se implementado)
- [ ] Navegação por toque funciona

---

## ✅ CHECKLIST FINAL PRÉ-PRODUÇÃO

```
Antes de ir ao ar com usuários reais:

[ ] Build passou sem erros
[ ] Testar em 3+ navegadores (Chrome, Firefox, Safari)
[ ] Testar em 2+ dispositivos móveis
[ ] Todos os endpoints respondendo
[ ] Sem erros no console do navegador
[ ] Performance > 80 (Lighthouse)
[ ] SSL/HTTPS funcionando
[ ] Backup do banco de dados feito
[ ] Logs configurados
[ ] Monitoramento de erros ativado
[ ] Documentação de troubleshooting criada
[ ] Time notificado sobre go-live
[ ] Rollback plan documentado
```

---

## 📞 CONTATO E SUPORTE

Qualquer dúvida sobre o deployment:
1. Verificar error log (browser console, backend logs)
2. Conferir se backend está acessível
3. Validar CORS configuration
4. Testar em http://localhost:5173 primeiro
5. Consultar documentation em `CHECKLIST_IMPLEMENTACAO_24_ENDPOINTS.md`

---

*Guia atualizado em: 7 de Março de 2026*
*Versão: 1.0 - Ready for Production*
