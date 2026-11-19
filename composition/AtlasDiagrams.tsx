/** Seven deterministic field plates. Geometry uses artwork coordinates; no browser
 * clock or provider output controls SVG markup. Keep y ≥ 695 free for Film captions. */
import {
  dark,
  ease,
  ink,
  Mark,
  muted,
  rule,
  seq,
  Specimen,
  TextBlock,
  type DiagramProps,
} from './plate-kit';
const tau = 2 * Math.PI;
const fmt = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 6 });

export function TitleHookScene({ plan, frame, progress }: DiagramProps) {
  const a = plan.accentColor;
  return (
    <g>
      <rect x="36" y="201" width="468" height="451" rx="8" fill="#1A342D" stroke={rule} />
      {seq(48).map((i) => (
        <circle
          key={i}
          cx={48 + ((i * 101 + frame * (0.2 + (i % 4) * 0.14)) % 442)}
          cy={221 + ((i * 47) % 405) + 3 * Math.sin((frame + i) / 19)}
          r={1 + (i % 3)}
          fill={a}
          opacity={0.12 + (i % 5) * 0.07}
        />
      ))}
      <path d="M54 235h34m-34 0v17m398 376h34v-17" stroke={a} fill="none" strokeWidth="2" />
      <g transform={`translate(0 ${6 * (1 - ease(progress, 0, 0.3))})`}>
        <TextBlock x={55} y={298} text={plan.title} maxWidth={426} size={45} weight={700} />
      </g>
      <g fill="none" stroke={a}>
        <ellipse cx="318" cy="503" rx="135" ry="48" transform="rotate(-19 318 503)" opacity=".4" />
        <circle
          cx="318"
          cy="503"
          r="83"
          strokeDasharray="2 8"
          transform={`rotate(${frame * 0.35} 318 503)`}
        />
        <circle
          cx={318 + 83 * Math.cos(frame * 0.026)}
          cy={503 + 83 * Math.sin(frame * 0.026)}
          r="5"
          fill={a}
        />
      </g>
      <circle cx="318" cy="503" r="66" fill={dark} stroke={rule} />
      <Specimen plan={plan} x={318} y={503} size={93} />
      <path d="M55 602h39" stroke={a} strokeWidth="3" />
      <TextBlock x={55} y={630} size={16} maxWidth={391} text={plan.labels[0]} />
    </g>
  );
}
export function CycleLoopScene({ plan, frame, progress }: DiagramProps) {
  const n = plan.labels.length,
    cx = 270,
    cy = 465,
    rx = 147,
    ry = 112,
    a = plan.accentColor;
  const point = (t: number) => [cx + rx * Math.cos(t), cy + ry * Math.sin(t)];
  const phase = -Math.PI / 2 + frame * 0.036,
    [bx, by] = point(phase),
    [tx, ty] = point(phase - Math.PI * 0.6);
  const active = Math.round((frame * 0.036 * n) / tau) % n;
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={rule} strokeWidth="4" />
      <path
        d={`M${tx} ${ty}A${rx} ${ry} 0 0 1 ${bx} ${by}`}
        stroke={a}
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx - 12}
        ry={ry - 12}
        fill="none"
        stroke={a}
        strokeDasharray="2 9"
        opacity=".48"
      />
      <circle cx={cx} cy={cy} r="46" fill="#1E3932" />
      <Specimen plan={plan} x={cx} y={cy} size={63} />
      {plan.labels.map((label, i) => {
        const angle = -Math.PI / 2 + (tau * i) / n,
          [x, y] = point(angle),
          m = angle + Math.PI / n,
          [u, v] = point(m),
          rot = (Math.atan2(ry * Math.cos(m), -rx * Math.sin(m)) * 180) / Math.PI;
        return (
          <g key={i}>
            <path
              d="m-6-5 8 5-8 5"
              transform={`translate(${u} ${v}) rotate(${rot})`}
              fill="none"
              stroke={a}
              strokeWidth="2.5"
            />
            <circle
              cx={x}
              cy={y}
              r="20"
              stroke={a}
              strokeWidth="2"
              fill={active === i ? a : dark}
            />
            <text
              x={x}
              y={y + 5}
              textAnchor="middle"
              fontSize="15"
              fontFamily="monospace"
              fill={active === i ? dark : ink}
            >
              0{i + 1}
            </text>
            <TextBlock
              x={x}
              y={y + 37}
              text={label}
              anchor="middle"
              size={16}
              maxWidth={n === 3 ? 166 : 153}
              weight={550}
            />
          </g>
        );
      })}
      <circle cx={bx} cy={by} r={5 + ease(progress, 0, 0.3) * 2} fill={a} />
    </g>
  );
}
export function RatioGaugeScene({ plan, progress }: DiagramProps) {
  const a = plan.accentColor,
    p = ease(progress, 0, 0.82),
    v = plan.toValue ?? 0,
    percent = plan.unit === '%';
  return (
    <g>
      <circle cx="270" cy="454" r="129" fill="#1A342E" stroke={rule} />
      {seq(60).map((i) => (
        <path
          key={i}
          transform={`rotate(${i * 6} 270 454)`}
          d={`M270 328v${i % 5 === 0 ? 9 : 4}`}
          stroke={muted}
          opacity=".6"
        />
      ))}
      {percent ? (
        <g fill="none" strokeWidth="13" transform="rotate(-90 270 454)">
          <circle cx="270" cy="454" r="97" stroke={rule} />
          <circle
            cx="270"
            cy="454"
            r="97"
            pathLength="100"
            stroke={a}
            strokeDasharray={`${v * p} 101`}
          />
        </g>
      ) : (
        [83, 95, 107].map((r, i) => (
          <circle
            key={r}
            cx="270"
            cy="454"
            r={r}
            pathLength="100"
            fill="none"
            stroke={a}
            opacity={0.4 + i * 0.2}
            strokeWidth="3"
            strokeDasharray={`${70 * p} 100`}
            transform={`rotate(${-90 + i * 80} 270 454)`}
          />
        ))
      )}
      <TextBlock
        text={`${percent ? '%' : ''}${fmt(v)}${percent ? '' : '×'}`}
        x={270}
        y={472}
        anchor="middle"
        size={46}
        weight={650}
        maxWidth={163}
      />
      <Mark x={percent ? 239 : 233} y={612}>
        {percent ? 'YÜZDE' : 'ÇARPAN'}
      </Mark>
      <TextBlock x={270} y={648} text={plan.labels[0]} anchor="middle" maxWidth={443} size={24} />
    </g>
  );
}
export function LayerStackScene({ plan, progress }: DiagramProps) {
  const n = plan.labels.length,
    a = plan.accentColor;
  return (
    <g>
      <path d="M154 304v330" stroke={rule} strokeDasharray="4 7" />
      {plan.labels.map((label, i) => {
        const y = 353 + i * (231 / (n - 1)),
          k = ease(progress, i * 0.08, 0.72 + i * 0.08),
          dy = (1 - k) * 17;
        return (
          <g key={i}>
            <g transform={`translate(0 ${dy})`}>
              <path
                d={`M43 ${y}l107-31 118 23-108 34Z`}
                fill={['#41685A', '#52634D', '#695647', '#40575C'][i]}
                stroke={a}
              />
              <path d={`M43 ${y}l117 26 108-34v15l-108 35-117-27Z`} fill="#233831" stroke={rule} />
              <path d={`M160 ${y + 26}v15`} stroke={a} opacity=".5" />
            </g>
            <path d={`M267 ${y - 8 + dy}l16 ${-dy}h15`} fill="none" stroke={a} />
            <circle cx="299" cy={y - 8} r="2.5" fill={a} />
            <Mark x={310} y={y - 16} color={a}>
              KATMAN 0{i + 1}
            </Mark>
            <TextBlock x={310} y={y + 9} text={label} size={17} maxWidth={187} />
          </g>
        );
      })}
    </g>
  );
}
export function WavePulseScene({ plan, frame }: DiagramProps) {
  const a = plan.accentColor,
    y = 462;
  const wave = (phase: number, height: number) =>
    seq(151)
      .map((i) => {
        const t = i / 150;
        return `${i ? 'L' : 'M'}${85 + t * 370} ${y + Math.sin(t * tau * 3.2 - frame * 0.105 + phase) * Math.sin(t * Math.PI) * height}`;
      })
      .join(' ');
  return (
    <g>
      <rect x="36" y="310" width="468" height="309" rx="8" fill="#19342D" stroke={rule} />
      {seq(11).map((i) => (
        <path key={i} d={`M${60 + i * 42} 354v210`} stroke={rule} strokeDasharray="2 7" />
      ))}
      <path d={`M62 ${y}h415`} stroke={muted} opacity=".5" />
      <path d={wave(0.88, 43)} stroke={a} opacity=".3" fill="none" strokeWidth="2" />
      <path d={wave(0, 66)} stroke={a} fill="none" strokeWidth="4" />
      {[85, 455].map((x) => (
        <g key={x}>
          <circle cx={x} cy={y} r="13" stroke={a} fill={dark} />
          <circle cx={x} cy={y} r="4" fill={a} />
        </g>
      ))}
      <Mark x={55} y={341} color={a}>
        DALGA YAYILIMI
      </Mark>
      <path d="M393 337h72l-9-5m9 5-9 5" stroke={a} fill="none" />
      <TextBlock x={55} y={579} size={17} text={plan.labels[0]} maxWidth={200} />
      <TextBlock x={485} y={579} anchor="end" size={17} text={plan.labels[1]} maxWidth={200} />
    </g>
  );
}
export function SplitCauseEffectScene({ plan, frame, progress }: DiagramProps) {
  const a = plan.accentColor,
    k = ease(progress, 0.12, 0.79);
  return (
    <g>
      {plan.labels.map((label, i) => {
        const x = i ? 287 : 36,
          cx = x + 108;
        return (
          <g key={i}>
            <rect
              x={x}
              y="328"
              width="217"
              height="316"
              rx="8"
              fill={i ? '#203C34' : '#1A332D'}
              stroke={rule}
            />
            <path d={`M${x + 16} 357h23`} stroke={i ? a : muted} strokeWidth="3" />
            <Mark x={x + 48} y={361} color={i ? a : muted}>
              {i ? 'ETKİ' : 'NEDEN'}
            </Mark>
            {i ? (
              <g fill="none" stroke={a}>
                {seq(4).map((j) => (
                  <circle
                    key={j}
                    cx={cx}
                    cy="457"
                    r={9 + (j + (frame % 40) / 40) * 12}
                    opacity={0.86 - j * 0.17}
                  />
                ))}
              </g>
            ) : (
              <Specimen plan={plan} x={cx} y={457} size={79} />
            )}
            <path d={`M${x + 18} 534h181`} stroke={rule} />
            <TextBlock x={x + 18} y={574} size={20} maxWidth={181} weight={550} text={label} />
          </g>
        );
      })}
      <g transform={`translate(${k * 7} 0)`}>
        <circle cx="267" cy="457" r="27" fill={dark} stroke={a} />
        <path d="M253 457h27m-10-10 10 10-10 10" fill="none" stroke={a} strokeWidth="3" />
      </g>
    </g>
  );
}
export function TimelineScaleScene({ plan, progress }: DiagramProps) {
  const { unit, fromValue, toValue, midValue, accentColor: a } = plan,
    ordered = unit === 'sıra';
  const stops = [fromValue ?? 0, midValue ?? 1, toValue ?? 2],
    up = ['m', 'km', 'cm'].includes(unit ?? '') && stops[2] > stops[0];
  const pos = (t: number) => (up ? 594 - 246 * t : 348 + 246 * t);
  const x = 116,
    k = ease(progress, 0, 0.85);
  return (
    <g>
      <rect x="36" y="300" width="468" height="362" rx="8" fill="#19332D" stroke={rule} />
      {seq(25).map((i) => (
        <path
          key={i}
          d={`M${x - (i % 4 === 0 ? 25 : 13)} ${pos(i / 24)}H${x - 4}`}
          stroke={muted}
        />
      ))}
      <path d={`M${x} ${pos(0)}V${pos(1)}`} stroke={rule} strokeWidth="5" />
      <path d={`M${x} ${pos(0)}V${pos(k)}`} stroke={a} strokeWidth="5" />
      {plan.labels.map((label, i) => {
        const fraction = (stops[i] - stops[0]) / (stops[2] - stops[0] || 1),
          y = pos(fraction),
          row = pos(i / 2);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="7" fill={dark} stroke={a} strokeWidth="2" />
            <path d={`M${x + 9} ${y}h21L177 ${row}h18`} fill="none" stroke={rule} />
            <Mark x={207} y={row - 5} color={a}>
              {ordered ? `EVRE 0${i + 1}` : `${fmt(stops[i])} ${unit}`}
            </Mark>
            <TextBlock x={207} y={row + 23} size={19} maxWidth={279} text={label} />
          </g>
        );
      })}
      <circle cx={x} cy={pos(k)} r="4" fill={ink} />
    </g>
  );
}
