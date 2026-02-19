@echo off
setlocal enabledelayedexpansion
title LERPROVA - Auto Git Push
color 0A

echo ===============================
echo  AUTO COMMIT E PUSH - LERPROVA
echo ===============================

cd /d C:\projetos\LERPROVA || (
  echo ERRO: Pasta do projeto nao encontrada.
  pause
  exit /b 1
)

echo.
echo Verificando repositorio...
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo ERRO: Esta pasta nao e um repositorio git.
  pause
  exit /b 1
)

echo.
echo Verificando se ha mudancas...
git diff --quiet
set has_worktree_changes=%errorlevel%
git diff --cached --quiet
set has_staged_changes=%errorlevel%

if %has_worktree_changes%==0 if %has_staged_changes%==0 (
  echo Nenhuma mudanca para commitar.
  echo Tentando apenas push (caso haja commits pendentes)...
  git push
  echo.
  echo ====== FINALIZADO ======
  pause
  exit /b 0
)

echo.
set /p msg=Digite a mensagem do commit: 
if "!msg!"=="" set msg=Atualizacao %date% %time%

echo.
echo Adicionando arquivos...
git add .

echo.
echo Criando commit...
git commit -m "!msg!"
if errorlevel 1 (
  echo.
  echo Commit nao realizado (provavelmente nada para commitar).
  echo Tentando push mesmo assim...
  git push
  echo.
  echo ====== FINALIZADO ======
  pause
  exit /b 0
)

echo.
echo Enviando para o GitHub...
git push

echo.
echo ====== FINALIZADO ======
pause
