'use client'
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AnimatedCharacter from './play/SkinMenu/AnimatedCharacter'
import Link from 'next/link'
import BasicButton from '@/components/BasicButton'
import { Code } from '@phosphor-icons/react'

export default function Index() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/signin');
  }, [router]);
  return null;
}
