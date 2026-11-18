import { z } from 'zod';
import type { Speaker } from './speakers';
// Retain legacy board fields in saved approvals/version history; none drive the composition.
const cameras = ['push', 'pull', 'pan', 'tilt', 'track', 'focus'] as const;
const environments = ['dust', 'snow', 'bubbles', 'water', 'rays', 'fog', 'stars', 'none'] as const;
const objects = ['none', 'trail', 'current', 'orbit', 'reveal', 'arrow'] as const;
const transitions = ['dissolve', 'iris', 'drift', 'cut'] as const;
const str = z.string().trim().max(5000);
export const sceneSchema = z.object({
  id: z.string().uuid(),
  narration: str,
  description: str,
  prompt: str,
  angle: str,
  animation: str.optional(),
  environment: str,
  sound: str,
  camera: z.enum(cameras).optional(),
  effect: z.enum(environments).optional(),
  object: z.enum(objects).optional(),
  transition: z.enum(transitions).optional(),
  seconds: z.number().min(0.2).max(120),
  motion: z.number().min(0.2).max(2).optional(),
});
export type Scene = z.infer<typeof sceneSchema>;
export type TimedText = { text: string; start: number; end: number };
export type Word = TimedText;
export const wordSchema = z.object({
  text: z.string().trim().min(1).max(120),
  start: z.number().nonnegative(),
  end: z.number().positive(),
});
export type Asset = {
  file: string;
  key: string;
  duration?: number;
  source?: 'gemini' | 'import' | 'local';
  model?: string;
  created?: string;
};
export type Media = {
  image?: Asset;
  voice?: Asset;
  align?: Asset &
    (
      | { method?: 'whisper' } // Includes verified word alignments saved before 1.0.4.
      | { method: 'estimated'; reason: string; sentences: TimedText[] }
    );
  clip?: Asset;
  sfx?: Asset;
  words?: Word[];
  edits?: TimedText[]; // Same granularity as the underlying alignment.
  recognized?: string;
};
export type Task = {
  state: 'waiting' | 'working' | 'done' | 'failed' | 'config';
  label: string;
  kind?: string;
  scene?: string;
  progress?: number;
  at: string;
};
export type Project = {
  version: 1;
  id: string;
  rev: number;
  title: string;
  topic: string;
  instructions: string;
  category: string;
  cover: string;
  example: boolean;
  created: string;
  updated: string;
  script: string;
  scriptApproval: string | null;
  boardApproval: string | null;
  scenes: Scene[];
  styleGuide: string;
  intensity?: 'Düşük' | 'Orta' | 'Yüksek'; // Legacy metadata only.
  voice: Speaker;
  speakerPinned?: boolean; // Explicit choice or a project that already has narration.
  voiceStyle: string;
  pace: string;
  subtitleSize: number;
  highlight: boolean;
  musicVolume: number;
  music?: Asset;
  assets: Record<string, Media>;
  final?: Asset;
  subtitleFiles?: { srt: string; json: string };
  job: Task;
  history: number;
};
export type ProjectSummary = Pick<
  Project,
  'id' | 'title' | 'topic' | 'updated' | 'category' | 'cover' | 'example' | 'job'
> & { stage: string; scenes: number; duration: number; exported: boolean };
export const kinds = ['text', 'image', 'tts'] as const;
export type Kind = (typeof kinds)[number];
export type Connection =
  | 'not-configured'
  | 'untested'
  | 'connected'
  | 'invalid'
  | 'quota'
  | 'unavailable';
export type ModelConfig = { model: string; consent: 'blocked' | 'free' | 'paid' };
// Only an explicit paid opt-in enables the remote image adapter.
export const manualImages = (image: ModelConfig) => image.consent !== 'paid';
export type ProviderSettings = {
  models: Record<Kind, ModelConfig>;
  catalog: { id: string; kind: Kind; name: string }[];
  status: Connection;
  tested: string | null;
  services: Partial<Record<Kind, { status: Connection; message: string; at: string }>>;
  requests: Record<string, number>;
  message: string;
};
export type Settings = ProviderSettings & {
  defaultSpeaker: Speaker;
  hasKey: boolean;
  storage: 'encrypted' | 'session';
  folder: string;
  desktop: boolean;
  setupDone: boolean;
};
export type Check = { id: string; name: string; ok: boolean; detail: string };
export const blankScene = (id: string): Scene => ({
  id,
  narration: '',
  description: '',
  prompt: '',
  angle: 'Göz hizası',
  environment: '',
  sound: '',
  seconds: 5,
});
export const normalize = (s: string) => s.trim().replace(/\s+/gu, ' ');
export const stageOf = (p: Project) =>
  p.final
    ? 'Tamamlandı'
    : p.job.state === 'working'
      ? 'İşleniyor'
      : p.job.state === 'waiting' && p.job.kind === 'manual-images'
        ? 'Görsel bekleniyor'
        : p.boardApproval
          ? 'Üretime hazır'
          : p.scriptApproval
            ? 'Storyboard'
            : p.script
              ? 'Senaryo'
              : 'Taslak';
export const labels = { text: 'Metin', image: 'Görsel', tts: 'Seslendirme' };
export const statusNames: Record<Connection, string> = {
  'not-configured': 'Yapılandırılmadı',
  untested: 'Test edilmedi',
  connected: 'Bağlandı',
  invalid: 'Geçersiz anahtar',
  quota: 'Kota aşıldı',
  unavailable: 'Servis kullanılamıyor',
};
