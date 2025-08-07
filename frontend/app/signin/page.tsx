'use client'
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    console.log('Backend URL:', process.env.NEXT_PUBLIC_BACKEND_URL);
    const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      localStorage.setItem('token', data.token);
      router.replace('/app');
    } else {
      setError(data.message || 'Login failed');
    }
  };

  return (
    <div className='flex flex-col items-center w-full pt-56 h-dvh'>
      <form onSubmit={handleSubmit} className='flex flex-col gap-4 w-80 p-8 bg-white rounded shadow'>
        <h2 className='text-2xl font-bold mb-2 text-center'>Sign In</h2>
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
        <button type='submit' className='bg-blue-600 text-white p-2 rounded hover:bg-blue-700'>Sign In</button>
        <span className='text-sm text-center'>Don't have an account? <a href='/signup' className='underline text-blue-600'>Sign up</a></span>
      </form>
    </div>
  );
} 