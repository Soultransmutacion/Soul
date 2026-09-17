#!/usr/bin/env node
// scripts/test-shop.js
//
// Pruebas de la etapa de preview del Shop: catalogo (data/shop-products.json
// vía lib/shop-catalog.js) y logica pura del carrito (lib/shop-cart.js).
// No hace ninguna llamada real a Mercado Pago ni a ningun servidor: solo
// prueba datos y funciones puras. Se ejecuta junto con los demas scripts
// mediante "npm test".

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { catalogo, PRODUCTS, FREE_SHIPPING_THRESHOLD, CURRENCY, getActiveProducts } = require("../lib/shop-catalog");
const ShopCart = require("../lib/shop-cart");

let fallidas = 0;
let totales = 0;

function test(nombre, fn) {
  totales += 1;
  try {
    fn();
    console.log("  OK  - " + nombre);
  } catch (err) {
    fallidas += 1;
    console.error("FALLO - " + nombre);
    console.error("        " + err.message);
  }
}

function seccion(titulo) {
  console.log("\n" + titulo);
}

// ——— Lectura del catálogo ———

seccion("Catálogo del Shop (data/shop-products.json)");

test("el catálogo se puede leer y es un array de productos", () => {
  assert.ok(Array.isArray(PRODUCTS));
  assert.ok(PRODUCTS.length > 0);
});

test("hay exactamente nueve productos en el catálogo", () => {
  assert.strictEqual(PRODUCTS.length, 9);
});

test("los nueve productos están activos", () => {
  const activos = getActiveProducts();
  assert.strictEqual(activos.length, 9);
  activos.forEach((p) => assert.strictEqual(p.active, true));
});

test("cada producto tiene los campos mínimos requeridos", () => {
  const camposRequeridos = ["id", "slug", "name", "price", "currency", "stockStatus", "category", "image", "shortDescription", "active"];
  PRODUCTS.forEach((p) => {
    camposRequeridos.forEach((campo) => {
      assert.ok(Object.prototype.hasOwnProperty.call(p, campo), "falta el campo \"" + campo + "\" en " + p.id);
    });
  });
});

test("los precios son válidos (número positivo) y coinciden con $15.000 ARS", () => {
  PRODUCTS.forEach((p) => {
    assert.strictEqual(typeof p.price, "number");
    assert.ok(p.price > 0, "el precio de " + p.id + " debe ser positivo");
    assert.strictEqual(p.price, 15000);
    assert.strictEqual(p.currency, "ARS");
  });
  assert.strictEqual(CURRENCY, "ARS");
});

test("los IDs y los slugs de los productos son únicos", () => {
  const ids = PRODUCTS.map((p) => p.id);
  const slugs = PRODUCTS.map((p) => p.slug);
  assert.strictEqual(new Set(ids).size, ids.length);
  assert.strictEqual(new Set(slugs).size, slugs.length);
});

test("el umbral de envío gratis del catálogo es $150.000", () => {
  assert.strictEqual(FREE_SHIPPING_THRESHOLD, 150000);
});

test("index.html no duplica manualmente el catálogo de productos del Shop", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.ok(html.includes("data/shop-products.json"), "index.html debe leer el catálogo desde data/shop-products.json");
  assert.ok(!/Áurico Uriel/.test(html), "no debe haber nombres de áuricos hardcodeados en index.html");
});

// ——— Carrito: cantidades ———

seccion("Carrito — cantidades (lib/shop-cart.js)");

test("una cantidad menor a 1 se normaliza a 1", () => {
  assert.strictEqual(ShopCart.normalizarCantidad(0), 1);
  assert.strictEqual(ShopCart.normalizarCantidad(-5), 1);
});

test("una cantidad no entera se redondea hacia abajo", () => {
  assert.strictEqual(ShopCart.normalizarCantidad(2.9), 2);
  assert.strictEqual(ShopCart.normalizarCantidad("3.7"), 3);
});

test("una cantidad excesiva o absurda se limita al máximo permitido", () => {
  assert.strictEqual(ShopCart.normalizarCantidad(999999), ShopCart.CANTIDAD_MAXIMA);
  assert.strictEqual(ShopCart.normalizarCantidad(100), ShopCart.CANTIDAD_MAXIMA);
});

