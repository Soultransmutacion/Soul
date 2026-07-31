#!/usr/bin/env node
// scripts/check-catalog-sync.js
//
// Verifica que el catalogo mostrado en index.html (objeto SERVICIOS) sea
// exactamente el mismo, en id, nombre y precio, que el catalogo que usa el
// asistente en lib/soul-catalog.js (array CATALOGO). Se ejecuta con
// "npm test" y termina con codigo de error si detecta cualquier diferencia,
// indicando claramente que servicio no coincide.

const fs = require("fs");
const path = require("path");
const { CATALOGO } = require("../lib/soul-catalog");

function leerServiciosDesdeHtml() {
    const htmlPath = path.join(__dirname, "..", "index.html");
    const html = fs.readFileSync(htmlPath, "utf8");

  const inicio = html.indexOf("const SERVICIOS = {");
    if (inicio === -1) throw new Error("No se encontro el objeto SERVICIOS en index.html");
    const marcadorFin = "\nlet servicioActual";
    const fin = html.indexOf(marcadorFin, inicio);
    if (fin === -1) throw new Error("No se pudo delimitar el objeto SERVICIOS en index.html");

  const bloque = html.slice(inicio, fin);

  const regexEntrada = /(\w+):\s*{\s*nombre:\s*'([^']+)',\s*precio:\s*'([^']+)'/g;
    const servicios = [];
    let match;
    while ((match = regexEntrada.exec(bloque)) !== null) {
          const [, id, nombre, precioTexto] = match;
          const precio = Number(precioTexto.replace(/[^0-9]/g, ""));
          servicios.push({ id, nombre, precio });
    }
    return servicios;
}

function compararCatalogos() {
    const serviciosHtml = leerServiciosDesdeHtml();
    const diferencias = [];

  if (serviciosHtml.length !== CATALOGO.length) {
        diferencias.push(
                "Cantidad distinta de servicios: index.html tiene " + serviciosHtml.length +
                ", lib/soul-catalog.js tiene " + CATALOGO.length
              );
  }

  const mapaHtml = new Map(serviciosHtml.map((s) => [s.id, s]));
    const mapaCatalogo = new Map(CATALOGO.map((s) => [s.id, s]));

  for (const [id, servicioHtml] of mapaHtml) {
        const servicioCatalogo = mapaCatalogo.get(id);
        if (!servicioCatalogo) {
                diferencias.push("El servicio \"" + id + "\" existe en index.html pero no en lib/soul-catalog.js");
                continue;
        }
        if (servicioHtml.nombre !== servicioCatalogo.nombre) {
                diferencias.push(
                          "Nombre distinto para \"" + id + "\": index.html=\"" + servicioHtml.nombre +
                          "\" lib/soul-catalog.js=\"" + servicioCatalogo.nombre + "\""
                        );
        }
        if (servicioHtml.precio !== servicioCatalogo.precio) {
                diferencias.push(
                          "Precio distinto para \"" + id + "\": index.html=" + servicioHtml.precio +
                          " lib/soul-catalog.js=" + servicioCatalogo.precio
                        );
        }
  }

  for (const id of mapaCatalogo.keys()) {
        if (!mapaHtml.has(id)) {
                diferencias.push("El servicio \"" + id + "\" existe en lib/soul-catalog.js pero no en index.html");
        }
  }

  return diferencias;
}

function main() {
    const diferencias = compararCatalogos();
    if (diferencias.length > 0) {
          console.error("check-catalog-sync: se encontraron diferencias entre index.html y lib/soul-catalog.js:");
          diferencias.forEach((d) => console.error(" - " + d));
          process.exitCode = 1;
          return;
    }
    console.log("check-catalog-sync: OK, los " + CATALOGO.length + " servicios coinciden en id, nombre y precio.");
}

if (require.main === module) {
    main();
}

module.exports = { compararCatalogos, leerServiciosDesdeHtml };
