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

const STOPWORDS = new Set([
  've',
  'veya',
  'ile',
  'olan',
  'olarak',
  'ise',
  'ama',
  'çünkü',
  'bir',
  'için',
  'gibi',
  'kadar',
  'örneğin',
  'nasıl',
  'böylece',
  'de',
  'da',
  'ya',
  'ne',
  'neden',
  'niçin',
  'nerede',
  'nereye',
  'kim',
  'kimler',
  'hangi',
  'hangisi',
  'neler',
  'mi',
  'mı',
  'mu',
  'mü',
  'ki',
  'henüz',
  'daha',
  'çok',
  'hem',
  'bu',
  'şu',
  'o',
  'bunlar',
  'şunlar',
  'onlar',
  'birçok',
  'bazı',
  'her',
]);

const TITLE_FALLBACKS = [
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

/** Anlatıdan türetilmiş, alınmamış, 2–4 kelimelik doğal Türkçe bir başlık döndürür. */
export function uniqueSceneTitle(narration: string, taken: Set<string>): string {
  const words = narration
    .toLocaleLowerCase('tr')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w) && /^\p{L}+$/u.test(w));
  for (const len of [2, 3, 4]) {
    for (let i = 0; i + len <= words.length; i++) {
      const phrase = words
        .slice(i, i + len)
        .map((w) => w[0].toLocaleUpperCase('tr') + w.slice(1))
        .join(' ');
      if (!taken.has(phrase.toLocaleLowerCase('tr'))) return phrase;
    }
  }
  for (const fallback of TITLE_FALLBACKS)
    if (!taken.has(fallback.toLocaleLowerCase('tr'))) return fallback;
  return 'Gizli Derinlikler';
}
