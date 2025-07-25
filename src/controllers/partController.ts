import { Request, Response } from 'express';
import { Part, IPart, PartType } from '../models/Part';
import mongoose, { Types } from 'mongoose';
import { MESSAGES } from '../constants/messages';

export const getAllParts = async (req: Request, res: Response) => {
  try {
    const parts = await Part.find().sort({ name: 1 });
    return res.json(parts);
  } catch (err: any) {
    return res.status(500).json({ message: MESSAGES.SERVER_ERROR, error: err.message });
  }
};

export const getPartById = async (req: Request, res: Response) => {
  try {
    const { partId } = req.params;
    const part = await Part.findById(partId);
    
    if (!part) {
      return res.status(404).json({ message: MESSAGES.PART_NOT_FOUND });
    }
    
    return res.json(part);
  } catch (err: any) {
    return res.status(500).json({ message: MESSAGES.SERVER_ERROR, error: err.message });
  }
};

function generatePartId(name: string, type: string) {
  return name.toLowerCase().replace(/\s+/g, '-') + '-' + type.toLowerCase();
}

export const createPart = async (req: Request, res: Response) => {
  try {
    const { name, type, parts } = req.body;
    if (!name || !type) {
      return res.status(400).json({ message: MESSAGES.NAME_TYPE_REQUIRED });
    }
    if (type !== 'RAW' && type !== 'ASSEMBLED') {
      return res.status(400).json({ message: MESSAGES.INVALID_PART_TYPE });
    }
    let formattedParts;
    if (type === 'ASSEMBLED') {
      if (!Array.isArray(parts) || parts.length === 0) {
        return res.status(400).json({ message: MESSAGES.ASSEMBLED_PARTS_REQUIRED });
      }

      formattedParts = parts.map(p => ({
        id: new Types.ObjectId(p.id),
        quantity: p.quantity
      }));
      const hasCycle = await (Part as any).hasCircularDependency('', formattedParts);
      if (hasCycle) {
        return res.status(400).json({ message: MESSAGES.CIRCULAR_DEPENDENCY });
      }
    }
    const part = new Part({
      name,
      type,
      parts: type === 'ASSEMBLED' ? formattedParts : undefined,
    });
    await part.save();
    return res.status(201).json(part);
  } catch (err: any) {
    if (err.code === 11000) {
      return res.status(409).json({ message: MESSAGES.PART_NAME_UNIQUE });
    }
    return res.status(500).json({ message: MESSAGES.SERVER_ERROR, error: err.message });
  }
};

export const updatePart = async (req: Request, res: Response) => {
  try {
    const { partId } = req.params;
    const { name, type, parts, quantity } = req.body;
    
    const part = await Part.findById(partId);
    if (!part) {
      return res.status(404).json({ message: MESSAGES.PART_NOT_FOUND });
    }

    if (type && type !== 'RAW' && type !== 'ASSEMBLED') {
      return res.status(400).json({ message: MESSAGES.INVALID_PART_TYPE });
    }

    let formattedParts;
    if (type === 'ASSEMBLED' || (part.type === 'ASSEMBLED' && parts)) {
      if (!Array.isArray(parts) || parts.length === 0) {
        return res.status(400).json({ message: MESSAGES.ASSEMBLED_PARTS_REQUIRED });
      }
      formattedParts = parts.map(p => ({
        id: new Types.ObjectId(p.id),
        quantity: p.quantity
      }));

      const hasCycle = await (Part as any).hasCircularDependency(partId, formattedParts);
      if (hasCycle) {
        return res.status(400).json({ message: MESSAGES.CIRCULAR_DEPENDENCY });
      }
    }

    if (name) part.name = name;
    if (type) part.type = type;
    if (formattedParts) part.parts = formattedParts;
    if (type === 'RAW') part.parts = undefined;
    if (typeof quantity === 'number') part.quantity = quantity;

    await part.save();
    return res.json(part);
  } catch (err: any) {
    if (err.code === 11000) {
      return res.status(409).json({ message: MESSAGES.PART_NAME_UNIQUE });
    }
    return res.status(500).json({ message: MESSAGES.SERVER_ERROR, error: err.message });
  }
};

