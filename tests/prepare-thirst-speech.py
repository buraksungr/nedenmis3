"""Windows QA ONLY: synthesize the six matching Turkish recordings for the offline TTS transport.
No weights or runtime from this script are packaged in Studio. See tests/fixtures/README.md.
"""
import hashlib
import json
import tarfile
import urllib.request
import wave
from array import array
from pathlib import Path

import sherpa_onnx

root = Path('out/thirst-speech')
root.mkdir(parents=True, exist_ok=True)
name = 'vits-piper-tr_TR-dfki-medium'
url = f'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/{name}.tar.bz2'
archive = root / f'{name}.tar.bz2'
if not archive.is_file():
    urllib.request.urlretrieve(url, archive)
with archive.open('rb') as f:
    if hashlib.file_digest(f, 'sha256').hexdigest() != 'b63babaefcdd63202c7079aba25b72a2013825ad5895e2aeff03d1ae5a5b3bbf':
        raise ValueError('Turkish QA voice checksum mismatch')
with tarfile.open(archive) as f:
    f.extractall(root, filter='data')
voice = root / name
config = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
    vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=str(next(voice.glob('*.onnx'))),
        tokens=str(voice / 'tokens.txt'), data_dir=str(voice / 'espeak-ng-data'),
        noise_scale=0, noise_scale_w=0),
    num_threads=2, provider='cpu'))
assert config.validate()
tts = sherpa_onnx.OfflineTts(config)
for i, line in enumerate(json.loads(Path('tests/fixtures/thirst.json').read_text(encoding='utf-8'))):
    audio = tts.generate(line, sid=0, speed=0.92)
    assert len(audio.samples) > audio.sample_rate // 2
    with wave.open(str(root / f'{i}.wav'), 'wb') as f:
        f.setparams((1, 2, audio.sample_rate, 0, 'NONE', 'NONE'))
        f.writeframes(bytes(2 * (audio.sample_rate // 8)))
        f.writeframes(array('h', (round(32767 * max(-1, min(1, v))) for v in audio.samples)).tobytes())
        f.writeframes(bytes(2 * (audio.sample_rate // 4)))
(root / 'source.json').write_text(json.dumps({
    'audio': 'QA narration synthesized with Sherpa-ONNX / Piper Turkish DFKI OT, not Gemini.',
    'model': url, 'dataset': 'DFKI OT / MaryTTS',
    'attribution': 'Rhasspy/Piper; https://github.com/marytts/dfki-ot-data/',
    'license': 'CC BY-NC-SA 4.0 · https://creativecommons.org/licenses/by-nc-sa/4.0/'
}), encoding='utf-8')