test("un valor no numérico o no finito se normaliza a la cantidad mínima", () => {
  assert.strictEqual(ShopCart.normalizarCantidad("abc"), 1);
  assert.strictEqual(ShopCart.normalizarCantidad(NaN), 1);
  assert.strictEqual(ShopCart.normalizarCantidad(Infinity), 1);
});

test("agregar el mismo producto dos veces suma cantidades en vez de duplicar la línea", () => {
  let items = [];
  items = ShopCart.agregarItem(items, "aurico-ganesha", 2);
  items = ShopCart.agregarItem(items, "aurico-ganesha", 3);
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].qty, 5);
});

// ——— Carrito: total ———

seccion("Carrito — total (lib/shop-cart.js)");

test("el total del carrito es la suma de precio unitario por cantidad", () => {
  const items = [
    { id: "aurico-ganesha", qty: 2 },
    { id: "aurico-uriel", qty: 3 },
  ];
  const totales = ShopCart.calcularTotales(items, PRODUCTS);
  assert.strictEqual(totales.cantidadTotal, 5);
  assert.strictEqual(totales.total, 2 * 15000 + 3 * 15000);
  assert.strictEqual(totales.lineas.length, 2);
  totales.lineas.forEach((linea) => {
    assert.strictEqual(linea.subtotal, linea.precioUnitario * linea.cantidad);
  });
});

test("un carrito vacío tiene total 0", () => {
  const totales = ShopCart.calcularTotales([], PRODUCTS);
  assert.strictEqual(totales.total, 0);
  assert.strictEqual(totales.cantidadTotal, 0);
  assert.deepStrictEqual(totales.lineas, []);
});

test("un id de producto inexistente se ignora al calcular el total", () => {
  const totales = ShopCart.calcularTotales([{ id: "no-existe", qty: 5 }], PRODUCTS);
  assert.strictEqual(totales.total, 0);
  assert.strictEqual(totales.lineas.length, 0);
});

test("quitarItem y vaciar dejan el carrito sin ese producto o completamente vacío", () => {
  let items = ShopCart.agregarItem([], "aurico-ganesha", 1);
  items = ShopCart.agregarItem(items, "aurico-uriel", 1);
  items = ShopCart.quitarItem(items, "aurico-ganesha");
  assert.strictEqual(items.length, 1);
  assert.strictEqual(ShopCart.vaciar().length, 0);
});

// ——— Umbral de envío gratis ———

seccion("Envío gratis (lib/shop-cart.js)");

test("por debajo del umbral, indica cuánto falta y no asume costo de envío", () => {
  const resultado = ShopCart.calcularEnvioGratis(15000, FREE_SHIPPING_THRESHOLD);
  assert.strictEqual(resultado.envioGratis, false);
  assert.strictEqual(resultado.falta, 135000);
  assert.ok(resultado.mensaje.includes("Te faltan"));
});

test("al alcanzar o superar el umbral, confirma envío gratis", () => {
  const enElUmbral = ShopCart.calcularEnvioGratis(150000, FREE_SHIPPING_THRESHOLD);
  const porEncima = ShopCart.calcularEnvioGratis(180000, FREE_SHIPPING_THRESHOLD);
  assert.strictEqual(enElUmbral.envioGratis, true);
  assert.strictEqual(porEncima.envioGratis, true);
  assert.strictEqual(enElUmbral.falta, 0);
});

test("con el carrito vacío (total 0) no se afirma envío gratis", () => {
  const resultado = ShopCart.calcularEnvioGratis(0, FREE_SHIPPING_THRESHOLD);
  assert.strictEqual(resultado.envioGratis, false);
});

// ——— Persistencia del carrito ———

seccion("Persistencia del carrito (localStorage simulado)");

function crearStorageFalso() {
  const datos = {};
  return {
    getItem: (clave) => (Object.prototype.hasOwnProperty.call(datos, clave) ? datos[clave] : null),
    setItem: (clave, valor) => { datos[clave] = String(valor); },
    removeItem: (clave) => { delete datos[clave]; },
  };
}

