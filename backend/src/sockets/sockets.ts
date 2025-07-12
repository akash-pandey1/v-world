import { Server } from 'socket.io'
import { JoinRealm, Disconnect, OnEventCallback, MovePlayer, Teleport, ChangedSkin, NewMessage } from './socket-types'
import { sessionManager } from '../session'
import { removeExtraSpaces } from '../utils'
import { kickPlayer } from './helpers'
import { formatEmailToName } from '../utils'
import path from 'path'
import fs from 'fs'
import { Realm } from '../Realm'
import { v4 as uuidv4 } from 'uuid'

const joiningInProgress = new Set<string>()
// Map socket IDs to UIDs - use user ID from JWT instead of generating new UUIDs
const socketToUid = new Map<string, string>()

export function sockets(io: Server) {
    // Handle a connection
    io.on('connection', (socket) => {
        // Don't generate UID here - wait until we have user data from JWT
        console.log(`[SOCKET] New connection: socketId=${socket.id}`)

        function on(eventName: string, _schema: any, callback: OnEventCallback) {
            socket.on(eventName, (data: any) => {
                // Use UID from socket mapping
                const uid = socketToUid.get(socket.id)
                if (!uid) {
                    console.log(`[SOCKET] No UID found for socketId: ${socket.id}`);
                    return
                }
                const session = sessionManager.getPlayerSession(uid)
                if (!session) {
                    console.log(`[SOCKET] No session found for uid: ${uid}`);
                    return
                }
                callback({ session, data })
            })
        }

        function emit(eventName: string, data: any) {
            const uid = socketToUid.get(socket.id)
            if (!uid) {
                console.log(`[SOCKET] emit function: No UID found for socketId: ${socket.id}`);
                return
            }
            const session = sessionManager.getPlayerSession(uid)
            if (!session) {
                console.log(`[SOCKET] emit function: No session found for uid: ${uid}`);
                return
            }

            const room = session.getPlayerRoom(uid)
            const players = session.getPlayersInRoom(room)
            console.log(`[SOCKET] emit function: eventName=${eventName}, room=${room}, players in room: ${players.length}`);

            let emittedCount = 0;
            for (const player of players) {
                if (player.socketId === socket.id) {
                    console.log(`[SOCKET] Skipping sender socketId: ${socket.id}`);
                    continue
                }

                console.log(`[SOCKET] Emitting ${eventName} to socketId: ${player.socketId}, uid: ${player.uid}`);
                io.to(player.socketId).emit(eventName, data)
                emittedCount++;
            }
            console.log(`[SOCKET] emit function: Emitted ${eventName} to ${emittedCount} players`);
            
            // Debug: Check if the socket is still connected
            if (emittedCount === 0) {
                console.log(`[SOCKET] WARNING: No players received ${eventName} event. All players:`, players.map(p => ({ uid: p.uid, socketId: p.socketId })));
            }
        }

        function emitToSocketIds(socketIds: string[], eventName: string, data: any) {
            for (const socketId of socketIds) {
                io.to(socketId).emit(eventName, data)
            }
        }

        socket.on('joinRealm', async (realmData: any) => {
            // Get user data from authenticated socket
            const user = socket.data.user;
            console.log('[SOCKET] Authenticated user from JWT:', user);
            
            if (!user || !user.id) {
                console.log('[SOCKET] No user data or user ID found in JWT');
                socket.emit('failedToJoinRoom', 'Authentication failed');
                return;
            }
            
            // Use user ID as UID for consistency across reconnections
            const uid = user.id;
            socketToUid.set(socket.id, uid);
            console.log(`[SOCKET] Using user ID as UID: socketId=${socket.id}, uid=${uid}`);
            
            console.log('[SOCKET] joinRealm called. uid:', uid, 'realmData.uid:', realmData.uid);
            console.log('[SOCKET] socket.id:', socket.id, 'realmData.realmId:', realmData.realmId);
            console.log('[SOCKET] realmData.shareId:', realmData.shareId);
            console.log('[SOCKET] realmData.userId:', realmData.userId, 'realmData.isOwner:', realmData.isOwner);
            console.log('[SOCKET] JWT user ID:', user?.id);
            console.log('[SOCKET] Current joiningInProgress:', Array.from(joiningInProgress));
            
            const rejectJoin = (reason: string) => {
                console.log('[SOCKET] Rejecting join for uid:', uid, 'reason:', reason);
                socket.emit('failedToJoinRoom', reason)
                joiningInProgress.delete(uid)
            }

            // Always fetch the realm from the database using realmId
            const realm = await Realm.findOne({ _id: realmData.realmId });
            if (!realm) return rejectJoin('Space not found.');

            console.log('[SOCKET] Found realm:', { 
                realmId: realm._id, 
                share_id: realm.share_id, 
                owner_id: realm.owner_id,
                only_owner: realm.only_owner 
            });

            // Allow multiple players to join simultaneously
            console.log('[SOCKET] Adding player to joiningInProgress. uid:', uid);
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
            console.log('[SOCKET] Final map_data before session creation: rooms.length=', map_data.rooms.length);

            // Check authorization before proceeding
            if (realm.only_owner) {
                console.log('[SOCKET] Realm is private, rejecting join. uid:', uid);
                return rejectJoin('This realm is private right now. Come back later!')
            }
            
            // Check if user is the owner using JWT user ID
            const jwtUserId = user?.id;
            const isOwner = jwtUserId === realm.owner_id;
            console.log('[SOCKET] Owner check:', { 
                isOwner, 
                jwtUserId: jwtUserId, 
                realmOwnerId: realm.owner_id, 
                realmDataUserId: realmData.userId, 
                realmDataIsOwner: realmData.isOwner 
            });
            
            // Allow owner to join without shareId, or allow anyone with correct shareId
            if (isOwner) {
                console.log('[SOCKET] Player is owner, allowing join. uid:', uid);
            } else if (realmData.shareId && realm.share_id === realmData.shareId) {
                console.log('[SOCKET] Player authorized via share link, allowing join. uid:', uid);
            } else if (!realmData.shareId) {
                console.log('[SOCKET] No shareId provided and not owner, rejecting join. uid:', uid);
                return rejectJoin('Share link is required to join this realm.')
            } else {
                console.log('[SOCKET] Share link mismatch, rejecting join. uid:', uid, 'realm.share_id:', realm.share_id, 'realmData.shareId:', realmData.shareId);
                return rejectJoin('The share link has been changed.')
            }

            const join = async () => {
                // Defensive: check map_data.rooms
                console.log('[SOCKET] About to create session with map_data.rooms.length:', map_data.rooms.length);
                if (!map_data.rooms || !Array.isArray(map_data.rooms) || map_data.rooms.length === 0) {
                    return rejectJoin('Map data is missing or corrupted. No rooms found.');
                }
                
                // Only create session if it doesn't exist
                const sessionBeforeJoin = sessionManager.getSession(realmData.realmId);
                if (!sessionBeforeJoin) {
                    console.log('[SOCKET] Creating new session for realmId:', realmData.realmId);
                    sessionManager.createSession(realmData.realmId, map_data)
                } else {
                    console.log('[SOCKET] Using existing session for realmId:', realmData.realmId, 'current players:', sessionBeforeJoin.getPlayerCount());
                }

                // Check if player is already in a session and kick them
                const currentSession = sessionManager.getPlayerSession(uid)
                if (currentSession) {
                    console.log('[SOCKET] Player already in session, kicking from previous location. uid:', uid);
                    kickPlayer(uid, 'You have logged in from another location.')
                }

                // Use JWT user data for username
                const username = user?.name || formatEmailToName(user?.email) || 'Anonymous';
                const jwtUserId = user?.id || uid; // Use JWT user ID or fallback to uid
                console.log('[SOCKET] About to add player to session. uid:', uid, 'socketId:', socket.id, 'realmId:', realmData.realmId, 'username:', username, 'jwtUserId:', jwtUserId);
                
                // Get existing players BEFORE adding the new player
                const existingSession = sessionManager.getSession(realmData.realmId);
                const existingPlayers = existingSession ? existingSession.getPlayersInRoom(0) : [];
                console.log('[SOCKET] Existing players before join:', existingPlayers.map((p: any) => ({ uid: p.uid, username: p.username })));
                
                sessionManager.addPlayerToSession(socket.id, realmData.realmId, uid, username, realmData.skin, jwtUserId)
                const newSession = sessionManager.getPlayerSession(uid)
                const player = newSession.getPlayer(uid)   
                console.log('[SOCKET] Player added successfully. player:', player);

                // Send existing players to the joining client (not including the joining player)
                console.log('[SOCKET] Sending currentPlayers to client. existingPlayers count:', existingPlayers.length);
                console.log('[SOCKET] All players in session after join:', newSession.getPlayerIds());
                socket.emit('currentPlayers', existingPlayers);
                
                // Notify existing players when someone joins (if there are other players besides the joining one)
                if (existingPlayers.length > 0) {
                    console.log('[SOCKET] Other players detected, emitting playerJoinedRoom to existing players. existingPlayers count:', existingPlayers.length);
                    emit('playerJoinedRoom', player);
                    
                    // DO NOT send currentPlayers again - this causes duplicates!
                    // The existing players already have the correct state
                } else {
                    console.log('[SOCKET] First player joining, no need to notify others');
                }

                socket.join(realmData.realmId)
                socket.emit('joinedRealm')
                joiningInProgress.delete(uid)
                console.log('[SOCKET] Join completed successfully for uid:', uid);
                console.log('[SOCKET] Socket state after join - connected:', socket.connected, 'id:', socket.id);
                
                // Add a timeout to clear joiningInProgress in case of issues
                setTimeout(() => {
                    joiningInProgress.delete(uid)
                }, 10000)
            }

            try {
                await join()
            } catch (error) {
                console.error('[SOCKET] Error during join:', error)
                rejectJoin('Internal server error during join')
            }
        })

        // Handle a disconnection
        on('disconnect', Disconnect, ({ session, data }) => {
            const uid = socketToUid.get(socket.id)
            if (!uid) {
                console.log(`[SOCKET] No UID found for disconnected socket: ${socket.id}`);
                return
            }
            
            console.log(`[SOCKET] Player disconnected: uid=${uid}, socketId=${socket.id}`);
            console.log(`[SOCKET] Socket connected: ${socket.connected}`);
            
            // Remove from joiningInProgress
            joiningInProgress.delete(uid);
            
            console.log(`[SOCKET] Session before disconnect: ${session.id}, total players: ${session.getPlayerCount()}`);
            const socketIds = sessionManager.getSocketIdsInRoom(session.id, session.getPlayerRoom(uid))
            const success = sessionManager.logOutBySocketId(socket.id)
            if (success) {
                console.log(`[SOCKET] Player logged out successfully: uid=${uid}`);
                emitToSocketIds(socketIds, 'playerLeftRoom', uid)
                
                // DO NOT send currentPlayers again - this can cause issues
                // The remaining players will handle the player removal via playerLeftRoom
            } else {
                console.log(`[SOCKET] Failed to log out player: uid=${uid}`);
            }
            
            // Clean up the UID mapping
            socketToUid.delete(socket.id)
        })

        on('movePlayer', MovePlayer, ({ session, data }) => {  
            const uid = socketToUid.get(socket.id)
            if (!uid) {
                console.log(`[SOCKET] No UID found for movePlayer: ${socket.id}`);
                return
            }
            
            const player = session.getPlayer(uid)
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
            const uid = socketToUid.get(socket.id)
            if (!uid) {
                console.log(`[SOCKET] No UID found for teleport: ${socket.id}`);
                return
            }
            
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
            const uid = socketToUid.get(socket.id)
            if (!uid) {
                console.log(`[SOCKET] No UID found for changedSkin: ${socket.id}`);
                return
            }
            
            const player = session.getPlayer(uid)
            player.skin = data
            emit('playerChangedSkin', { uid, skin: player.skin })
        })

        on('sendMessage', NewMessage, ({ session, data }) => {
            // cannot exceed 300 characters
            if (data.length > 300 || data.trim() === '') return

            const message = removeExtraSpaces(data)

            const uid = socketToUid.get(socket.id)
            if (!uid) {
                console.log(`[SOCKET] No UID found for sendMessage: ${socket.id}`);
                return
            }
            emit('receiveMessage', { uid, message })
        })
    })
}