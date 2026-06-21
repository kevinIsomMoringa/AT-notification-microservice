import { Router } from 'express';
import { diagnosticsDashboard, diagnosticsLogJson } from '../controllers/diagnostics.controller';

const router = Router();

router.get('/diagnostics', diagnosticsDashboard);
router.get('/diagnostics/log', diagnosticsLogJson);

export default router;

