import React from 'react';
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { templateNames, templates, type SvgPlan, type Template } from '../shared/svg';

// All geometry is authored here. Diagrams use a 540 × 960 viewBox (2× at export).
// Frame and plan are the only inputs: no CSS clocks, random seeds, network, or injected SVG.
type DiagramProps = { plan: SvgPlan; frame: number; progress: number };
const ink = '#EDF5EE',
  muted = '#A7BAB2',
  rule = '#3A534C',
  dark = '#112721';
const ease = (x: number, l = 0, r = 1) =>
  interpolate(x, [l, r], [0, 1], {
    easing: Easing.inOut(Easing.sin),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
const seq = (n: number) => Array.from({ length: n }, (_, i) => i);
const num = (v: number) =>
  new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 1,
    notation: Math.abs(v) >= 10000 ? 'compact' : 'standard',
  }).format(Math.abs(v) < 0.05 ? 0 : v);
function lines(value: string, width: number, count: number) {
  const result: string[] = [];
  let row = '';
  for (const word of value.trim().split(/\s+/u)) {
    if (!word) continue;
    if (row && (row + ' ' + word).length > width) {
      result.push(row);
      row = '';
    }
    if (word.length > width) {
      if (row) {
        result.push(row);
        row = '';
      }
      for (let i = 0; i < word.length; i += width) {
        if (i + width < word.length) result.push(word.slice(i, i + width));
        else row = word.slice(i);
      }
    } else row = row ? row + ' ' + word : word;
  }
  if (row) result.push(row);
  if (result.length > count) result[count - 1] = result[count - 1].slice(0, width - 1) + '…';
  return result.slice(0, count);
}
function TextBlock({
  text,
  x,
  y,
  width = 35,
  rows = 2,
  size = 18,
  color = ink,
  weight = 400,
}: {
  text: string;
  x: number;
  y: number;
  width?: number;
  rows?: number;
  size?: number;
  color?: string;
  weight?: number;
}) {
  return (
    <text x={x} y={y} fill={color} fontSize={size} fontWeight={weight}>
      {lines(text, width, rows).map((l, i) => (
        <tspan key={i} x={x} dy={i ? size * 1.22 : 0}>
          {l}
        </tspan>
      ))}
    </text>
  );
}
function Mark({
  x,
  y,
  children,
  color = muted,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <text x={x} y={y} fill={color} fontSize="12" fontFamily="monospace" letterSpacing="1.2">
      {children}
    </text>
  );
}
const parts = (plan: SvgPlan, defaults: string[]) => {
  const labels = plan.subtitle.split('|').map((s) => s.trim());
  return labels.length === defaults.length && labels.every(Boolean) ? labels : defaults;
};

