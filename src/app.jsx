// app.jsx – Native Spirit (refonte)

import React, { useEffect, useMemo, useState } from "react";
import {
  getUniqueRefs,
  getColorsFor,
  getSizesFor,
  getStock,
} from "./stockCsvApi.js";          // ← correspond à src/stockCsvsApi.js
import { getReappro } from "./reapproCsvApi.js";
import "./index.css";

export default function App() {
  // Sélections & données
  const [refs, setRefs] = useState([]);
  const [colors, setColors] = useState([]);
  const [sizes, setSizes] = useState([]);

  const [selectedRef, setSelectedRef] = useState("");
  const [selectedColor, setSelectedColor] = useState("");

  const [stockBySize, setStockBySize] = useState({});
  const [reapproBySize, setReapproBySize] = useState({});

  // États UI
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [loadingTable, setLoadingTable] = useState(false);
  const [error, setError] = useState("");

  // Ordre de tri des tailles (inclut 2XS pour NS)
  const sizeOrder = useMemo(
    () => ["2XS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"],
    []
  );

  // 1) Charger les références
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
    return () => { alive = false; };
  }, []);

  // 2) Charger les couleurs quand on choisit une référence
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
    return () => { alive = false; };
  }, [selectedRef]);

  // 3) Charger tailles + stocks + réappro quand on choisit une couleur
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
          ...sizeOrder.filter(sz => rawSizes.includes(sz)),
          ...rawSizes.filter(sz => !sizeOrder.includes(sz)).sort((a, b) => a.localeCompare(b)),
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
        if (!alive) return;

        const nextStock = {};
        const nextReappro = {};
        results.forEach(({ size, stock, reappro }) => {
          nextStock[size] = stock;
          nextReappro[size] = reappro;
        });
        setStockBySize(nextStock);
        setReapproBySize(nextReappro);
      } catch {
        if (!alive) return;
        setError("Impossible de charger le tableau des tailles.");
      } finally {
        if (alive) setLoadingTable(false);
      }
    })();

    return () => { alive = false; };
  }, [selectedRef, selectedColor, sizeOrder]);

  return (
    <div className="app-container">
      {/* En-tête */}
      <header className="app-header" aria-label="Native Spirit – Stock Checker">
        <img
          src="/NATIVESPIRIT-logo-pastille-blanc.png"
          alt="Native Spirit"
          className="app-logo"
          width={220}
          height={64}
          loading="eager"
          decoding="async"
          fetchPriority="high"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <h1 className="app-title">Stock Checker</h1>
      </header>

      {/* Filtres */}
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
              <option key={r} value={r}>{r}</option>
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
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Messages d'état */}
      {error && (
        <div role="alert" style={{ color: "#b00020", marginBottom: 12 }}>
          {error}
        </div>
      )}
      {(loadingRefs || loadingFilters || loadingTable) && (
        <div className="center" style={{ margin: "8px 0 12px" }}>
          Chargement…
        </div>
      )}

      {/* Tableau résultats */}
      {sizes.length > 0 ? (
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
                  {Number(stockBySize[size] || 0) > 0 ? stockBySize[size] : "Rupture"}
                </td>
                <td className="center">{reapproBySize[size]?.dateToRec || "-"}</td>
                <td className="right">{reapproBySize[size]?.quantity ?? "-"}</td>
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
