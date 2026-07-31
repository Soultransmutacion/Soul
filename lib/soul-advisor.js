// lib/soul-advisor.js — orquestador ajustado al catalogo real, a reservar_sesion
// y a los limites de seguridad y costo aprobados para el asistente de SOUL.
//
// Conexion: usa el SDK de Anthropic pero apuntando a Vercel AI Gateway, para
// consumir los creditos ya cargados ahi (no los de la cuenta directa de
// Anthropic). La clave se lee unicamente desde la variable de entorno
// AI_GATEWAY_API_KEY [nunca se expone ni se escribe en este archivo].
//
// El cliente se crea de forma perezosa (recien cuando se necesita) para que
// este archivo pueda importarse de forma segura en pruebas automaticas aunque
// todavia no exista la variable de entorno en ese entorno.

const Anthropic = require("@anthropic-ai/sdk");
const { tools } = require("./soul-advisor-tools");
const { SYSTEM_PROMPT } = require("./soul-advisor-system-prompt");
const catalog = require("./soul-catalog");

const MODEL = "anthropic/claude-haiku-4.5";
const MAX_VUELTAS = 3;
const MAX_TOKENS = 500;
const MAX_MENSAJES_HISTORIAL_VISIBLE = 8;

const IDS_VALIDOS = catalog.CATALOGO.map((s) => s.id);
const INTENCIONES_VALIDAS = [
      "limpieza_energetica", "apertura_caminos", "sanacion_profunda",
      "armonizacion_hogar", "impulso_proyecto", "ninos", "mascotas",
      "legales", "aprendizaje_tarot"
    ];
const PRESUPUESTO_MAX_PERMITIDO = 10000000;

let clienteAnthropic = null;
function getClienteAnthropic() {
      if (!clienteAnthropic) {
              clienteAnthropic = new Anthropic({
                        apiKey: process.env.AI_GATEWAY_API_KEY,
                        baseURL: "https://ai-gateway.vercel.sh"
              });
      }
      return clienteAnthropic;
}

// Riesgo residual: estos patrones se evaluan sobre el mensaje ACTUAL del
// visitante [nunca sobre el historial, que puede haber sido manipulado].
// Son heuristicas de texto simple, no una comprension real del lenguaje:
// ante cualquier duda se rechaza la reserva en vez de asumir que confirmo.
const PATRONES_NEGACION = [
      /\bno\s+la\s+quiero\b/i,
      /\bno\s+lo\s+quiero\b/i,
      /\bno\s+quiero\s+reservar\b/i,
      /\bno\s+reservemos(\s+todavia)?\b/i,
      /\btodavia\s+no\s+quiero\s+agendar\b/i,
      /\bmejor\s+mas\s+adelante\b/i,
      /\bno,?\s*gracias\b/i,
      /\btodavia\s+no\b/i,
      /\bno\s+todavia\b/i,
      /\bno\s+quiero\b/i
    ];

const PATRONES_CONFIRMACION = [
      /\bla\s+quiero\b/i,
      /\blo\s+quiero\b/i,
      /\bquiero\s+reservar\b/i,
      /\breservemos\b/i,
      /\bdale,?\s*esa\b/i,
      /\bquiero\s+esa\s+sesion\b/i,
      /\bquiero\s+esa\b/i,
      /\breserv[a\u00e1]\s*(la|esa)\b/i
    ];

function normalizarTexto(texto) {
        return texto
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
}

function hayConfirmacionExplicita(mensaje) {
        if (!mensaje || typeof mensaje !== "string") return false;
        const texto = normalizarTexto(mensaje);
        if (PATRONES_NEGACION.some((r) => r.test(texto))) return false;
        return PATRONES_CONFIRMACION.some((r) => r.test(texto));
}