export function CrossSectionScene({ plan, frame, progress }: DiagramProps) {
  const a = plan.accentColor,
    grow = ease(progress, 0, 0.78);
  return (
    <g>
      <rect x="36" y="300" width="468" height="352" rx="8" fill="#213F39" />
      <circle cx="411" cy="366" r="24" fill="#D4DFC0" opacity="0.72" />
      <path
        d="M36 446 Q130 405 224 438 T405 433 Q460 412 504 429 V645 Q504 652 496 652 H44 Q36 652 36 645Z"
        fill="#533F35"
      />
      <path d="M36 486 Q165 451 274 484 T504 472 V517 Q352 545 244 520 T36 524Z" fill="#725744" />
      <path d="M36 571 Q139 530 257 564 T504 548 V591 Q371 617 242 584 T36 599Z" fill="#344A42" />
      <path
        d="M36 446 Q130 405 224 438 T405 433 Q460 412 504 429"
        fill="none"
        stroke={a}
        strokeWidth="5"
      />
      {seq(35).map((i) => (
        <circle
          key={i}
          cx={49 + ((i * 71) % 436)}
          cy={475 + ((i * 27) % 160)}
          r={(i % 3) + 1}
          fill="#D3B599"
          opacity="0.28"
        />
      ))}
      <g fill="none" stroke={a} strokeLinecap="round">
        {[
          'M211 434 Q242 462 226 497 T252 567 Q266 599 247 628',
          'M229 480 Q200 484 180 510 T145 539',
          'M233 528 Q272 513 289 491 T333 477',
          'M250 566 Q222 559 204 589',
        ].map((d, i) => (
          <path
            key={d}
            d={d}
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset={1 - grow}
            strokeWidth={i ? 3 : 5}
          />
        ))}
      </g>
      {plan.weather !== 'none' &&
        seq(31).map((i) => {
          const x = 49 + ((i * 43) % 438),
            y = 314 + ((i * 19 + frame * (plan.weather === 'rain' ? 3.5 : 1.2)) % 112);
          return plan.weather === 'snow' ? (
            <circle
              key={i}
              cx={x + 4 * Math.sin((frame + i) / 15)}
              cy={y}
              r={1.7 + (i % 2)}
              fill={ink}
            />
          ) : (
            <path key={i} d={`M${x} ${y}l-3 8`} stroke="#ACDEED" strokeWidth="2" />
          );
        })}
      <Mark x={54} y={328}>
        ORTAM / {plan.weather === 'snow' ? 'KAR' : plan.weather === 'rain' ? 'YAĞMUR' : 'AÇIK'}
      </Mark>
      <Mark x={52} y={634} color="#E8D7C6">
        ALT KATMAN
      </Mark>
    </g>
  );
}
export function ThermometerGaugeScene({ plan, progress }: DiagramProps) {
  const v = interpolate(ease(progress, 0.04, 0.88), [0, 1], [plan.fromValue, plan.toValue]);
  const min = Math.min(plan.fromValue, plan.toValue),
    max = Math.max(plan.fromValue, plan.toValue),
    pad = Math.max(1, (max - min) * 0.15);
  const y = interpolate(v, [min - pad, max + pad], [604, 349]);
  return (
    <g>
      <rect
        x="72"
        y="321"
        width="79"
        height="325"
        rx="39"
        fill="#1B3730"
        stroke={rule}
        strokeWidth="2"
      />
      <path d="M111 354V606" stroke="#39534B" strokeWidth="15" strokeLinecap="round" />
      <path d={`M111 604V${y}`} stroke={plan.accentColor} strokeWidth="15" strokeLinecap="round" />
      <circle cx="111" cy="610" r="20" fill={plan.accentColor} />
      {seq(13).map((i) => (
        <line
          key={i}
          x1="158"
          x2={i % 3 === 0 ? 184 : 171}
          y1={351 + i * 21}
          y2={351 + i * 21}
          stroke={muted}
          strokeWidth={i % 3 === 0 ? 2 : 1}
        />
      ))}
      <Mark x={220} y={407}>
        ANLIK SICAKLIK
      </Mark>
      <text
        x="217"
        y="473"
        fill={plan.accentColor}
        fontSize={Math.abs(v) > 999 ? 43 : 60}
        fontWeight="650"
      >
        {num(v)}°C
      </text>
      <line x1="220" x2="465" y1="498" y2="498" stroke={rule} />
      <Mark x={220} y={532}>
        BAŞLANGIÇ → BİTİŞ
      </Mark>
      <text x="220" y="566" fontSize="25" fill={ink}>
        {num(plan.fromValue)}° → {num(plan.toValue)}°
      </text>
    </g>
  );
}
export function FocusCalloutScene({ plan, frame, progress }: DiagramProps) {
  const a = plan.accentColor,
    [one, two] = parts(plan, ['İncelenen yapı', 'Odak noktası']),
    pulse = (1 - Math.cos((frame * Math.PI) / 32)) / 2;
  return (
    <g>
      <circle cx="265" cy="478" r="105" fill="#1C3731" stroke={rule} />
      <circle
        cx="265"
        cy="478"
        r={111 + 12 * pulse}
        fill="none"
        stroke={a}
        strokeWidth="3"
        opacity={0.85 - 0.5 * pulse}
      />
      <path
        d="M208 517 Q197 422 327 404 Q333 502 262 532 Q234 540 208 517Z"
        fill={a}
        opacity="0.85"
      />
      <path
        d="M202 540Q254 477 313 422M245 488l-2-38M263 469l38 1"
        fill="none"
        stroke={dark}
        strokeWidth="5"
        strokeLinecap="round"
      />
      {[
        [one, 46, 332, 'M74 350H160L219 429', 'M217 419l2 10-11-3'],
        [two, 329, 634, 'M464 600H359L300 526', 'M302 537l-2-11 11 5'],
      ].map(([label, x, y, d, arrow], i) => (
        <g key={i} opacity={0.3 + 0.7 * ease(progress, i * 0.2, 0.6 + i * 0.2)}>
          <path d={String(d)} fill="none" stroke={a} strokeWidth="2" />
          <path d={String(arrow)} fill="none" stroke={a} strokeWidth="2.5" />
          <TextBlock
            x={Number(x)}
            y={Number(y)}
            text={String(label)}
            width={16}
            rows={2}
            size={17}
          />
        </g>
      ))}
    </g>
  );
}
export function ComparisonScene({ plan, progress }: DiagramProps) {
  const values = [plan.fromValue, plan.toValue],
    min = Math.min(0, ...values),
    max = Math.max(0, ...values),
    scale = (v: number) => 59 + ((v - min) / (max - min || 1)) * 420,
    zero = scale(0),
    labels = parts(plan, ['A · İlk değer', 'B · İkinci değer']);
  return (
    <g>
      {seq(8).map((i) => (
        <line
          key={i}
          x1={59 + i * 60}
          x2={59 + i * 60}
          y1="365"
          y2="608"
          stroke={rule}
          strokeDasharray="2 8"
        />
      ))}
      {values.map((v, i) => {
        const k = ease(progress, i * 0.13, 0.75 + i * 0.13),
          end = scale(v * k),
          y = 400 + i * 128;
        return (
          <g key={i}>
            <TextBlock x={59} y={y - 13} text={labels[i]} width={24} rows={1} size={21} />
            <text x="479" y={y - 13} fill={plan.accentColor} textAnchor="end" fontSize="23">
              {num(v * k)}
            </text>
            <rect x="59" y={y} width="420" height="34" rx="4" fill="#293F39" />
            <rect
              x={Math.min(end, zero)}
              y={y}
              width={Math.abs(end - zero)}
              height="34"
              rx="3"
              fill={i ? plan.accentColor : '#B6C4BC'}
            />
          </g>
        );
      })}
      <line x1={zero} x2={zero} y1="397" y2="606" stroke={ink} opacity="0.65" />
      <Mark x={54} y={636}>
        ORTAK ÖLÇEK · {num(min)} / {num(max)}
      </Mark>
    </g>
  );
}
export function ProcessFlowScene({ plan, progress }: DiagramProps) {
  const labels = parts(plan, ['Başlangıç', 'Dönüşüm', 'Sonuç']);
  return (
    <g>
      {labels.map((l, i) => {
        const k = ease(progress, i * 0.27, 0.24 + i * 0.27),
          y = 333 + i * 112;
        return (
          <g key={i}>
            {i > 0 && (
              <g opacity={k}>
                <path
                  d={`M99 ${y - 39}v29m-6-6 6 6 6-6`}
                  fill="none"
                  stroke={plan.accentColor}
                  strokeWidth="3"
                />
              </g>
            )}
            <g opacity={0.15 + 0.85 * k}>
              <rect x="57" y={y} width="426" height="76" rx="7" fill="#1D3831" stroke={rule} />
              <circle cx="100" cy={y + 37} r="22" fill={plan.accentColor} />
              <text
                x="100"
                y={y + 44}
                textAnchor="middle"
                fill={dark}
                fontSize="18"
                fontFamily="monospace"
              >
                0{i + 1}
              </text>
              <TextBlock x={145} y={y + 35} text={l} width={23} rows={2} size={20} />
            </g>
          </g>
        );
      })}
    </g>
  );
}
const drawings: Record<Template, React.ComponentType<DiagramProps>> = {
  CrossSectionScene,
  ThermometerGaugeScene,
  FocusCalloutScene,
  ComparisonScene,
  ProcessFlowScene,
};
export function ScientificPlate({
  plan,
  frame,
  frames,
}: {
  plan: SvgPlan;
  frame: number;
  frames: number;
}) {
  const Drawing = drawings[plan.template],
    id = templates.indexOf(plan.template) + 1;
  const progress = interpolate(frame, [0, Math.max(1, frames - 1)], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  return (
    <svg
      viewBox="0 0 540 960"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={plan.title}
      style={{ display: 'block', background: dark, fontFamily: 'Arial, sans-serif' }}
    >
      <rect width="540" height="960" fill={dark} />
      <path d="M36 65H504M36 696H504" stroke={rule} />
      <rect x="36" y="33" width="9" height="9" fill={plan.accentColor} />
      <Mark x={55} y={42}>
        NEDENMİŞ / BİLİM ATLASI
      </Mark>
      <Mark x={416} y={42}>
        LEVHA 0{id}
      </Mark>
      <Mark x={36} y={110} color={plan.accentColor}>
        {templateNames[plan.template].toLocaleUpperCase('tr')}
      </Mark>
      <TextBlock x={34} y={163} text={plan.title} width={22} rows={3} size={34} weight={650} />
      <Drawing plan={plan} frame={frame} progress={progress} />
      {plan.subtitle && !plan.subtitle.includes('|') && (
        <TextBlock
          x={36}
          y={729}
          text={plan.subtitle}
          width={49}
          rows={2}
          size={16}
          color={muted}
        />
      )}
      <line x1="36" x2="504" y1="906" y2="906" stroke={rule} />
      <Mark x={36} y={930}>
        BİLİMSEL GÖRSELLEŞTİRME
      </Mark>
      <text
        x="504"
        y="930"
        textAnchor="end"
        fontFamily="monospace"
        fontSize="12"
        fill={plan.accentColor}
      >
        ŞEMA / 0{id}
      </text>
    </svg>
  );
}
// An incoming diagram dissolves to its opening frame, exactly matching its own clip's first frame.
export function AnimatedPlate({ plan, opening = false }: { plan: SvgPlan; opening?: boolean }) {
  const frame = useCurrentFrame(),
    { durationInFrames } = useVideoConfig();
  return <ScientificPlate plan={plan} frame={opening ? 0 : frame} frames={durationInFrames} />;
}
