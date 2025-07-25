import { Router } from 'express';
import { createPart, addPartToInventory, updatePart, deletePart, getAllParts, getPartById } from '../controllers/partController';

const router = Router();

// GET /api/part - Get all parts
router.get('/', getAllParts);

// GET /api/part/:partId - Get a specific part by ID
router.get('/:partId', getPartById);

// POST /api/part - Register raw or assembled part
router.post('/', createPart);

// POST /api/part/inventory - Add inventory for multiple parts
router.post('/inventory', addPartToInventory);

// PUT /api/part/:partId - Update a part
router.put('/:partId', updatePart);

// DELETE /api/part/:partId - Delete a part
router.delete('/:partId', deletePart);


export default router; 