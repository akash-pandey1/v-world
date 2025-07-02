'use client'
import React, { useState, useEffect } from 'react'
import Modal from './Modal'
import { useModal } from '@/app/hooks/useModal'
import { toast } from 'react-toastify'
import revalidate from '@/utils/revalidate'
import BasicInput from '../BasicInput'
import { removeExtraSpaces, formatForComparison } from '@/utils/removeExtraSpaces'

type DeleteRealmModalProps = {
    
}

const DeleteRealmModal:React.FC<DeleteRealmModalProps> = () => {
    
    const { modal, realmToDelete } = useModal()
    const [loading, setLoading] = useState<boolean>(false)
    const [input, setInput] = useState<string>('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    const handleDelete = async () => {
        setError('')
        setSuccess(false)
        const token = localStorage.getItem('token')
        if (!token) {
            setError('Not authenticated')
            return
        }
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/realms/${realmToDelete.id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        if (res.ok) {
            setSuccess(true)
            revalidate('/app')
            window.location.reload()
        } else {
            const data = await res.json()
            setError(data.message || 'Failed to delete realm')
        }
    }

    function onChange(e: React.ChangeEvent<HTMLInputElement>) {
        const value = removeExtraSpaces(e.target.value)
        setInput(value)
    }

    function getDisabled() {
        return input.trim() !== realmToDelete.name.trim()
    }

    useEffect(() => {
        setInput('')
    }, [modal])

    return (
        <Modal open={modal === 'Delete Realm'} closeOnOutsideClick>
            <div className='p-2 flex flex-col items-center gap-2'>
                <h1 className='text-center'>Are you sure you want to delete <span className='text-red-500 select-none'>{realmToDelete.name}</span>? It will be gone forever!</h1>
                <h2 className='text-center'>Type <span className='text-red-500 select-none'>{realmToDelete.name}</span> to confirm.</h2>
                {error && <div className='text-red-500 text-sm'>{error}</div>}
                {success && <div className='text-green-600 text-sm'>Realm deleted!</div>}
                <BasicInput className='h-8 p-2 bg-light-secondary border-none text-white' onChange={onChange} value={input}/>
                <div className='flex gap-2'>
                    <button className={`${loading ? 'pointer-events-none' : ''} ${getDisabled() ? 'opacity-70 pointer-events-none' : ''} 'px-2 py-1 rounded-md outline-none p-2 bg-red-500 hover:bg-red-600 animate-colors text-white cursor-pointer`} disabled={getDisabled()} onClick={handleDelete}>Delete</button>
                    <button className='bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500'>Cancel</button>
                </div>
            </div>
        </Modal>
    )
}

export default DeleteRealmModal