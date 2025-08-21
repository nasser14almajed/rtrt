import { Router } from 'express';
import OpenAI from 'openai';
import { z } from 'zod';

export const aiRouter = Router();

aiRouter.post('/suggest', async (req, res) => {
  const Body = z.object({
    prompt: z.string().min(1),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(400).json({ error: 'OPENAI_API_KEY not set' });

  const client = new OpenAI({ apiKey: key });

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful assistant that generates form field suggestions." },
        { role: "user", content: parsed.data.prompt }
      ],
      temperature: 0.2,
    });

    res.json({ result: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'OpenAI request failed' });
  }
});