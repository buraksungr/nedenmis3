import { parseIllustration } from './server/layered-svg';

const svg = `<svg viewBox="0 0 1080 1920"><g id="set"><rect width="1080" height="1920" fill="#194057"/><path d="M0 1100Q540 980 1080 1140V1920H0Z" fill="#6c4e3f"/><circle cx="240" cy="420" r="12" data-anim="fall"/><circle cx="580" cy="340" r="9" data-anim="fall"/><circle cx="810" cy="520" r="14" data-anim="fall"/></svg>`;
console.log('SVG length:', svg.length);
console.log('Starts with <svg:', svg.startsWith('<svg'));
console.log('Ends with </svg>:', svg.endsWith('</svg>'));
try {
    const result = parseIllustration(svg);
    console.log('Parse succeeded:', !!result.drawing);
    console.log('Canonical length:', result.canonical.length);
} catch (e: any) {
    console.log('Parse failed:', e.message);
}
