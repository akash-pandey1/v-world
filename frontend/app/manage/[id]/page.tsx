import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ManageChild from '../ManageChild'
import NotFound from '../../not-found'

export default function ManagePage({ params }: { params: { id: string } }) {
    const [realm, setRealm] = useState<any>(null);
    const [error, setError] = useState('');
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            router.replace('/signin');
            return;
        }
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/realms/${params.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                if (!data || !data.realm) setError('Realm not found');
                else setRealm(data.realm);
            })
            .catch(() => setError('Failed to fetch realm'));
    }, [params.id, router]);

    if (error) return <div>{error}</div>;
    if (!realm) return <div>Loading...</div>;

    return (
        <div>
            <ManageChild 
                realmId={realm.id} 
                startingShareId={realm.share_id} 
                startingOnlyOwner={realm.only_owner} 
                startingName={realm.name}
            />
        </div>
    )
}