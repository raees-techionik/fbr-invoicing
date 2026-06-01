# Temporary Server Deployment Handoff

This file is temporary. Delete it after the Ubuntu server backend is deployed and Vercel is updated.

Do not commit real passwords, database passwords, JWT secrets, FBR tokens, or Cloudflare credentials into Git.

## Current Goal

Deploy the backend and PostgreSQL database on the Ubuntu local server.

Keep the frontend on Vercel.

```text
Frontend: https://fbr-einvoicing.vercel.app
Backend: Ubuntu server via Cloudflare Tunnel
Database: PostgreSQL running on the Ubuntu server, currently in Docker
FBR mode: Mock mode ON for now
```

## Answers To Current Questions

### 1. Frontend deployed URL

```text
https://fbr-einvoicing.vercel.app
```

### 2. Frontend backend URL environment variable

This frontend is Create React App, so the variable name is:

```text
REACT_APP_API_BASE_URL
```

Current temporary Cloudflare Tunnel URL shown on the server:

```text
https://director-disabilities-worlds-sunglasses.trycloudflare.com
```

First test which health URL works:

```bash
curl -i https://director-disabilities-worlds-sunglasses.trycloudflare.com/api/fbr-einvoicing-backend/health
curl -i https://director-disabilities-worlds-sunglasses.trycloudflare.com/health
```

If this works:

```text
https://director-disabilities-worlds-sunglasses.trycloudflare.com/api/fbr-einvoicing-backend/health
```

then set Vercel to:

```text
REACT_APP_API_BASE_URL=https://director-disabilities-worlds-sunglasses.trycloudflare.com/api/fbr-einvoicing-backend
```

If this works instead:

```text
https://director-disabilities-worlds-sunglasses.trycloudflare.com/health
```

then set Vercel to:

```text
REACT_APP_API_BASE_URL=https://director-disabilities-worlds-sunglasses.trycloudflare.com
```

Important: `trycloudflare.com` URLs are temporary. If the tunnel restarts, the URL may change and Vercel must be updated/redeployed again.

### 3. Live FBR or mock mode

Keep mock mode ON for now:

```text
FBR_INVOICE_USE_MOCKS=true
FBR_REFERENCE_USE_MOCKS=true
```

### 4. FBR tokens

No live PRAL/FBR tokens yet. Leave these empty for now:

```text
FBR_SANDBOX_TOKEN=
FBR_PRODUCTION_TOKEN=
FBR_REFERENCE_API_TOKEN=
```

### 5. Pull latest GitHub main

Yes, pull latest GitHub `main` and redeploy, but back up `.env` first.

Suggested command:

```bash
cd ~/fbr-einvoicing/apps/backend 2>/dev/null || cd /var/www/fbr-einvoicing/apps/backend
cp .env ".env.backup.$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
git -C ../.. fetch origin main
git -C ../.. status --short
```

If there are no local code changes that need to be preserved:

```bash
git -C ../.. pull --ff-only origin main
```

## Server Facts Already Known

```text
Ubuntu: 24.04.3 LTS
Local LAN IP: 192.168.18.25
Public IP: 72.255.7.34
Router/Gateway: 192.168.18.1
User: ubuntu-pc
Node: v22.22.2
npm: 10.9.7
Nginx: 1.24.0 running
Git: 2.43.0
Docker: 29.1.3
Docker Compose: 2.40.3
PostgreSQL: running in Docker as server-db-1
Host psql client: missing
PM2: missing
Direct public access: not reachable yet
Cloudflare tunnel: working
```

## What To Check On Server

Run:

```bash
docker ps
docker inspect server-db-1 --format '{{json .Config.Env}}'
docker port server-db-1
```

Use that output to find:

```text
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_DB
host port mapped to container 5432
```

If Docker maps PostgreSQL like `0.0.0.0:5432->5432/tcp`, the backend DB URL will be:

```text
DATABASE_URL=postgresql://POSTGRES_USER:POSTGRES_PASSWORD@localhost:5432/POSTGRES_DB
DIRECT_URL=postgresql://POSTGRES_USER:POSTGRES_PASSWORD@localhost:5432/POSTGRES_DB
```

