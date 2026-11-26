import { type Project } from '../shared/schema';
import type { RetryNotice } from './gemini';
import type { SceneModels } from './scene-models';
import { requireThat } from './store';
export async function script(
  models: SceneModels,
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
  const t = await models.text(
    `Profesyonel bir Türkçe belgesel yazarı olarak doğal seslendirme metni yaz. Merak uyandıran soruyla aç, bilimsel doğruluğu koru, sade ifadeler ve tatmin edici son kullan. Uydurma bilgi, klişe, tanıtım, başlık, Markdown veya sahne numarası kullanma. Paragrafları boş satırla ayır. ${rule}\nProje verisi: ${JSON.stringify({ konu: p.topic, talimat: p.instructions, metin: p.script, paragraf: paragraph ? paragraphs[index!] : undefined })}`,
    onRetry,
  );
  requireThat(t.length > 5 && t.length < 10000, 'Metin yanıtı boş veya çok uzun.', 502);
  if (paragraph) {
    paragraphs[index!] = t;
    return paragraphs.join('\n\n');
  }
  return t;
}
