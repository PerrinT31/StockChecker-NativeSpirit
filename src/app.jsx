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
    {sizes.map((s) => {
      const key = `${selectedRef}::${selectedColor}::${s}`;
      const stock = stockData[key]?.stock ?? 0;
      const reappro = stockData[key]?.reappro ?? null;
      return (
        <tr key={s}>
          <td>{s}</td>
          <td className={stock <= 0 ? "out" : ""}>
            {stock > 0 ? stock : "Out of stock"}
          </td>
          <td>{reappro?.dateToRec || "-"}</td>
          <td>{reappro?.quantity || "-"}</td>
        </tr>
      );
    })}
  </tbody>
</table>
