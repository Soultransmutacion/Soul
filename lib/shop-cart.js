// lib/shop-cart.js — lógica pura del carrito del Shop
//
// Sin DOM, sin red, sin localStorage directo: recibe y devuelve datos
// simples (arrays/objetos planos) para poder probarla con Node (ver
// scripts/test-shop.js) y reutilizar exactamente el mismo código en el
// navegador. Se carga en index.html como script clásico
// (<script src="lib/shop-cart.js">) y queda disponible como
// window.SoulShopCart; en Node se accede vía require().
//
// La persistencia (guardarEnStorage/leerDeStorage) recibe el "storage"
// como parámetro en vez de usar localStorage directamente, así los tests
// de Node pueden pasar un mock y el navegador pasa el localStorage real.

(function (definir) {
  var CANTIDAD_MINIMA = 1;
  var CANTIDAD_MAXIMA = 99;

  function normalizarCantidad(valor) {
    var n = Math.floor(Number(valor));
    if (!Number.isFinite(n)) return CANTIDAD_MINIMA;
    if (n < CANTIDAD_MINIMA) return CANTIDAD_MINIMA;
    if (n > CANTIDAD_MAXIMA) return CANTIDAD_MAXIMA;
    return n;
  }

  function agregarItem(items, id, cantidad) {
    var lista = Array.isArray(items) ? items.slice() : [];
    var cantidadNormalizada = normalizarCantidad(cantidad);
    var indice = -1;
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].id === id) { indice = i; break; }
    }
    if (indice === -1) {
      lista.push({ id: id, qty: cantidadNormalizada });
    } else {
      var actual = lista[indice];
      lista[indice] = { id: actual.id, qty: normalizarCantidad(actual.qty + cantidadNormalizada) };
    }
    return lista;
  }

  function actualizarCantidad(items, id, cantidad) {
    var lista = Array.isArray(items) ? items.slice() : [];
    return lista.map(function (it) {
      if (it.id !== id) return it;
      return { id: it.id, qty: normalizarCantidad(cantidad) };
    });
  }

  function quitarItem(items, id) {
    var lista = Array.isArray(items) ? items.slice() : [];
    return lista.filter(function (it) { return it.id !== id; });
  }

  function vaciar() {
    return [];
  }

  function calcularTotales(items, productos) {
    var mapaProductos = {};
    (productos || []).forEach(function (p) { mapaProductos[p.id] = p; });
    var cantidadTotal = 0;
    var total = 0;
    var lineas = [];
    (items || []).forEach(function (it) {
      var producto = mapaProductos[it.id];
      if (!producto) return;
      var cantidad = normalizarCantidad(it.qty);
      var subtotal = producto.price * cantidad;
      cantidadTotal += cantidad;
      total += subtotal;
      lineas.push({
        id: it.id,
        nombre: producto.name,
        precioUnitario: producto.price,
        cantidad: cantidad,
        subtotal: subtotal,
        imagen: producto.image || null
      });
    });
    return { lineas: lineas, cantidadTotal: cantidadTotal, total: total };
  }

  function calcularEnvioGratis(total, umbral) {
    if (!total || total <= 0) {
      return { envioGratis: false, falta: umbral, mensaje: null };
    }
    if (total >= umbral) {
      return { envioGratis: true, falta: 0, mensaje: "Tu compra tiene envío gratis" };
    }
    var falta = umbral - total;
    return {
      envioGratis: false,
      falta: falta,
      mensaje: "Te faltan $" + falta.toLocaleString("es-AR") + " para obtener envío gratis"
    };
  }

  function guardarEnStorage(storage, clave, items) {
    if (!storage) return false;
    try {
      storage.setItem(clave, JSON.stringify(Array.isArray(items) ? items : []));
      return true;
    } catch (err) {
      return false;
    }
  }

  function leerDeStorage(storage, clave) {
    if (!storage) return [];
    try {
      var crudo = storage.getItem(clave);
      if (!crudo) return [];
      var datos = JSON.parse(crudo);
      if (!Array.isArray(datos)) return [];
      return datos
        .filter(function (it) { return it && typeof it.id === "string"; })
        .map(function (it) { return { id: it.id, qty: normalizarCantidad(it.qty) }; });
    } catch (err) {
      return [];
    }
  }

  definir({
    CANTIDAD_MINIMA: CANTIDAD_MINIMA,
    CANTIDAD_MAXIMA: CANTIDAD_MAXIMA,
    normalizarCantidad: normalizarCantidad,
    agregarItem: agregarItem,
    actualizarCantidad: actualizarCantidad,
    quitarItem: quitarItem,
    vaciar: vaciar,
    calcularTotales: calcularTotales,
    calcularEnvioGratis: calcularEnvioGratis,
    guardarEnStorage: guardarEnStorage,
    leerDeStorage: leerDeStorage
  });
})(typeof module !== "undefined" && module.exports
  ? function (api) { module.exports = api; }
  : function (api) { window.SoulShopCart = api; });
