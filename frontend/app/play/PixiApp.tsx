'use client'
import React, { useRef } from 'react'
import { PlayApp } from '@/utils/pixi/PlayApp'
import { useEffect } from 'react'
import { RealmData } from '@/utils/pixi/types'
import { useModal } from '../hooks/useModal'

type PixiAppProps = {
    className?: string
    mapData: RealmData
    username: string
    access_token: string
    realmId: string
    uid: string
    shareId: string
    initialSkin: string
}

const PixiApp:React.FC<PixiAppProps> = ({ className, mapData, username, access_token, realmId, uid, shareId, initialSkin }) => {

    const appRef = useRef<PlayApp | null>(null)
    const { setModal, setLoadingText, setFailedConnectionMessage, setErrorModal } = useModal()

    useEffect(() => {
        const mount = async () => {
            // Defensive check: ensure all rooms have tilemap
            if (!mapData.rooms || !Array.isArray(mapData.rooms) || mapData.rooms.some(room => !room.tilemap)) {
                setErrorModal('Room data is corrupted or missing. Please contact support.');
                return;
            }
            const app = new PlayApp(uid, realmId, mapData, username, initialSkin)
            appRef.current = app
            setModal('Loading')
            setLoadingText('Connecting to server...')
            // TODO: Add server connection logic here if needed
            // const { success, errorMessage } = await server.connect(realmId, uid, shareId, access_token)
            // if (!success) {
            //     setErrorModal('Failed To Connect')
            //     setFailedConnectionMessage(errorMessage)
            //     return
            // }

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
