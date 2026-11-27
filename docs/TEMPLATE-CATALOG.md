# Yerel bilimsel şablon kataloğu · 1.7.5

Kategoriler ve kullanım kapsamları uygulamadaki `server/science-catalog.ts` kaynağından gelir. Anahtar sözcük eşlemesi Türkçe ekleri ve bazı belirsizlikleri de dikkate alır; sözcük listesi bütün olası anlamları kapsamaz. Genel şablonlar kara delik, uzay, kalp ve karınca konularına yerel olarak uyarlanır; konu tanınmadığında nötr görünür.

| Kimlik           | Kategori | Türkçe                                      | English                                     | Kullanım kapsamı                                                        |
| ---------------- | -------- | ------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| `eye-front`      | anatomy  | göz, iris, göz bebeği, görme                | eye, iris, pupil, vision                    | Yalnız gerçek göz ve görme anlatımı; gözlem veya gözden kaybolma değil. |
| `eye-cross`      | anatomy  | göz, retina, kornea, göz merceği            | eye, retina, cornea, eye lens               | Göz anatomisi ve gözde ışığın izlediği yol.                             |
| `brain`          | anatomy  | beyin, beyin sapı                           | brain, brainstem                            | Beynin yapısı; genel sinir iletimi için nöron da uygundur.              |
| `neuron`         | biology  | nöron, sinir, beyin, akson                  | neuron, nerve, brain, axon                  | Sinir hücresi ve sinyal iletimi.                                        |
| `heart`          | anatomy  | kalp, yürek, kalp atışı                     | heart, heartbeat, cardiac                   | Kalp anatomisi ve nabız; damarlar kalple birlikte hareket eder.         |
| `circulation`    | anatomy  | kan, damar, dolaşım, kalp                   | blood, vessel, circulation, heart           | Kan ve vücut dolaşımı; karasal veya okyanus akıntısı değil.             |
| `cell`           | biology  | hücre, organel, hücre zarı                  | cell, organelle, cell membrane              | Hücre yapısı ve organeller.                                             |
| `dna`            | biology  | DNA, gen, genetik, kromozom                 | DNA, gene, genetics, chromosome             | DNA ve kalıtım; genişlemek sözcüğü gen değildir.                        |
| `lung`           | anatomy  | akciğer, nefes, solunum, bronş              | lung, breath, respiration, bronchus         | Akciğer ve solunum anatomisi.                                           |
| `muscle-joint`   | anatomy  | kas, eklem, tendon, kemik                   | muscle, joint, tendon, bone                 | Kas, kemik ve eklem yapısı.                                             |
| `soil-colony`    | ecology  | karınca, koloni, yuva, toprak altı          | ant, colony, nest, underground              | Karınca yuvası ve yeraltı kolonisi geniş görünümü.                      |
| `ant-tunnel`     | ecology  | karınca, tünel, yuva                        | ant, tunnel, nest                           | Karınca ve yuva tünelinin yakın görünümü.                               |
| `colony-chamber` | ecology  | karınca, koloni, odacık, kraliçe            | ant, colony, chamber, queen                 | Karınca kolonisinin odacığı ve bireyleri.                               |
| `atmosphere`     | earth    | atmosfer, hava katmanı                      | atmosphere, air layer                       | Dünya atmosferinin katmanları.                                          |
| `ocean-depth`    | earth    | okyanus, deniz, derinlik                    | ocean, sea, deep sea                        | Deniz yüzeyi ve okyanus derinliği.                                      |
| `water-cycle`    | earth    | su döngüsü, yağmur, buharlaşma, bulut       | water cycle, rain, evaporation, cloud       | Su döngüsü, yağış, akış ve buharlaşma.                                  |
| `plant`          | biology  | bitki, ağaç, yaprak, kök                    | plant, tree, leaf, root                     | Bitki ve yaprak/kök yapısı.                                             |
| `photosynthesis` | biology  | fotosentez, kloroplast, yaprak              | photosynthesis, chloroplast, leaf           | Fotosentez ve yapraktaki kloroplast.                                    |
| `refraction`     | physics  | kırılma, prizma, optik, ışık                | refraction, prism, optics, light            | Prizmada optik kırılma; uzaydaki ışık bükülmesini prizmayla göstermez.  |
| `magnetism`      | physics  | mıknatıs, manyetik alan                     | magnet, magnetic field                      | Mıknatıs ve manyetik alan.                                              |
| `electricity`    | physics  | elektrik, devre, akım, pil                  | electricity, circuit, current, battery      | Elektrik devresi ve akım.                                               |
| `orbit`          | space    | yörünge, gezegen, güneş sistemi, kara delik | orbit, planet, solar system, black hole     | Uzay ve yörünge; kara delikte yerel yığılma diski görünümü.             |
| `gravity`        | space    | yerçekimi, kütleçekim, uydu, kara delik     | gravity, gravitation, satellite, black hole | Kütleçekim ve uzay; kara delikte olay ufku ve ışık bükülmesi.           |
| `sound`          | physics  | ses, akustik, ses dalgası                   | sound, acoustics, sound wave                | Ses kaynağı ve dalga yayılması.                                         |
| `thermal`        | physics  | ısı, sıcaklık, termal, iletim               | heat, temperature, thermal, conduction      | Isı iletimi ve sıcaklık farkı.                                          |
| `overview`       | diagram  | genel bakış, bütün                          | overview, whole                             | Konuya uyarlanan genel görünüm; bilinmeyen konuda nötr şema.            |
| `focus`          | diagram  | odak, yakın plan                            | focus, close-up                             | Konuya uyarlanan yakın görünüm; göz veya optik iddiası değildir.        |
| `detail`         | diagram  | ayrıntı, kesit                              | detail, cross section                       | Konuya uyarlanan ayrıntı; bilinmeyen konuda nötr yapı.                  |
| `comparison`     | diagram  | karşılaştırma, fark                         | comparison, difference                      | İki durumun karşılaştırılması veya konuya uyarlanmış görünüm.           |
| `cause-effect`   | diagram  | neden, sonuç, etki                          | cause, effect                               | Neden/etki ilişkisi veya konuya uyarlanmış görünüm.                     |
| `timeline`       | diagram  | zaman, aşama, süreç, evrim                  | timeline, stage, process, evolution         | Süreç veya konuya uyarlanmış sıralı görünüm.                            |
| `microscope`     | diagram  | mikroskop, büyütme                          | microscope, magnification                   | Mikroskop yalnız gerçekten anılıyorsa; aksi durumda konu ayrıntısı.     |
| `balance`        | diagram  | denge, eşik                                 | balance, threshold                          | Denge veya konuya uyarlanmış bilimsel görünüm.                          |
