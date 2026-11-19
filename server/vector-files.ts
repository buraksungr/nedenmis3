import fs from 'node:fs';
import path from 'node:path';
import { digestSchema, vectorSchema, type VectorRef } from '../shared/vector';
import { normalize } from '../shared/schema';
import { atomic, hash, Issue } from './store';
import { parseIllustration, MAX_XML } from './layered-svg';
export const narrationHash = (s: string) => hash(normalize(s));
function dir(root: string) {
  return path.join(root, 'media', 'illustrations');
}
const identity = (v: Omit<VectorRef, 'digest'>, xml: string) =>
  hash('vector-file-1', v.title, v.fx, v.provider, v.model, v.narrationHash, xml);
export function saveIllustration(root: string, info: Omit<VectorRef, 'digest'>, canonical: string) {
  const ref = vectorSchema.parse({ ...info, digest: identity(info, canonical) }),
    base = path.join(dir(root), ref.digest);
  atomic(base + '.svg', canonical);
  atomic(base + '.json', JSON.stringify(ref));
  return ref;
}
export function readIllustration(root: string, id: string) {
  try {
    const base = path.join(dir(root), digestSchema.parse(id));
    if (fs.statSync(base + '.svg').size > MAX_XML || fs.statSync(base + '.json').size > 2048)
      throw Error();
    const ref = vectorSchema.parse(JSON.parse(fs.readFileSync(base + '.json', 'utf8'))),
      xml = fs.readFileSync(base + '.svg', 'utf8');
    if (ref.digest !== id || identity(ref, xml) !== id) throw Error();
    const { drawing, canonical } = parseIllustration(xml);
    return { ref, drawing, canonical };
  } catch {
    throw new Issue(
      422,
      'Kayıtlı vektör sahnesi eksik veya doğrulanamadı. Bu sahneyi yeniden çiz.',
    );
  }
}
export function verifiedFrame(root: string, ref: VectorRef, text: string) {
  const stored = readIllustration(root, ref.digest);
  if (
    stored.ref.narrationHash !== narrationHash(text) ||
    JSON.stringify(stored.ref) !== JSON.stringify(vectorSchema.parse(ref))
  )
    throw new Issue(409, 'Anlatım veya çizim bilgisi değişti. Bu sahneyi yeniden çiz.');
  return { ref: stored.ref, drawing: stored.drawing };
}
