"""Exact acoustic timing only. The caller handles sentence-based fallback separately."""
import argparse
import hashlib
import json
import re
import sys
from contextlib import contextmanager
from difflib import SequenceMatcher
from pathlib import Path
from shutil import which


@contextmanager
def stage(name):
    try:
        yield
    except Exception as err:
        raise RuntimeError(f'{name}: {type(err).__name__}: {err}') from err


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--check', action='store_true')
    p.add_argument('--install-model', action='store_true')
    for arg in ('audio', 'script', 'out', 'models'):
        p.add_argument('--' + arg)
    a = p.parse_args()
    with stage('Whisper ortamı'):
        import torch, whisper, stable_whisper
    if a.install_model:
        whisper.load_model('base', device='cpu', download_root=a.models)
        return
    url = whisper._MODELS['base']
    weights = Path(a.models) / url.rsplit('/', 1)[1]
    if not weights.is_file():
        raise FileNotFoundError(f'Whisper base modeli bulunamadı: {weights}. Whisper ortamını kurun.')
    with weights.open('rb') as model_file:
        if hashlib.file_digest(model_file, 'sha256').hexdigest() != url.split('/')[-2]:
            raise ValueError(f'Whisper model bütünlüğü doğrulanamadı: {weights}. Ortamı yeniden kurun.')
    if a.check:
        print('Whisper + stable-ts / PyTorch ' + torch.__version__ + ' · CPU')
        return
    torch.set_num_threads(2)
    text = Path(a.script).read_text(encoding='utf-8').strip()
    with stage('Yerel model yükleme'):
        # Only use the named, verified local model (including its calibrated alignment heads).
        model = stable_whisper.load_model('base', device='cpu', download_root=a.models)
    decoder = which('ffmpeg') or 'PATH üzerinde bulunamadı'
    with stage(f'Ses çözme / Türkçe transkripsiyon (FFmpeg: {decoder})'):
        heard = model.transcribe(a.audio, language='tr', fp16=False, verbose=None).text.strip()
    def norm(t):
        return re.findall(r'\w+', t.replace('I', 'ı').replace('İ', 'i').lower())
    score = SequenceMatcher(None, norm(text), norm(heard)).ratio()
    if not heard or score < 0.5:
        raise ValueError(f'Ses ve onaylı anlatım eşleşmedi (benzerlik={score:.2f}, alt sınır=0.50).')
    with stage('Zorlanmış sözcük hizalaması'):
        alignment = model.align(a.audio, text, language='tr', verbose=None)
        words = [{'text': w.word.strip(), 'start': w.start, 'end': w.end}
                 for seg in alignment.segments for w in seg.words if w.word.strip()]
        if not words or norm(' '.join(w['text'] for w in words)) != norm(text):
            raise ValueError(f'Onaylı metnin tamamı hizalanamadı ({len(words)} kayıt).')
    with stage('Hizalama JSON çıktısı'):
        result = {'recognized': heard, 'match': score, 'words': words}
        Path(a.out).write_text(json.dumps(result, ensure_ascii=False, allow_nan=False), encoding='utf-8')


if __name__ == '__main__':
    try:
        main()
    except Exception as err:
        print(f'{type(err).__name__}: {err}', file=sys.stderr)
        sys.exit(1)
