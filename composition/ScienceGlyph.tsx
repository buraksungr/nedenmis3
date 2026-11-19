import type { ScienceIcon } from '../shared/svg';

/** Authored 100 × 100 field specimens. Only the enum and a validated solid colour enter this SVG. */
export function ScienceGlyph({ icon, accent }: { icon: ScienceIcon; accent: string }) {
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
  };
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
