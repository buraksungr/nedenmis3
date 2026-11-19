import { catalogue, labelSchema, type ScienceIcon, type Template } from './svg';

export type Subject = {
  icon: ScienceIcon;
  title: string;
  pair: [string, string];
  flow: [string, string, string];
};
type Entry = [RegExp, Subject];
const entry = (
  test: RegExp,
  icon: ScienceIcon,
  title: string,
  pair: Subject['pair'],
  flow: Subject['flow'],
): Entry => [test, { icon, title, pair, flow }];
const subjects: Entry[] = [
  // Prefer specific mechanisms and anatomy to incidental words such as “hava” or “su”.
  entry(
    /epidermis|dermis|deri altı/,
    'shield',
    'Derinin Katmanları',
    ['Deri yüzeyi', 'Deri altı'],
    ['Epidermis', 'Dermis', 'Deri altı'],
  ),
  entry(
    /manto|yer kabuğu|iç çekirdek/,
    'earth',
    'Dünyanın İç Yapısı',
    ['Yer kabuğu', 'Yer çekirdeği'],
    ['Yer kabuğu', 'Manto', 'Çekirdek'],
  ),
  entry(
    /humus|ana kaya|killi|kumlu/,
    'earth',
    'Toprağın Yapısı',
    ['Organik madde', 'Mineral taneleri'],
    ['Toprak yüzeyi', 'Alt toprak', 'Ana kaya'],
  ),
  entry(
    /kanadın|kanat kesit|kanat profili/,
    'airplane',
    'Kanadın Kesiti',
    ['Üst yüzey', 'Alt yüzey'],
    ['Hücum kenarı', 'Kanat yüzeyi', 'Firar kenarı'],
  ),
  entry(
    /jet motor|kompresör|türbin/,
    'airplane',
    'Jet Motorunun İşleyişi',
    ['Hava girişi', 'Gaz çıkışı'],
    ['Havanın sıkıştırılması', 'Yakıtın yanması', 'Gazın çıkışı'],
  ),
  entry(
    /kalkış.*iniş|iniş.*kalkış/,
    'airplane',
    'Uçuşun Evreleri',
    ['Kalkış', 'İniş'],
    ['Kalkış', 'Seyir', 'İniş'],
  ),
  entry(
    /kabin|basınçlandır/,
    'shield',
    'Kabinde Hava Basıncı',
    ['Kabin basıncı', 'Yolcuların solunumu'],
    ['Hava beslemesi', 'Basıncın ayarlanması', 'Kabin havası'],
  ),
  entry(
    /sürükleme|yakıt tasarruf|hava direnci/,
    'airplane',
    'Havanın Direnci',
    ['Seyrek hava', 'Azalan sürükleme'],
    ['Havanın seyrelmesi', 'Direncin azalması', 'Yakıt tasarrufu'],
  ),
  entry(
    /hava.*(?:seyrek|yoğun)|seyrek.*hava/,
    'molecule',
    'Havanın Yoğunluğu',
    ['Yoğun hava', 'Seyrek hava'],
    ['Alçak irtifa', 'Yükselme', 'Seyrek hava'],
  ),
  entry(
    /oksijen/,
    'molecule',
    'Havadaki Oksijen',
    ['Oksijen', 'Hava karışımı'],
    ['Hava karışımı', 'Solunan oksijen', 'Gaz alışverişi'],
  ),
  entry(
    /troposfer|stratosfer|mezosfer|atmosfer.*katman/,
    'globe',
    'Atmosferin Katmanları',
    ['Alt atmosfer', 'Üst atmosfer'],
    ['Troposfer', 'Stratosfer', 'Mezosfer'],
  ),
  entry(
    /kontrol kulesi|radyo sinyal|radyo dalga/,
    'soundwave',
    'Radyoyla Haberleşme',
    ['Verici anten', 'Alıcı anten'],
    ['Radyo vericisi', 'Dalganın yayılması', 'Alıcı anten'],
  ),
  entry(
    /uçak|uçağ|uçuş|havacılık|seyir irtifa|pilot/,
    'airplane',
    'Uçakların Seyir Yüksekliği',
    ['Yolcu uçağı', 'Seyir irtifası'],
    ['Pistten kalkış', 'Tırmanış', 'Seyir uçuşu'],
  ),
  entry(
    /mesafe|kilometre|yol boyunca/,
    'globe',
    'Mesafe Ölçeği',
    ['Yolun başı', 'Varış noktası'],
    ['Çıkış noktası', 'Ara durak', 'Varış noktası'],
  ),
  entry(
    /böbre[kğ]|idrar/,
    'water',
    'Böbreklerin Su Dengesi',
    ['Çözünmüş tuz', 'Atılan su'],
    ['Kanın süzülmesi', 'Suyun geri emilimi', 'İdrarla atılım'],
  ),
  entry(
    /tuzlu su|deniz suyu|deniz suyunu/,
    'water',
    'Deniz Suyundaki Tuz',
    ['Deniz suyu', 'Çözünmüş tuz'],
    ['Tuz alımı', 'Yoğunluk artışı', 'Su ihtiyacı'],
  ),
  entry(
    /karınca/,
    'ant',
    'Karıncaların Yaşamı',
    ['İşçi karınca', 'Yuva girişi'],
    ['Yuvadan çıkış', 'Besin arayışı', 'Yuvaya dönüş'],
  ),
  entry(
    /retina|göz(?!lem)|görme|merce[kğ]/,
    'eye',
    'Gözün Işık Algısı',
    ['Göz merceği', 'Retina'],
    ['Işığın girişi', 'Mercekte odaklanma', 'Retinada algılama'],
  ),
  entry(
    /kalp|kalb|nabız/,
    'heart',
    'Kalbin Ritmi',
    ['Kalp kası', 'Kan akışı'],
    ['Kalbin dolması', 'Kasılma', 'Kanın pompalanması'],
  ),
  entry(
    /atom|elektron|proton|nötron/,
    'atom',
    'Atomun Yapısı',
    ['Atom çekirdeği', 'Elektron bulutu'],
    ['Atom çekirdeği', 'Elektronlar', 'Enerji düzeyleri'],
  ),
  entry(
    /ses dalga|ses tel|titreşim|frekans|yankı|akustik|işitme/,
    'soundwave',
    'Sesin Yayılması',
    ['Titreşim kaynağı', 'Sesin alıcısı'],
    ['Titreşim', 'Havada yayılma', 'Sesin algılanması'],
  ),
  entry(
    /şimşek|yıldırım|elektrik yük|elektrik akım/,
    'lightning',
    'Elektrik Yükleri',
    ['Yük ayrımı', 'Elektrik boşalması'],
    ['Yük birikimi', 'Alan oluşumu', 'Boşalma'],
  ),
  entry(
    /bağışıklık|koruyucu|savunma|kalkan/,
    'shield',
    'Koruyucu Yapılar',
    ['Koruyucu tabaka', 'Korunan doku'],
    ['Temas', 'Koruyucu engel', 'Doku yanıtı'],
  ),
  entry(
    /kar kristal|kar tanesi|buz kristal|donma|karlı|kar yağ/,
    'snowflake',
    'Buz Kristalleri',
    ['Su molekülü', 'Kristal örgü'],
    ['Soğuma', 'Kristalleşme', 'Buz oluşumu'],
  ),
  entry(
    /güneş|gün ışığı|ışınım/,
    'sun',
    'Güneşin Işınları',
    ['Güneş', 'Yeryüzü'],
    ['Güneş ışığı', 'Işığın yayılması', 'Yüzeye ulaşma'],
  ),
  entry(
    /zaman|saat|saniye|dakika|takvim/,
    'clock',
    'Zamanın Ölçümü',
    ['Geçen süre', 'Zaman aralığı'],
    ['İlk ölçüm', 'Geçen süre', 'Son ölçüm'],
  ),
  entry(
    /yerküre|enlem|boylam|ekvator|kutuplar/,
    'globe',
    'Yerkürenin Yapısı',
    ['Ekvator', 'Kutuplar'],
    ['Ekvator', 'Orta enlemler', 'Kutuplar'],
  ),
  [
    /hücre|ozmo[sz]|osmo[sz]|zarından/,
    {
      icon: 'cell',
      title: 'Hücrede Su Dengesi',
      pair: ['Hücre içi sıvı', 'Hücre dışı sıvı'],
      flow: ['Yoğunluk farkı', 'Zardan su geçişi', 'Sıvı dengesi'],
    },
  ],
  [
    /beyin|beyn|hipotalamus|sinir|nöron/,
    {
      icon: 'brain',
      title: 'Beynin Sinyalleri',
      pair: ['Duyu sinyali', 'Beynin yanıtı'],
      flow: ['Uyarının algılanması', 'Sinir iletimi', 'Beynin yanıtı'],
    },
  ],
  [
    /ağız|ağz|damak|tükürük/,
    {
      icon: 'water',
      title: 'Ağızda Kalan Tat',
      pair: ['Tatlı lokma', 'Bir yudum su'],
      flow: ['Tatlı lokma', 'Damakta kalan tat', 'Su içme isteği'],
    },
  ],
  [
    /(?:^| )kan(?:da|a|ın|ı| dolaş| şeker)|damar|alyuvar|plazma/,
    {
      icon: 'blood',
      title: 'Kan Dolaşımı',
      pair: ['Kan plazması', 'Damar duvarı'],
      flow: ['Bağırsakta emilim', 'Kana geçiş', 'Damarlarla taşınma'],
    },
  ],
  [
    /şeker|glikoz|glukoz|sindirim|molekül|kimya/,
    {
      icon: 'molecule',
      title: 'Moleküllerin Yapısı',
      pair: ['Molekül', 'Atomlar'],
      flow: ['Atomlar', 'Kimyasal bağlar', 'Molekül'],
    },
  ],
  [
    /buharlaş|yoğuş|su döngü/,
    {
      icon: 'water',
      title: 'Suyun Yolculuğu',
      pair: ['Su buharı', 'Su damlası'],
      flow: ['Buharlaşma', 'Yoğuşma', 'Yağış'],
    },
  ],
  [
    /susama|susa[dr]|susuz|sıvı|su iç|içtiğimiz su|yağmur|damla|deniz|okyanus|(?:^| )su(?: |yu|ya|da|yun)/,
    {
      icon: 'water',
      title: 'Suyun Hareketi',
      pair: ['Su damlası', 'Su yüzeyi'],
      flow: ['Su damlası', 'Yüzeyde akış', 'Su birikimi'],
    },
  ],
  [
    /yapra[kğ]|bitki|kök|fotosentez|orman/,
    {
      icon: 'leaf',
      title: 'Bitkinin Yapısı',
      pair: ['Yaprak ayası', 'Ana damar'],
      flow: ['Kökten emilim', 'Gövdede taşınma', 'Yaprağa ulaşım'],
    },
  ],
  [
    /sıcak|termometre|derece|°c|enerji|ateş|alev|ısın|ısı /,
    {
      icon: 'flame',
      title: 'Isı Değişimi',
      pair: ['Isı kaynağı', 'Isınan ortam'],
      flow: ['Isı kaynağı', 'Isı aktarımı', 'Sıcaklık değişimi'],
    },
  ],
  [
    /topra[kğ]|katman|yeralt|yüzey|yuva|dünya|gezegen|kaya|karlı|kar yağ/,
    {
      icon: 'earth',
      title: 'Yüzeyin Altında',
      pair: ['Yeryüzü', 'Toprak katmanı'],
      flow: ['Yüzey', 'Üst katman', 'Derin katman'],
    },
  ],
];
export const lower = (s: string) => s.toLocaleLowerCase('tr').normalize('NFC');
export const upperFirst = (s: string) => s.slice(0, 1).toLocaleUpperCase('tr') + s.slice(1);
const stop =
  /^(?:ve|ile|için|neden|nasıl|gibi|daha|fakat|önce|sonra|çünkü|bir|bu|olan|olarak|hemen|bile|çok|ise|kadar)$/u;
