import mongoose, { Schema, Document } from 'mongoose';

export interface IRealm extends Document {
  owner_id: string;
  name: string;
  map_data: any;
  share_id: string;
  only_owner: boolean;
}

const RealmSchema: Schema = new Schema({
  owner_id: { type: String, required: true },
  name: { type: String, required: true },
  map_data: { type: Schema.Types.Mixed, required: true },
  share_id: { type: String, required: true, unique: true },
  only_owner: { type: Boolean, default: false },
});

export const Realm = mongoose.model<IRealm>('Realm', RealmSchema); 