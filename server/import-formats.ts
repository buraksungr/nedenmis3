import { Issue } from './store';
/** Only single, local media containers are accepted (never a playlist or URL). */
export function inputFormat(data: Buffer, image: boolean): string {
  const tag = (from: number, len: number) => data.toString('ascii', from, from + len);
  if (image) {
    if (data[0] === 255 && data[1] === 216 && data[2] === 255) return 'mjpeg';
    if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
      return 'png_pipe';
    if (tag(0, 4) === 'RIFF' && tag(8, 4) === 'WEBP') return 'webp_pipe';
  } else {
    if (tag(0, 4) === 'RIFF' && tag(8, 4) === 'WAVE') return 'wav';
    if (tag(0, 4) === 'fLaC') return 'flac';
    if (tag(0, 4) === 'OggS') return 'ogg';
    if (tag(4, 4) === 'ftyp') return 'mov';
    if (data[0] === 255 && (data[1] & 246) === 240) return 'aac';
    if (tag(0, 3) === 'ID3' || (data[0] === 255 && (data[1] & 224) === 224)) return 'mp3';
  }
  throw new Issue(
    422,
    image ? 'JPEG, PNG veya WebP görseli seçin.' : 'WAV, FLAC, Ogg, MP3, AAC veya M4A sesi seçin.',
  );
}
