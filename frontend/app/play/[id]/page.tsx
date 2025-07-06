'use client'
import React, { useEffect, useState } from 'react'
import NotFound from '@/app/not-found'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatEmailToName } from '@/utils/formatEmailToName'
import { jwtDecode } from 'jwt-decode'
import PlayClient from '../PlayClient'
import { defaultSkin, skins } from '@/utils/pixi/Player/skins'

export default function PlayPage({ params }: { params: { id: string } }) {
    const [realm, setRealm] = useState<any>(null);
    const [error, setError] = useState('');
    const router = useRouter();
    const searchParams = useSearchParams();

    // Helper to get shareId from searchParams
    function getShareId() {
        return searchParams.get('shareId') || '';
    }

    // Helper to get user and access_token from localStorage
    function getUserAndToken() {
        const token = localStorage.getItem('token');
        if (!token) return { user: null, access_token: '' };
        try {
            const user = jwtDecode(token) as any;
            console.log('[PlayPage] JWT decoded user:', user);
            console.log('[PlayPage] JWT token raw:', token);
            console.log('[PlayPage] User ID from JWT:', user?.id);
            console.log('[PlayPage] User ID type:', typeof user?.id);
            console.log('[PlayPage] All user properties:', Object.keys(user || {}));
            return { user, access_token: token };
        } catch (error) {
            console.log('[PlayPage] Failed to decode JWT token:', error);
            return { user: null, access_token: '' };
        }
    }

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            router.replace('/signin');
            return;
        }
        const shareId = searchParams.get('shareId');
        const fetchUrl = shareId
            ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/realms/join/${shareId}`
            : `${process.env.NEXT_PUBLIC_BACKEND_URL}/realms/${params.id}`;
        fetch(fetchUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                if (!data || !data.realm) setError('Realm not found');
                else setRealm(data.realm);
            })
            .catch(() => setError('Failed to fetch realm'));
    }, [params.id, router, searchParams]);

    if (error) return <div>{error}</div>;
    if (!realm) return <div>Loading...</div>;

    const map_data = realm.map_data

    let skin = realm.skin
    if (!skin || !skins.includes(skin)) {
        skin = defaultSkin
    }

    const { user, access_token } = getUserAndToken();
    const shareId = getShareId();

    // Backend will generate and manage UIDs, so we don't need to pass one
    console.log('[PlayPage] Backend will handle UID generation');
    console.log('[PlayPage] User ID:', user?.id, 'Realm owner ID:', realm.owner_id, 'Is owner:', user?.id === realm.owner_id);
    console.log('[PlayPage] User object:', user);
    console.log('[PlayPage] Realm object:', realm);

    // Optionally update visited realms if shareId is present and not owner
    // if (shareId && user && realm.owner_id !== user.id) {
    //     updateVisitedRealms(access_token, shareId)
    // }

    return (
        <PlayClient 
            mapData={map_data} 
            username={user ? formatEmailToName(user.email) : ''} 
            access_token={access_token} 
            realmId={params.id} 
            shareId={shareId} 
            initialSkin={skin}
            name={realm.name}
            userId={user?.id || ''}
            isOwner={user?.id === realm.owner_id}
        />
    )
}