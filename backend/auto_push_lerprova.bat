@echo off
setlocal
title LERPROVA - Auto Git Push
color 0A

echo ===============================
echo  AUTO COMMIT E PUSH - LERPROVA
echo ===============================

cd /d "C:\projetos\LERPROVA" || (
  echo ERRO: Pasta do projeto nao encontrada.
  pause
  exit /b 1
)

echo.
echo Verificando repositorio...
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo ERRO: Esta pasta nao e um repositorio git.
  echo DICA: execute "git status" aqui para ver detalhes.
  pause
  exit /b 1
)

echo.
echo Verificando branch atual...
for /f "delims=" %%B in ('git symbolic-ref -q --short HEAD 2^>nul') do set "BRANCH=%%B"
if not defined BRANCH (
  echo ERRO: HEAD destacada (detached HEAD). Voce nao esta em uma branch.
  echo DICA: rode "git checkout -b minha-branch" ou volte para main/master.
  pause
  exit /b 1
)
echo Branch: %BRANCH%

echo.
echo Verificando se ha mudancas (inclui arquivos novos)...
for /f "delims=" %%S in ('git status --porcelain') do set "HASCHANGES=1"

if not defined HASCHANGES (
  echo Nenhuma mudanca para commitar.
  echo Tentando apenas push (caso haja commits pendentes)...
  call :ensure_upstream "%BRANCH%"
  if errorlevel 1 (
    pause
    exit /b 1
  )
  git push
  if errorlevel 1 (
    echo ERRO: Falha no push. Veja a mensagem acima.
    pause
    exit /b 1
  )
  echo.
  echo ====== FINALIZADO ======
  pause
  exit /b 0
)

echo.
set "msg="
set /p msg=Digite a mensagem do commit: 
if "%msg%"=="" set "msg=Atualizacao %date% %time%"

echo.
echo Adicionando arquivos...
git add -A
if errorlevel 1 (
  echo ERRO: Falha no git add.
  pause
  exit /b 1
)

echo.
echo Criando commit...
git commit -m "%msg%"
if errorlevel 1 (
  echo.
  echo Commit nao realizado (pode ser nada para commitar ou erro de configuracao).
  echo Tentando push mesmo assim...
)

echo.
echo Enviando para o GitHub...
call :ensure_upstream "%BRANCH%"
if errorlevel 1 (
  pause
  exit /b 1
)

git push
if errorlevel 1 (
  echo ERRO: Falha no push. Veja a mensagem acima.
  pause
  exit /b 1
)

echo.
echo ====== FINALIZADO ======
pause
exit /b 0

:ensure_upstream
set "B=%~1"
git rev-parse --abbrev-ref --symbolic-full-name "@{u}" >nul 2>&1
if errorlevel 1 (
  echo Upstream nao configurado. Configurando origin %B%...
  git push -u origin "%B%"
  if errorlevel 1 (
    echo ERRO: Nao foi possivel configurar upstream.
    echo Causas comuns: remote "origin" inexistente, sem permissao, ou branch remota diferente.
    echo DICA: rode "git remote -v" e "git branch -vv".
    exit /b 1
  )
) else (
  rem upstream ok
)
exit /b 0