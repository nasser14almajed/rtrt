## Backend Integration

A deploy-anywhere backend has been added at `backend/`.

### Local dev (backend)
```bash
cd backend
cp .env.example .env
npm i
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Your frontend can call the API at `http://localhost:8080/api` (or the deployed URL).

### Suggested frontend env (choose one)
- For Vite: add `.env` with `VITE_API_URL=http://localhost:8080`
- For Next.js: add `.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:8080`