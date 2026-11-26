// Locally authored QA illustration, not a model response or a topic-specific production template.
// Front view has lids, sclera, radial iris fibres and pupil; side view has cornea, lens,
// retina and incoming light rays. Used to inspect actual encoded transition pixels offline.
const outer = `<defs><radialGradient id="sclera"><stop stop-color="#ffffff"/><stop offset="1" stop-color="#b7d5dd"/></radialGradient><radialGradient id="iris"><stop stop-color="#9eebd9"/><stop offset="1" stop-color="#27909d"/></radialGradient></defs>`;
const moving = `<circle cx="120" cy="1040" r="13" fill="#ffe8a0" data-anim="rise" data-dy="60" data-duration="3"/><circle cx="850" cy="1000" r="12" fill="#86e3ee" data-anim="wiggle" data-angle="12"/><circle cx="950" cy="1150" r="10" fill="#ffe8a0" data-anim="fall" data-dy="60" data-duration="4"/>`;
const start = (bg: string, label: string) =>
  `<svg viewBox="0 0 1080 1920">${outer}<g id="layer-bg"><rect width="1080" height="1920" fill="${bg}"/></g><g id="layer-fx">${moving}<text data-keyword="true" x="80" y="220" font-size="40" fill="#fff">${label}</text></g><g id="layer-main">`;
const end = '</g></svg>';
export const eyeArt = [
  start('#101728', 'İris') +
    `<path d="M100 630C240 380 840 380 980 630C840 880 240 880 100 630Z" fill="#c78077" stroke="#f3cbb0" stroke-width="16"/>` +
    `<path d="M130 630C265 448 815 448 950 630C815 812 265 812 130 630Z" fill="url(#sclera)" stroke="#b4e0e3" stroke-width="8"/>` +
    `<path d="M540 460A170 170 0 1 0 540 800A170 170 0 1 0 540 460Z" fill="url(#iris)" stroke="#236578" stroke-width="9"/>` +
    `<path d="M540 478V552M602 490L575 560M654 522L603 574M680 580L610 606M692 630H614M680 682L610 654M654 738L603 686M602 772L575 700M540 782V708M478 772L505 700M426 738L477 686M400 682L470 654M388 630H466M400 580L470 606M426 522L477 574M478 490L505 560" fill="none" stroke="#b5f2dc" stroke-width="8" stroke-linecap="round"/>` +
    `<path d="M540 554A76 76 0 1 0 540 706A76 76 0 1 0 540 554Z" fill="#142736" stroke="#e8fbef" stroke-width="5"/>` +
    `<path d="M495 602Q500 577 526 570" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round"/>` +
    `<path d="M118 630C265 404 815 404 962 630M118 630C265 850 815 850 962 630" fill="none" stroke="#f6c4aa" stroke-width="18"/>` +
    end,
  start('#10203a', 'Retina') +
    `<path d="M180 650C205 390 580 360 775 460C900 525 926 775 775 870C585 985 205 930 180 650Z" fill="#dcefed" stroke="#b9e9f2" stroke-width="12"/>` +
    `<path d="M186 475Q55 650 186 835Q250 745 250 650Q250 550 186 475Z" fill="#93d9e6" stroke="#e9fbff" stroke-width="9"/>` +
    `<path d="M416 485C337 555 337 745 416 815C495 745 495 555 416 485Z" fill="#8dd8d1" stroke="#e5fff1" stroke-width="9"/>` +
    `<path d="M752 470C890 525 900 775 752 864" fill="none" stroke="#e98f80" stroke-width="30" stroke-linecap="round"/>` +
    `<path d="M767 482C863 540 873 755 767 852" fill="none" stroke="#ffe2a2" stroke-width="8"/>` +
    `<path d="M824 626Q918 610 995 650Q925 692 824 678Z" fill="#eeb59b" stroke="#f7dbb6" stroke-width="8"/>` +
    `<path d="M55 535L180 535L365 580L830 650M55 760L180 760L365 720L830 650" fill="none" stroke="#ffdf72" stroke-width="9" stroke-linecap="round"/>` +
    `<path d="M65 650H830" fill="none" stroke="#fff6c5" stroke-width="6" stroke-linecap="round"/>` +
    end,
];
