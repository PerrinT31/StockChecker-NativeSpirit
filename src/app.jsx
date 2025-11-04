// src/App.jsx — Native Spirit Stock Checker (EN + search)
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

// helper: normalize for search (remove accents, lowercase, trim)
const normalize = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

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

  // Search state
  const [searchRef, setSearchRef] = useState("");

  // Size order (Native Spirit)
  const sizeOrder = useMemo(
    () => ["2XS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL", "6XL"],
    []
  );

  // Filtered refs based on search
  const filteredRefs = useMemo(() => {
    if (!searchRef) return refs;
    const q = normalize(searchRef);
    return refs.filter((r) => normalize(r).includes(q));
  }, [refs, searchRef]);

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
      } catch (e) {
        if (!alive) return;
        setError("Unable to load references.");
      } finally {
        if (alive) setLoadingRefs(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 2) When selecting a reference -> load colors
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
      } catch (e) {
        if (!alive) return;
        setError("Unable to load colors for this reference.");
      } finally {
        if (alive) setLoadingFilters(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedRef]);

  // 3) When selecting a color -> load sizes, stock & replenishment
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
      } catch (e) {
        if (!alive) return;
        setError("Unable to load size table.");
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

      {/* Filters */}
      <div className="filters">
        {/* Search reference */}
        <div className="filter">
          <label>Search reference</label>
          <input
            type="text"
            className="search-input"
            placeholder="Type a reference (e.g., NS221)…"
            value={searchRef}
            onChange={(e) => setSearchRef(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filteredRefs.length === 1) {
                setSelectedRef(filteredRefs[0]);
                setSearchRef("");
              }
            }}
          />
          <small className="hint">
            {searchRef
              ? `${filteredRefs.length} result${
                  filteredRefs.length > 1 ? "s" : ""
                }`
              : "Tip: type to filter references faster."}
          </small>
        </div>

        {/* Reference select (filtered) */}
        <div className="filter">
          <label>Reference</label>
          <select
            value={selectedRef}
            onChange={(e) => setSelectedRef(e.target.value)}
            disabled={!filteredRefs.length || loadingRefs}
          >
            <option value="">-- Select reference --</option>
            {filteredRefs.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Color select */}
        <div className="filter">
          <label>Color</label>
          <select
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value)}
            disabled={!colors.length || loadingFilters}
          >
            <option value="">-- Select color --</option>
            {colors.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
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
      {sizes.length > 0 ? (
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
            {sizes.map((size) => (
              <tr key={size}>
                <td>{size}</td>
                <td className="right">
                  {Number(stockBySize[size] || 0) > 0
                    ? stockBySize[size]
                    : "Out of stock"}
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
      ) : (
        <div className="spacer" />
      )}
    </div>
  );
}
