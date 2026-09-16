// lib/shop-catalog.js — acceso de Node a la única fuente de datos del Shop
//
// El catálogo del Shop vive exclusivamente en data/shop-products.json.
// Este módulo solo lo lee y expone helpers para scripts de Node (tests,
// futura lógica de servidor). El frontend (index.html) lee ese mismo
// archivo con fetch('data/shop-products.json'): no hay ninguna copia
// manual del catálogo en otro lugar.

const fs = require("fs");
const path = require("path");

const RUTA_CATALOGO = path.join(__dirname, "..", "data", "shop-products.json");

function leerCatalogo() {
  const crudo = fs.readFileSync(RUTA_CATALOGO, "utf8");
  return JSON.parse(crudo);
}

const catalogo = leerCatalogo();

const PRODUCTS = catalogo.products;
const FREE_SHIPPING_THRESHOLD = catalogo.freeShippingThreshold;
const CURRENCY = catalogo.currency;

function getActiveProducts() {
  return PRODUCTS.filter((p) => p.active);
}

module.exports = {
  catalogo,
  PRODUCTS,
  FREE_SHIPPING_THRESHOLD,
  CURRENCY,
  getActiveProducts,
};
