import { Request, Response } from 'express';
import mongoose, { ClientSession } from 'mongoose';
import { PartService } from '../services/PartService';
import { InventoryService } from '../services/InventoryService';
import { CreatePartInput, UpdatePartInput, InventoryOperation } from '../types/PartTypes';
import { MESSAGES } from '../constants/messages';

// Initialize services
const partService = new PartService();
const inventoryService = new InventoryService();

/**
 * Get all parts
 * @route GET /api/part
 */
export const getAllParts = async (req: Request, res: Response): Promise<Response> => {
  try {
    const parts = await partService.getAllParts();
    return res.json(parts);
  } catch (error) {
    console.error('Error getting all parts:', error);
    return res.status(500).json({ 
      message: MESSAGES.SERVER_ERROR, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Get a specific part by ID
 * @route GET /api/part/:partId
 */
export const getPartById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { partId } = req.params;
    const part = await partService.getPartById(partId);
    return res.json(part);
  } catch (error) {
    console.error('Error getting part by ID:', error);
    return res.status(500).json({ 
      message: MESSAGES.SERVER_ERROR, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Create a new part
 * @route POST /api/part
 */
export const createPart = async (req: Request, res: Response): Promise<Response> => {
  try {
    const createData = req.body as CreatePartInput;
    const part = await partService.createPart(createData);
    return res.status(201).json(part);
  } catch (error) {
    console.error('Error creating part:', error);
    return res.status(500).json({ 
      message: MESSAGES.SERVER_ERROR, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Update an existing part
 * @route PUT /api/part/:partId
 */
export const updatePart = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { partId } = req.params;
    const updateData = req.body as UpdatePartInput;
    const part = await partService.updatePart(partId, updateData);
    return res.json(part);
  } catch (error) {
    console.error('Error updating part:', error);
    return res.status(500).json({ 
      message: MESSAGES.SERVER_ERROR, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Delete a part
 * @route DELETE /api/part/:partId
 */
export const deletePart = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { partId } = req.params;
    const message = await partService.deletePart(partId);
    return res.json({ message });
  } catch (error) {
    console.error('Error deleting part:', error);
    return res.status(500).json({ 
      message: MESSAGES.SERVER_ERROR, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Add parts to inventory (deduct quantities)
 * @route POST /api/part/inventory
 * @route POST /api/part/:partId
 */
export const addPartToInventory = async (req: Request, res: Response): Promise<Response> => {
  const session: ClientSession = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Parse request data
    let partsToDeduct: InventoryOperation[] = [];
    
    if (Array.isArray(req.body.parts)) {
      partsToDeduct = req.body.parts;
    } else if (req.params.partId && req.body.quantity) {
      partsToDeduct = [{ 
        partId: req.params.partId, 
        quantity: req.body.quantity 
      }];
    } else {
      return res.status(400).json({ 
        status: MESSAGES.STATUS_FAILED, 
        message: MESSAGES.QUANTITY_POSITIVE 
      });
    }

    // Process inventory deduction
    const { allInsufficient, results } = await inventoryService.deductParts(partsToDeduct, session);

    // Handle insufficient quantities
    if (allInsufficient.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        status: MESSAGES.STATUS_FAILED, 
        results 
      });
    }

    // Commit transaction
    await session.commitTransaction();
    session.endSession();
    
    return res.json({ 
      status: MESSAGES.STATUS_SUCCESS, 
      results 
    });
    
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error adding part to inventory:', error);
    return res.status(500).json({ 
      message: MESSAGES.SERVER_ERROR, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}; 