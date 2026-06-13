import express from "express";
import analizeControllerGemini from "../controllers/analizeControllerGemini.js";
import { authOrGenerateMiddleware } from "../middleware/authMiddleware.js";
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const router = express.Router();

// Match index.js which mounts this router at /analyze
router.post("/", authOrGenerateMiddleware, analizeControllerGemini);

export default router;

