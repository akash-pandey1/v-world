import React, { useEffect, useState } from 'react'
import { NavbarChild } from './NavbarChild'
import { formatEmailToName } from '@/utils/formatEmailToName'

export default function Navbar() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        setIsLoggedIn(!!localStorage.getItem('token'));
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        window.location.reload();
    };

    return (
        <nav className='w-full flex items-center justify-between p-4 bg-gray-800 text-white'>
            <div className='font-bold text-xl'>V-World</div>
            {isLoggedIn && (
                <button onClick={handleLogout} className='bg-red-500 px-4 py-2 rounded hover:bg-red-600'>Logout</button>
            )}
        </nav>
    )
}
