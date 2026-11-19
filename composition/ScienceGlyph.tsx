import type { ScienceIcon } from '../shared/svg';

/** Authored 100 × 100 field specimens. Only the enum and a validated solid colour enter this SVG. */
const figures = {
  cell: (
    <>
      <path d="M10 49C8 29 24 13 45 16S89 23 91 47 74 84 49 85 12 72 10 49Z" />
      <path d="M16 48C15 31 29 20 45 22S81 28 84 48 67 78 48 79 17 66 16 48Z" opacity=".55" />
      <ellipse cx="47" cy="48" rx="16" ry="13" />
      <circle cx="50" cy="47" r="5" fill="currentColor" />
      <path d="M25 58q8-8 13 4m21 3q6-8 12-3m-6-26 5 4" />
    </>
  ),
  water: (
    <>
      <path d="M50 7C44 22 20 45 20 61a30 30 0 0 0 60 0C80 44 59 22 50 7Z" />
      <path d="M30 59q0 15 14 18" />
    </>
  ),
  blood: (
    <>
      <path d="M49 8C43 24 20 44 20 62a30 30 0 1 0 60 0C80 44 58 24 49 8Z" />
      <ellipse cx="49" cy="61" rx="18" ry="11" transform="rotate(-22 49 61)" />
      <path d="M40 63q9 3 18-6" />
    </>
  ),
  brain: (
    <>
      <path d="M49 21q-13-15-22 0-15 0-14 14-13 8-4 22-4 14 9 18 5 15 19 10 9 6 12-5Zm3 0q14-15 22 0 16 1 13 15 14 7 6 21 3 13-10 18-3 14-17 10-10 6-14-5Z" />
      <path d="M26 23q-2 9 7 12m-20 9q10-7 18 3m-13 26q0-12 11-14m12 7q-10-9-4-18m35-26q2 9-7 13m20 9q-11-6-17 4m13 25q0-11-11-14m-12 7q10-8 6-18" />
    </>
  ),
  molecule: (
    <>
      <path d="m25 26 23 23 27-20M48 49l13 29M48 49 18 67" fill="none" />
      <circle cx="24" cy="24" r="11" />
      <circle cx="48" cy="49" r="15" />
      <circle cx="78" cy="26" r="11" />
      <circle cx="63" cy="81" r="9" />
      <circle cx="16" cy="69" r="7" />
    </>
  ),
  leaf: (
    <>
      <path d="M18 74Q8 23 83 12q6 63-38 70-17 4-27-8Z" />
      <path d="M15 89q21-37 60-67M40 57l-1-20m14 6 16-3" />
    </>
  ),
  earth: (
    <>
      <circle cx="50" cy="50" r="37" />
      <path d="m23 28 17 1 9 9-4 10-13 1 6 10 13 6-6 15-8-7-4-16-12-6m43-34-8 12 8 9 15-1 6 9m-7 6-15-1-6 11 8 12 9-2" />
    </>
  ),
  flame: (
    <>
      <path d="M45 9c6 17-14 21-12 36-6-1-9-7-8-13-24 32-6 58 24 58 34 0 45-30 24-56 1 9-3 14-8 16C71 28 54 20 45 9Z" />
      <path d="M48 52c2 9-10 14-9 23 1 9 19 11 22-1 1-7-6-11-6-17-1 5-4 8-6 8" />
    </>
  ),
  airplane: (
    <path d="M46 64 29 78v5l19-6 2 13 3-13 18 6v-5L55 64l1-18 35 13v-7L56 31c0-11-2-20-6-23-4 4-6 13-6 23L9 52v7l36-13Z" />
  ),
  sun: (
    <>
      <circle cx="50" cy="50" r="22" />
      <circle cx="50" cy="50" r="16" opacity=".35" />
      {Array.from({ length: 12 }, (_, i) => (
        <path key={i} transform={`rotate(${i * 30} 50 50)`} d="M50 8v10" />
      ))}
    </>
  ),
  snowflake: (
    <>
      {Array.from({ length: 6 }, (_, i) => (
        <path
          key={i}
          transform={`rotate(${i * 60} 50 50)`}
          fill="none"
          d="M50 50V9m0 16-9-8m9 8 9-8m-9 20-13-9m13 9 13-9"
        />
      ))}
    </>
  ),
  ant: (
    <>
      <path
        fill="none"
        d="m46 48-16-14-4-12m17 30-21-1-8 9m30-6-15 14-3 10m28-30 15-11 12 1m-27 15 18 3 8 11m-28-9 13 18v9m-8-53-2-14 6-8m7 25 13-9 1-9"
      />
      <ellipse cx="37" cy="64" rx="16" ry="12" transform="rotate(-40 37 64)" />
      <ellipse cx="50" cy="49" rx="8" ry="12" transform="rotate(45 50 49)" />
      <ellipse cx="62" cy="34" rx="12" ry="10" transform="rotate(-38 62 34)" />
    </>
  ),
  eye: (
    <>
      <path d="M7 50Q45-5 93 50 48 104 7 50Z" />
      <circle cx="50" cy="50" r="19" />
      <circle cx="50" cy="50" r="8" fill="currentColor" />
      <circle cx="55" cy="45" r="3" fill="#1D3831" stroke="none" />
    </>
  ),
  heart: (
    <>
      <path d="M49 88C39 78 9 59 10 36c1-23 31-30 40-7 12-23 40-16 41 7 1 19-24 41-42 52Z" />
      <path fill="none" d="M18 51h16l7-12 10 26 9-20 6 7h15" />
    </>
  ),
  atom: (
    <>
      {[0, 60, 120].map((r) => (
        <ellipse
          key={r}
          cx="50"
          cy="50"
          rx="43"
          ry="15"
          fill="none"
          transform={`rotate(${r} 50 50)`}
        />
      ))}
      <circle cx="50" cy="50" r="6" fill="currentColor" />
      <circle cx="90" cy="45" r="4" />
    </>
  ),
  soundwave: (
    <>
      {[10, 22, 38, 62, 80, 54, 34, 19, 8].map((h, i) => (
        <path key={i} d={`M${10 + i * 10} ${50 - h / 2}v${h}`} strokeWidth="5" />
      ))}
    </>
  ),
  shield: (
    <>
      <path d="M50 8c11 8 22 13 36 15v23c0 19-13 36-36 47-24-12-36-29-36-47V23c15-2 24-7 36-15Z" />
      <path d="M50 18q11 8 27 12v17q-2 20-27 36Z" opacity=".45" />
      <path d="m32 48 13 13 23-26" fill="none" />
    </>
  ),
  clock: (
    <>
      <circle cx="50" cy="51" r="38" />
      <path d="M50 22v5m0 48v5M21 51h5m49 0h5M50 32v20l15 9" />
      <circle cx="50" cy="51" r="3" fill="currentColor" />
    </>
  ),
  globe: (
    <>
      <circle cx="50" cy="50" r="39" />
      <g fill="none">
        <ellipse cx="50" cy="50" rx="18" ry="39" />
        <path d="M11 50h78M17 29q33 14 66 0M17 71q33-14 66 0M50 11v78" />
      </g>
    </>
  ),
  lightning: (
    <>
      <path d="M61 6 21 58h25l-8 36 43-57H54Z" />
      <path d="m23 23-8-7m65 55 7 7m-69-5-7 4" />
    </>
  ),
} satisfies Record<ScienceIcon, React.ReactNode>;
export function ScienceGlyph({ icon, accent }: { icon: ScienceIcon; accent: string }) {
  return (
    <g
      data-science-icon={icon}
      color={accent}
      fill="#1D3831"
      stroke="currentColor"
      strokeWidth="3.3"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {figures[icon]}
    </g>
  );
}