export function keywords(text: string) {
  return [
    ...new Set(
      (lower(text).match(/[\p{L}][\p{L}\p{M}’'-]*/gu) ?? []).filter(
        (w) => w.length > 2 && w.length <= 22 && !stop.test(w),
      ),
    ),
  ];
}
export function subjectFor(text: string, topic: string): Subject {
  const source = lower(text),
    match = (s: string) => subjects.find(([r]) => r.test(s))?.[1];
  const base = match(source) ?? match(lower(topic));
  if (base) {
    if (base.icon === 'blood' && /şeker|gl[iu]koz|yoğun|çözünmüş/.test(source))
      return {
        ...base,
        title: /yoğun|çözünmüş/.test(source) ? 'Kandaki Yoğunluk Artışı' : 'Glikozun Kana Geçişi',
        pair: [
          'Kan plazması',
          /şeker|gl[iu]koz/.test(source) ? 'Çözünmüş glikoz' : 'Çözünmüş madde',
        ],
        flow: ['Sindirim', 'Glikoz emilimi', 'Kana geçiş'],
      };
    if (base.icon === 'brain' && /sus|sıvı|su iç/.test(source + ' ' + lower(topic)))
      return {
        ...base,
        title: 'Beynin Susama Sinyali',
        pair: ['Sıvı dengesi', 'Susama merkezi'],
        flow: ['Yoğunluk değişimi', 'Beyinde algılama', 'Susama hissi'],
      };
    if (base.icon === 'molecule' && /şeker|gl[iu]koz|tatlı/.test(source))
      return {
        ...base,
        title: 'Şekerin Yolculuğu',
        pair: ['Şeker molekülü', 'Çözünmüş şeker'],
        flow: ['Şekerin sindirimi', 'Bağırsakta emilim', 'Kana geçiş'],
      };
    if (
      base.icon === 'water' &&
      !/ağız|ağz|böbre|tuz/.test(source) &&
      /susuz|susama|su iç|sıvı denge|içtiğimiz su/.test(source)
    )
      return {
        ...base,
        title: /tatlı|şeker/.test(source) ? 'Tatlı ve Susama' : 'Vücudun Su Dengesi',
        pair: ['Susama hissi', 'Bir yudum su'],
        flow: ['Susama sinyali', 'Su içme', 'Sıvı dengesi'],
      };
    return base;
  }
  const [a, b, c] = keywords(text + ' ' + topic),
    key = upperFirst(a ?? 'Bilim'),
    second = b ? upperFirst(b) : key + ' incelemesi';
  return {
    icon: 'globe',
    title: `Mercek Altında ${key}`,
    pair: [key, second],
    flow: [key, second, c ? upperFirst(c) : `${key} etkisi`],
  };
}

export function supportsIcon(text: string, icon: ScienceIcon) {
  return subjects.some(([r, c]) => c.icon === icon && r.test(lower(text)));
}
export function hasSubject(text: string) {
  return subjects.some(([r]) => r.test(lower(text)));
}

// Named sequences keep their meaning when the narrator uses inflections (and are
// not truncated excerpts of the sentence). Only include a fourth stop when present.
const cycles: [RegExp, string][][] = [
  [
    [/buharlaş/, 'Buharlaşma'],
    [/yoğuş|yoğunlaş/, 'Yoğuşma'],
    [/yağış|yağmur/, 'Yağış'],
    [/birik|akış|toplan/, 'Suyun toplanması'],
  ],
  [
    [/kalkış|kalkar/, 'Kalkış'],
    [/tırman/, 'Tırmanış'],
    [/seyir/, 'Seyir'],
    [/iniş|iner/, 'İniş'],
  ],
  [
    [/ilkbahar/, 'İlkbahar'],
    [/\byaz/, 'Yaz'],
    [/sonbahar/, 'Sonbahar'],
    [/kış/, 'Kış'],
  ],
  [
    [/yumurta/, 'Yumurta'],
    [/larva/, 'Larva'],
    [/pupa/, 'Pupa'],
    [/ergin|yetişkin/, 'Ergin birey'],
  ],
];
const strata: [RegExp, string][][] = [
  [
    [/termosfer/, 'Termosfer'],
    [/mezosfer/, 'Mezosfer'],
    [/stratosfer/, 'Stratosfer'],
    [/troposfer/, 'Troposfer'],
  ],
  [
    [/kabuk|kabuğ/, 'Yer kabuğu'],
    [/manto/, 'Manto'],
    [/dış çekirdek/, 'Dış çekirdek'],
    [/iç çekirdek/, 'İç çekirdek'],
  ],
  [
    [/humus/, 'Humus'],
    [/üst toprak/, 'Üst toprak'],
    [/alt toprak|killi/, 'Alt toprak'],
    [/ana kaya|anakaya/, 'Ana kaya'],
  ],
  [
    [/epidermis/, 'Epidermis'],
    [/(?<!\p{L})dermis/u, 'Dermis'],
    [/hipodermis|deri altı/, 'Deri altı'],
  ],
];
export function namedSequence(text: string, kind: 'cycle' | 'layers') {
  return (kind === 'cycle' ? cycles : strata)
    .map((group) => group.filter(([r]) => r.test(lower(text))).map(([, name]) => name))
    .find((a) => a.length >= 3);
}
function clauses(text: string) {
  // Keep whole short clauses, not the first N words of a long sentence.
  return text
    .replace(/[.!?;:]+$/u, '')
    .split(/\s*[,;:→]\s*|\s+(?:ve sonra|ardından|daha sonra|sonra|bu yüzden|böylece|oysa|ise)\s+/iu)
    .map((s) => upperFirst(s.trim()))
    .filter((s) => s.length > 1 && s.length <= 36 && s.split(/\s+/).length <= 4);
}
export function copyFor(template: Template, text: string, topic: string, requested?: number) {
  const c = subjectFor(text, topic),
    s = lower(text),
    [min, max] = catalogue[template].slots;
  let title = c.title,
    labels: string[] = [...c.pair];
  switch (template) {
    case 'TitleHookScene':
      labels = [c.pair[0]];
      break;
    case 'ProcessFlowScene':
      labels = [...c.flow];
      break;
    case 'CycleLoopScene': {
      const seq = namedSequence(text, 'cycle');
      title = /buharlaş|yoğuş/.test(s)
        ? 'Suyun Döngüsü'
        : /mevsim|sonbahar/.test(s)
          ? 'Mevsimlerin Döngüsü'
          : c.title;
      labels = seq ?? (clauses(text).length >= 3 ? clauses(text) : [...c.flow]);
      break;
    }
    case 'LayerStackScene':
      labels =
        namedSequence(text, 'layers') ?? (clauses(text).length >= 3 ? clauses(text) : [...c.flow]);
      break;
    case 'RatioGaugeScene':
      if (/ağırlı|ağırlığ|ağır|kütle/.test(s)) {
        title = 'Ağırlık Oranı';
        labels = ['Vücut ağırlığı'];
      } else if (/oksijen/.test(s)) {
        title = 'Havadaki Oksijen Oranı';
        labels = ['Oksijen'];
      } else if (/(?:^| )su(?:$|\b|yu|da|dur|dan)/u.test(s)) {
        title = 'Suyun Payı';
        labels = ['Su'];
      } else {
        const n = keywords(text.replace(/(?:yüzde|%)[\s\d.,]+/giu, ' ')).find(
          (w) => !/^oran|yüzde|katı$/u.test(w),
        );
        labels = [n ? upperFirst(n) : c.pair[0]];
      }
      break;
    case 'ThermometerGaugeScene':
      title = /topra[kğ]/.test(s)
        ? 'Toprağın Sıcaklığı'
        : /hava|kıyı|yukar|irtifa/.test(s)
          ? 'Havanın Sıcaklığı'
          : 'Sıcaklık Değişimi';
      labels = [
        /topra[kğ]/.test(s)
          ? 'Toprak sıcaklığı'
          : /hava|kıyı|yukar|irtifa/.test(s)
            ? 'Hava sıcaklığı'
            : /su |suyun/.test(s)
              ? 'Su sıcaklığı'
              : 'Ölçülen sıcaklık',
        'Sıcaklık aralığı',
      ];
      break;
    case 'WavePulseScene':
      if (/radyo|anten/.test(s))
        labels = [
          /pilot|uçak/.test(s) ? 'Uçak anteni' : 'Verici anten',
          /kule/.test(s) ? 'Kontrol kulesi' : 'Alıcı anten',
        ];
      else if (/güneş|ışık/.test(s))
        labels = [
          /güneş/.test(s) ? 'Güneş' : 'Işık kaynağı',
          /göz|retina/.test(s) ? 'Retina' : 'Aydınlanan yüzey',
        ];
      else if (/ses|titreşim/.test(s))
        labels = [
          /ses tel/.test(s) ? 'Ses telleri' : 'Titreşim kaynağı',
          /kulak/.test(s) ? 'Kulak' : 'Sesin alıcısı',
        ];
      break;
    case 'SplitCauseEffectScene': {
      const pair = clauses(text);
      if (pair.length === 2) labels = pair;
      if (c.icon === 'cell' && /yoğun|çözünmüş/.test(s))
        labels = ['Yoğunluk farkı', 'Hücreden su çıkışı'];
      if (/sürükleme|hava direnci/.test(s)) {
        if (/seyrel|seyrek/.test(s)) labels = ['Havanın seyrelmesi', 'Azalan sürükleme'];
        else if (/yakıt/.test(s)) labels = ['Azalan hava direnci', 'Yakıt tasarrufu'];
      }
      break;
    }
    case 'TimelineScaleScene':
      if (/irtifa|tırman|yüksekli|deniz seviyesinden/.test(s)) {
        title = 'Yükseklik Ölçeği';
        labels = [
          /deniz sevi/.test(s) ? 'Deniz seviyesi' : 'Alçak irtifa',
          'Ara irtifa',
          'Üst irtifa',
        ];
      } else labels = clauses(text).length >= 3 ? clauses(text) : [...c.flow];
      break;
    case 'CrossSectionScene':
      if (c.icon === 'cell') labels = ['Hücre dışı sıvı', 'Hücre içi sıvı'];
      if (c.icon === 'leaf' || c.icon === 'ant')
        labels = ['Toprak yüzeyi', c.icon === 'ant' ? 'Yuva odası' : 'Kök bölgesi'];
      break;
  }
  const count = Math.max(min, Math.min(max, requested ?? labels.length));
  // Build a distinct reservoir for partial rows. Never synthesize “Etiket 3”.
  const pool = [
    ...labels,
    ...c.pair,
    ...c.flow,
    ...clauses(text),
    ...keywords(text + ' ' + topic).map(upperFirst),
    title,
  ];
  const seen = new Set<string>();
  return {
    title,
    icon: c.icon,
    labels: pool
      .filter((label) => {
        const k = lower(label);
        if (seen.has(k) || !labelSchema.safeParse(label).success) return false;
        seen.add(k);
        return true;
      })
      .slice(0, count),
  };
}
