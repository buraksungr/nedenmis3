import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { normalize, sceneSchema, type Project, type Scene } from '../shared/schema';
import type { Gemini, RetryNotice } from './gemini';
import { requireThat, scriptSig } from './store';
const concept = sceneSchema.pick({
  narration: true,
  description: true,
  prompt: true,
  angle: true,
  environment: true,
  sound: true,
  seconds: true,
});
const board = z.object({
  styleGuide: z.string().min(5).max(3000),
  scenes: z.array(concept).min(5).max(7),
});
export async function script(
  g: Gemini,
  p: Project,
  action: string,
  index?: number,
  onRetry?: RetryNotice,
) {
  const paragraphs = p.script.split(/\n\s*\n/);
  const paragraph = action === 'paragraph';
  if (paragraph)
    requireThat(
      index !== undefined && index >= 0 && index < paragraphs.length,
      'Paragraf bulunamadı.',
    );
  const rule = paragraph
    ? 'Yalnızca belirtilen paragrafı yeniden yaz. Diğer paragrafları döndürme.'
    : action === 'shorten'
      ? 'Anlamı koruyarak metni biraz kısalt.'
      : action === 'lengthen'
        ? 'Doğru ve ilgili bir ayrıntıyla metni biraz genişlet.'
        : 'Yaklaşık 30 saniye, 65–75 Türkçe sözcük.';
  const t = await g.text(
    `Profesyonel bir Türkçe belgesel yazarı olarak doğal seslendirme metni yaz. Merak uyandıran soruyla aç, bilimsel doğruluğu koru, sade ifadeler ve tatmin edici son kullan. Uydurma bilgi, klişe, tanıtım, başlık, Markdown veya sahne numarası kullanma. Paragrafları boş satırla ayır. ${rule}\nProje verisi: ${JSON.stringify({ konu: p.topic, talimat: p.instructions, metin: p.script, paragraf: paragraph ? paragraphs[index!] : undefined })}`,
    undefined,
    onRetry,
  );
  requireThat(t.length > 5 && t.length < 10000, 'Metin yanıtı boş veya çok uzun.', 502);
  if (paragraph) {
    paragraphs[index!] = t;
    return paragraphs.join('\n\n');
  }
  return t;
}
export async function storyboard(g: Gemini, p: Project, target?: Scene) {
  requireThat(p.scriptApproval === scriptSig(p), 'Storyboard için senaryo onayı gerekiyor.');
  const prompt = `Türkçe sinematik 2D belgesel yönetmenisin. ${target ? 'Sadece belirtilen sahneyi yeniden tasarla; anlatımını aynen koru.' : 'Onaylı metni cümle bütünlüğüyle 5–7 sahneye böl. narration alanlarını tek boşlukla birleştirince onaylı metnin TAMAMI aynen çıkmalı. Kelime veya noktalama değiştirme.'} Her sahne için anlatımı açıklayan tek sabit illüstrasyon tasarla; kadrajı, ışığı, çevreyi ve ses tasarımını betimle. prompt alanında o sahnenin öznesini, kadrajını ve ortak paleti tek başına anlaşılacak biçimde tarif et. Kamera veya nesne animasyonu planlama. Sahneler yalnız yumuşak geçişle birleşir. Tahmini sürelerin toplamı yaklaşık 30 saniye. Üslup ve özne tüm sahnelerde tutarlı. ${JSON.stringify({ topic: p.topic, approved: p.script, style: p.styleGuide, target, instructions: p.instructions })}`;
  const shape = target ? concept : board;
  const schema = z.toJSONSchema(shape, {
    target: 'draft-7',
    // generateContent's JSON Schema subset omits string length bounds; Zod still checks them locally.
    override: ({ jsonSchema }) => {
      delete jsonSchema.minLength;
      delete jsonSchema.maxLength;
    },
  });
  delete schema.$schema;
  const raw = JSON.parse(await g.text(prompt, schema));
  if (target) {
    const s = concept.parse(raw);
    return {
      styleGuide: p.styleGuide,
      scenes: p.scenes.map((x) =>
        x.id === target.id ? { ...x, ...s, narration: x.narration } : x,
      ),
    };
  }
  const result = board.parse(raw);
  requireThat(
    normalize(result.scenes.map((s) => s.narration).join(' ')) === normalize(p.script),
    'Gemini onaylı anlatımı değiştirdi. Storyboard kaydedilmedi; tekrar deneyin.',
    422,
  );
  return { ...result, scenes: result.scenes.map((s) => ({ ...s, id: randomUUID() })) };
}
