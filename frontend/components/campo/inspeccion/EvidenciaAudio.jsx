'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Play, Pause, AlertCircle } from 'lucide-react';
import { vibrar, vibrarError } from '../../../utils/haptics';

export function EvidenciaAudio({ audios = [], onAddAudio, onDeleteAudio, isOnline }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [playingIndex, setPlayingIndex] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const currentAudioRef = useRef(null);

  const maxAudios = 5;
  const audiosAlcanzados = audios.length >= maxAudios;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
    };
  }, []);

  const startRecording = async () => {
    vibrar(40);
    setErrorMessage('');

    if (audiosAlcanzados) {
      vibrarError();
      setErrorMessage(`Límite de ${maxAudios} audios alcanzado.`);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        onAddAudio(audioBlob);
        vibrar(40);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('[EvidenciaAudio] Error al acceder al micrófono:', err);
      vibrarError();
      setErrorMessage('No se pudo acceder al micrófono.');
    }
  };

  const stopRecording = () => {
    vibrar(40);
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const togglePlayAudio = (index, blob) => {
    vibrar(20);
    if (playingIndex === index) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      setPlayingIndex(null);
    } else {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      audio.onended = () => setPlayingIndex(null);
      audio.play();
      setPlayingIndex(index);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full space-y-2.5 my-2">
      {/* Encabezado Nota de Voz / Audio y Contador 0/5 */}
      <div className="flex items-center justify-between px-0.5">
        <label className="text-xs font-bold text-slate-300">
          Nota de Voz / Audio
        </label>
        <span className="text-[11px] font-black text-sky-400 bg-sky-950/60 border border-sky-800/80 px-2 py-0.5 rounded-md font-mono">
          {audios.length}/{maxAudios}
        </span>
      </div>

      {/* Tarjeta Botón Principal: GRABAR AUDIO */}
      {!isRecording ? (
        <button
          type="button"
          onClick={startRecording}
          disabled={audiosAlcanzados}
          className={`
            w-full py-3.5 px-4 rounded-xl border flex items-center justify-between transition-all duration-150 active:scale-[0.98] shadow-md
            ${
              audiosAlcanzados
                ? 'bg-[#131c2e]/40 border-slate-800 text-slate-600 cursor-not-allowed'
                : 'bg-[#131c2e] border-slate-800 hover:bg-[#1a263d] hover:border-slate-700 text-slate-200'
            }
          `}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
              <Mic className="w-5 h-5" />
            </div>
            <span className="font-black text-sm text-white tracking-wider uppercase">GRABAR AUDIO</span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Micrófono Web</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={stopRecording}
          className="w-full py-3.5 px-4 bg-[#2b1014] border border-red-500/80 rounded-xl flex items-center justify-between shadow-lg shadow-red-950/40 animate-pulse active:scale-[0.98]"
        >
          <div className="flex items-center gap-3 text-red-400">
            <div className="w-9 h-9 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
              <Square className="w-4 h-4 fill-current" />
            </div>
            <span className="font-black text-sm text-red-200 uppercase tracking-wider">
              DETENER ({formatTime(recordingTime)})
            </span>
          </div>
          <span className="text-xs text-red-400 font-black animate-ping">● GRABANDO</span>
        </button>
      )}

      {errorMessage && (
        <div className="bg-red-950/80 border border-red-500 text-red-200 text-xs font-bold p-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Lista Compacta de Audios Grabados */}
      {audios.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {audios.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-[#131c2e] border border-slate-800 p-2.5 rounded-xl text-xs shadow-sm hover:border-slate-700"
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => togglePlayAudio(index, item.blob)}
                  className="bg-[#0284c7] hover:bg-[#0369a1] text-white p-2 rounded-lg font-bold transition-all active:scale-95 shadow"
                  aria-label="Reproducir audio"
                >
                  {playingIndex === index ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                </button>
                <div className="flex flex-col leading-tight">
                  <span className="text-white font-bold text-xs">Nota de Voz #{index + 1}</span>
                  <span className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {playingIndex === index ? 'Reproduciendo...' : 'Audio guardado'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  vibrar(40);
                  if (playingIndex === index && currentAudioRef.current) {
                    currentAudioRef.current.pause();
                    setPlayingIndex(null);
                  }
                  onDeleteAudio(index);
                }}
                className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-red-950/40 active:scale-95 transition-all"
                aria-label="Eliminar audio"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

