import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOCUMENTARY_TOPICS, nextTopic, uniqueSceneTitle } from '../shared/topics';

test('konu öneri havuzunda en az 30 farklı Türkçe belgesel konusu vardır', () => {
  assert.ok(DOCUMENTARY_TOPICS.length >= 30);
  const lower = DOCUMENTARY_TOPICS.map((t) => t.toLocaleLowerCase('tr'));
  assert.equal(new Set(lower).size, lower.length, 'havuzda tekrarlı konu yok');
  for (const t of DOCUMENTARY_TOPICS) {
    assert.ok(t.length >= 10 && t.length <= 240, t);
    assert.ok(/\?$/.test(t), `${t} soru cümlesi olmalı`);
  }
});

test('yenile butonu mevcut konudan farklı bir konu önerir ve döngüsal döner', () => {
  let current = DOCUMENTARY_TOPICS[0];
  const seen = new Set<string>();
  for (let i = 0; i < DOCUMENTARY_TOPICS.length + 3; i++) {
    const nxt = nextTopic(current);
    assert.notEqual(nxt, current, `yenile aynı konuyu tekrarlamamalı: ${current}`);
    assert.ok(DOCUMENTARY_TOPICS.includes(nxt));
    seen.add(nxt);
    current = nxt;
  }
  assert.ok(seen.size > 1, 'farklı öneriler üretilmeli');
  assert.equal(nextTopic(), DOCUMENTARY_TOPICS[0]);
});

test('tanınmayan konu için varsayılan ilk havuz konusu döner', () => {
  assert.equal(nextTopic('böyle bir konu yok'), DOCUMENTARY_TOPICS[0]);
});

test('uniqueSceneTitle alınmamış 2–4 kelimelik bir başlık döndürür', () => {
  const taken = new Set(['Kışın Eşiğinde', 'Güvenli Derinlikler']);
  const title = uniqueSceneTitle(
    'Karıncalar kışın yuvalarında nasıl uyurlar ve nemlenirler?',
    taken,
  );
  const words = title.trim().split(' ');
  assert.ok(words.length >= 2 && words.length <= 4, title);
  assert.ok(!taken.has(title.toLocaleLowerCase('tr')), title);
  // İkinci çağrı aynı alıntıya diğer bir başlık vermeli.
  taken.add(title.toLocaleLowerCase('tr'));
  const title2 = uniqueSceneTitle(
    'Karıncalar kışın yuvalarında nasıl uyurlar ve nemlenirler?',
    taken,
  );
  assert.notEqual(title2, title);
  assert.ok(!taken.has(title2.toLocaleLowerCase('tr')));
});

test('uniqueSceneTitle anlatıda yeterli kelime yoksa yedek havuza düşer', () => {
  const taken = new Set(DOCUMENTARY_TOPICS.map((t) => t.toLocaleLowerCase('tr')));
  for (const fallback of [
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
  ])
    taken.add(fallback.toLocaleLowerCase('tr'));
  const title = uniqueSceneTitle('xy z', taken);
  const words = title.trim().split(' ');
  assert.ok(words.length >= 2 && words.length <= 4, title);
});
