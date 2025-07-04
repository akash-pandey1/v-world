import { RealmData } from './session'
import { z } from 'zod'

export function removeExtraSpaces(text: string) {
    let value = text.replace(/\s\s+/g, ' ')
    if (value.startsWith(' ')) {
        value = value.substring(1)
    }
    value = value.trim()
    return value
}

export function formatForComaprison(text: string) {
    return removeExtraSpaces(text.toLowerCase())
}

export function getRoomFromName(mapData: RealmData, name: string) {
    const room = mapData.rooms.find(room => formatForComaprison(room.name) === formatForComaprison(name))
    return room
}

export function getRoomNames(mapData: RealmData) {
    return mapData.rooms.map(room => room.name)
}

export function getRoomNamesWithChannelId(mapData: RealmData, channelId: string) {
    return mapData.rooms.filter(room => room.channelId === channelId).map(room => room.name)
}

export function formatEmailToName(email: string) {
    const name = email.split('@')[0]
    return name
}

const TeleporterSchema = z.object({
  roomIndex: z.number(),
  x: z.number(),
  y: z.number(),
})

const TileSchema = z.object({
  floor: z.string().optional(),
  above_floor: z.string().optional(),
  object: z.string().optional(),
  impassable: z.boolean().optional(),
  teleporter: TeleporterSchema.optional(),
  privateAreaId: z.string().optional(),
})

const TileMapSchema = z.record(z.string().regex(/^(-?\d+), (-?\d+)$/), TileSchema)

const RoomSchema = z.object({
  name: z.string(),
  tilemap: TileMapSchema,
  channelId: z.string().optional(),
})

const SpawnpointSchema = z.object({
  roomIndex: z.number(),
  x: z.number(),
  y: z.number(),
})

const RealmDataSchema = z.object({
  spawnpoint: SpawnpointSchema,
  rooms: z.array(RoomSchema),
})

export { RealmDataSchema, RoomSchema }