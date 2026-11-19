import { z } from 'zod';
export const keywordSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(48)
  .regex(/^[a-z][a-z0-9]*(?:[ -][a-z0-9]+){0,3}$/, 'Kısa bir İngilizce kavram gir.');
export const artworkPolicy = z.enum(['hybrid', 'iconify', 'offline']);
export const artRefSchema = z.strictObject({
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  source: z.enum(['iconify', 'llm']),
  name: z
    .string()
    .max(120)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9:._/-]*$/),
});
export type ArtRef = z.infer<typeof artRefSchema>;
export type ArtPolicy = z.infer<typeof artworkPolicy>;
export const artMode = z.enum(['auto', 'custom', 'local']);
export const artUrl = (project: string, ref?: ArtRef) =>
  ref ? `/api/projects/${project}/atlas/${ref.digest}.svg` : undefined;
