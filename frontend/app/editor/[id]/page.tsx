'use client'
import NotFound from '@/app/not-found'
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Editor from '../Editor'

export default function RealmEditor({ params }: { params: { id: string } }) {
    const [realmData, setRealmData] = useState<any>(null);
    const [notFound, setNotFound] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!token) {
            router.replace('/signin');
            return;
        }
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/realms/${params.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                if (!data || !data.realm) setNotFound(true);
                else setRealmData(data.realm.map_data);
            })
            .catch(() => setNotFound(true));
    }, [params.id, router]);

    if (notFound) return <NotFound />;
    if (!realmData) return <div>Loading...</div>;

    return (
        <div>
            <Editor realmData={realmData}/>
        </div>
    )
}