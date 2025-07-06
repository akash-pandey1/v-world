'use client'
import React, { useRef } from 'react'
import { PlayApp } from '@/utils/pixi/PlayApp'
import { useEffect } from 'react'
import { RealmData } from '@/utils/pixi/types'
import { useModal } from '../hooks/useModal'
import io from 'socket.io-client'
import { Socket } from 'socket.io-client'

type PixiAppProps = {
    className?: string
    mapData: RealmData
    username: string
    access_token: string
    realmId: string
    shareId: string
    initialSkin: string
    userId: string
    isOwner: boolean
}

const PixiApp:React.FC<PixiAppProps> = ({ className, mapData, username, access_token, realmId, shareId, initialSkin, userId, isOwner }) => {

    const appRef = useRef<PlayApp | null>(null)
    const { setModal, setLoadingText, setFailedConnectionMessage, setErrorModal } = useModal()

    useEffect(() => {
        let socket: Socket | null = null;
        const mount = async () => {
            // Defensive check: ensure all rooms have tilemap
            if (!mapData.rooms || !Array.isArray(mapData.rooms) || mapData.rooms.some(room => !room.tilemap)) {
                setErrorModal('Failed To Connect');
                return;
            }
            setModal('Loading')
            setLoadingText('Connecting to server...')
            // Connect to backend via socket.io - backend will generate UID
            console.log('[PixiApp] Connecting socket - backend will generate UID');
            socket = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001', {
                transports: ['websocket'],
                auth: { token: access_token }
            });
            socket.on('connect', () => {
                console.log('[SOCKET] Connected, emitting joinRealm', { realmId, shareId, userId, isOwner });
                socket?.emit('joinRealm', { realmId, shareId, userId, isOwner })
            });
            
            socket.on('disconnect', () => {
                console.log('[SOCKET] Disconnected');
            });
            
            socket.on('error', (error: any) => {
                console.log('[SOCKET] Error:', error);
            });
            // Listen for playerJoinedRoom
            socket.on('playerJoinedRoom', async (player: any) => {
                console.log('[SOCKET] playerJoinedRoom received:', player);
                if (appRef.current) {
                    // Only update/add this player, do NOT call syncPlayersFromSocket!
                    await appRef.current.updatePlayer(player.uid, player);
                }
            });
            

            // Listen for currentPlayers (full list on join)
            socket.on('currentPlayers', async (players: any[]) => {
                console.log('[SOCKET] currentPlayers received:', players);
                console.log('[SOCKET] currentPlayers length:', players.length);
                console.log('[SOCKET] currentPlayers details:', players.map(p => ({ uid: p.uid, username: p.username, x: p.x, y: p.y })));
                if (appRef.current) {
                    await appRef.current.syncPlayersFromSocket(players);
                }
            });

            // Listen for playerLeftRoom (when a player disconnects)
            socket.on('playerLeftRoom', async (uid: string) => {
                console.log('[SOCKET] playerLeftRoom received for uid:', uid);
                if (appRef.current) {
                    appRef.current.onPlayerLeftRoom(uid);
                }
            });
            const app = new PlayApp(realmId, mapData, username, initialSkin, socket)
            appRef.current = app
            setLoadingText('Loading game...')
            console.log('Before app.init');
            await app.init()
            console.log('After app.init');
            setModal('None')
            const pixiApp = app.getApp()
            console.log('Before appendChild');
            document.getElementById('app-container')!.appendChild(pixiApp.canvas)
            console.log('After appendChild');
        }

        if (!appRef.current) {
            mount()
        }
        
        return () => {
            if (appRef.current) {
                appRef.current.destroy()
            }
        }
    }, [])

    return (
        <div id='app-container' className={`overflow-hidden ${className}`}>
            
        </div>
    )
}

export default PixiApp
