import {
  ink,
  dark,
  muted,
  rule,
  ease,
  seq,
  num,
  TextBlock,
  Mark,
  Specimen,
  type DiagramProps,
} from './plate-kit';
import {
  TitleHookScene,
  CycleLoopScene,
  RatioGaugeScene,
  LayerStackScene,
  WavePulseScene,
  SplitCauseEffectScene,
  TimelineScaleScene,
} from './AtlasDiagrams';
import React from 'react';
import { ScienceGlyph } from './ScienceGlyph';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { templateNames, templates, type SvgPlan, type Template } from '../shared/svg';

// All geometry is authored here. Diagrams use a 540 × 960 viewBox (2× at export).
// Frame and plan are the only inputs: no CSS clocks, random seeds, network, or injected SVG.
// A membrane (or vessel wall) rather than soil for biological sections. Particles
// travel in both directions, not to a fabricated numerical concentration scale.
function TissueSection({ plan, frame }: DiagramProps) {
  const blood = plan.icon === 'blood',
    a = plan.accentColor;
  return (
    <g>
      <rect x="36" y="307" width="468" height="342" rx="8" fill="#203B37" />
      <path
        d="M36 467Q146 436 270 472T504 469V642Q504 649 496 649H44Q36 649 36 641Z"
        fill={blood ? '#523B3C' : '#294D45'}
      />
      {seq(42).map((i) => {
        const x = 43 + i * 11,
          y = 469 + 10 * Math.sin(i / 6);
        return (
          <g key={i} stroke={a}>
            <path d={`M${x} ${y}v16m3-16v16`} strokeWidth="1.5" />
            <circle cx={x + 1} cy={y} r="3.7" fill={a} />
            <circle cx={x + 1} cy={y + 18} r="3.7" fill={a} />
          </g>
        );
      })}
      {seq(26).map((i) => {
        const x = 54 + ((i * 69 + frame * (blood ? 1.1 : 0.28)) % 424),
          y = blood
            ? 379 + ((i * 17) % 63)
            : 395 + ((((i * 31 + frame * (i % 2 ? 1.2 : -1.2)) % 213) + 213) % 213);
        return blood ? (
          <ellipse key={i} cx={x} cy={y} rx="9" ry="5" fill="#CF8980" />
        ) : (
          <circle key={i} cx={x} cy={y} r={3 + (i % 3)} fill={a} opacity=".8" />
        );
      })}
      <TextBlock x={55} y={345} text={plan.labels[0]} size={19} />
      <TextBlock x={55} y={632} text={plan.labels[1]} size={19} />
    </g>
  );
}
export function CrossSectionScene({ plan, frame, progress }: DiagramProps) {
  if (plan.icon === 'cell' || plan.icon === 'blood')
    return <TissueSection plan={plan} frame={frame} progress={progress} />;
  if (plan.icon === 'airplane')
    return (
      <g>
        <rect x="36" y="303" width="468" height="347" rx="8" fill="#1C3731" stroke={rule} />
        {seq(7).map((i) => (
          <path
            key={i}
            d={`M55 ${379 + i * 27}Q185 ${345 + i * 28} 300 ${372 + i * 27}T485 ${378 + i * 27}`}
            fill="none"
            stroke={plan.accentColor}
            opacity=".48"
            strokeDasharray="24 16"
            strokeDashoffset={-frame * 1.2}
          />
        ))}
        <path
          d="M89 493C114 419 283 440 459 493c-136-13-267 29-359 10q-15-1-11-10Z"
          fill="#435F56"
          stroke={ink}
          strokeWidth="2"
        />
        <path
          d="M161 391v30l43 30m115 109v-36l-32-24"
          fill="none"
          stroke={plan.accentColor}
          strokeWidth="2"
        />
        <TextBlock x={56} y={359} text={plan.labels[0]} maxWidth={400} />
        <TextBlock x={197} y={600} text={plan.labels[1]} maxWidth={285} />
      </g>
    );
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
      <TextBlock x={54} y={331} text={plan.labels[0]} size={17} />
      <TextBlock x={54} y={635} text={plan.labels[1]} size={17} />
    </g>
  );
}
export function ThermometerGaugeScene({ plan, progress }: DiagramProps) {
  const from = plan.fromValue ?? 0,
    to = plan.toValue ?? 0;
  const v = interpolate(ease(progress, 0.04, 0.88), [0, 1], [from, to]);
  const min = Math.min(from, to),
    max = Math.max(from, to),
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
      <TextBlock x={220} y={397} text={plan.labels[0]} size={18} maxWidth={265} />
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
      <TextBlock x={220} y={526} text={plan.labels[1]} size={16} maxWidth={265} />
      <text x="220" y="602" fontSize="25" fill={ink}>
        {num(from)}° → {num(to)}°
      </text>
    </g>
  );
}
export function FocusCalloutScene({ plan, frame, progress }: DiagramProps) {
  const a = plan.accentColor,
    [one, two] = plan.labels,
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
      <g transform="translate(193 406) scale(1.44)">
        <ScienceGlyph icon={plan.icon} accent={a} />
      </g>
      {[
        [one, 46, 332, 'M74 350H160L219 429', 'M217 419l2 10-11-3'],
        [two, 329, 634, 'M464 600H359L300 526', 'M302 537l-2-11 11 5'],
      ].map(([label, x, y, d, arrow], i) => (
        <g key={i} opacity={0.3 + 0.7 * ease(progress, i * 0.2, 0.6 + i * 0.2)}>
          <path d={String(d)} fill="none" stroke={a} strokeWidth="2" />
          <path d={String(arrow)} fill="none" stroke={a} strokeWidth="2.5" />
          <TextBlock x={Number(x)} y={Number(y)} text={String(label)} maxWidth={168} size={17} />
        </g>
      ))}
    </g>
  );
}
export function ComparisonScene({ plan, progress }: DiagramProps) {
  if (plan.fromValue === null || plan.toValue === null)
    return (
      <g>
        {plan.labels.map((label, i) => {
          const k = ease(progress, i * 0.2, 0.7 + i * 0.2),
            y = 361 + i * 148;
          return (
            <g key={i} opacity={0.24 + 0.76 * k}>
              <rect x="47" y={y} width="446" height="117" rx="8" fill="#1D3831" stroke={rule} />
              <path d={`M64 ${y + 15}v87`} stroke={i ? plan.accentColor : muted} strokeWidth="4" />
              <TextBlock x={91} y={y + 56} text={label} maxWidth={376} size={25} />
            </g>
          );
        })}
      </g>
    );
  const values = [plan.fromValue, plan.toValue],
    min = Math.min(0, ...values),
    max = Math.max(0, ...values),
    scale = (v: number) => 59 + ((v - min) / (max - min || 1)) * 420,
    zero = scale(0),
    labels = plan.labels;
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
            <TextBlock x={59} y={y - 13} text={labels[i]} maxWidth={317} size={21} />
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
  const labels = plan.labels;
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
              <TextBlock x={145} y={y + 35} text={l} maxWidth={320} size={20} />
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
  TitleHookScene,
  CycleLoopScene,
  RatioGaugeScene,
  LayerStackScene,
  WavePulseScene,
  SplitCauseEffectScene,
  TimelineScaleScene,
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
      <path d="M36 65H504" stroke={rule} />
      <rect x="36" y="33" width="9" height="9" fill={plan.accentColor} />
      <Mark x={55} y={42}>
        NEDENMİŞ / BİLİM ATLASI
      </Mark>
      <Specimen plan={plan} x={385} y={38} size={35} />
      <Mark x={416} y={42}>
        LEVHA {String(id).padStart(2, '0')}
      </Mark>
      <Mark x={36} y={110} color={plan.accentColor}>
        {templateNames[plan.template].toLocaleUpperCase('tr')}
      </Mark>
      {plan.template !== 'TitleHookScene' && (
        <TextBlock x={34} y={163} text={plan.title} maxWidth={470} size={34} weight={650} />
      )}
      <Drawing plan={plan} frame={frame} progress={progress} />
      {/* The lower safe area belongs exclusively to Film's timed caption track. */}
    </svg>
  );
}
// An incoming diagram dissolves to its opening frame, exactly matching its own clip's first frame.
export function AnimatedPlate({ plan, opening = false }: { plan: SvgPlan; opening?: boolean }) {
  const frame = useCurrentFrame(),
    { durationInFrames } = useVideoConfig();
  return <ScientificPlate plan={plan} frame={opening ? 0 : frame} frames={durationInFrames} />;
}
