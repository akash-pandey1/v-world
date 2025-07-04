import { Server } from 'socket.io'
import { JoinRealm, Disconnect, OnEventCallback, MovePlayer, Teleport, ChangedSkin, NewMessage } from './socket-types'
import { sessionManager } from '../session'
import { removeExtraSpaces } from '../utils'
import { kickPlayer } from './helpers'
import { formatEmailToName } from '../utils'
import path from 'path'
import fs from 'fs'
import { Realm } from '../Realm'

const joiningInProgress = new Set<string>()

export function sockets(io: Server) {
    // Handle a connection
    io.on('connection', (socket) => {

        function on(eventName: string, _schema: any, callback: OnEventCallback) {
            socket.on(eventName, (data: any) => {
                // No schema validation
                const session = sessionManager.getPlayerSession(socket.handshake.query.uid as string)
                if (!session) {
                    return
                }
                callback({ session, data })
            })
        }

        function emit(eventName: string, data: any) {
            const session = sessionManager.getPlayerSession(socket.handshake.query.uid as string)
            if (!session) {
                return
            }

            const room = session.getPlayerRoom(socket.handshake.query.uid as string)
            const players = session.getPlayersInRoom(room)

            for (const player of players) {
                if (player.socketId === socket.id) continue

                io.to(player.socketId).emit(eventName, data)
            }
        }

        function emitToSocketIds(socketIds: string[], eventName: string, data: any) {
            for (const socketId of socketIds) {
                io.to(socketId).emit(eventName, data)
            }
        }

        socket.on('joinRealm', async (realmData: any) => {
            const uid = socket.handshake.query.uid as string
            console.log('[SOCKET] joinRealm called. socket.handshake.query.uid:', uid, 'realmData.uid:', realmData.uid);
            const rejectJoin = (reason: string) => {
                socket.emit('failedToJoinRoom', reason)
                joiningInProgress.delete(uid)
            }

            // Always fetch the realm from the database using realmId
            const realm = await Realm.findOne({ _id: realmData.realmId });
            if (!realm) return rejectJoin('Space not found.');

            if (joiningInProgress.has(uid)) {
                rejectJoin('Already joining a space.')
            }
            joiningInProgress.add(uid)

            const session = sessionManager.getSession(realmData.realmId)
            if (session) {
                const playerCount = session.getPlayerCount()
                if (playerCount >= 30) {
                    return rejectJoin("Space is full. It's 30 players max.")
                } 
            }

            // Load each room's tilemap from file (as in REST API)
            const tilemapDir = path.join(__dirname, '../room_tilemaps');
            const map_data = JSON.parse(JSON.stringify(realm.map_data));
            for (let i = 0; i < map_data.rooms.length; i++) {
                const room = map_data.rooms[i];
                if (room.tilemapFile) {
                    const filePath = path.join(tilemapDir, room.tilemapFile);
                    try {
                        const raw = fs.readFileSync(filePath, 'utf-8');
                        room.tilemap = JSON.parse(raw);
                        console.log(`[SOCKET] Loaded tilemap for room ${i} (${room.name}) from ${room.tilemapFile}`);
                    } catch (e) {
                        room.tilemap = {};
                        const errMsg = (e instanceof Error) ? e.message : String(e);
                        console.log(`[SOCKET] Failed to load tilemap for room ${i} (${room.name}) from ${room.tilemapFile}:`, errMsg);
                    }
                } else {
                    console.log(`[SOCKET] No tilemapFile for room ${i} (${room.name})`);
                }
            }
            console.log('[SOCKET] Final map_data before session creation:', JSON.stringify(map_data));

            const join = async () => {
                // Defensive: check map_data.rooms
                console.log('[SOCKET] About to create session with map_data:', JSON.stringify(map_data));
                if (!map_data.rooms || !Array.isArray(map_data.rooms) || map_data.rooms.length === 0) {
                    return rejectJoin('Map data is missing or corrupted. No rooms found.');
                }
                if (!sessionManager.getSession(realmData.realmId)) {
                    sessionManager.createSession(realmData.realmId, map_data)
                }

                const currentSession = sessionManager.getPlayerSession(uid)
                if (currentSession) {
                    kickPlayer(uid, 'You have logged in from another location.')
                }

                // const user = users.getUser(uid)!
                // const username = formatEmailToName(user.user_metadata.email)
                const username = 'Anonymous'; // TODO: Replace with real user name from JWT/session
                sessionManager.addPlayerToSession(socket.id, realmData.realmId, uid, username, realmData.skin)
                const newSession = sessionManager.getPlayerSession(uid)
                const player = newSession.getPlayer(uid)   

                // Send all current players in the room to the joining client
                const allPlayers = newSession.getPlayersInRoom(player.room);
                socket.emit('currentPlayers', allPlayers);

                socket.join(realmData.realmId)
                socket.emit('joinedRealm')
                emit('playerJoinedRoom', player)
                joiningInProgress.delete(uid)
            }

            // Always call join() after loading map_data, regardless of owner
            if (realm.only_owner) {
                return rejectJoin('This realm is private right now. Come back later!')
            }
            if (realm.share_id === realmData.shareId || realm.owner_id === socket.handshake.query.uid) {
                return join()
            } else {
                return rejectJoin('The share link has been changed.')
            }
        })

        // Handle a disconnection
        on('disconnect', Disconnect, ({ session, data }) => {
            const uid = socket.handshake.query.uid as string
            const socketIds = sessionManager.getSocketIdsInRoom(session.id, session.getPlayerRoom(uid))
            const success = sessionManager.logOutBySocketId(socket.id)
            if (success) {
                emitToSocketIds(socketIds, 'playerLeftRoom', uid)
                // users.removeUser(uid)
                // TODO: Remove user from session if needed
            }
        })

        on('movePlayer', MovePlayer, ({ session, data }) => {  
            const player = session.getPlayer(socket.handshake.query.uid as string)
            const changedPlayers = session.movePlayer(player.uid, data.x, data.y)

            console.log(`[SOCKET] movePlayer received from uid=${player.uid}, x=${data.x}, y=${data.y}`);

            emit('playerMoved', {
                uid: player.uid,
                x: player.x,
                y: player.y
            })

            console.log(`[SOCKET] emit('playerMoved') for uid=${player.uid} to other players in room.`);

            for (const uid of changedPlayers) {
                const changedPlayerData = session.getPlayer(uid)

                emitToSocketIds([changedPlayerData.socketId], 'proximityUpdate', {
                    proximityId: changedPlayerData.proximityId
                })
            }
        })  

        on('teleport', Teleport, ({ session, data }) => {
            const uid = socket.handshake.query.uid as string
            const player = session.getPlayer(uid)
            if (player.room !== data.roomIndex) {
                emit('playerLeftRoom', uid)
                const session = sessionManager.getPlayerSession(uid)
                const changedPlayers = session.changeRoom(uid, data.roomIndex, data.x, data.y)
                emit('playerJoinedRoom', player)

                for (const uid of changedPlayers) {
                    const changedPlayerData = session.getPlayer(uid)

                    emitToSocketIds([changedPlayerData.socketId], 'proximityUpdate', {
                        proximityId: changedPlayerData.proximityId
                    })
                }
            } else {
                const changedPlayers = session.movePlayer(player.uid, data.x, data.y)
                emit('playerTeleported', { uid, x: player.x, y: player.y })

                for (const uid of changedPlayers) {
                    const changedPlayerData = session.getPlayer(uid)

                    emitToSocketIds([changedPlayerData.socketId], 'proximityUpdate', {
                        proximityId: changedPlayerData.proximityId
                    })
                }
            }
        })

        on('changedSkin', ChangedSkin, ({ session, data }) => {
            const uid = socket.handshake.query.uid as string
            const player = session.getPlayer(uid)
            player.skin = data
            emit('playerChangedSkin', { uid, skin: player.skin })
        })

        on('sendMessage', NewMessage, ({ session, data }) => {
            // cannot exceed 300 characters
            if (data.length > 300 || data.trim() === '') return

            const message = removeExtraSpaces(data)

            const uid = socket.handshake.query.uid as string
            emit('receiveMessage', { uid, message })
        })
    })
}