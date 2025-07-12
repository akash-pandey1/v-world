import { kickPlayer } from './sockets/helpers'
import { v4 as uuidv4 } from 'uuid'

export type RealmData = {
    spawnpoint: {
        roomIndex: number,
        x: number,
        y: number,
    },
    rooms: Room[],
}

export interface Room {
    name: string,
    tilemap: {
        [key: `${number}, ${number}`]: {
            floor?: string,
            above_floor?: string,
            object?: string,
            impassable?: boolean
            teleporter?: {
                roomIndex: number,
                x: number,
                y: number,
            }
        }
    }
    channelId?: string
}

export interface Player {
    uid: string,
    userId: string, // JWT user ID for identifying the local player
    username: string,
    x: number,
    y: number,
    room: number,
    socketId: string,
    skin: string,
    proximityId: string | null,
}

export const defaultSkin = '009'

export const Spawnpoint = {
    roomIndex: 0,
    x: 0,
    y: 0,
}

export type RoomData = { [key: number]: Player[] }

export class SessionManager {
    private sessions: { [key: string]: Session } = {}
    private playerIdToRealmId: { [key: string]: string } = {}
    private socketIdToPlayerId: { [key: string]: string } = {}

    public createSession(id: string, mapData: RealmData): void {
        console.log(`[SessionManager] Creating session for realmId=${id}, rooms.length=${mapData.rooms?.length}`);
        const realm = new Session(id, mapData)

        this.sessions[id] = realm
    }

    public getSession(id: string): Session {
        const session = this.sessions[id]
        if (session) {
            console.log(`[SessionManager] getSession: Found session for realmId=${id}, rooms.length=${session.map_data.rooms?.length}`);
        } else {
            console.log(`[SessionManager] getSession: No session for realmId=${id}`);
        }
        return session
    }

    public getPlayerSession(uid: string): Session {
        const realmId = this.playerIdToRealmId[uid]
        console.log(`[SessionManager] getPlayerSession: uid=${uid}, realmId=${realmId}`);
        console.log(`[SessionManager] Available sessions:`, Object.keys(this.sessions));
        console.log(`[SessionManager] playerIdToRealmId mapping:`, this.playerIdToRealmId);
        return this.sessions[realmId]
    }

    public addPlayerToSession(socketId: string, realmId: string, uid: string, username: string, skin: string, userId: string) {
        console.log(`[SessionManager] addPlayerToSession: socketId=${socketId}, realmId=${realmId}, uid=${uid}, username=${username}, skin=${skin}, userId=${userId}`);
        this.sessions[realmId].addPlayer(socketId, uid, username, skin, userId)
        this.playerIdToRealmId[uid] = realmId
        this.socketIdToPlayerId[socketId] = uid
        console.log(`[SessionManager] Player added. Total players in session: ${this.sessions[realmId].getPlayerCount()}`);
        console.log(`[SessionManager] All players in session:`, this.sessions[realmId].getPlayerIds());
        console.log(`[SessionManager] socketIdToPlayerId mapping:`, this.socketIdToPlayerId);
    }

    public logOutPlayer(uid: string) {
        console.log(`[SessionManager] logOutPlayer called: uid=${uid}`);
        const realmId = this.playerIdToRealmId[uid]
        // If the player is not in a realm, do nothing
        if (!realmId) {
            console.log(`[SessionManager] Player not in any realm: uid=${uid}`);
            return
        }

        const player = this.sessions[realmId].getPlayer(uid)
        console.log(`[SessionManager] Removing player from session: uid=${uid}, realmId=${realmId}`);
        delete this.socketIdToPlayerId[player.socketId]
        delete this.playerIdToRealmId[uid]
        this.sessions[realmId].removePlayer(uid)
        console.log(`[SessionManager] Player removed. Total players in session: ${this.sessions[realmId].getPlayerCount()}`);
    }

    public getSocketIdsInRoom(realmId: string, roomIndex: number): string[] {
        return this.sessions[realmId].getPlayersInRoom(roomIndex).map(player => player.socketId)
    }

    public logOutBySocketId(socketId: string) {
        const uid = this.socketIdToPlayerId[socketId]
        console.log(`[SessionManager] logOutBySocketId: socketId=${socketId}, uid=${uid}`);
        console.log(`[SessionManager] Available socketIdToPlayerId mappings:`, Object.keys(this.socketIdToPlayerId));
        if (!uid) {
            console.log(`[SessionManager] No uid found for socketId: ${socketId}`);
            return false
        }

        this.logOutPlayer(uid)
        delete this.socketIdToPlayerId[socketId]
        delete this.playerIdToRealmId[uid]
        return true
    }

