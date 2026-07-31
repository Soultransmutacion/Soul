// api/soul-assistant.js — endpoint que consume el widget en index.html
//
// Este endpoint es la unica puerta de entrada del visitante hacia el
// asistente. Todo lo que llega desde el navegador se trata como NO
// confiable: se valida el metodo, el tipo de contenido, el tamano del
// mensaje, y se reconstruye un historial saneado antes de pasarlo al
// orquestador (lib/soul-advisor.js). Nunca se registran mensajes
// completos ni datos personales en los logs del servidor.

const { runAdvisor } = require("../lib/soul-advisor");

const MAX_CARACTERES_MENSAJE = 700;
const MAX_CARACTERES_HISTORIAL_ITEM = 700;
const MAX_PARES_HISTORIAL = 4; // equivale a 8 mensajes (user + assistant)

function esTextoValido(valor, maxLen) {
      return typeof valor === "string" && valor.trim().length > 0 && valor.length <= maxLen;
}

// El historial que llega en el body es informacion NO confiable: cualquier
// visitante puede editar el JavaScript del navegador y mandar un array
// fabricado a mano, con roles o contenido inventados. Por eso aca no se
// confia en la forma del historial recibido: se reconstruye desde cero,
// tomando unicamente pares completos user -> assistant, con texto simple,
// y descartando cualquier otra cosa (roles desconocidos, contenido
// estructurado, system, tool_use, tool_result, arrays, objetos, etc.).
//
// Riesgo residual: aun asi, un visitante podria fabricar un historial que
// simule una conversacion donde "el asistente" ya acepto algo. Por eso
// ninguna decision sensible (como reservar_sesion) depende del historial:
// siempre se exige ademas una confirmacion explicita en el mensaje ACTUAL,
// validada del lado del servidor en lib/soul-advisor.js.
function sanearHistorial(historialCrudo) {
      if (!Array.isArray(historialCrudo)) return [];

  // 1) Nos quedamos solo con entradas de forma simple y valida: rol
  // conocido (user/assistant) y contenido de texto plano dentro del limite.
  const limpios = [];
      for (const item of historialCrudo) {
              if (!item || typeof item !== "object") continue;
              const { role, content } = item;
              if (role !== "user" && role !== "assistant") continue;
              if (!esTextoValido(content, MAX_CARACTERES_HISTORIAL_ITEM)) continue;
              limpios.push({ role, content: content.trim() });
      }

  // 2) Construimos pares completos user -> assistant, en orden. Cualquier
  // mensaje suelto, repetido o fuera de secuencia se descarta en vez de
  // forzarlo dentro de un par incompleto.
  const pares = [];
      let i = 0;
      while (i < limpios.length) {
              const actual = limpios[i];
              const siguiente = limpios[i + 1];
              if (actual.role === "user" && siguiente && siguiente.role === "assistant") {
                        pares.push([actual, siguiente]);
                        i += 2;
              } else {
                        i += 1;
              }
      }

  // 3) Conservamos como maximo los ultimos N pares completos.
  const ultimosPares = pares.slice(-MAX_PARES_HISTORIAL);

  // El resultado final: siempre empieza en user, siempre termina en
  // assistant, nunca contiene roles consecutivos iguales ni mensajes
  // sueltos, y nunca system/tool_use/tool_result ni contenido estructurado.
  return ultimosPares.flat();
}

module.exports = async function handler(req, res) {
      if (req.method !== "POST") {
              res.status(405).json({ error: "Metodo no permitido" });
              return;
      }

      const contentType = String(req.headers["content-type"] || "");
      if (!contentType.includes("application/json")) {
              res.status(415).json({ error: "Tipo de contenido no soportado" });
              return;
      }

      let body = req.body;
      if (typeof body === "string") {
              try { body = JSON.parse(body); } catch { body = null; }
      }
      if (!body || typeof body !== "object" || Array.isArray(body)) {
              res.status(400).json({ error: "Cuerpo de la solicitud invalido" });
              return;
      }

      const { historial, mensaje } = body;

      if (!esTextoValido(mensaje, MAX_CARACTERES_MENSAJE)) {
              const demasiadoLargo = typeof mensaje === "string" && mensaje.length > MAX_CARACTERES_MENSAJE;
              res.status(400).json({
                        error: demasiadoLargo ? "El mensaje es demasiado largo" : "Falta el mensaje o no es valido"
              });
              return;
      }

      const historialSaneado = sanearHistorial(historial);

      try {
              const resultado = await runAdvisor(historialSaneado, mensaje.trim());

        res.status(200).json({
                  texto: resultado.texto,
                  historial: resultado.historial,
                  acciones_reserva: resultado.acciones_reserva,
                  items: resultado.items_mostrados
        });
      } catch (err) {
              // No se registra el mensaje del visitante ni datos personales: solo un
        // texto tecnico minimo, sin mencionar Anthropic, Vercel ni claves.
        console.error("Error en /api/soul-assistant:", err && err.message ? err.message : "error desconocido");
              res.status(502).json({ error: "El asesor no esta disponible en este momento, proba de nuevo en un rato" });
      }
};

module.exports._sanearHistorial = sanearHistorial;
