// Target book endpoints: /api/targets
// Errors are sent as { error, code, params } (errors.ts).

import { Router } from "express";
import { listSavedTargets, createSavedTarget, deleteSavedTarget, suggestionFor } from "../services/savedTargets.js";
import { apiError, errorBody } from "../errors.js";

export function createSavedTargetRouter(): Router {
  const router = Router();

  // List (optional search: ?search=test)
  router.get("/", async (req, res) => {
    res.json(await listSavedTargets(req.query.search));
  });

  // Save suggestion: ?url=http://... → { saved, runCount }
  router.get("/suggest", async (req, res) => {
    const url = typeof req.query.url === "string" ? req.query.url.trim() : "";
    if (!url) {
      return res.status(400).json(errorBody(apiError("URL_REQUIRED")));
    }
    res.json(await suggestionFor(url));
  });

  // New entry: { name, url }
  router.post("/", async (req, res) => {
    const result = await createSavedTarget(req.body);
    if (!result.ok) {
      return res.status(result.status).json(errorBody(result.error));
    }
    res.status(201).json(result.target);
  });

  // Delete an entry
  router.delete("/:id", async (req, res) => {
    // Digits only (forms like "0x28" or "1e1" could also be converted to numbers)
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json(errorBody(apiError("INVALID_ID")));
    }
    const id = Number(req.params.id);

    const deleted = await deleteSavedTarget(id);
    if (!deleted) {
      return res.status(404).json(errorBody(apiError("TARGET_NOT_FOUND")));
    }
    res.status(204).end();
  });

  return router;
}