// src/app.jsx — Native Spirit (mise à jour labels & affichages)
import React, { useEffect, useMemo, useState } from "react";
import {
  getUniqueRefs,
  getColorsFor,
  getSizesFor,
  getStock,
} from "./stockCsvApi.js";
import { getReappro, getReapproAll } from "./reapproCsvApi.js";
import "./index.css";

export default function App() {
  // Sélections & données
  const [refs, setRefs] = useState([]);
  const [colors, setColors] = useState([]);
  const [sizes, setSizes] = useState([]);

  const [selectedRef, setSelectedRef] = useState("");
  const [selectedColor, setSelectedColor] = useState("");

  const [stockBySize, setStockBySize] = useState({});
  const [reapproAggBySize, setReapproAggBySize] = useState({});
  const [reapproListBySize, setReapproListBySize] = useState({});

  // États UI
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [loadingTable, setLoadingTable] = useState(false);
  const [error, setError] = useState("");

  // Ordre de tri des tailles (inclut 2XS pour NS)
  const sizeOrder = useMemo(
    () => ["2XS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL", "6XL"],
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
        setError("Unable to load references.");
      } finally {
        if (alive) setLoadingRefs(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // 2) Quand on choisit une référence → charger les couleurs
  useEffect(() => {
    if (!selectedRef) {
      setColors([]);
      setSelectedColor("");
      setSizes([]);
      setStockBySize({});
      setReapproAggBySize({});
      setReapproListBySize({});
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
        setReapproAggBySize({});
        setReapproListBySize({});
      } catch {
        if (!alive) return;
        setError("Unable to load colours for this reference.");
      } finally {
        if (alive) setLoadingFilters(false);
      }
    })();
    return () => { alive = false; };
  }, [selectedRef]);

  // 3) Quand on choisit une couleur → charger tailles + stocks + réappro
  useEffect(() => {
    if (!selectedRef || !selectedColor) {
      setSizes([]);
      setStockBySize({});
      setReapproAggBySize({});
      setReapproListBySize({});
      return;
    }

    let alive = true;
    (async () => {
      setLoadingTable(true);
      setError("");
      try {
        const rawSizes = await getSizesFor(selectedRef, selectedColor);
        if (!alive) return;

        // Tri custom : tailles connues d'abord, puis alpha
        const sorted = [
          ...sizeOrder.filter((sz) => rawSizes.includes(sz)),
          ...rawSizes.filter((sz) => !sizeOrder.includes(sz)).sort((a, b) => a.localeCompare(b)),
        ];
        setSizes(sorted);

        // Charger stock + réappro (agrégé + liste) par taille
        const results = await Promise.all(
          sorted.map(async (size) => {
            const [stock, reapproAgg, reapproAll] = await Promise.all([
              getStock(selectedRef, selectedColor, size),
              getReappro(selectedRef, selectedColor, size),
              // si getReapproAll n'est pas dispo pour une raison X, on sécurise :
              (async () => {
                try { return await getReapproAll(selectedRef, selectedColor, size); }
                catch { return []; }
              })(),
            ]);
            return { size, stock, reapproAgg, reapproAll: Array.isArray(reapproAll) ? reapproAll : [] };
          })
        );
        if (!alive) return;

        const nextStock = {};
        const nextAgg = {};
        const nextList = {};
        results.forEach(({ size, stock, reapproAgg, reapproAll }) => {
          nextStock[size] = Number(stock) || 0;
          if (reapproAgg) nextAgg[size] = reapproAgg;
          nextList[size] = reapproAll;
        });

        setStockBySize(nextStock);
        setReapproAggBySize(nextAgg);
        setReapproListBySize(nextList);
      } catch {
        if (!alive) return;
        setError("Unable to load sizes/stock/restock data.");
      } finally {
        if (alive) setLoadingTable(false);
      }
    })();

    return () => { alive = false; };
  }, [selectedRef, selectedColor, sizeOrder]);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header" aria-label="Native Spirit – Stock Checker">
        <img
          src="/NATIVESPIRIT-logo-gris-rvb-fond-transparent.png"
          alt="Native Spirit"
          className="app-logo"
          width={260}
          height="auto"
          loading="eager"
          decoding="async"
          fetchPriority="high"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      </header>

      {/* Filtres */}
      <div className="filters two-cols">
        <div className="filter">
          <label>Reference</label>
          <select
            value={selectedRef}
            onChange={(e) => setSelectedRef(e.target.value)}
            disabled={loadingRefs}
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
            onChange={(e) => setSelectedColor(e.target.value)}
            disabled={!colors.length || loadingFilters}
          >
            <option value="">-- Select colour --</option>
            {colors.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Messages d'état */}
      {error && <div className="error-message" role="alert">{error}</div>}
      {(loadingRefs || loadingFilters || loadingTable) && (
        <div className="loading">Loading…</div>
      )}

      {/* Tableau résultats */}
      {sizes.length > 0 ? (
        <table className="results-table">
          <thead>
            <tr>
              <th>Size</th>
              <th className="right">Stock</th>
              <th>Restock (Date)</th>
              <th className="right">Total incoming qty</th>
            </tr>
          </thead>
          <tbody>
            {sizes.map((size) => {
              const stock = Number(stockBySize[size] || 0);
              const agg = reapproAggBySize[size] || null;
              const list = reapproListBySize[size] || [];

              // Total qty = somme de la liste si dispo, sinon agrégé
              const totalIncoming = list.length
                ? list.reduce((s, r) => s + (Number(r.quantity) || 0), 0)
                : (agg?.quantity ?? 0);

              return (
                <tr key={size}>
                  <td>{size}</td>

                  {/* Stock aligné à droite, avec "Out of stock" si zéro */}
                  <td className="right">
                    {stock > 0 ? stock : "Out of stock"}
                  </td>

                  {/* Restock : quantité d’abord, puis date entre parenthèses */}
                  <td>
                    {list.length > 0 ? (
                      <div className="reappro-list">
                        {list.map((r, idx) => (
                          <div key={idx}>
                            <span className="muted">
                              {Number(r.quantity) || 0} ({r.dateToRec || "-"})
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : agg ? (
                      <span className="muted">
                        {(Number(agg.quantity) || 0)} ({agg.dateToRec || "-"})
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>

                  {/* Total incoming qty aligné à droite */}
                  <td className="right">
                    {totalIncoming > 0 ? totalIncoming : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div className="spacer" />
      )}
    </div>
  );
}
