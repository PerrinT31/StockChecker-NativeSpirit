// stockCsvApi.js – Native Spirit
// Charge le CSV de stock et REGROUPE les variantes (ex. NS221A, NS221AX) sous NS221.

const STOCK_CSV_URL = "/NATIVE_SPIRIT_STOCKWEB_NS.csv";

let _cacheRows = null;
let _index = {
  byRef: new Map(),          // baseRef -> Set(colors)
  byRefColor: new Map(),     // `${baseRef}::${color}` -> Set(sizes)
  stockByKey: new Map(),     // `${baseRef}::${color}::${size}` -> number (agrégé)
};

// Ordre de tailles Native Spirit (avec 2XS + 6XL)
const SIZE_ORDER = ["2XS","XS","S","M","L","XL","XXL","3XL","4XL","5XL","6XL"];

// --- helpers ---------------------------------------------------------------
const norm = (s) => (s ?? "").trim();
const normColor = (s) => norm(s).replace(/\s+/g, " ");
const SIZE_ALIASES = new Map([
  ["XXS","2XS"], ["2XS","2XS"],
  ["XS","XS"], ["S","S"], ["M","M"], ["L","L"], ["XL","XL"],
  ["XXL","XXL"], ["2XL","XXL"], // mappe 2XL -> XXL
  ["3XL","3XL"], ["4XL","4XL"], ["5XL","5XL"], ["6XL","6XL"],
]);
const normSize = (s) => {
  const up = norm(s).toUpperCase().replace(/\s+/g, "");
  return SIZE_ALIASES.get(up) || up;
};
const toInt = (v) => {
  const n = parseInt(String(v).replace(/\s/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};
// Référence de base : lettres + chiffres; on ignore les suffixes alphabétiques (ex: NS221AX -> NS221)
const toBaseRef = (ref) => {
  const m = String(ref).trim().match(/^([A-Za-z]+[0-9]+)/);
  return m ? m[1] : String(ref).trim();
};
const sortSizes = (arr) => {
  const order = new Map(SIZE_ORDER.map((v, i) => [v, i]));
  return [...new Set(arr)]
    .sort((a, b) => {
      const aa = order.has(a) ? order.get(a) : 999;
      const bb = order.has(b) ? order.get(b) : 999;
      return aa === bb ? a.localeCompare(b) : aa - bb;
    });
};

const detectDelimiter = (sample) => {
  const semi = (sample.match(/;/g) || []).length;
  const comma = (sample.match(/,/g) || []).length;
  return semi >= comma ? ";" : ",";
};

// --- loader ----------------------------------------------------------------
async function loadStock() {
  if (_cacheRows) return _cacheRows;

  const res = await fetch(STOCK_CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`❌ Stock CSV not found: ${STOCK_CSV_URL}`);
  const text = await res.text();

  const delim = detectDelimiter(text.slice(0, 1000));
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const header = lines[0].split(delim).map(h => h.trim().toLowerCase());
  // tolérance sur les intitulés
  const refIdx   = header.findIndex(h => ["ref","reference","référence"].includes(h) || h.includes("ref"));
  const colorIdx = header.findIndex(h => ["color","colour","couleur"].includes(h) || h.includes("color"));
  const sizeIdx  = header.findIndex(h => ["size","taille"].includes(h) || h.includes("size"));
  const stockIdx = header.findIndex(h => ["stock","qty","quantity","quantité"].includes(h) || h.includes("qty"));

  const noHeader = [refIdx,colorIdx,sizeIdx,stockIdx].some(i => i === -1);
  const body = noHeader ? lines : lines.slice(1);

  const rows = body.map(line => {
    const p = line.split(delim);
    const rawRef = norm(p[noHeader ? 0 : refIdx]);
    const baseRef = toBaseRef(rawRef);
    const color   = normColor(p[noHeader ? 1 : colorIdx]);
    const size    = normSize(p[noHeader ? 2 : sizeIdx]);
    const stock   = toInt(p[noHeader ? 3 : stockIdx]);
    return { baseRef, color, size, stock };
  }).filter(r => r.baseRef && r.color && r.size);

  // Réinitialise les index
  _index = { byRef: new Map(), byRefColor: new Map(), stockByKey: new Map() };

  for (const r of rows) {
    // baseRef -> colors
    if (!_index.byRef.has(r.baseRef)) _index.byRef.set(r.baseRef, new Set());
    _index.byRef.get(r.baseRef).add(r.color);

    // baseRef+color -> sizes
    const rcKey = `${r.baseRef}::${r.color}`;
    if (!_index.byRefColor.has(rcKey)) _index.byRefColor.set(rcKey, new Set());
    _index.byRefColor.get(rcKey).add(r.size);

    // baseRef+color+size -> stock (AGRÉGATION si plusieurs lignes)
    const skKey = `${rcKey}::${r.size}`;
    const prev = _index.stockByKey.get(skKey) ?? 0;
    _index.stockByKey.set(skKey, prev + r.stock);
  }

  _cacheRows = rows;
  return rows;
}

// --- API -------------------------------------------------------------------
export async function getUniqueRefs() {
  await loadStock();
  return [..._index.byRef.keys()].sort(); // ex: ["NS221", "NS300", ...]
}

export async function getColorsFor(ref) {
  await loadStock();
  const baseRef = toBaseRef(ref);
  const set = _index.byRef.get(baseRef) ?? new Set();
  return [...set].sort((a,b) => a.localeCompare(b));
}

export async function getSizesFor(ref, color) {
  await loadStock();
  const baseRef = toBaseRef(ref);
  const set = _index.byRefColor.get(`${baseRef}::${color}`) ?? new Set();
  return sortSizes([...set]);
}

export async function getStock(ref, color, size) {
  await loadStock();
  const baseRef = toBaseRef(ref);
  // normalise la taille pour matcher l’index (ex. "2XL" => "XXL")
  const sizeKey = normSize(size);
  return _index.stockByKey.get(`${baseRef}::${color}::${sizeKey}`) ?? 0;
}