test("guardar y leer el carrito devuelve exactamente los mismos items", () => {
  const storage = crearStorageFalso();
  const items = [{ id: "aurico-ganesha", qty: 2 }, { id: "aurico-uriel", qty: 1 }];
  ShopCart.guardarEnStorage(storage, "clave-test", items);
  const leidos = ShopCart.leerDeStorage(storage, "clave-test");
  assert.deepStrictEqual(leidos, items);
});

test("si no hay nada guardado, se devuelve un carrito vacío", () => {
  const storage = crearStorageFalso();
  assert.deepStrictEqual(ShopCart.leerDeStorage(storage, "clave-inexistente"), []);
});

test("datos corruptos en storage no rompen la lectura: se devuelve carrito vacío", () => {
  const storage = crearStorageFalso();
  storage.setItem("clave-test", "esto no es JSON válido {{{");
  assert.deepStrictEqual(ShopCart.leerDeStorage(storage, "clave-test"), []);
});

test("sin storage disponible (null), guardar y leer no lanzan excepción", () => {
  assert.strictEqual(ShopCart.guardarEnStorage(null, "clave-test", []), false);
  assert.deepStrictEqual(ShopCart.leerDeStorage(null, "clave-test"), []);
});

// ——— Ausencia de pago real ———

seccion("Ausencia de pago real en esta etapa (index.html)");

test("el botón de pago del checkout está deshabilitado y dice 'Pago online próximamente'", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const inicioForm = html.indexOf('id="checkoutForm"');
  const finForm = html.indexOf("</form>", inicioForm);
  const bloqueForm = html.slice(inicioForm, finForm);
  assert.ok(/id="checkoutSubmitBtn"[^>]*disabled/.test(bloqueForm), "el botón de envío debe tener el atributo disabled");
  assert.ok(bloqueForm.includes("Pago online próximamente"));
  assert.ok(html.includes("Esta es una vista previa. Todavía no se generará ningún pedido ni cobro."));
});

test("no se incluye el SDK de Mercado Pago en la página", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.ok(!html.includes("sdk.mercadopago.com"));
  assert.ok(!/new\s+MercadoPago\s*\(/.test(html));
});

test("el envío del formulario de checkout nunca llama a fetch ni crea pedidos", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const inicio = html.indexOf("checkoutForm.addEventListener('submit'");
  assert.ok(inicio !== -1, "debe existir un listener de submit para el checkout");
  const fin = html.indexOf("});", inicio);
  const bloque = html.slice(inicio, fin);
  assert.ok(bloque.includes("e.preventDefault()"));
  assert.ok(!bloque.includes("fetch("));
});

// ——— Fotografías reales de los 9 áuricos ———

seccion("Fotografías reales de los productos");

const DESCRIPCIONES_ESPERADAS = {
  "aurico-miguel": "Áurico Miguel — Protección.",
  "aurico-rafael": "Áurico Rafael — Sanación.",
  "aurico-gabriel": "Áurico Gabriel — Claridad.",
  "aurico-jofiel": "Áurico Jofiel — Armonía.",
  "aurico-chamuel": "Áurico Chamuel — Amor.",
  "aurico-zadquiel": "Áurico Zadquiel — Transmutación.",
  "aurico-uriel": "Áurico Uriel — Abundancia.",
  "aurico-ganesha": "Áurico Ganesha — Apertura de caminos.",
  "aurico-atrae-clientes": "Áurico Atrae Clientes — Magnetismo comercial.",
};

test("los nueve productos tienen una imagen real (no null) con webp y jpg", () => {
  PRODUCTS.forEach((p) => {
    assert.ok(p.image && typeof p.image === "object", p.id + " debe tener un objeto image");
    assert.ok(p.image.webp && p.image.webp.startsWith("assets/shop/"), p.id + ": ruta webp inválida");
    assert.ok(p.image.jpg && p.image.jpg.startsWith("assets/shop/"), p.id + ": ruta jpg inválida");
    assert.ok(p.image.width > 0 && p.image.height > 0, p.id + ": dimensiones inválidas");
    assert.ok(typeof p.image.alt === "string" && p.image.alt.length > 0, p.id + ": falta alt descriptivo");
  });
});

