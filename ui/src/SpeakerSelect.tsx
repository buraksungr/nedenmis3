import { speakers, type Speaker } from '../../shared/speakers';

export function SpeakerSelect({
  voice,
  onChange,
  disabled,
}: {
  voice: Speaker;
  onChange: (voice: Speaker) => void;
  disabled?: boolean;
}) {
  return (
    <label className="speaker-select">
      Konuşmacı (Speaker) seçimi
      <select
        value={voice}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as Speaker)}
      >
        {speakers.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
