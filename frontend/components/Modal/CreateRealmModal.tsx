'use client'
import React, { useState } from 'react'
import Modal from './Modal'
import { useModal } from '@/app/hooks/useModal'
import BasicButton from '../BasicButton'
import BasicInput from '../BasicInput'
import { toast } from 'react-toastify'
import { useRouter } from 'next/navigation' 
import revalidate from '@/utils/revalidate'
import { removeExtraSpaces } from '@/utils/removeExtraSpaces'
import defaultMap from '@/utils/defaultmap.json'

const CreateRealmModal:React.FC = () => {
    
    const { modal, setModal } = useModal()
    const [realmName, setRealmName] = useState<string>('')
    const [loading, setLoading] = useState<boolean>(false)
    const [error, setError] = useState<string>('')
    const [success, setSuccess] = useState<boolean>(false)

    const [useDefaultMap, setUseDefaultMap] = useState<boolean>(true)

    const router = useRouter()

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setSuccess(false)
        const token = localStorage.getItem('token')
        if (!token) {
            setError('Not authenticated')
            return
        }
        let body: any = { name: realmName }
        if (useDefaultMap) {
            // Deep clone defaultMap and set the room name
            const mapCopy = JSON.parse(JSON.stringify(defaultMap))
            if (Array.isArray(mapCopy.rooms) && mapCopy.rooms.length > 0) {
                mapCopy.rooms[0].name = realmName
            }
            body.map_data = mapCopy
        }
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/realms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        })
        if (res.ok) {
            setSuccess(true)
            revalidate('/app')
            setModal('None')
            toast.success('Your space has been created!')
            const data = await res.json()
            if (data && data.realm && (data.realm.id || data.realm._id)) {
                router.push(`/editor/${data.realm.id || data.realm._id}`)
            } else {
                router.push('/app')
            }
        } else {
            const data = await res.json()
            setError(data.message || 'Failed to create realm')
        }
    }

    function onChange(e: React.ChangeEvent<HTMLInputElement>) {
        const value = removeExtraSpaces(e.target.value)
        setRealmName(value)
    }

    return (
        <Modal open={modal === 'Create Realm'} closeOnOutsideClick>
            <div className='flex flex-col items-center p-4 w-[400px] gap-4'>
                <h1 className='text-2xl'>Create a Space</h1>
                <form onSubmit={handleCreate} className='flex flex-col gap-4 w-[280px]'>
                    <BasicInput label={'Space Name'} className='w-[280px]' value={realmName} onChange={onChange} maxLength={32}/>
                    <div className='flex items-center gap-2 w-[280px]'>
                        <input
                            type="checkbox"
                            id="useDefaultMap"
                            checked={useDefaultMap}
                            onChange={(e) => setUseDefaultMap(e.target.checked)}
                        />
                        <label htmlFor="useDefaultMap">Use starter map</label>
                    </div>
                    {error && <div className='text-red-500 text-sm'>{error}</div>}
                    {success && <div className='text-green-600 text-sm'>Realm created!</div>}
                    <div className='flex gap-2 w-[280px]'>
                        <button type='submit' disabled={realmName.length <= 0 || loading} className='bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-lg'>Create</button>
                        <BasicButton onClick={() => setModal('None')} className='text-lg'>
                            Cancel
                        </BasicButton>
                    </div>
                </form>
            </div>
        </Modal>
    )
}

export default CreateRealmModal