    public terminateSession(id: string, reason: string) {
        const session = this.sessions[id]
        if (!session) return

        const players = session.getPlayerIds()
        players.forEach(player => {
            kickPlayer(player, reason)
        })

        delete this.sessions[id]
    }
}

export class Session {
    private playerRooms: { [key: number]: Set<string> } = {}

    // roomIndex -> position -> uid
    private playerPositions: { [key: number]: { [key: string]: Set<string> } } = {}

    public players: { [key: string]: Player } = {}
    public id: string
    public map_data: RealmData 

    constructor(id: string, mapData: RealmData) {
        this.id = id
        this.map_data = mapData 

        for (let i = 0; i < mapData.rooms.length; i++) {
            this.playerRooms[i] = new Set<string>()
            this.playerPositions[i] = {}
        }
    }

    public addPlayer(socketId: string, uid: string, username: string, skin: string, userId: string) {
        console.log(`[Session] addPlayer called: socketId=${socketId}, uid=${uid}, username=${username}, skin=${skin}, userId=${userId}`);
        // Remove player if they already exist (to handle reconnections)
        this.removePlayer(uid)
        const spawnIndex = this.map_data.spawnpoint.roomIndex
        const spawnX = this.map_data.spawnpoint.x
        const spawnY = this.map_data.spawnpoint.y

        console.log(`[Session] addPlayer: spawnIndex=${spawnIndex}, rooms.length=${this.map_data.rooms.length}`);
        if (!this.playerRooms.hasOwnProperty(spawnIndex)) {
            throw new Error(`[Session] Invalid spawnIndex in addPlayer: ${spawnIndex}. playerRooms: ${JSON.stringify(Object.keys(this.playerRooms))}`);
        }

        // Find an available spawn position
        let finalX = spawnX;
        let finalY = spawnY;
        const coordKey = `${spawnX}, ${spawnY}`;
        
        // If there are already players at the spawn point, find a nearby position
        if (this.playerPositions[spawnIndex][coordKey] && this.playerPositions[spawnIndex][coordKey].size > 0) {
            console.log(`[Session] Spawn point occupied, finding nearby position`);
            // Try positions in a spiral pattern around the spawn point
            const offsets = [
                [0, 1], [1, 0], [0, -1], [-1, 0],  // Adjacent tiles
                [1, 1], [-1, 1], [1, -1], [-1, -1], // Diagonal tiles
                [0, 2], [2, 0], [0, -2], [-2, 0],  // 2 tiles away
            ];
            
            for (const [dx, dy] of offsets) {
                const testX = spawnX + dx;
                const testY = spawnY + dy;
                const testKey = `${testX}, ${testY}`;
                
                if (!this.playerPositions[spawnIndex][testKey] || this.playerPositions[spawnIndex][testKey].size === 0) {
                    finalX = testX;
                    finalY = testY;
                    console.log(`[Session] Found available position at (${finalX}, ${finalY})`);
                    break;
                }
            }
        }

        const player: Player = {
            uid,
            userId: userId, // Assuming uid is the userId for now
            username,
            x: finalX,
            y: finalY,
            room: spawnIndex,
            socketId: socketId,
            skin,
            proximityId: null,
        }

        this.playerRooms[spawnIndex].add(uid)
        const finalCoordKey = `${finalX}, ${finalY}`;
        if (!this.playerPositions[spawnIndex][finalCoordKey]) {
            this.playerPositions[spawnIndex][finalCoordKey] = new Set<string>()
        }
        this.playerPositions[spawnIndex][finalCoordKey].add(uid)
        this.players[uid] = player
        console.log(`[Session] Player added successfully at (${finalX}, ${finalY}). Total players: ${Object.keys(this.players).length}`);
        console.log(`[Session] Players in room ${spawnIndex}: ${Array.from(this.playerRooms[spawnIndex])}`);
    }

    public removePlayer(uid: string): void {
        console.log(`[Session] removePlayer called: uid=${uid}`);
        if (!this.players[uid]) {
            console.log(`[Session] Player not found: uid=${uid}`);
            return
        }

        const player = this.players[uid]
        console.log(`[Session] Removing player from room ${player.room}: uid=${uid}`);
        this.playerRooms[player.room].delete(uid)

        const coordKey = `${player.x}, ${player.y}`
        if (this.playerPositions[player.room][coordKey]) {
            this.playerPositions[player.room][coordKey].delete(uid)
            // Remove the coordinate entry if no players are left at this position
            if (this.playerPositions[player.room][coordKey].size === 0) {
                delete this.playerPositions[player.room][coordKey]
            }
        }

        delete this.players[uid]
        console.log(`[Session] Player removed. Total players: ${Object.keys(this.players).length}`);
    }

