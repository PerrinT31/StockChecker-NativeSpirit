// App.jsx – Native Spirit (version finale, full thème vert)
// Hypothèses :
// - Les CSV sont dans /public :
//     • /NATIVE_SPIRIT_STOCKWEB_NS.csv
//     • /NATIVE_SPIRIT_REAPPROWEB_NS (2).csv
// - Le logo blanc est dans /public/NATIVESPIRIT-logo-pastille-blanc.png

import React, { useEffect, useMemo, useState } from "react";
import {
  getUniqueRefs,
  getColorsFor,
  getSizesFor,
  getStock,
} from "./stockCsvApi.js";
import { getReappro } from "./reapproCsvApi.js";
import "./index.css";

export default function App() {
  const [refs, setRefs] = useState([]);
  const [colors, setColors] = useState([]);
  const [sizes, setSizes] = useState([]);

  const [selectedRef, setSelectedRef] = useState("");
  const [selectedColor, setSelectedColor] = useState("");

  const [stockBySize, setStockBySize] = useState({});
  const [reapproBySize, setReapproBySize] = useState({});

  const [loadingRefs, setLoadingRefs] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [loadingTable, setLoadingTable] = useState(false);
  const [error, setError] = useState("");

  const sizeOrder = useMemo(
    () => ["2XS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"],
    []
  );

  // 1️⃣ Charger les références
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingRefs(true);
      setError("");
      try {
        const list = await getUniqueRefs();
        if (!alive) return;
        setRefs(list);
      } catch {
        if (!alive) return;
        setError("Impossible de charger les références.");
      } finally {
        if (alive) setLoadingRefs(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 2️⃣ Charger les couleurs quand une ref est choisie
  useEffect(() => {
    if (!selectedRef) {
      setColors([]);
      setSelectedColor("");
      setSizes([]);
      setStockBySize({});
      setReapproBySize({});
      return;
    }

    let alive = true;
    (async () => {
      setLoadingFilters(true);
      setError("");
      try {
        const cols = await getColorsFor(selectedRef);
        if (!alive) return;
        setColors(cols);
        setSelectedColor("");
        setSizes([]);
        setStockBySize({});
        setReapproBySize({});
      } catch {
        if (!alive) return;
        setError("Impossible de charger les couleurs pour cette référence.");
      } finally {
        if (alive) setLoadingFilters(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [selectedRef]);

  // 3️⃣ Charger tailles + stocks + réappro quand couleur choisie
  useEffect(() => {
    if (!selectedRef || !selectedColor) {
      setSizes([]);
      setStockBySize({});
      setReapproBySize({});
      return;
    }

    let alive = true;
    (async () => {
      setLoadingTable(true);
      setError("");
      try {
        const rawSizes = await getSizesFor(selectedRef, selectedColor);
        if (!alive) return;

        const sorted = [
          ...sizeOrder.filter((sz) => rawSizes.includes(sz)),
          ...rawSizes
            .filter((sz) => !sizeOrder.includes(sz))
            .sort((a, b) => a.localeCompare(b)),
        ];
        setSizes(sorted);

        const results = await Promise.all(
          sorted.map(async (size) => {
            const [stock, reappro] = await Promise.all([
              getStock(selectedRef, selectedColor, size),
              getReappro(selectedRef, selectedColor, size),
            ]);
            return { size, stock, reappro };
          })
        );

        const nextStock = {};
        const nextReappro = {};
        results.forEach(({ size, stock, reappro }) => {
          nextStock[size] = stock;
          nextReappro[size] = reappro;
        });

        if (!alive) return;
        setStockBySize(nextStock);
        setReapproBySize(nextReappro);
      } catch {
        if (!alive) return;
        setError("Impossible de charger les données de stock.");
      } finally {
        if (alive) setLoadingTable(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [selectedRef, selectedColor, sizeOrder]);

  return (
    <div className="app-container">
      <header className="app-header" aria-label="Native Spirit – Stock Checker">
  <img
    src="/NATIVESPIRIT-logo-pastille-blanc.png"
    alt="Native Spirit"
    className="app-logo"
    width={330}   // doublé visuellement
    height={330}
    loading="eager"
    decoding="async"
    fetchPriority="high"
  />
  <h1 className="app-title">Stock Checker</h1>
</header>
      <div className="filters">
        <div className="filter">
          <label>Référence</label>
          <select
            value={selectedRef}
            onChange={(e) => setSelectedRef(e.target.value)}
            disabled={loadingRefs}
          >
            <option value="">-- Sélectionner une référence --</option>
            {refs.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="filter">
          <label>Couleur</label>
          <select
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value)}
            disabled={!colors.length || loadingFilters}
          >
            <option value="">-- Sélectionner une couleur --</option>
            {colors.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {(loadingRefs || loadingFilters || loadingTable) && (
        <div className="loading">Chargement…</div>
      )}

      {sizes.length > 0 && (
        <table className="results-table">
          <thead>
            <tr>
              <th>Taille</th>
              <th>Stock</th>
              <th>Réappro (Date)</th>
              <th>Qté entrante</th>
            </tr>
          </thead>
          <tbody>
            {sizes.map((size) => (
              <tr key={size}>
                <td>{size}</td>
                <td className="right">
                  {Number(stockBySize[size] || 0) > 0
                    ? stockBySize[size]
                    : "Rupture"}
                </td>
                <td className="center">
                  {reapproBySize[size]?.dateToRec || "-"}
                </td>
                <td className="right">
                  {reapproBySize[size]?.quantity ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
