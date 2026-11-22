import fs from 'node:fs';
import path from 'node:path';
import {
  rigSchema,
  motionRefSchema,
  type RigRef,
  type MotionRef,
  type ObjectFrame,
} from '../shared/object-motion';
import { digestSchema } from '../shared/vector';
import { hash, atomic, Issue, requireThat } from './store';
import { parseSubjectRig, parseStage } from './motion-svg';
import { MAX_XML } from './layered-svg';
import { narrationHash } from './vector-files';
import { checkpoint } from './operation';
const file = (root: string, d: string) =>
  path.join(root, 'media', 'motion', digestSchema.parse(d) + '.svg');
function xml(root: string, d: string) {
  const f = file(root, d);
  if (!fs.existsSync(f) || fs.statSync(f).size > MAX_XML)
    throw new Issue(422, 'Hareket çizimi eksik veya çok büyük. Yeniden planlayın.');
  return fs.readFileSync(f, 'utf8');
}
const rigId = (r: Omit<RigRef, 'digest'>, s: string) =>
  hash(r.kind, r.subject, r.scriptHash, r.provider, r.model, s);
const shotId = (r: Omit<MotionRef, 'digest'>, s: string) =>
  hash(r.kind, r.title, r.rigDigest, r.narrationHash, r.provider, r.model, r.actors, r.objects, s);
export function saveRig(root: string, info: Omit<RigRef, 'digest'>, svg: string) {
  const data = parseSubjectRig(svg),
    ref = rigSchema.parse({ ...info, digest: rigId(info, data.canonical) });
  checkpoint();
  atomic(file(root, ref.digest), data.canonical);
  return ref;
}
export function loadRig(root: string, ref: RigRef) {
  const r = rigSchema.parse(ref),
    s = xml(root, r.digest);
  requireThat(rigId(r, s) === r.digest, 'Özne şablonu doğrulanamadı.', 422);
  return parseSubjectRig(s);
}
export function saveMotion(
  root: string,
  rig: RigRef,
  info: Omit<MotionRef, 'digest' | 'actors' | 'objects' | 'rigDigest'>,
  svg: string,
) {
  const data = parseStage(svg, loadRig(root, rig).root),
    meta = { ...info, rigDigest: rig.digest, actors: data.actors, objects: data.objects },
    ref = motionRefSchema.parse({ ...meta, digest: shotId(meta, data.canonical) });
  checkpoint();
  atomic(file(root, ref.digest), data.canonical);
  return ref;
}
export function motionFrame(
  root: string,
  rig: RigRef | undefined,
  ref: MotionRef | undefined,
  narration: string,
): ObjectFrame {
  requireThat(
    rig && ref && ref.rigDigest === rig.digest && ref.narrationHash === narrationHash(narration),
    'Anlatım veya özne değişti; bu sahneyi yeniden planlayın.',
  );
  motionRefSchema.parse(ref);
  const s = xml(root, ref.digest);
  requireThat(shotId(ref, s) === ref.digest, 'Hareket çizimi doğrulanamadı.', 422);
  const template = loadRig(root, rig).root,
    stage = parseStage(s, template);
  requireThat(
    stage.actors === ref.actors && stage.objects === ref.objects,
    'Koreografi doğrulanamadı.',
    422,
  );
  return { ref, rig: template, stage: stage.root };
}
