'use client'
import { useState } from 'react'
import Editor from '../Editor'
import defaultMap from '@/utils/defaultmap.json'

export default function NewEditorPage() {
    const [mapData] = useState<any>({ ...defaultMap })
    return (
        <div className='w-full h-screen'>
            <Editor realmData={mapData} />
        </div>
    )
} 