@echo off
cd /d "%~dp0"
if not exist .env (
  copy .env.example .env
  echo Created .env. Please edit .env and set JWT_SECRET and JWT_REFRESH_SECRET.
) else (
  echo .env already exists.
)
