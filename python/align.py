"""One CPU model, two independent passes. Never derive timestamps from text length."""
import argparse, hashlib, json, re, sys
from difflib import SequenceMatcher
from pathlib import Path


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--check', action='store_true')
    p.add_argument('--install-model', action='store_true')
    p.add_argument('--audio'); p.add_argument('--script'); p.add_argument('--out'); p.add_argument('--models')
    a = p.parse_args()
    import torch, whisper, stable_whisper
    if a.install_model:
        whisper.load_model('base', device='cpu', download_root=a.models)
        return
    if a.check:
        if a.models:
            url = whisper._MODELS['base']
            weights = Path(a.models) / url.rsplit('/', 1)[1]
            if not weights.is_file():
                raise ValueError('Doğrulanmış Whisper base modeli yok. Whisper ortamını kurun.')
            with weights.open('rb') as model_file:
                if hashlib.file_digest(model_file, 'sha256').hexdigest() != url.split('/')[-2]:
                    raise ValueError('Whisper model bütünlüğü doğrulanamadı. Ortamı yeniden kurun.')
        print('Whisper + stable-ts / PyTorch ' + torch.__version__ + ' · CPU'); return
    torch.set_num_threads(2)
    text = Path(a.script).read_text(encoding='utf-8').strip()
    model = stable_whisper.load_model('base', device='cpu', download_root=a.models)
    # The reference transcript is not provided to the recognition pass.
    heard = model.transcribe(a.audio, language='tr', fp16=False, verbose=None).text.strip()
    norm = lambda t: re.findall(r'\w+', t.replace('I','ı').replace('İ','i').lower())
    score = SequenceMatcher(None, norm(text), norm(heard)).ratio()
    if not heard or score < 0.5:
        raise ValueError('Ses, onaylı anlatımla eşleşmedi. Seslendirmeyi dinleyin veya yenileyin.')
    alignment = model.align(a.audio, text, language='tr', verbose=None)
    words = [{'text': w.word.strip(), 'start': w.start, 'end': w.end}
             for seg in alignment.segments for w in seg.words if w.word.strip()]
    if not words or norm(' '.join(w['text'] for w in words)) != norm(text):
        raise ValueError('Onaylı metnin tamamı hizalanamadı.')
    result = {'recognized': heard, 'match': score, 'words': words}
    Path(a.out).write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')


if __name__ == '__main__':
    try: main()
    except Exception as err:
        print(str(err), file=sys.stderr); sys.exit(1)
