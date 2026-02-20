@echo off
setlocal EnableExtensions
title LERPROVA - Auto Git Push
color 0A

echo ===============================
echo  AUTO COMMIT E PUSH - LERPROVA
echo ===============================

REM ===== IR PARA O PROJETO =====
cd /d "C:\projetos\LERPROVA" || (
  echo ERRO: Pasta do projeto nao encontrada.
  pause
  exit /b 1
)

REM ===== VERIFICAR SE GIT EXISTE =====
where git >nul 2>&1
if errorlevel 1 (
  echo ERRO: Git nao esta instalado ou nao esta no PATH.
  pause
  exit /b 1
)

echo.
echo Verificando repositorio...
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo ERRO: Esta pasta nao e um repositorio git.
  echo Execute: git init
  pause
  exit /b 1
)

REM ===== DESCOBRIR BRANCH (CORRIGIDO - SEM ERRO DO PONTO) =====
echo.
echo Verificando branch atual...

set "BRANCH="
for /f "usebackq delims=" %%B in (`git symbolic-ref -q --short HEAD 2^>nul`) do set "BRANCH=%%B"

if "%BRANCH%"=="" (
  echo ERRO: Voce nao esta em uma branch (detached HEAD).
  echo Rode: git checkout -b main
  pause
  exit /b 1
)

echo Branch atual: %BRANCH%

REM ===== VERIFICAR MUDANCAS (INCLUI ARQUIVOS NOVOS) =====
echo.
echo Verificando alteracoes...

set "HASCHANGES="
for /f "delims=" %%S in ('git status --porcelain') do set "HASCHANGES=1"

if not defined HASCHANGES (
  echo Nenhuma mudanca detectada.
  echo Tentando apenas push...

  call :ensure_upstream "%BRANCH%"
  if errorlevel 1 goto :erro

  git push
  goto :fim
)

REM ===== PEGAR MENSAGEM =====
echo.
set /p msg=Digite a mensagem do commit:
if "%msg%"=="" set "msg=Atualizacao %date% %time%"

REM ===== ADD =====
echo.
echo Adicionando arquivos...
git add -A
if errorlevel 1 goto :erro

REM ===== COMMIT =====
echo.
echo Criando commit...
git commit -m "%msg%"

REM ===== PUSH =====
echo.
echo Enviando para GitHub...

call :ensure_upstream "%BRANCH%"
if errorlevel 1 goto :erro

git push
if errorlevel 1 goto :erro

goto :fim


REM ======================================================
REM CONFIGURA UPSTREAM AUTOMATICAMENTE
REM ======================================================
:ensure_upstream
git rev-parse --abbrev-ref --symbolic-full-name "@{u}" >nul 2>&1
if errorlevel 1 (
  echo Configurando upstream origin/%~1 ...
  git push -u origin "%~1"
  if errorlevel 1 (
    echo ERRO: Falha ao configurar upstream.
    exit /b 1
  )
)
exit /b 0


:erro
echo.
echo ===== OCORREU UM ERRO =====
git status
pause
exit /b 1

:fim
echo.
echo ===== FINALIZADO COM SUCESSO =====
pause
exit /b 0