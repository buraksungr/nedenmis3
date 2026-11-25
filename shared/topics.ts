import { motionHeading } from './object-motion';

/** Belgesel konu öneri havuzu: doğa, bilim, uzay, insan vücudu, tarih ve günlük
 * merak konularından oluşan Türkçe başlıklar. Havuz, "Yeni video" ekranındaki
 * dinamik öneri metnini ve planlayıcının yedek başlık havuzunu besler. */
export const DOCUMENTARY_TOPICS = [
  'Karıncalar kışın nereye gider?',
  'Balinalar nasıl şarkı söyler?',
  'İnsan beyninde uyurken ne olur?',
  'Ayda su varsa nerede?',
  'Dağlar nasıl oluşur?',
  'Vücutta bağışıklık nasıl çalışır?',
  'Dinazorlar neden yok oldu?',
  'Okyanusların en derin yerinde neler yaşıyor?',
  'Güneş tutulması nasıl gerçekleşir?',
  'Ağaçlar birbirleriyle nasıl konuşur?',
  'Kar taneleri neden birbirinden farklıdır?',
  'Kuşlar göçte yol nasıl bulur?',
  'Volkanlar neden patlar?',
  'İnsan vücudu kanı nasıl dolaştırır?',
  'Işığın renkleri nasıl oluşur?',
  'Dünya’nın manyetik alanı ne işe yarar?',
  'Uydular gezegenleri nasıl görüntüler?',
  'Siyah delikler nelerdir?',
  'İlk bilgisayar nasıl çalıştı?',
  'Zeytinyağı nasıl üretilir?',
  'Orman yangından sonra ne olur?',
  'Arıların dans dilini kimler anlar?',
  'Penguenler neden uçmuyor?',
  'Yağan kar kışta neden sıcak tutar?',
  'İnsan gözü renkleri neden farklıdır?',
  'Doğada Fibonacci sayısı nerede görünür?',
  'Fırtınalar nasıl üretilir?',
  'Denizden tuz nasıl elde edilir?',
  'Gecede ağaçlar ne yapar?',
  'İnsan dili nasıl gelişti?',
  'Yeraltı suları nasıl oluşur?',
  'Zebralar neden şeritlidir?',
  'Mutluluk hormonları nelerdir?',
  'Yıldızlar aslında mı parlar?',
  'Kuyu suyu nereden gelir?',
];

/** Havuzdaki mevcut konudan farklı bir sonraki öneriyi döndürür (döngüsal). */
export function nextTopic(current?: string): string {
  let i = current ? DOCUMENTARY_TOPICS.findIndex((t) => t === current) : -1;
  if (i < 0) i = DOCUMENTARY_TOPICS.length - 1;
  const next = DOCUMENTARY_TOPICS[(i + 1) % DOCUMENTARY_TOPICS.length];
  return next === current ? DOCUMENTARY_TOPICS[(i + 2) % DOCUMENTARY_TOPICS.length] : next;
}

const TITLE_FALLBACKS = [
  'Sürecin Ayrıntıları',
  'Yakından Bakış',
  'Öne Çıkan Ayrıntılar',
  'Değişimin İzleri',
  'Farklı Bir Bakış',
  'Sürecin Dinamikleri',
  'Dikkat Çeken Noktalar',
  'Bağlantıların İzinde',
  'Temel Özellikler',
  'Bir Başka Perspektif',
  'Gizli Derinlikler',
  'Karanlık Katmanlar',
  'Yeraltı Yaşamı',
  'Doğal Döngüler',
  'Sessiz Hareket',
  'Kızıl Rüzgar',
  'Mavi Derinlik',
  'Altın Zaman',
  'Kara Toprak',
  'Beyaz Kar',
];

/** Last resort after the model repeats a title. Never cut a phrase out of narration:
 * doing so creates plausible-looking but incomplete Turkish headings. */
export function uniqueSceneTitle(_narration: string, taken: Set<string>): string {
  const used = new Set([...taken].map((s) => s.toLocaleLowerCase('tr')));
  for (const fallback of TITLE_FALLBACKS)
    if (!used.has(fallback.toLocaleLowerCase('tr'))) return fallback;
  throw new Error('Benzersiz sahne başlığı kalmadı; farklı bir başlık üretin.');
}

/** Yeni sahnelerde kullanılan başlık denetimiyle aynı kuralları paylaşır. */
export function isCompleteTitle(title: string): boolean {
  return (
    motionHeading.safeParse(title).success &&
    title
      .trim()
      .split(' ')
      .every((w) => w.length >= 2)
  );
}

/** Havuzdan rastgele, henüz kullanılmayan bir konu önerisi döndürür. */
let recentTopics = new Set<string>();
export function randomTopic(): string {
  const available = DOCUMENTARY_TOPICS.filter((t) => !recentTopics.has(t));
  const pool = available.length > 0 ? available : DOCUMENTARY_TOPICS;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  recentTopics.add(pick);
  if (recentTopics.size > DOCUMENTARY_TOPICS.length * 0.7)
    recentTopics = new Set([...recentTopics].slice(-Math.floor(DOCUMENTARY_TOPICS.length / 2)));
  return pick;
}