If Docker maps a different host port, replace `5432` with the mapped host port.

## Backend Environment Template

Create or update:

```bash
nano apps/backend/.env
```

Use this template. Fill database values from Docker. Generate secrets locally on server.

Generate JWT secret:

```bash
openssl rand -base64 48
```

Generate FBR settings encryption key:

```bash
openssl rand -base64 32
```

`.env` template:

```text
DATABASE_URL=postgresql://POSTGRES_USER:POSTGRES_PASSWORD@localhost:5432/POSTGRES_DB
DIRECT_URL=postgresql://POSTGRES_USER:POSTGRES_PASSWORD@localhost:5432/POSTGRES_DB

JWT_SECRET=GENERATE_WITH_OPENSSL_RAND_BASE64_48
JWT_EXPIRES_IN=7d

PORT=3000

ADMIN_EMAIL=admin@fbr.com
ADMIN_PASSWORD=admin123
ADMIN_FULL_NAME=Admin
ADMIN_WORKSPACE_NAME=Admin Workspace
ALLOW_DEV_ADMIN_LOGIN=false

FBR_BASE_URL=https://gw.fbr.gov.pk
FBR_REFERENCE_API_TOKEN=
FBR_REFERENCE_CACHE_TTL_SECONDS=86400
FBR_REFERENCE_USE_MOCKS=true

FBR_ENVIRONMENT=sandbox
FBR_SANDBOX_TOKEN=
FBR_PRODUCTION_TOKEN=
FBR_REFERENCE_INVOICE_LOOKUP_URL=
FBR_SETTINGS_ENCRYPTION_KEY=GENERATE_WITH_OPENSSL_RAND_BASE64_32
FBR_OUTBOUND_IP=72.255.7.34

FBR_INVOICE_USE_MOCKS=true
OFFLINE_QUEUE_AUTO_PROCESS_DISABLED=false
```

Note: `ALLOW_DEV_ADMIN_LOGIN=false` is safer, but it means `admin@fbr.com / admin123` will only work if that user exists in the database. If login is needed immediately and no DB user exists yet, either seed/create the admin user or temporarily use `ALLOW_DEV_ADMIN_LOGIN=true` for demo only.

## Install PM2 If Missing

```bash
sudo npm install -g pm2
pm2 -v
```

## Build And Deploy Backend

From repo root or backend folder:

```bash
cd ~/fbr-einvoicing/apps/backend 2>/dev/null || cd /var/www/fbr-einvoicing/apps/backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 start dist/src/index.js --name fbr-backend
pm2 save
pm2 status
```

If an old PM2 process already exists:

```bash
pm2 restart fbr-backend --update-env
```

Test locally:

```bash
curl -i http://localhost:3000/health
```

Expected:

```json
{"ok":true,"service":"fbr-einvoicing-api"}
```

## Nginx Local Proxy

Only expose Nginx/Cloudflare-facing ports. Do not expose PostgreSQL or direct backend port publicly.

Create config:

```bash
sudo nano /etc/nginx/sites-available/fbr-backend
```

Use:

```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable:

```bash
sudo ln -sf /etc/nginx/sites-available/fbr-backend /etc/nginx/sites-enabled/fbr-backend
sudo nginx -t
sudo systemctl reload nginx
```

Test:

```bash
curl -i http://localhost/health
curl -i http://192.168.18.25/health
```

## Cloudflare Tunnel

If the tunnel is already running, point it to local Nginx or backend.

Preferred:

```text
Cloudflare Tunnel -> http://localhost
```

or directly:

```text
Cloudflare Tunnel -> http://localhost:3000
```

Then test:

```bash
curl -i https://director-disabilities-worlds-sunglasses.trycloudflare.com/health
```

## Vercel Update

After the backend URL is confirmed, update Vercel:

```text
Project: fbr-einvoicing
Environment Variable: REACT_APP_API_BASE_URL
Value: confirmed Cloudflare backend base URL
```

Redeploy Vercel without build cache.

## Cleanup After Deployment

After deployment succeeds, delete this temporary file from the repository:

```bash
git rm TEMP_SERVER_DEPLOYMENT_HANDOFF.md
git commit -m "Remove temporary server deployment handoff"
git push
```

