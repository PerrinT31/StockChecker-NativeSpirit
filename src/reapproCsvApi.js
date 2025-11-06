// src/reapproCsvApi.js — Native Spirit
// CSV attendu dans /public : NATIVE_SPIRIT_REAPPROWEB_NS (2).csv
// Expose :
//   - loadReappro()
//   - getReapproAll(ref, color, size) -> [{ dateToRec, quantity }, ...] (trié du +proche au +lointain)
//   - getReappro(ref, color, size)    -> { dateToRec, quantity } (agrégé)

export const REAPPRO_CSV_URL = encodeURI("/NATIVE_SPIRIT_REAPPROWEB_NS (2).csv");

let _cache = null;

/* =======================
   Normalisations & utils
   ======================= */
const norm = (s) => (s ?? "").toString().trim();

// Ex: NS221A -> NS221
const toBaseRef = (ref) => {
  const m = String(ref).trim().match(/^([A-Za-z]+\d+)/);
  return m ? m[1] : String(ref).trim();
};

// couleur -> clé normalisée (sans accents/espaces/ponctuations)
const toColorKey = (s) =>
  norm(s)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// Alias tailles (harmonise 2XL -> XXL, etc.)
const SIZE_ALIASES = new Map([
  ["2XS", "XXS"], ["XXS", "XXS"],
  ["XS", "XS"], ["S", "S"], ["M", "M"], ["L", "L"], ["XL", "XL"],
  ["2XL", "XXL"], ["XXL", "XXL"], ["3XL", "3XL"], ["4XL", "4XL"],
  ["5XL", "5XL"], ["6XL", "6XL"],
]);
const normSize = (s) => {
  const up = norm(s).toUpperCase().replace(/\s+/g, "");
  return SIZE_ALIASES.get(up) || up;
};

// Transforme une date texte en clé triable AAAAMMJJ (nombre)
function toDateKey(str) {
  const t = String(str || "").trim();
  if (!t || t === "-") return Number.MAX_SAFE_INTEGER;

  // JJ/MM/AAAA
  let m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const d = +m[1], mo = +m[2], y = +m[3];
    return y * 10000 + mo * 100 + d;
  }

  // AAAA-MM-JJ
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = +m[1], mo = +m[2], d = +m[3];
    return y * 10000 + mo * 100 + d;
  }

  // Inconnu : tout en bas
  return Number.MAX_SAFE_INTEGER;
}

/* =======================
   Helpers entêtes & split
   ======================= */
const contains = (needle) => (h) => h.includes(needle);
const equals   = (needle) => (h) => h === needle;

function findCol(header, testers) {
  for (let i = 0; i < header.length; i++) {
    const h = header[i];
    if (testers.some((t) => t(h))) return i;
  }
  return -1;
}

// CSV simples internes : autorise ; ou ,
function splitSmart(line) {
  if (line.includes(";")) return line.split(";");
  return line.split(",");
}

/* =======================
   Chargement CSV
   ======================= */
export async function loadReappro() {
  if (_cache) return _cache;

  const res = await fetch(REAPPRO_CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("❌ Reappro CSV not found: " + REAPPRO_CSV_URL);
  const text = await res.text();

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) {
    _cache = [];
    return _cache;
  }

  // Header en minuscules sans espaces multiples
  const header = splitSmart(lines[0])
    .map((h) => h.trim().toLowerCase().replace(/\s+/g, " "));

  // Détection tolérante
  const idx = {
    ref: findCol(header, [
      equals("ref"), equals("reference"), equals("référence"), contains("ref"),
    ]),
    color: findCol(header, [
      equals("color"), equals("colour"), equals("couleur"), contains("color"),
    ]),
    size: findCol(header, [
      equals("size"), equals("taille"), contains("size"),
    ]),
    date: findCol(header, [
      equals("date to receive"), equals("date_to_receive"), equals("datetorec"),
      contains("date to receive"), contains("date_to_receive"), contains("datetorec"),
      (h) => h.includes("date") && (h.includes("receive") || h.includes("rec")),
    ]),
    qty: findCol(header, [
      equals("quantity"), equals("qty"), equals("quantité"),
      contains("quantity"), contains("qty"), contains("quantit"),
    ]),
  };

  const noHeader = Object.values(idx).some((i) => i === -1);
  const body = noHeader ? lines : lines.slice(1);

  _cache = body
    .map((line) => {
      const p = splitSmart(line);
      const baseRef   = toBaseRef(norm(p[noHeader ? 0 : idx.ref]));
      const color     = norm(p[noHeader ? 1 : idx.color]);
      const colorKey  = toColorKey(color);
      const size      = normSize(p[noHeader ? 2 : idx.size]);
      const dateToRec = norm(p[noHeader ? 3 : idx.date]) || "-";
      const quantity  = parseInt((p[noHeader ? 4 : idx.qty]) ?? "", 10) || 0;
      return { baseRef, color, colorKey, size, dateToRec, quantity };
    })
    .filter((r) => r.baseRef && r.colorKey && r.size);

  return _cache;
}

/* =======================
   API réappro
   ======================= */

/** Liste détaillée des réassorts pour baseRef+color+size
 *  @returns [{ dateToRec: string, quantity: number }, ...] (trié par date asc, "-" en dernier)
 */
export async function getReapproAll(ref, color, size) {
  const baseRef  = toBaseRef(ref);
  const colorKey = toColorKey(color);
  const sizeKey  = normSize(size);

  const data = await loadReappro();
  const rows = data.filter(
    (r) => r.baseRef === baseRef && r.colorKey === colorKey && r.size === sizeKey
  );
  if (!rows.length) return [];

  // Agrège par date (si plusieurs lignes pour la même date)
  const byDate = new Map();
  for (const r of rows) {
    const d = r.dateToRec && r.dateToRec !== "-" ? r.dateToRec : "-";
    byDate.set(d, (byDate.get(d) || 0) + (r.quantity || 0));
  }

  // Tri du plus tôt au plus tard (les "-" en dernier)
  const list = [...byDate.entries()]
    .map(([dateToRec, quantity]) => ({ dateToRec, quantity }))
    .sort((a, b) => toDateKey(a.dateToRec) - toDateKey(b.dateToRec));

  return list;
}

/** Version agrégée (compat) : total + première date non vide trouvée */
export async function getReappro(ref, color, size) {
  const list = await getReapproAll(ref, color, size);
  if (!list.length) return null;
  const totalQty = list.reduce((s, r) => s + (r.quantity || 0), 0);
  const firstDate = list.find((r) => r.dateToRec && r.dateToRec !== "-")?.dateToRec || "-";
  return { dateToRec: firstDate, quantity: totalQty };
}
