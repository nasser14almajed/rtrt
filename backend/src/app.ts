import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { json, urlencoded } from 'express';
import { z } from 'zod';
import { prisma } from './lib/db.js';
import { aiRouter } from './routes/ai.js';

const app = express();

const origins = process.env.CORS_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean);
app.use(cors(origins && origins.length ? { origin: origins } : {}));
app.use(helmet());
app.use(morgan('dev'));
app.use(json({ limit: '1mb' }));
app.use(urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'development' });
});

app.post('/api/forms', async (req, res) => {
  const Body = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    fields: z.array(z.object({
      label: z.string(),
      type: z.string(),
      required: z.boolean().optional(),
      options: z.any().optional(),
      order: z.number().int(),
    })).default([])
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  const { name, description, fields } = parsed.data;
  const form = await prisma.form.create({
    data: {
      name, description,
      fields: {
        create: fields.map(f => ({
          label: f.label, type: f.type, required: !!f.required, options: f.options ?? null, order: f.order
        }))
      }
    },
    include: { fields: true }
  });
  res.status(201).json(form);
});

app.get('/api/forms', async (_req, res) => {
  const forms = await prisma.form.findMany({ include: { fields: true }, orderBy: { createdAt: 'desc' }});
  res.json(forms);
});

app.get('/api/forms/:id', async (req, res) => {
  const form = await prisma.form.findUnique({ where: { id: req.params.id }, include: { fields: true }});
  if (!form) return res.status(404).json({ error: 'Not found' });
  res.json(form);
});

app.post('/api/forms/:id/submit', async (req, res) => {
  const Body = z.object({
    values: z.array(z.object({ fieldId: z.string(), value: z.string() }))
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const form = await prisma.form.findUnique({ where: { id: req.params.id }, include: { fields: true }});
  if (!form) return res.status(404).json({ error: 'Form not found' });

  const validFieldIds = new Set(form.fields.map(f => f.id));
  for (const v of parsed.data.values) {
    if (!validFieldIds.has(v.fieldId)) {
      return res.status(400).json({ error: `Field ${v.fieldId} not in form` });
    }
  }

  const submission = await prisma.submission.create({
    data: {
      formId: form.id,
      values: { create: parsed.data.values.map(v => ({ fieldId: v.fieldId, value: v.value })) }
    },
    include: { values: true }
  });
  res.status(201).json(submission);
});

app.get('/api/forms/:id/submissions', async (req, res) => {
  const submissions = await prisma.submission.findMany({
    where: { formId: req.params.id },
    include: { values: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(submissions);
});

app.use('/api/ai', aiRouter);

export default app;