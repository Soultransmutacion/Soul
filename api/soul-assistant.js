// api/soul-assistant.js — endpoint que consume el widget en index.html
const { runAdvisor } = require("../lib/soul-advisor");

module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
          res.status(405).json({ error: "Método no permitido" });
          return;
    }

    try {
          const { historial = [], mensaje } = req.body;

      if (!mensaje || typeof mensaje !== "string") {
              res.status(400).json({ error: "Falta el campo 'mensaje'" });
              return;
      }

      const resultado = await runAdvisor(historial, mensaje);

      res.status(200).json({
              texto: resultado.texto,
              historial: resultado.historial,
              acciones_reserva: resultado.acciones_reserva,
              items: resultado.items_mostrados
      });
    } catch (err) {
          console.error("Error en /api/soul-assistant:", err);
          res.status(500).json({ error: "Error interno del asesor" });
    }
};
