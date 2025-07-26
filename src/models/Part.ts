import { Schema, model, Document, Model, Types } from 'mongoose';

export const PART_TYPES = ['RAW', 'ASSEMBLED'] as const;
export type PartType = typeof PART_TYPES[number];

export interface IConstituentPart {
  id: Types.ObjectId;
  quantity: number;
}

export interface IPart extends Document {
  _id: Types.ObjectId;
  name: string;
  type: PartType;
  quantity: number;
  parts?: IConstituentPart[];
}

const ConstituentPartSchema = new Schema<IConstituentPart>({
  id: { type: Schema.Types.ObjectId, ref: 'Part', required: true },
  quantity: { type: Number, required: true, min: 1 },
}, { _id: false });

const PartSchema = new Schema<IPart>({
  name: { type: String, required: true, unique: true },
  type: { type: String, enum: PART_TYPES, required: true },
  quantity: { type: Number, default: 0, min: 0 },
  parts: {
    type: [ConstituentPartSchema],
    required: function (this: IPart) { return this.type === 'ASSEMBLED'; },
    default: undefined,
  },
});

export interface PartModelType extends Model<IPart> {
  hasCircularDependency(partId: string, parts: IConstituentPart[]): Promise<boolean>;
}

PartSchema.statics.hasCircularDependency = async function (
  partId: string,
  parts: IConstituentPart[]
): Promise<boolean> {
  const visited = new Set<string>();
  const model = this as PartModelType;
  async function dfs(currentId: string): Promise<boolean> {
    if (visited.has(currentId)) return false;
    visited.add(currentId);
    const part = await model.findById(currentId);
    if (!part || part.type !== 'ASSEMBLED' || !part.parts) return false;
    for (const p of part.parts) {
      if (p.id.toString() === partId) return true;
      if (await dfs(p.id.toString())) return true;
    }
    return false;
  }
  for (const p of parts) {
    if (await dfs(p.id.toString())) return true;
  }
  return false;
};

export const Part = model<IPart, PartModelType>('Part', PartSchema);