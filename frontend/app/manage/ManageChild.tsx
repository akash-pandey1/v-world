'use client'
import React, { useState } from 'react'
import Dropdown from '@/components/Dropdown'
import BasicButton from '@/components/BasicButton'
import { toast } from 'react-toastify'
import revalidate from '@/utils/revalidate'
import { useModal } from '../hooks/useModal'
import { Copy } from '@phosphor-icons/react'
import { v4 as uuidv4 } from 'uuid'
import BasicInput from '@/components/BasicInput'
import { removeExtraSpaces } from '@/utils/removeExtraSpaces'

type ManageChildProps = {
    realmId: string
    startingShareId: string
    startingOnlyOwner: boolean
    startingName: string
}

const ManageChild:React.FC<ManageChildProps> = ({ realmId, startingShareId, startingOnlyOwner, startingName }) => {

    const [selectedTab, setSelectedTab] = useState(0)
    const [shareId, setShareId] = useState(startingShareId)
    const [onlyOwner, setOnlyOwner] = useState(startingOnlyOwner)
    const [name, setName] = useState(startingName)
    const { setModal, setLoadingText } = useModal()

    async function save() {
        if (name.trim() === '') {
            toast.error('Name cannot be empty!')
            return
        }

        setModal('Loading')
        setLoadingText('Saving...')

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                toast.error('Authentication required');
                setModal('None');
                return;
            }

            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/realms/${realmId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: name,
                    only_owner: onlyOwner
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to save realm');
            }

            toast.success('Saved!');
        } catch (error: any) {
            toast.error(error.message || 'Failed to save realm');
        }

        revalidate('/manage/[id]')
        setModal('None')
    }

    function copyLink() {
        const link = process.env.NEXT_PUBLIC_BASE_URL + '/play/' + realmId + '?shareId=' + shareId
        navigator.clipboard.writeText(link)
        toast.success('Link copied!')
    }

    async function generateNewLink() {
        setModal('Loading')
        setLoadingText('Generating new link...')

        const newShareId = uuidv4()
        
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                toast.error('Authentication required');
                setModal('None');
                return;
            }

            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/realms/${realmId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    share_id: newShareId
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to generate new link');
            }

            setShareId(newShareId)
            const link = process.env.NEXT_PUBLIC_BASE_URL + '/play/' + realmId + '?shareId=' + newShareId
            navigator.clipboard.writeText(link)
            toast.success('New link copied!')
        } catch (error: any) {
            toast.error(error.message || 'Failed to generate new link');
        }

        revalidate('/manage/[id]')
        setModal('None')
    }

    function onNameChange(e: React.ChangeEvent<HTMLInputElement>) {
        const value = removeExtraSpaces(e.target.value)
        setName(value)
    }

    return (
        <div className='flex flex-col items-center pt-24'>
            <div className='flex flex-row gap-8 relative'>
                <div className='flex flex-col h-[500px] w-[200px] border-white border-r-2 pr-4 gap-2'>
                    <h1 className={`${selectedTab === 0 ? 'font-bold underline' : ''} cursor-pointer`} onClick={() => setSelectedTab(0)}>General</h1> 
                    <h1 className={`${selectedTab === 1 ? 'font-bold underline' : ''} cursor-pointer`} onClick={() => setSelectedTab(1)}>Sharing Options</h1> 
                </div>
                <div className='flex flex-col w-[300px]'>
                    {selectedTab === 0 && (
                        <div className='flex flex-col gap-2'>
                            Name
                            <BasicInput value={name} onChange={onNameChange} maxLength={32}/>
                        </div>
                    )}
                    {selectedTab === 1 && (
                        <div className='flex flex-col gap-2'>
                            <BasicButton className='flex flex-row items-center gap-2 text-sm max-w-max' onClick={copyLink}>
                                Copy Link <Copy />
                            </BasicButton>
                            <BasicButton className='flex flex-row items-center gap-2 text-sm max-w-max' onClick={generateNewLink}>
                                Generate New Link <Copy />
                            </BasicButton>
                        </div>
                    )}
                    {selectedTab === 2 && (
                        <div className='flex flex-col gap-2'>
                            
                        </div>
                    )}
                    </div>
                <BasicButton className='absolute bottom-[-50px] right-0' onClick={save}>
                    Save
                </BasicButton>
            </div>
        </div>
    )
}

export default ManageChild