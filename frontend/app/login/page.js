'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, Shield, AlertCircle } from 'lucide-react';
import { apiService } from '../../services/api';
import { vibrar, vibrarExito, vibrarError } from '../../utils/haptics';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    vibrar(30);
    setErrorMsg('');

    if (!username || !password) {
      vibrarError();
      setErrorMsg('Complete usuario y contraseña.');
      return;
    }

    setLoading(true);

    try {
      await apiService.login(username, password);
      vibrarExito();
      router.push('/campo');
    } catch (err) {
      console.error('[Login] Error:', err);
      vibrarError();
      setErrorMsg(err.message || 'Usuario o contraseña incorrectos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border-3 border-sky-500 p-6 rounded-3xl space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-sky-900 text-sky-300 rounded-2xl flex items-center justify-center mx-auto border-2 border-sky-400">
            <Shield className="w-10 h-10" />
          </div>
          <span className="text-xs font-black text-sky-400 uppercase tracking-widest block">Modo Campo</span>
          <h1 className="text-3xl font-black text-white">Inspector PGP</h1>
          <p className="text-xs text-slate-400 font-semibold">Inicie sesión para acceder a las inspecciones en planta</p>
        </div>

        {errorMsg && (
          <div className="bg-red-950 border-2 border-red-500 text-red-200 text-sm font-bold p-3 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-black text-slate-300 uppercase mb-1">Usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ej: inspector1"
              className="w-full h-14 px-4 text-lg font-bold bg-slate-950 border-2 border-slate-700 rounded-xl text-white focus:outline-none focus:border-sky-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-black text-slate-300 uppercase mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-14 px-4 text-lg font-bold bg-slate-950 border-2 border-slate-700 rounded-xl text-white focus:outline-none focus:border-sky-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`
              w-full min-h-[64px] rounded-2xl font-black text-2xl uppercase tracking-wider flex items-center justify-center gap-3 transition-all duration-150 active:scale-95 shadow-xl border-4 mt-6
              ${
                loading
                  ? 'bg-slate-700 text-slate-400 border-slate-600'
                  : 'bg-sky-600 hover:bg-sky-500 text-white border-sky-400 active:bg-sky-700'
              }
            `}
          >
            <LogIn className="w-7 h-7" />
            <span>{loading ? 'INGRESANDO...' : 'INGRESAR'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
