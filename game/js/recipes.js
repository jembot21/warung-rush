// Recipe data uses component names as item identities, including shared prep.
export const ingredients = [
  { id: 'rice', name: 'Nasi', color: '#fff0c5' },
  { id: 'noodles', name: 'Mie', color: '#edbc57' },
  { id: 'chicken', name: 'Ayam', color: '#ca8c4b' },
  { id: 'egg', name: 'Telur', color: '#efba37' },
  { id: 'tofu', name: 'Tahu', color: '#f0d79a' },
  { id: 'tempeh', name: 'Tempe', color: '#b88149' },
  { id: 'cabbage', name: 'Kol', color: '#82a15e' },
  { id: 'chili', name: 'Cabai', color: '#c85535' },
];

export const stations = {
  cut: { name: 'Talenan', label: 'Potong', seconds: 1.5, slots: 1 },
  wok: { name: 'Wajan', label: 'Tumis', seconds: 4, slots: 2 },
  grill: { name: 'Panggangan', label: 'Bakar', seconds: 8, slots: 1 },
  pot: { name: 'Panci', label: 'Rebus', seconds: 5, slots: 2 },
};

export const dishes = [
  {
    id: 'nasi-telur-balado', name: 'Nasi Telur Balado', price: 12000, unlockDay: 1,
    description: 'Nasi langsung ke piring, telur ditumis, cabai dipotong.',
    art: { mounds: ['#fff0c5', '#fff8e7', '#d45436'], garnish: '#668653' },
    components: [
      { name: 'Nasi putih', from: 'rice', station: null },
      { name: 'Telur ceplok', from: 'egg', station: 'wok' },
      { name: 'Sambal iris', from: 'chili', station: 'cut' },
    ],
  },
  {
    id: 'nasi-goreng', name: 'Nasi Goreng', price: 18000, unlockDay: 1,
    description: 'Tumis nasi dan telur. Potong ayam, lalu susun semuanya.',
    art: { mounds: ['#ce9851', '#fff8e7', '#ca8c4b'], garnish: '#74964f' },
    components: [
      { name: 'Nasi goreng', from: 'rice', station: 'wok' },
      { name: 'Telur ceplok', from: 'egg', station: 'wok' },
      { name: 'Ayam potong', from: 'chicken', station: 'cut' },
    ],
  },
  {
    id: 'tahu-tempe-sambal', name: 'Tahu Tempe Sambal', price: 16000, unlockDay: 1,
    description: 'Potong tempe lalu tumis. Tumis tahu dan potong cabai.',
    art: { mounds: ['#b88149', '#f0d79a', '#c85535'], garnish: '#74964f' },
    components: [
      { name: 'Tempe iris', from: 'tempeh', station: 'cut' },
      { name: 'Tempe goreng', from: 'Tempe iris', station: 'wok' },
      { name: 'Tahu goreng', from: 'tofu', station: 'wok' },
      { name: 'Sambal iris', from: 'chili', station: 'cut' },
    ],
  },
  {
    id: 'mie-goreng', name: 'Mie Goreng', price: 20000, unlockDay: 2,
    description: 'Rebus mie, potong kol, tumis telur. Siap diracik!',
    art: { mounds: ['#edbc57', '#82a15e', '#fff8e7'], garnish: '#c85535' },
    components: [
      { name: 'Mie rebus', from: 'noodles', station: 'pot' },
      { name: 'Kol iris', from: 'cabbage', station: 'cut' },
      { name: 'Telur ceplok', from: 'egg', station: 'wok' },
    ],
  },
  {
    id: 'gado-gado', name: 'Gado-Gado', price: 22000, unlockDay: 2,
    description: 'Rebus kol dan telur. Potong tahu dan cabai.',
    art: { mounds: ['#82a15e', '#f0d79a', '#fff8e7'], garnish: '#c85535' },
    components: [
      { name: 'Kol rebus', from: 'cabbage', station: 'pot' },
      { name: 'Tahu iris', from: 'tofu', station: 'cut' },
      { name: 'Telur rebus', from: 'egg', station: 'pot' },
      { name: 'Sambal iris', from: 'chili', station: 'cut' },
    ],
  },
  {
    id: 'sate-ayam', name: 'Sate Ayam', price: 26000, unlockDay: 3,
    description: 'Potong ayam, ambil lalu bakar. Tambahkan cabai potong.',
    art: { mounds: ['#a86a37', '#ca8c4b', '#c85535'], garnish: '#74964f' },
    components: [
      { name: 'Ayam potong', from: 'chicken', station: 'cut' },
      { name: 'Sate bakar', from: 'Ayam potong', station: 'grill' },
      { name: 'Sambal iris', from: 'chili', station: 'cut' },
    ],
  },
  {
    id: 'soto-ayam', name: 'Soto Ayam', price: 28000, unlockDay: 3,
    description: 'Rebus ayam, mie, dan telur. Potong kol sebagai pelengkap.',
    art: { mounds: ['#ca8c4b', '#edbc57', '#fff8e7'], garnish: '#82a15e' },
    components: [
      { name: 'Ayam rebus', from: 'chicken', station: 'pot' },
      { name: 'Mie rebus', from: 'noodles', station: 'pot' },
      { name: 'Telur rebus', from: 'egg', station: 'pot' },
      { name: 'Kol iris', from: 'cabbage', station: 'cut' },
    ],
  },
];

// Intermediate components belong on the ticket, but not on the final plate.
export function finalComponentNames(dish) {
  const intermediate = new Set(dish.components.map(component => component.from));
  return new Set(dish.components
    .filter(component => !intermediate.has(component.name))
    .map(component => component.name));
}

export function platePicture(dish) {
  const { mounds, garnish } = dish.art;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" aria-hidden="true" focusable="false">
    <ellipse cx="60" cy="61" rx="53" ry="15" fill="#d1c0a1"/>
    <ellipse cx="60" cy="55" rx="54" ry="18" fill="#fff8e6" stroke="#9b8364" stroke-width="2"/>
    <ellipse cx="60" cy="54" rx="43" ry="12" fill="#ead9b8"/>
    <path d="M20 51c0-35 43-35 43 0z" fill="${mounds[0]}" stroke="#9b754a" stroke-width="1.5"/>
    <path d="M55 49c-4-28 35-31 37 0z" fill="${mounds[1]}" stroke="#9b754a" stroke-width="1.5"/>
    <ellipse cx="81" cy="55" rx="18" ry="9" fill="${mounds[2]}" stroke="#9b754a" stroke-width="1.5"/>
    <path d="m31 36 4 2m9-10 4 1m-7 15 4 1m-16 0 4 2m31-8 4 1m9-8 4 2" stroke="#fff8e6" stroke-width="2" stroke-linecap="round" opacity=".65"/>
    <path d="M17 56c-5-13 10-18 15-8-4 11-9 13-15 8m78-3c-3-12 11-14 14-5-3 11-7 12-14 5" fill="${garnish}" stroke="#527446" stroke-width="1"/>
  </svg>`;
}
