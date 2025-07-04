'use client'
import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import BasicButton from '@/components/BasicButton'
import DesktopRealmItem from './DesktopRealmItem'
import { useRouter } from 'next/navigation'
import { request } from '@/utils/backend/requests'
import revalidate from '@/utils/revalidate'

type Realm = {
    _id: string,
    id?: string,
    name: string,
    share_id: string
    shared?: boolean
}

type RealmsMenuProps = {
    realms: Realm[]
    errorMessage: string
}

const RealmsMenu:React.FC<RealmsMenuProps> = ({ realms: initialRealms, errorMessage }) => {

    const [selectedRealm, setSelectedRealm] = useState<Realm | null>(null)
    const [playerCounts, setPlayerCounts] = useState<number[]>([])
    const [createError, setCreateError] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [realms, setRealms] = useState<Realm[]>(initialRealms);
    const router = useRouter()
    const [joinShareId, setJoinShareId] = useState('');
    const [joinError, setJoinError] = useState('');

    useEffect(() => {
        if (errorMessage) {
            toast.error(errorMessage)
        }
    }, [errorMessage])

    useEffect(() => {
        getPlayerCounts()
        revalidate('/play/[id]')
    }, [])

    useEffect(() => {
        // Fetch realms on mount if not already present
        if (!initialRealms || initialRealms.length === 0) {
            fetchRealms();
        }
    }, []);

    async function fetchRealms() {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!token) return;
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/realms`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (Array.isArray(data.realms)) {
                setRealms(data.realms);
            }
        } catch (err) {
            // ignore
        }
    }

    function getLink() {
        if (selectedRealm?.share_id) {
            return `/play/${selectedRealm.id}?shareId=${selectedRealm.share_id}`
        } else {
            return `/play/${selectedRealm?.id}`
        }
    }

    async function getPlayerCounts() {
        const { data: playerCountData, error: playerCountsError } = await request('/getPlayerCounts', { realmIds: realms.map((realm: any) => realm.id) })
        if (playerCountData) {
            setPlayerCounts(playerCountData.playerCounts)
        }
    }

 

    return (
        <>
            {/* Create Space Form (Desktop Only) */}
      
            {/* Mobile View */}
            <div className='flex flex-col items-center p-4 gap-2 sm:hidden'>
                {realms.length === 0 && <p className='text-center'>You have no spaces you can join. Create one on desktop to get started!</p>}
                {realms.map((realm, index) => {

                    function selectRealm() {
                        setSelectedRealm(realm)
                    }

                    return (
                        <BasicButton key={realm.id} className={`w-full h-12 border-4 border-transparent flex flex-row items-center justify-between ${selectedRealm?.id === realm.id ? 'border-white' : ''}`} onClick={selectRealm}>
                            <p className='text-button text-xl text-left'>{realm.name}</p>
                            {playerCounts[index] !== undefined && <div className='rounded-full grid place-items-center w-8 h-8 font-bold bg-green-500'>
                                {playerCounts[index]}
                            </div>}
                        </BasicButton>
                    )
                })}
                <div className='fixed bottom-0 w-full bg-primary grid place-items-center p-2'>
                     <BasicButton className='w-[90%] text-xl px-0 py-0' disabled={selectedRealm === null} onClick={() => router.push(getLink())}>
                        Join Space
                    </BasicButton>
                </div>
            </div>

            {/* Desktop View */}
            <div className='flex-col items-center w-full p-8 hidden sm:flex'>
                {realms.length === 0 && <p className='text-center'>You have no spaces you can join. Create a space to get started!</p>}
                <div className='hidden sm:grid grid-cols-2 md:grid-cols-3 gap-8 w-full'>
                    {realms.map((realm, index) => {
                        return (
                            <DesktopRealmItem key={realm._id} name={realm.name} id={realm._id} shareId={realm.share_id} shared={realm.shared} playerCount={playerCounts[index]}/>
                        )
                    })}
                </div>
                {realms.length > 0 && (
                  <button
                    className="mt-4 bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
                    disabled={!selectedRealm}
                    onClick={() => {
                      if (selectedRealm) {
                        router.push(
                          selectedRealm.share_id
                            ? `/play/${selectedRealm._id}?shareId=${selectedRealm.share_id}`
                            : `/play/${selectedRealm._id}`
                        );
                      }
                    }}
                  >
                    Join Space
                  </button>
                )}
                {/* Join by Share ID */}
                <div className="mt-8 flex flex-row gap-2 items-center">
                  <input
                    type="text"
                    value={joinShareId}
                    onChange={e => setJoinShareId(e.target.value)}
                    placeholder="Enter Share ID to join..."
                    className="border p-2 rounded bg-white text-gray-900"
                  />
                  <button
                    className="bg-green-600 text-white p-2 rounded hover:bg-green-700"
                    onClick={async () => {
                      setJoinError('');
                      if (!joinShareId) return;
                      try {
                        let realmId = '';
                        let shareId = '';
                        // Try to extract from a full URL
                        const urlPattern = /\/play\/([a-fA-F0-9]+)(?:\?shareId=([\w-]+))?/;
                        const match = joinShareId.match(urlPattern);
                        if (match) {
                          realmId = match[1];
                          shareId = match[2] || '';
                        } else if (/^share-/.test(joinShareId)) {
                          // Only shareId provided, resolve realmId from backend
                          shareId = joinShareId;
                          const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/realms/join/${shareId}`);
                          const data = await res.json();
                          if (!res.ok || !data.realm) {
                            setJoinError('Room not found');
                            return;
                          }
                          realmId = data.realm._id;
                        } else {
                          setJoinError('Invalid link or Share ID');
                          return;
                        }
                        if (!realmId || !shareId) {
                          setJoinError('Invalid link or Share ID');
                          return;
                        }
                        // Navigate to the correct play URL
                        router.push(`/play/${realmId}?shareId=${shareId}`);
                      } catch {
                        setJoinError('Room not found');
                      }
                    }}
                  >
                    Join by Share ID
                  </button>
                  {joinError && <span className="text-red-500 text-sm ml-2">{joinError}</span>}
                </div>
            </div>
            
        </>
        
    )
}

export default RealmsMenu