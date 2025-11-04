// src/App.jsx — Native Spirit Stock Checker (EN, side-by-side filters, full reappro details)
// Expects CSVs in /public:
//  • /NATIVE_SPIRIT_STOCKWEB_NS.csv
//  • /NATIVE_SPIRIT_REAPPROWEB_NS (2).csv

import React, { useEffect, useMemo, useState } from "react";
import {
  getUniqueRefs,
  getColorsFor,
  getSizesFor,
  getStock,
} from "./stockCsvApi.js";            // ⚠️ respecte exactement le nom du fichier
import { getReappro, getReapproAll } from "./reapproCsvApi.js";
import "./index.css";

// small safety: trim & normalize spaces
const trimSpaces = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

export default function App() {
  // Data
  const [refs, setRefs] = useState([]);
  const [colors, setColors] = useState([]);
  const [sizes, setSizes] = useState([]);

  const [selectedRef, setSelectedRef] = useState("");
  const [selectedColor, setSelectedColor] = useState("");

  const [stockBySize, setStockBySize] = useState({});
  const [reapproBySize, setReapproBySize] = useState({});
  const [reapproListBySize, setReapproListBySize] = useState({}); // size -> [{dateToRec, quantity}, ...]

  // UI states
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [loadingTable, setLoadingTable] = useState(false);
  const [error, setError] = useState("");

  // Safe values (avoid trailing/double-spaces mismatches)
  const safeRef = useMemo(() => trimSpaces(selectedRef), [selectedRef]);
  const safeColor = useMemo(() => trimSpaces(selectedColor), [selectedColor]);

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
      setReapproListBySize({});
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
        setReapproListBySize({});
      } catch {
        if (!alive) return;
        setError("Unable to load colours for this reference.");
      } finally {
        if (alive) setLoadingFilters(false);
      }
    })();
    return () => { alive = false; };
  }, [safeRef]);

  // 3) When selecting a color -> load sizes, stock & replenishment (incl. all dates)
  useEffect(() => {
    if (!safeRef || !safeColor) {
      setSizes([]);
      setStockBySize({});
      setReapproBySize({});
      setReapproListBySize({});
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
            const [stock, reapproAgg, reapproAll] = await Promise.all([
              getStock(safeRef, safeColor, size),     // number
              getReappro(safeRef, safeColor, size),   // { dateToRec, quantity } (aggregated)
              getReapproAll(safeRef, safeColor, size) // [{ dateToRec, quantity }, ...]
            ]);
            return { size, stock, reapproAgg, reapproAll };
          })
        );

        const nextStock = {};
        const nextReappro = {};
        const nextReapproList = {};
        results.forEach(({ size, stock, reapproAgg, reapproAll }) => {
          nextStock[size] = stock;
          nextReappro[size] = reapproAgg;
          nextReapproList[size] = Array.isArray(reapproAll) ? reapproAll : [];
        });

        if (!alive) return;
        setStockBySize(nextStock);
        setReapproBySize(nextReappro);
        setReapproListBySize(nextReapproList);

        if (!sorted.length) setError("No size found for this Reference / Colour.");
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

      {/* Filters (two columns) */}
      <div className="filters two-cols">
        <div className="filter">
          <label>Reference</label>
          <select
            value={selectedRef}
            onChange={(e) => setSelectedRef(trimSpaces(e.target.value))}
            disabled={!refs.length || loadingRefs}
          >
            <option value="">-- Select reference --</option>
            {refs.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div className="filter">
          <label>Colour</label>
          <select
            value={selectedColor}
            onChange={(e) => setSelectedColor(trimSpaces(e.target.value))}
            disabled={!colors.length || loadingFilters}
          >
            <option value="">-- Select colour --</option>
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
              <th>Restock</th>
              <th>Total incoming qty</th>
            </tr>
          </thead>
          <tbody>
            {sizes.length ? (
              sizes.map((size) => {
                const list = reapproListBySize[size] || [];
                const totalQty = reapproBySize[size]?.quantity ?? "-";
                return (
                  <tr key={size}>
                    <td>{size}</td>
                    <td className="right">
                      {Number(stockBySize[size] || 0) > 0 ? stockBySize[size] : "Out of stock"}
                    </td>
                    <td className="center">
                      {list.length ? (
                        <div className="reappro-list">
                          {list.map((r, i) => (
                            <div key={`${r.dateToRec}-${i}`}>
                              {r.dateToRec} <span className="muted">({r.quantity})</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="right">{totalQty}</td>
                  </tr>
                );
              })
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
