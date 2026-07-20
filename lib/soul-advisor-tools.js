// lib/soul-advisor-tools.js — ajustado a las 9 sesiones reales de SOUL

const tools = [
  {
    name: "buscar_catalogo",
    description:
      "Busca entre las 9 sesiones de SOUL según la intención de la persona y su presupuesto. " +
      "Usar apenas mencione qué le pasa o qué quiere trabajar.",
    input_schema: {
      type: "object",
      properties: {
        intencion: {
          type: "string",
          enum: [
            "limpieza_energetica", "apertura_caminos", "sanacion_profunda",
            "armonizacion_hogar", "impulso_proyecto", "ninos", "mascotas",
            "legales", "aprendizaje_tarot"
          ],
          description: "Intención principal detectada en el mensaje de la persona."
        },
        presupuesto_max: { type: "number" }
      }
    }
  },
  {
    name: "comparar_items",
    description: "Trae el detalle de 2 a 3 sesiones puntuales para compararlas.",
    input_schema: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 3 }
      },
      required: ["ids"]
    }
  },
  {
    name: "ver_ficha",
    description: "Devuelve el detalle completo de una sesión puntual por su id.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"]
    }
  },
  {
    name: "reservar_sesion",
    description:
      "Abre el flujo de reserva de una sesión (modal de detalle + modal de pago) en el sitio. " +
      "SOLO usar cuando la persona confirmó explícitamente que quiere esa sesión " +
      "('la quiero', 'reservemos esa', 'dale, esa'). Nunca reservar algo que la " +
      "persona no confirmó, aunque haya sido recomendado.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"]
    }
  }
];

module.exports = { tools };
