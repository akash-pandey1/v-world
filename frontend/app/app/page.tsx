'use client'
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar/Navbar';
import RealmsMenu from './RealmsMenu/RealmsMenu';
import defaultMap from '@/utils/defaultmap.json'

export default function App() {
    const [realms, setRealms] = useState<any[]>([]);
    const [errorMessage, setErrorMessage] = useState('');
    const router = useRouter();

    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!token) {
            router.replace('/signin');
            return;
        }
        // Fetch realms from backend
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/realms`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                if (data.error || !Array.isArray(data.realms)) {
                    setErrorMessage((data.error && data.error.message) || 'Failed to fetch realms');
                    setRealms([]);
                } else {
                    setRealms(data.realms);
                }
            })
            .catch(() => {
                setErrorMessage('Failed to fetch realms');
                setRealms([]);
            });
    }, [router]);

    return (
        <div>
            <Navbar />
            <h1 className='text-3xl pl-4 sm:pl-8 pt-8'>Your Spaces</h1>
            <div className='flex flex-col items-center mt-12'>
                <button
                    className='bg-blue-600 text-white px-6 py-3 rounded text-xl hover:bg-blue-700'
                    onClick={() => {
                        // Navigate to /editor/new and pass defaultMap as state
                        router.push('/editor/new')
                    }}
                >
                    Create Room
                </button>
            </div>
            {errorMessage ? (
                <div className='text-red-500 p-4'>{errorMessage}</div>
            ) : (
                <RealmsMenu realms={realms} errorMessage={errorMessage}/>
            )}
        </div>
    );
}