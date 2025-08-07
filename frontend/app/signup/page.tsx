'use client'
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    console.log('Backend URL:', process.env.NEXT_PUBLIC_BACKEND_URL);
    const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (res.ok) {
      setSuccess(true);
      setTimeout(() => router.replace('/signin'), 1500);
    } else {
      setError(data.message || 'Signup failed');
    }
  };

  return (
    <div className='flex flex-col items-center w-full pt-56 h-dvh'>
      <form onSubmit={handleSubmit} className='flex flex-col gap-4 w-80 p-8 bg-white rounded shadow'>
        <h2 className='text-2xl font-bold mb-2 text-center'>Sign Up</h2>
        <input
          type='text'
          placeholder='Name'
          value={name}
          onChange={e => setName(e.target.value)}
          className='border p-2 rounded bg-white text-gray-900'
          required
        />
        <input
          type='email'
          placeholder='Email'
          value={email}
          onChange={e => setEmail(e.target.value)}
          className='border p-2 rounded bg-white text-gray-900'
          required
        />
        <input
          type='password'
          placeholder='Password'
          value={password}
          onChange={e => setPassword(e.target.value)}
          className='border p-2 rounded bg-white text-gray-900'
          required
        />
        {error && <div className='text-red-500 text-sm'>{error}</div>}
        {success && <div className='text-green-600 text-sm'>Signup successful! Redirecting...</div>}
        <button type='submit' className='bg-blue-600 text-white p-2 rounded hover:bg-blue-700'>Sign Up</button>
        <span className='text-sm text-center'>Already have an account? <a href='/signin' className='underline text-blue-600'>Sign in</a></span>
      </form>
    </div>
  );
} 