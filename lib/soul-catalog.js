// lib/soul-catalog.js — versión ajustada al sitio real
//
// SOUL tiene 9 sesiones fijas, ya definidas como objeto SERVICIOS dentro
// de index.html. En vez de duplicar infraestructura (Sheets + caché) para
// un catálogo que casi no cambia, lo hardcodeamos acá también, en el mismo
// orden e IDs que usa el frontend (abrirServicio(id) en el HTML).
// Si Bianca agrega o edita sesiones, se edita esta lista Y el objeto
// SERVICIOS del HTML — son la misma fuente de verdad, solo duplicada
// una vez para evitar exponer lógica de negocio al cliente.

const CATALOGO = [
  {
    id: "pendulo",
    nombre: "Limpieza Energética Personal con Péndulo Karnak",
    precio: 30000,
    intencion: "limpieza_energetica",
    resumen: "Para cansancio sin causa, bloqueos, emociones pesadas o sensación de cargar algo ajeno."
  },
  {
    id: "mesa",
    nombre: "Armonización y Apertura de Caminos con Mesa Cuántica",
    precio: 25000,
    intencion: "apertura_caminos",
    resumen: "Para cuando las oportunidades no llegan o hay obstáculos invisibles en amor, trabajo o economía."
  },
  {
    id: "sanacion",
    nombre: "Transformación y Sanación Profunda",
    precio: 30000,
    intencion: "sanacion_profunda",
    resumen: "Para patrones heredados, vínculos kármicos y creencias limitantes arraigadas."
  },
  {
    id: "hogar",
    nombre: "Armonización de Espacios y Hogares",
    precio: 45000,
    intencion: "armonizacion_hogar",
    resumen: "Para cuando el hogar se siente pesado, hay conflictos frecuentes o no se descansa bien."
  },
  {
    id: "negocio",
    nombre: "Impulso para Proyectos y Negocios",
    precio: 40000,
    intencion: "impulso_proyecto",
    resumen: "Para emprendimientos que no despegan a pesar del esfuerzo."
  },
  {
    id: "ninos",
    nombre: "Acompañamiento Energético para Niños",
    precio: 15000,
    intencion: "ninos",
    resumen: "Para cambios de conducta, dificultad para dormir o adaptación a cambios familiares."
  },
  {
    id: "mascota",
    nombre: "Sanación Energética para Mascotas",
    precio: 15000,
    intencion: "mascotas",
    resumen: "Para cambios de comportamiento o humor en animales de compañía."
  },
  {
    id: "legales",
    nombre: "Destrabe de Procesos Legales y Administrativos",
    precio: 30000,
    intencion: "legales",
    resumen: "Para ventas, sucesiones o trámites que no avanzan a pesar de estar en orden."
  },
  {
    id: "tarot",
    nombre: "Guía Completa de Tarot",
    precio: 20000,
    intencion: "aprendizaje_tarot",
    resumen: "Material digital para aprender tarot desde una mirada intuitiva, con numerología y tiradas."
  }
];

function buscarCatalogo({ intencion, presupuesto_max } = {}) {
  let resultados = CATALOGO;
  if (intencion) resultados = resultados.filter((s) => s.intencion === intencion);
  if (presupuesto_max != null) resultados = resultados.filter((s) => s.precio <= presupuesto_max);
  return resultados;
}

function compararItems(ids) {
  return ids.map((id) => CATALOGO.find((s) => s.id === id)).filter(Boolean);
}

function verFicha(id) {
  return CATALOGO.find((s) => s.id === id) || null;
}

module.exports = { CATALOGO, buscarCatalogo, compararItems, verFicha };