function validarInputHerramienta(nombre, inputCrudo) {
      const input = inputCrudo && typeof inputCrudo === "object" ? inputCrudo : {};
      switch (nombre) {
          case "buscar_catalogo": {
                    const out = {};
                    if (input.intencion !== undefined) {
                                if (typeof input.intencion !== "string" || !INTENCIONES_VALIDAS.includes(input.intencion)) return null;
                                out.intencion = input.intencion;
                    }
                    if (input.presupuesto_max !== undefined) {
                                const n = Number(input.presupuesto_max);
                                if (!Number.isFinite(n) || n <= 0 || n > PRESUPUESTO_MAX_PERMITIDO) return null;
                                out.presupuesto_max = n;
                    }
                    return out;
          }
          case "comparar_items": {
                    if (!Array.isArray(input.ids)) return null;
                    if (input.ids.length < 2 || input.ids.length > 3) return null;
                    if (!input.ids.every((id) => typeof id === "string" && IDS_VALIDOS.includes(id))) return null;
                    return { ids: input.ids };
          }
          case "ver_ficha":
          case "reservar_sesion": {
                    if (typeof input.id !== "string" || !IDS_VALIDOS.includes(input.id)) return null;
                    return { id: input.id };
          }
          default:
                    return null;
      }
}

async function ejecutarTool(nombre, inputCrudo, mensajeUsuarioActual) {
      const input = validarInputHerramienta(nombre, inputCrudo);
      if (input === null) return { error: "entrada_invalida" };

  switch (nombre) {
      case "buscar_catalogo":
                return catalog.buscarCatalogo(input);
      case "comparar_items":
                return catalog.compararItems(input.ids);
      case "ver_ficha":
                return catalog.verFicha(input.id);
      case "reservar_sesion": {
                // La reserva NUNCA depende solo de que el modelo haya decidido llamar
                // la herramienta: se exige ademas una confirmacion explicita en el
                // mensaje actual del visitante, validada aqui en el servidor.
                if (!hayConfirmacionExplicita(mensajeUsuarioActual)) {
                            return { accion: "reserva_no_confirmada" };
                }
                return { accion: "reservar_sesion", id: input.id };
      }
      default:
                return { error: "herramienta_desconocida" };
  }
}

function dedupeItems(items) {
      const vistos = new Map();
      for (const item of items) {
              if (item && item.id && !vistos.has(item.id)) vistos.set(item.id, item);
      }
      return Array.from(vistos.values());
}

async function runAdvisor(historialSaneado, mensajeUsuario) {
      const anthropic = getClienteAnthropic();
      const mensajesInternos = [...historialSaneado, { role: "user", content: mensajeUsuario }];
      const accionesReserva = [];
      const itemsMostrados = [];
      let textoFinal = "Perdon, se me complico procesar eso, podes contarlo de otra forma?";

  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
          const respuesta = await anthropic.messages.create({
                    model: MODEL,
                    max_tokens: MAX_TOKENS,
                    system: SYSTEM_PROMPT,
                    tools,
                    messages: mensajesInternos
          });

        mensajesInternos.push({ role: "assistant", content: respuesta.content });

        if (respuesta.stop_reason !== "tool_use") {
                  textoFinal = respuesta.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
                  break;
        }

        const tool_results = [];
          for (const bloque of respuesta.content) {
                    if (bloque.type !== "tool_use") continue;
                    const resultado = await ejecutarTool(bloque.name, bloque.input, mensajeUsuario);

            if (bloque.name === "reservar_sesion" && resultado && resultado.accion === "reservar_sesion") {
                        accionesReserva.push(resultado);
            }
                    if (["buscar_catalogo", "comparar_items", "ver_ficha"].includes(bloque.name)) {
                                const lista = Array.isArray(resultado) ? resultado : (resultado ? [resultado] : []);
                                itemsMostrados.push(...lista.filter((x) => x && x.id));
                    }

            tool_results.push({ type: "tool_result", tool_use_id: bloque.id, content: JSON.stringify(resultado ?? null) });
          }
          mensajesInternos.push({ role: "user", content: tool_results });
  }

  const historialVisible = [
          ...historialSaneado,
      { role: "user", content: mensajeUsuario },
      { role: "assistant", content: textoFinal }
        ].slice(-MAX_MENSAJES_HISTORIAL_VISIBLE);

  return {
          texto: textoFinal,
          historial: historialVisible,
          acciones_reserva: accionesReserva,
          items_mostrados: dedupeItems(itemsMostrados)
  };
}

module.exports = {
      runAdvisor,
      _interno: { hayConfirmacionExplicita, validarInputHerramienta, dedupeItems }
};
