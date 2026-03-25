# Running the Project

## Prerequisites
- Docker Desktop installed and running (check the bottom bar shows "Engine running")

---

## Step 1 — Open Terminal in the project folder
```bash
cd "C:\Users\JYIF2\OneDrive\Desktop\freelancer\freelance"
```

## Step 2 — Make sure .env file exists
```bash
ls .env
```
If not found, copy from the example:
```bash
cp .env.example .env
```

## Step 3 — Build the containers (first time only)
```bash
docker compose build
```
This takes 5–15 minutes on first run.

## Step 4 — Start the project
```bash
docker compose up
```
Or run in the background:
```bash
docker compose up -d
```

## Step 5 — Run database migrations (first time only)
```bash
docker compose exec backend npm run migrate
```

## Step 6 — Open in browser
| Service  | URL                          |
|----------|------------------------------|
| Frontend | http://localhost:3000        |
| Backend  | http://localhost:4000/api/v1 |

---

## Useful Commands

| Command                              | Description                  |
|--------------------------------------|------------------------------|
| `docker compose up -d`               | Start in background          |
| `docker compose down`                | Stop everything              |
| `docker compose logs -f backend`     | Watch backend logs           |
| `docker compose logs -f frontend`    | Watch frontend logs          |
| `docker compose restart backend`     | Restart a specific service   |
| `docker compose exec backend npm run migrate` | Run migrations      |
docker compose ps