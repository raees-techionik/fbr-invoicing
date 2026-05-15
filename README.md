# FBR Z E-Invoicing Portal

Monorepo-style project layout for the FBR digital invoicing portal.

## Structure

```text
fbr-z-einvoicing/
  apps/
    frontend/          React frontend
    backend/           Express/TypeScript API with Prisma/PostgreSQL
  packages/
    reference-api/     Portable FBR reference API client
  docs/
    fbr/               Official FBR/PRAL documents and templates
    reports/           Daily reports, EOD reports, and rendered report artifacts
    project/           Project design, development, and implementation notes
  README.md
  .gitignore
```

## Frontend

Path:

```text
apps/frontend
```

Local setup:

```bash
cd apps/frontend
npm install
npm start
```

Build:

```bash
npm run build
```

Required environment variable for deployed builds:

```text
REACT_APP_API_BASE_URL=https://your-backend-url
```

Local/deployment env example:

```text
apps/frontend/.env.example
```

Vercel deployment root:

```text
apps/frontend
```

## Backend

Path:

```text
apps/backend
```

Local setup:

```bash
cd apps/backend
npm install
npx prisma generate
npm run dev
```

Build and start:

```bash
npm run build
npm run start
```

Important environment variables are documented in:

```text
apps/backend/.env.example
```

Recommended backend deployment root:

```text
apps/backend
```

The backend is an Express server and is ready for Render. A Render Blueprint is included at:

```text
render.yaml
```

The frontend can be deployed to Vercel after the backend URL is available.

## Demo Login

For demo environments where development admin login is enabled:

```text
Email: admin@fbr.com
Password: admin123
```

Use real database-backed credentials before production handover.

## Deployment Notes

1. Push this repository to GitHub.
2. In Render, create a Blueprint from the GitHub repository using `render.yaml`, or create a Web Service manually with root directory `apps/backend`.
3. Add the required Render environment variables: `DATABASE_URL`, `JWT_SECRET`, `FBR_SETTINGS_ENCRYPTION_KEY`, and `ADMIN_PASSWORD`.
4. Confirm the deployed backend returns OK at `/health`.
5. Set `REACT_APP_API_BASE_URL` in Vercel to the deployed Render backend URL.
6. Deploy the frontend from `apps/frontend`.
7. Run a browser smoke test for login, dashboard, invoice creation, PDF download, settings, sandbox, and offline queue.

## Current Deployment Roots

Use these root directories when configuring hosts:

```text
Frontend/Vercel: apps/frontend
Backend/Render: apps/backend
```
