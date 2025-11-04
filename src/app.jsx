// src/App.jsx — Native Spirit Stock Checker (EN, no search)
// CSV expected in /public:
//  • /NATIVE_SPIRIT_STOCKWEB_NS.csv
//  • /NATIVE_SPIRIT_REAPPROWEB_NS (2).csv

import React, { useEffect, useMemo, useState } from "react";
import {
  getUniqueRefs,
  getColorsFor,
  getSizesFor,
  getStock,
} from "./stockCsvapi.js";          // ⚠️ respecte exactement le nom du fichier
import { getReappro } from "./reapproCsvApi.js";
import "./index.css";

// helper: normalize for safety (accents/case/extra spaces)
const normalize = (s) =>
  String(s ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim();

export default function App() {
  // Data
  const [refs, setRefs] = useState([]);
  const [colors, setColors] = useState([]);
  const [sizes, setSizes] = useState([]);

  const [selectedRef, setSelectedRef] = useState("");
  const [selectedColor, setSelectedColor] = useState("");

  const [stockBySize, setStockBySize] = useState({});
  const [reapproBySize, setReapproBySize] = useState({});

  // UI states
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [loadingTable, setLoadingTable] = useState(false);
  const [error, setError] = useState("");

  // Safety wrappers (avoid trailing/multiple spaces mismatches)
  const safeRef   = useMemo(() => (selectedRef || "").trim(), [selectedRef]);
  const safeColor = useMemo(
    () => (selectedColor || "").replace(/\s+/g, " ").trim(),
    [selectedColor]
  );

  // Size order (Native Spirit)
  const sizeOrder = useMemo(
    () => ["2XS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL", "6XL"],
    []
  );

  // 1) Load references
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
        setError("Unable to load references.");
      } finally {
        if (alive) setLoadingRefs(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // 2) When selecting a reference -> load colors
  useEffect(() => {
    if (!safeRef) {
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
        const cols = await getColorsFor(safeRef);
        if (!alive) return;
        setColors(cols);
        setSelectedColor("");
        setSizes([]);
        setStockBySize({});
        setReapproBySize({});
      } catch {
        if (!alive) return;
        setError("Unable to load colors for this reference.");
      } finally {
        if (alive) setLoadingFilters(false);
      }
    })();
    return () => { alive = false; };
  }, [safeRef]);

  // 3) When selecting a color -> load sizes, stock & replenishment
  useEffect(() => {
    if (!safeRef || !safeColor) {
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
        const rawSizes = await getSizesFor(safeRef, safeColor);
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
              getStock(safeRef, safeColor, size),
              getReappro(safeRef, safeColor, size),
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

        if (!sorted.length) setError("No size found for this Reference / Color.");
      } catch {
        if (!alive) return;
        setError("Unable to load size table.");
      } finally {
        if (alive) setLoadingTable(false);
      }
    })();
    return () => { alive = false; };
  }, [safeRef, safeColor, sizeOrder]);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header" aria-label="Native Spirit – Stock Checker">
        <img
          src="/NATIVESPIRIT-logo-blanc-fond-transparent.png"
          alt="Native Spirit"
          className="app-logo"
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
        <h1 className="app-title">Stock Checker</h1>
      </header>

      {/* Filters (side-by-side) */}
      <div className="filters two-cols">
        <div className="filter">
          <label>Reference</label>
          <select
            value={selectedRef}
            onChange={(e) => setSelectedRef(e.target.value.trim())}
            disabled={!refs.length || loadingRefs}
          >
            <option value="">-- Select reference --</option>
            {refs.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div className="filter">
          <label>Color</label>
          <select
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value.replace(/\s+/g, " ").trim())}
            disabled={!colors.length || loadingFilters}
          >
            <option value="">-- Select color --</option>
            {colors.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Status messages */}
      {error && (
        <div role="alert" className="error-message" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
      {(loadingRefs || loadingFilters || loadingTable) && (
        <div className="loading" style={{ margin: "8px 0 12px" }}>
          Loading…
        </div>
      )}

      {/* Results table */}
      {safeRef && safeColor ? (
        <table className="results-table">
          <thead>
            <tr>
              <th>Size</th>
              <th>Stock</th>
              <th>Replenishment (Date)</th>
              <th>Qty Incoming</th>
            </tr>
          </thead>
          <tbody>
            {sizes.length ? (
              sizes.map((size) => (
                <tr key={size}>
                  <td>{size}</td>
                  <td className="right">
                    {Number(stockBySize[size] || 0) > 0 ? stockBySize[size] : "Out of stock"}
                  </td>
                  <td className="center">{reapproBySize[size]?.dateToRec || "-"}</td>
                  <td className="right">{reapproBySize[size]?.quantity ?? "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="center">No data for this selection.</td>
              </tr>
            )}
          </tbody>
        </table>
      ) : (
        <div className="spacer" />
      )}
    </div>
  );
}
