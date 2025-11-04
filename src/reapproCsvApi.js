// reapproCsvApi.js – Native Spirit
// Compatible avec entêtes : "DATE TO RECEIVE", "QUANTITY", etc.
// Source attendue dans /public : NATIVE_SPIRIT_REAPPROWEB_NS (2).csv

// Utiliser encodeURI pour gérer l'espace et (2) dans le nom du fichier
export const REAPPRO_CSV_URL = encodeURI("/NATIVE_SPIRIT_REAPPROWEB_NS (2).csv");

let _cache = null;

// ---------- Normalisations ----------
const norm = (s) => (s ?? "").trim();

// IB220A/AX -> IB220 | NS221A -> NS221 (générique)
const toBaseRef = (ref) => {
  const m = String(ref).trim().match(/^([A-Za-z]+\d+)/);
  return m ? m[1] : String(ref).trim();
};

// couleur -> clé normalisée (sans accents/espaces)
const toColorKey = (s) =>
  norm(s)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const SIZE_ALIASES = new Map([
  // ✅ Canonique NS : "2XS"
  ["2XS", "2XS"], ["XXS", "2XS"],

  ["XS", "XS"], ["S", "S"], ["M", "M"], ["L", "L"], ["XL", "XL"],

  // ✅ Canonique adulte : "XXL"
  ["2XL", "XXL"], ["XXL", "XXL"],
  ["3XL", "3XL"], ["4XL", "4XL"], ["5XL", "5XL"], ["6XL", "6XL"],
]);

const normSize = (s) => {
  const up = norm(s).toUpperCase().replace(/\s+/g, "");
  return SIZE_ALIASES.get(up) || up;
};

// ---------- Helpers d’entêtes ----------
function findCol(header, testers) {
  for (let i = 0; i < header.length; i++) {
    const h = header[i];
    if (testers.some((t) => t(h))) return i;
  }
  return -1;
}
const contains = (needle) => (h) => h.includes(needle);
const equals = (needle) => (h) => h === needle;

// ---------- Parsing générique (délimiteur ; ou ,) ----------
function splitSmart(line) {
  // CSV simple des exports internes (sans guillemets imbriqués)
  if (line.includes(";")) return line.split(";");
  return line.split(",");
}

// ---------- Chargement CSV ----------
export async function loadReappro() {
  if (_cache) return _cache;

  const res = await fetch(REAPPRO_CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("❌ Reappro CSV not found: " + REAPPRO_CSV_URL);
  const text = await res.text();

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  // Header en minuscules sans espaces multiples
  const header = splitSmart(lines[0])
    .map((h) => h.trim().toLowerCase().replace(/\s+/g, " "));

  // Détection des colonnes avec tolérance
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
      equals("date to receive"),
      equals("date_to_receive"),
      equals("datetorec"),
      contains("date to receive"),
      contains("date_to_receive"),
      contains("datetorec"),
      // fallback : tout header qui contient "date" + ("receive" ou "rec")
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

/** Renvoie { dateToRec, quantity } ou null pour baseRef+color+size (tolérant aux variantes) */
export async function getReappro(ref, color, size) {
  const baseRef  = toBaseRef(ref);
  const colorKey = toColorKey(color);
  const sizeKey  = normSize(size);

  const data = await loadReappro();

  const matches = data.filter(
    (r) => r.baseRef === baseRef && r.colorKey === colorKey && r.size === sizeKey
  );

  if (!matches.length) return null;

  // Agrège les quantités et prend une date non vide (la première trouvée)
  const totalQty = matches.reduce((sum, r) => sum + (r.quantity || 0), 0);
  const date = matches.find((r) => r.dateToRec && r.dateToRec !== "-")?.dateToRec || "-";

  return { dateToRec: date, quantity: totalQty };
}
