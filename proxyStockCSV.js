// api/proxyStockCsv.js – Native Spirit
import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    const external = await fetch(
      "https://files.karibanbrands.com/documents/NATIVE_SPIRIT_STOCKWEB_NS.csv"
    );

    if (!external.ok) {
      throw new Error(`Échec du chargement du fichier : ${external.statusText}`);
    }

    const text = await external.text();

    // Autoriser le front à lire le CSV sans CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.send(text);
  } catch (err) {
    console.error("Erreur proxy Native Spirit:", err);
    res.status(500).json({ error: "Impossible de récupérer le CSV Native Spirit" });
  }
}
