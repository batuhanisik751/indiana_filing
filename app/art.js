// Pictures: line icons and the first screen's drawing. Inline SVG, so nothing is fetched from another site.
// They are decoration only: every place that shows one hides it from screen readers.
const ICON_PATHS = {
  card: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
  scale: '<path d="M12 4v16M8 20h8M5 7h14"/><path d="M4 13l3-6 3 6M4 13a3 3 0 0 0 6 0M14 13l3-6 3 6M14 13a3 3 0 0 0 6 0"/>',
  house: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  car: '<path d="M3 16.5v-3.5l2.5-5.5h13L21 13v3.5z"/><path d="M3 13h18"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  dots: '<circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/>',
  question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5v.4"/><path d="M12 16.8h.01"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  badge: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M7.5 17.5a4.5 4.5 0 0 1 9 0"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1.1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5V8M12 16v1.5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M9 15.5h6m-2-2 2 2-2 2"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  send: '<path d="M21 3 3 10.5l7 3 3 7.5z"/><path d="M10 13.5 21 3"/>',
  pen: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  court: '<path d="M3 9.5 12 4l9 5.5"/><path d="M4 21h16M5 18h14M6.5 10.5v7M10 10.5v7M14 10.5v7M17.5 10.5v7"/>',
};
const icon = name => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON_PATHS[name] || ICON_PATHS.doc}</svg>`;

// Which picture goes with each choice and each section of a form.
const KIND_ICONS = { debt: "card", smallclaims: "scale", eviction: "house", tort: "car", plenary: "doc" };
const SITUATION_ICONS = { respond: "chat", appearance: "badge", feewaiver: "coin", continuance: "calendar" };
const SECTION_ICONS = { "Your case": "folder", "About you": "person", "How the court reaches you": "mail", "Your answer": "chat", "Sending a copy": "send",
  "Signing": "pen", "Your household": "house", "Income": "coin", "Expenses": "receipt", "Your request": "calendar" };

// The first screen's drawing: a filled-in form with a check mark, in front of a courthouse.
const HERO_ART = `<svg class="hero-svg" viewBox="0 0 420 300" aria-hidden="true" focusable="false">
  <path class="art-soft" d="M52 162c-6-74 58-128 158-130s166 44 162 124-74 126-166 128S58 236 52 162z"/>
  <g class="art-house">
    <path d="M246 112 320 74l74 38z"/>
    <rect x="252" y="112" width="136" height="8" rx="2"/>
    <rect x="262" y="124" width="14" height="72" rx="3"/><rect x="292" y="124" width="14" height="72" rx="3"/>
    <rect x="334" y="124" width="14" height="72" rx="3"/><rect x="364" y="124" width="14" height="72" rx="3"/>
    <rect x="246" y="198" width="148" height="10" rx="2"/><rect x="238" y="210" width="164" height="10" rx="2"/>
  </g>
  <rect class="art-paper" x="92" y="62" width="156" height="200" rx="12"/>
  <rect class="art-accent" x="112" y="86" width="84" height="12" rx="6"/>
  <rect class="art-text" x="112" y="116" width="116" height="7" rx="3.5"/>
  <rect class="art-text" x="112" y="132" width="98" height="7" rx="3.5"/>
  <rect class="art-text" x="112" y="148" width="108" height="7" rx="3.5"/>
  <rect class="art-box" x="112" y="174" width="14" height="14" rx="3"/><rect class="art-text" x="134" y="177.5" width="70" height="7" rx="3.5"/>
  <rect class="art-box" x="112" y="198" width="14" height="14" rx="3"/><rect class="art-text" x="134" y="201.5" width="56" height="7" rx="3.5"/>
  <path class="art-tick" d="M115 181.5l3.5 3.5 6-7"/>
  <g transform="rotate(-48 300 214)">
    <rect class="art-accent" x="262" y="207" width="74" height="14" rx="4"/>
    <rect class="art-gold" x="322" y="207" width="14" height="14" rx="3"/>
    <path class="art-gold" d="M262 207l-15 7 15 7z"/>
  </g>
  <circle class="art-gold" cx="236" cy="246" r="27"/>
  <path class="art-badge-tick" d="M223 246l9 9 17-18"/>
  <circle class="art-gold" cx="84" cy="74" r="5"/><circle class="art-gold" cx="386" cy="248" r="4"/><circle class="art-soft-dot" cx="70" cy="236" r="8"/>
</svg>`;
window.appParts++;