    public changeRoom(uid: string, roomIndex: number, x: number, y: number): string[] {
        if (!this.players[uid]) return []

        const player = this.players[uid]

        this.playerRooms[player.room].delete(uid)
        this.playerRooms[roomIndex].add(uid)

        const coordKey = `${player.x}, ${player.y}`
        if (this.playerPositions[player.room][coordKey]) {
            this.playerPositions[player.room][coordKey].delete(uid)
        }

        player.room = roomIndex
        return this.movePlayer(uid, x, y)
    }

    public getPlayersInRoom(roomIndex: number): Player[] {
        const players = Array.from(this.playerRooms[roomIndex] || [])
            .map(uid => this.players[uid])
            .filter(player => player !== undefined)

        console.log(`[Session] getPlayersInRoom: roomIndex=${roomIndex}, players=${players.length}`);
        return players
    }

    public getRoomWithChannelId(channelId: string): number | null {
        const index = this.map_data.rooms.findIndex(room => room.channelId === channelId)
        return index !== -1 ? index : null
    }

    public getPlayerCount() {
        return Object.keys(this.players).length
    }

    public getPlayer(uid: string): Player {
        return this.players[uid]
    }

    public getPlayerIds(): string[] {
        return Object.keys(this.players)
    }

    public getPlayerRoom(uid: string): number {
        if (!this.players[uid]) {
            console.log(`[Session] getPlayerRoom: Player not found: uid=${uid}`);
            return 0; // Default to room 0 if player not found
        }
        return this.players[uid].room
    }

    public movePlayer(uid: string, x: number, y: number): string[] {
        const oldCoordKey = `${this.players[uid].x}, ${this.players[uid].y}`
        if (this.playerPositions[this.players[uid].room][oldCoordKey]) {
            this.playerPositions[this.players[uid].room][oldCoordKey].delete(uid)
        }

        this.players[uid].x = x
        this.players[uid].y = y

        const coordKey = `${x}, ${y}`
        if (!this.playerPositions[this.players[uid].room][coordKey]) {
            this.playerPositions[this.players[uid].room][coordKey] = new Set<string>()
        }

        this.playerPositions[this.players[uid].room][coordKey].add(uid)

        return this.setProximityIdsWithPlayer(uid)
    }

    public setProximityIdsWithPlayer(uid: string): string[] {
        const player = this.players[uid]
        const proximityTiles = this.getProximityTiles(player.x, player.y)
        const changedPlayers: Set<string> = new Set<string>()
        const originalProximityId = player.proximityId
        let otherPlayersExist = false
        for (const tile of proximityTiles) {
            const playersInTile = this.playerPositions[player.room][tile]
            if (!playersInTile) continue
            // iterate over players in tile
            for (const otherUid of playersInTile) {
                if (otherUid === uid) continue
                otherPlayersExist = true

                const otherPlayer = this.players[otherUid]
                if (otherPlayer.proximityId === null) {
                    if (player.proximityId === null) {
                        // set the proximity id to a uuid
                        player.proximityId = uuidv4()
                        // Only add uid if proximityId changed
                        if (player.proximityId !== originalProximityId) {
                            changedPlayers.add(uid)
                        }
                    }

                    otherPlayer.proximityId = player.proximityId
                    changedPlayers.add(otherUid)
                } else if (player.proximityId !== otherPlayer.proximityId) {
                    player.proximityId = otherPlayer.proximityId
                    // Only add uid if proximityId changed
                    if (player.proximityId !== originalProximityId) {
                        changedPlayers.add(uid)
                    }
                } 
            }
        }

        if (!otherPlayersExist) {
            player.proximityId = null
            // Only add uid if proximityId changed
            if (originalProximityId !== null) {
                changedPlayers.add(uid)
            }
        }

        return Array.from(changedPlayers)
    }

    private getProximityTiles(x: number, y: number): string[] {
        const proximityTiles: string[] = []
        const range = 3

        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                const tileX = x + dx
                const tileY = y + dy
                proximityTiles.push(`${tileX}, ${tileY}`)
            }
        }
        return proximityTiles
    }
}

const sessionManager = new SessionManager()

export { sessionManager }
