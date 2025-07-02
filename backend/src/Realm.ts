import mongoose, { Schema, Document } from 'mongoose';

export interface IRealm extends Document {
  owner_id: string;
  name: string;
  map_data: {
    spawnpoint: {
      roomIndex: number;
      x: number;
      y: number;
    };
    rooms: Array<{
      name: string;
      tilemap: Record<string, any>;
      channelId?: string;
    }>;
  };
  share_id: string;
  only_owner: boolean;
}

const TileSchema = new Schema({
  floor: { type: String },
  above_floor: { type: String },
  object: { type: String },
  impassable: { type: Boolean },
  teleporter: {
    roomIndex: { type: Number },
    x: { type: Number },
    y: { type: Number },
  },
  privateAreaId: { type: String },
}, { _id: false });

const RoomSchema = new Schema({
  name: { type: String, required: true },
  tilemap: { type: Schema.Types.Mixed, required: true }, // tilemap is a record of string -> TileSchema
  channelId: { type: String },
}, { _id: false });

const MapDataSchema = new Schema({
  spawnpoint: {
    roomIndex: { type: Number, required: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  rooms: { type: [RoomSchema], required: true },
}, { _id: false });

const RealmSchema: Schema = new Schema({
  owner_id: { type: String, required: true },
  name: { type: String, required: true },
  map_data: { type: MapDataSchema, required: true },
  share_id: { type: String, required: true, unique: true },
  only_owner: { type: Boolean, default: false },
});

export const Realm = mongoose.model<IRealm>('Realm', RealmSchema); 