// URL rehberi adresleri: /api/targets
// Hatalar { error, code, params } biçiminde gönderilir (errors.ts).

import { Router } from "express";
import { listSavedTargets, createSavedTarget, deleteSavedTarget, suggestionFor } from "../services/savedTargets.js";
import { apiError, errorBody } from "../errors.js";

export function createSavedTargetRouter(): Router {
  const router = Router();

  // Liste (isteğe bağlı arama: ?search=test)
  router.get("/", async (req, res) => {
    res.json(await listSavedTargets(req.query.search));
  });

  // Kaydetme önerisi: ?url=http://... → { saved, runCount }
  router.get("/suggest", async (req, res) => {
    const url = typeof req.query.url === "string" ? req.query.url.trim() : "";
    if (!url) {
      return res.status(400).json(errorBody(apiError("URL_REQUIRED")));
    }
    res.json(await suggestionFor(url));
  });

  // Yeni kayıt: { name, url }
  router.post("/", async (req, res) => {
    const result = await createSavedTarget(req.body);
    if (!result.ok) {
      return res.status(result.status).json(errorBody(result.error));
    }
    res.status(201).json(result.target);
  });

  // Kayıt silme
  router.delete("/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json(errorBody(apiError("INVALID_ID")));
    }

    const deleted = await deleteSavedTarget(id);
    if (!deleted) {
      return res.status(404).json(errorBody(apiError("TARGET_NOT_FOUND")));
    }
    res.status(204).end();
  });

  return router;
}