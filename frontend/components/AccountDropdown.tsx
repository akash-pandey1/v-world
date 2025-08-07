'use client'
import React, { Fragment, useState } from 'react'
import { useModal } from '@/app/hooks/useModal'
import { Dialog, Transition } from '@headlessui/react'
import { useRouter } from 'next/navigation'

const AccountDropdown:React.FC = () => {
    const { modal, setModal } = useModal()
    const router = useRouter()
    const [open, setOpen] = useState(false)

    const handleLogout = () => {
        localStorage.removeItem('token')
        window.location.reload()
    }

    return (
    <div className='relative'>
      <button onClick={() => setOpen(!open)} className='p-2'>V-World by Akash Pandey</button>
      {open && (
        <div className='absolute right-0 mt-2 w-48 bg-white rounded shadow-lg z-10'>
          <button onClick={handleLogout} className='block w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100'>Logout</button>
        </div>
      )}
    </div>
  )
}

export default AccountDropdown