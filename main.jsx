<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Native Spirit – Stock Checker</title>

    <!-- Hurme Geometric Sans 4 (local ou fallback Roboto Condensed) -->
    <link
      href="https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@400;700&display=swap"
      rel="stylesheet"
    />

    <!-- Favicon Native Spirit -->
    <link rel="icon" type="image/png" href="/NATIVESPIRIT-logo-pastille-blanc.png" />

    <meta name="description" content="Outil de contrôle des stocks Native Spirit – vêtements et accessoires écoresponsables pour les professionnels." />
    <meta name="theme-color" content="#93BCB4" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.jsx"></script>
  </body>
</html>


// =========================
// main.jsx – Native Spirit
// =========================

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css"; // Styles globaux (fond #93BCB4 + Hurme Geometric Sans 4)

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
