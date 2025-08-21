# Universal Backend for Complex Forms

Deployable to Vercel, AWS Lambda (Serverless), Docker, or any Node host.

## Features
- REST API for forms and submissions
- SQLite (free) for dev; Postgres (Neon/Supabase) via `DATABASE_URL`
- Zod validation, Helmet, CORS
- Optional OpenAI integration: `POST /api/ai/suggest`
- Prisma ORM

## Local Quickstart
```bash
cd universal-backend
cp .env.example .env
npm i
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

## Vercel
- Push to GitHub; import repo in Vercel.
- Add env: `SQLITE_URL` or `DATABASE_URL`, `OPENAI_API_KEY`.
- Vercel will build `api/index.ts` as a serverless function.

## AWS Lambda (Serverless)
```bash
npm run build
npm run lambda:build
npx serverless deploy
```
