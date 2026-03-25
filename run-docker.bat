@echo off
cd /d "%~dp0"
if not exist .env (
  if exist .env.example (
    copy .env.example .env
    echo Created .env from .env.example. Edit .env and set JWT_SECRET and JWT_REFRESH_SECRET.
  ) else (
    echo .env.example not found.
    exit /b 1
  )
)
docker compose up -d --build