export const deletePart = async (req: Request, res: Response) => {
  try {
    const { partId } = req.params;
    
    const part = await Part.findById(partId);
    if (!part) {
      return res.status(404).json({ message: MESSAGES.PART_NOT_FOUND });
    }

    const usedBy = await Part.find({
      type: 'ASSEMBLED',
      'parts.id': partId
    });

    if (usedBy.length > 0) {
      const usedByNames = usedBy.map(p => p.name).join(', ');
      return res.status(400).json({ 
        message: MESSAGES.PART_USED_BY(usedByNames)
      });
    }

    await Part.findByIdAndDelete(partId);
    return res.json({ message: MESSAGES.PART_DELETED });
  } catch (err: any) {
    return res.status(500).json({ message: MESSAGES.SERVER_ERROR, error: err.message });
  }
};

export const addPartToInventory = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    let partsToAdd: { partId: string, quantity: number }[] = [];
    if (Array.isArray(req.body.parts)) {
      partsToAdd = req.body.parts;
    } else if (req.params.partId && req.body.quantity) {
      partsToAdd = [{ partId: req.params.partId, quantity: req.body.quantity }];
    } else {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ status: MESSAGES.STATUS_FAILED, message: MESSAGES.QUANTITY_POSITIVE });
    }

    let allInsufficient: string[] = [];
    let results: { partId: string, status: string, message?: string }[] = [];

    for (const { partId, quantity } of partsToAdd) {
      if (!quantity || quantity <= 0) {
        results.push({ partId, status: MESSAGES.STATUS_FAILED, message: MESSAGES.QUANTITY_POSITIVE });
        continue;
      }
      const part = await Part.findById(partId).session(session);
      if (!part) {
        results.push({ partId, status: MESSAGES.STATUS_FAILED, message: MESSAGES.PART_NOT_FOUND });
        continue;
      }
      if (part.type === 'RAW') {
        part.quantity -= quantity;
        await part.save({ session });
        results.push({ partId, status: MESSAGES.STATUS_SUCCESS });
        continue;
      }

      async function checkAndDeductRaw(p: IPart, qty: number, visited = new Set<string>()): Promise<string[]> {
        if (visited.has(p._id.toString())) {
          return [p._id.toString()];
        }
        visited.add(p._id.toString());
        if (p.type === 'RAW') {
          if (p.quantity < qty) return [p._id.toString()];
          // Deduct raw part quantity
          p.quantity -= qty;
          await p.save({ session });
          return [];
        }
        let insufficient: string[] = [];
        for (const c of p.parts || []) {
          const cPart = await Part.findById(c.id).session(session);
          if (!cPart) {
            insufficient.push(c.id.toString());
            continue;
          }
          const needed = c.quantity * qty;
          const subInsufficient = await checkAndDeductRaw(cPart, needed, visited);
          if (subInsufficient.length > 0) {
            insufficient = insufficient.concat(subInsufficient);
          }
        }
        return insufficient;
      }
      const insufficient = await checkAndDeductRaw(part, quantity);
      if (insufficient.length > 0) {
        allInsufficient = allInsufficient.concat(insufficient);
        results.push({ partId, status: MESSAGES.STATUS_FAILED, message: MESSAGES.INSUFFICIENT_QUANTITY(insufficient) });
        continue;
      }
      part.quantity -= quantity;
      await part.save({ session });
      results.push({ partId, status: MESSAGES.STATUS_SUCCESS });
    }

    if (allInsufficient.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ status: MESSAGES.STATUS_FAILED, results });
    }
    await session.commitTransaction();
    session.endSession();
    return res.json({ status: MESSAGES.STATUS_SUCCESS, results });
  } catch (err: any) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ status: MESSAGES.STATUS_FAILED, message: err.message });
  }
}; 