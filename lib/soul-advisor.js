// lib/soul-advisor.js — orquestador ajustado al catálogo real y a reservar_sesion

const Anthropic = require("@anthropic-ai/sdk");
const { tools } = require("./soul-advisor-tools");
const { SYSTEM_PROMPT } = require("./soul-advisor-system-prompt");
const catalog = require("./soul-catalog");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-haiku-4-5-20251001";

async function ejecutarTool(nombre, input) {
  switch (nombre) {
    case "buscar_catalogo":
      return catalog.buscarCatalogo(input);
    case "comparar_items":
      return catalog.compararItems(input.ids);
    case "ver_ficha":
      return catalog.verFicha(input.id);
    case "reservar_sesion":
      return { accion: "reservar_sesion", id: input.id };
    default:
      throw new Error(`Tool desconocida: ${nombre}`);
  }
}

async function runAdvisor(historial, mensajeUsuario) {
  const mensajes = [...historial, { role: "user", content: mensajeUsuario }];
  const accionesReserva = [];
  const itemsMostrados = [];

  for (let vuelta = 0; vuelta < 5; vuelta++) {
    const respuesta = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages: mensajes
    });

    mensajes.push({ role: "assistant", content: respuesta.content });

    if (respuesta.stop_reason !== "tool_use") {
      const texto = respuesta.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
      return { texto, historial: mensajes, acciones_reserva: accionesReserva, items_mostrados: itemsMostrados };
    }

    const tool_results = [];
    for (const bloque of respuesta.content) {
      if (bloque.type !== "tool_use") continue;
      const resultado = await ejecutarTool(bloque.name, bloque.input);

      if (bloque.name === "reservar_sesion") accionesReserva.push(resultado);
      if (["buscar_catalogo", "comparar_items", "ver_ficha"].includes(bloque.name)) {
        itemsMostrados.push(...(Array.isArray(resultado) ? resultado : [resultado]));
      }

      tool_results.push({ type: "tool_result", tool_use_id: bloque.id, content: JSON.stringify(resultado ?? null) });
    }
    mensajes.push({ role: "user", content: tool_results });
  }

  return {
    texto: "Perdón, se me complicó procesar eso — ¿podés contarlo de otra forma?",
    historial: mensajes,
    acciones_reserva: accionesReserva,
    items_mostrados: itemsMostrados
  };
}

module.exports = { runAdvisor };
