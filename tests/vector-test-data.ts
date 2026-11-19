// Fixed outputs authored for QA, NOT captured service traffic. Never imported by the app.
import fs from 'node:fs';
import scenes from './fixtures/vector-whale/scenes.json';
export const sample = (i = 0) => ({
  ...scenes[i],
  svg: fs.readFileSync(`tests/fixtures/vector-whale/${String(i + 1).padStart(2, '0')}.svg`, 'utf8'),
});
export const completion = (value: unknown) =>
  Response.json({
    model: 'qa-illustrator-replay',
    choices: [
      {
        finish_reason: 'stop',
        message: { content: typeof value === 'string' ? value : JSON.stringify(value) },
      },
    ],
  });
