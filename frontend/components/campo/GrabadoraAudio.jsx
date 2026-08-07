'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Play, Pause, AlertCircle, Volume2 } from 'lucide-react';
import { vibrar, vibrarError } from '../../utils/haptics';

export function GrabadoraAudio({ audios, onAddAudio, onDeleteAudio, isOnline }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [playingIndex, setPlayingIndex] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const currentAudioRef = useRef(null);

  const maxAudios = isOnline ? 5 : 1;
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
      setErrorMessage(`Límite alcanzado (${maxAudios} audio ${isOnline ? 'online' : 'offline'}).`);
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
      console.error('[GrabadoraAudio] Error al acceder al micrófono:', err);
      vibrarError();
      setErrorMessage('No se pudo acceder al micrófono. Verifique los permisos.');
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
    <div className="w-full space-y-3 my-4 bg-slate-800/80 p-4 rounded-2xl border-2 border-slate-700">
      <div className="flex items-center justify-between">
        <label className="text-xl font-black text-slate-100 uppercase flex items-center gap-2">
          <Mic className="w-6 h-6 text-amber-400" />
          Nota de Voz / Audio
        </label>
        <span className={`text-sm font-bold px-3 py-1 rounded-full ${audiosAlcanzados ? 'bg-red-500/20 text-red-400 border border-red-500' : 'bg-slate-700 text-slate-300'}`}>
          {audios.length} / {maxAudios} {isOnline ? '(Online)' : '(Offline)'}
        </span>
      </div>

      {/* Botón Gigante de Grabación */}
      {!isRecording ? (
        <button
          type="button"
          onClick={startRecording}
          disabled={audiosAlcanzados}
          className={`
            w-full min-h-[64px] py-4 px-6 rounded-2xl font-black text-2xl flex items-center justify-center gap-3 transition-all duration-150 active:scale-95 shadow-xl border-4
            ${
              audiosAlcanzados
                ? 'bg-slate-700 text-slate-500 border-slate-600 cursor-not-allowed'
                : 'bg-amber-600 hover:bg-amber-500 text-slate-950 border-amber-400 active:bg-amber-700'
            }
          `}
        >
          <Mic className="w-9 h-9 shrink-0" />
          <span>🎤 GRABAR AUDIO</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={stopRecording}
          className="w-full min-h-[64px] py-4 px-6 rounded-2xl font-black text-2xl flex items-center justify-center gap-3 bg-red-600 hover:bg-red-500 text-white border-4 border-red-400 shadow-2xl animate-pulse"
        >
          <Square className="w-9 h-9 fill-current shrink-0" />
          <span>DETENER ({formatTime(recordingTime)})</span>
        </button>
      )}

      {errorMessage && (
        <div className="bg-red-900/40 border-2 border-red-500 text-red-200 text-sm font-bold p-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Lista de Audios Grabados */}
      {audios.length > 0 && (
        <div className="space-y-2 pt-2">
          {audios.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-slate-900 border-2 border-slate-700 p-3 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => togglePlayAudio(index, item.blob)}
                  className="bg-amber-500 hover:bg-amber-400 text-black p-2 rounded-lg font-bold"
                  aria-label="Reproducir audio"
                >
                  {playingIndex === index ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                </button>
                <div className="flex flex-col">
                  <span className="text-slate-200 font-bold text-base flex items-center gap-1">
                    <Volume2 className="w-4 h-4 text-amber-400" />
                    Audio #{index + 1}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {new Date(item.timestamp).toLocaleTimeString()}
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
                className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg border border-red-400 active:scale-90"
                aria-label="Eliminar audio"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