test("los archivos webp y jpg de cada producto existen en disco y no están vacíos", () => {
  PRODUCTS.forEach((p) => {
    [p.image.webp, p.image.jpg].forEach((rutaRelativa) => {
      const rutaAbsoluta = path.join(__dirname, "..", rutaRelativa);
      assert.ok(fs.existsSync(rutaAbsoluta), "no existe " + rutaRelativa);
      assert.ok(fs.statSync(rutaAbsoluta).size > 0, rutaRelativa + " está vacío");
    });
  });
});

test("las dos fotos de portada (marfil y naturaleza) existen y la marfil va primero en index.html", () => {
  assert.ok(catalogo.cover && catalogo.cover.marfil && catalogo.cover.naturaleza, "faltan las portadas en el catálogo");
  [catalogo.cover.marfil, catalogo.cover.naturaleza].forEach((img) => {
    [img.webp, img.jpg].forEach((rutaRelativa) => {
      const rutaAbsoluta = path.join(__dirname, "..", rutaRelativa);
      assert.ok(fs.existsSync(rutaAbsoluta), "no existe " + rutaRelativa);
    });
  });
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const posMarfil = html.indexOf("shop-portada-auricos-marfil");
  const posNaturaleza = html.indexOf("shop-portada-auricos-naturaleza");
  assert.ok(posMarfil !== -1 && posNaturaleza !== -1, "faltan las portadas en index.html");
  assert.ok(posMarfil < posNaturaleza, "la portada marfil debe aparecer primero que la de naturaleza");
});

test("la descripción breve de cada producto coincide con la etiqueta real (sin inventar beneficios)", () => {
  PRODUCTS.forEach((p) => {
    const esperada = DESCRIPCIONES_ESPERADAS[p.id];
    assert.ok(esperada, "no hay descripción esperada definida para " + p.id);
    assert.strictEqual(p.shortDescription, esperada);
  });
});

test("los nueve productos indican contenido de 125 ml", () => {
  PRODUCTS.forEach((p) => {
    assert.strictEqual(p.content, "125 ml");
  });
});

test("index.html ya no muestra el aviso provisional de 'imagen próximamente' como introducción del Shop", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.ok(html.includes("Conocé la línea de sprays áuricos SOUL"));
  assert.ok(!html.includes("Todavía estamos preparando las fotografías"));
});

// ——— Venta mayorista ———

seccion("Bloque de venta mayorista");

test("el bloque mayorista existe con título, texto y botón de WhatsApp con el mensaje correcto", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const inicio = html.indexOf('class="shop-mayorista"');
  assert.ok(inicio !== -1, "falta el bloque .shop-mayorista");
  const fin = html.indexOf("</div>", inicio);
  const bloque = html.slice(inicio, fin);
  assert.ok(bloque.includes("Venta mayorista"));
  assert.ok(bloque.includes("Consultanos por disponibilidad y condiciones mayoristas"));
  assert.ok(bloque.includes("Consultar venta mayorista"));
  assert.ok(bloque.includes("wa.me/5493416644513"));
  const mensajeEsperado = encodeURIComponent("Hola, quiero recibir información sobre la venta mayorista de los áuricos SOUL.");
  assert.ok(bloque.includes(mensajeEsperado), "el mensaje precargado de WhatsApp no coincide");
});

test("el bloque mayorista no inventa condiciones comerciales todavía no definidas", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const inicio = html.indexOf('class="shop-mayorista"');
  const fin = html.indexOf("</div>", inicio);
  const bloque = html.slice(inicio, fin).toLowerCase();
  ["compra mínima", "descuento", "% off", "exclusividad", "plazo"].forEach((termino) => {
    assert.ok(!bloque.includes(termino), "no debería mencionar: " + termino);
  });
});

function main() {
  console.log("\nResultado: " + (totales - fallidas) + "/" + totales + " pruebas OK.");
  if (fallidas > 0) {
    console.error(fallidas + " prueba(s) fallida(s).");
    process.exitCode = 1;
  }
}

main();
