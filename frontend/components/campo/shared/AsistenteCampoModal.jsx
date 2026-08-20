'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Mic, MicOff, Send, Check, Copy, ArrowLeft, RefreshCw, Bot, PlusCircle, AlertTriangle } from 'lucide-react';
import { apiService } from '../../../services/api';
import { vibrar, vibrarExito, vibrarError } from '../../../utils/haptics';

export function AsistenteCampoModal({
  isOpen,
  onClose,
  equipoId,
  codigoActivo,
  nombreActivo,
  onInsertarNotas
}) {
  const [consulta, setConsulta] = useState('');
  const [loading, setLoading] = useState(false);
  const [respuesta, setRespuesta] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [insertado, setInsertado] = useState(false);
  const recognitionRef = useRef(null);

  const handleCerrar = () => {
    vibrar(20);
    setConsulta('');
    setRespuesta('');
    setIsRecording(false);
    setInsertado(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
    }
    onClose();
  };

  const toggleVoice = () => {
    vibrar(30);
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Dictado de voz no disponible en este navegador móvil.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = 'es-ES';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsRecording(true);
      recognition.onend = () => setIsRecording(false);
      recognition.onerror = (err) => {
        console.error('Error de voz:', err);
        setIsRecording(false);
      };
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setConsulta(transcript);
          // Ejecutar automáticamente la consulta al dictar por voz
          ejecutarConsulta(transcript);
        }
      };

      recognition.start();
    } catch (e) {
      console.error('Error iniciando dictado:', e);
      setIsRecording(false);
    }
  };

  const ejecutarConsulta = async (textoDirecto) => {
    const texto = (textoDirecto || consulta).trim();
    if (!texto || !equipoId || loading) return;

    vibrar(40);
    setLoading(true);
    setInsertado(false);

    try {
      const res = await apiService.consultarAsistenteEquipo(
        equipoId,
        texto,
        [],
        'mobile'
      );
      setRespuesta(res.respuesta || 'Sin respuesta del asistente.');
      vibrarExito();
    } catch (err) {
      console.error('Error consultando asistente:', err);
      vibrarError();
      setRespuesta(`⚠️ No se pudo consultar a Gemini: ${err.message || 'Error de conexión'}.`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopiar = () => {
    if (!respuesta) return;
    navigator.clipboard.writeText(respuesta);
    vibrar(30);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const handleInsertar = () => {
    if (!respuesta || !onInsertarNotas) return;
    vibrarExito();
    onInsertarNotas(respuesta);
    setInsertado(true);
    setTimeout(() => {
      setInsertado(false);
      onClose();
    }, 1200);
  };

  const chipsRapidos = [
    { label: '📋 Antecedentes 2024', prompt: 'Resume en 2 viñetas los antecedentes y patologías del PGP 2024 de este equipo.' },
    { label: '⚠️ Puntos Críticos', prompt: '¿Cuáles son los 3 puntos más críticos a inspeccionar visualmente en este tipo de equipo?' },
    { label: '🔩 Acometidas y Juntas', prompt: 'Indica las recomendaciones técnicas para bulonería, juntas y acometidas de este equipo.' },
    { label: '💡 Criterio de Estado', prompt: 'Resume los criterios para clasificar este equipo en REGULAR o CRITICO.' }
  ];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/85 backdrop-blur-md transition-all duration-300"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <div
        className="relative w-full max-w-lg bg-slate-900 border-t-2 sm:border-2 border-sky-500/40 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh] text-white"
        style={{
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.6)'
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white m-0">Asistente Técnico IA</h3>
                <span className="bg-sky-950 text-sky-300 border border-sky-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                  {codigoActivo}
                </span>
              </div>
              <p className="text-xs text-slate-400 m-0 truncate max-w-[240px]">
                {nombreActivo}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCerrar}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/60 rounded-xl active:scale-95 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chips de Consultas Rápidas (Táctiles de 1 toque) */}
        <div className="space-y-1.5 mb-3">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Consultas Rápidas de Campo:
          </span>
          <div className="grid grid-cols-2 gap-2">
            {chipsRapidos.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setConsulta(chip.prompt);
                  ejecutarConsulta(chip.prompt);
                }}
                disabled={loading}
                className="text-left text-xs font-semibold bg-slate-800/80 hover:bg-slate-800 active:bg-sky-950 border border-slate-700 hover:border-sky-500/50 p-2.5 rounded-xl transition-all disabled:opacity-50 text-slate-200"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input con Botón de Voz */}
        <div className="relative mb-3">
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-2xl p-1.5 focus-within:border-sky-500 transition-all">
            <input
              type="text"
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && ejecutarConsulta()}
              placeholder={isRecording ? 'Escuchando voz...' : 'Escribe o dicta tu duda...'}
              className="flex-1 bg-transparent border-none text-sm text-white px-3 py-2 outline-none"
            />

            <button
              type="button"
              onClick={toggleVoice}
              className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
                isRecording
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
              title="Dictar por voz"
            >
              {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <button
              type="button"
              onClick={() => ejecutarConsulta()}
              disabled={loading || !consulta.trim()}
              className="p-2.5 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white disabled:text-slate-500 rounded-xl flex items-center justify-center transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Área de Respuesta de Gemini */}
        <div className="flex-1 overflow-y-auto min-h-[140px] max-h-[260px] bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-2 mb-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full py-8 space-y-2 text-center">
              <RefreshCw className="w-7 h-7 text-sky-400 animate-spin" />
              <p className="text-xs font-bold text-slate-400 m-0">Gemini procesando ficha técnica...</p>
            </div>
          ) : respuesta ? (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400 border-b border-slate-800 pb-1.5">
                <Bot className="w-4 h-4" />
                <span>Respuesta Técnica Concisa:</span>
              </div>
              <div className="text-xs sm:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                {respuesta}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-6 text-center text-slate-500 space-y-1">
              <Sparkles className="w-6 h-6 text-slate-600 mb-1" />
              <p className="text-xs font-bold text-slate-400 m-0">Toca un chip o dicta una consulta</p>
              <p className="text-[11px] text-slate-500 m-0">El asistente responderá con base en el historial y normativa de este equipo.</p>
            </div>
          )}
        </div>

        {/* Acciones de Respuesta (Copiar / Insertar en Notas) */}
        {respuesta && !loading && (
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={handleCopiar}
              className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 transition-all"
            >
              {copiado ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiado ? 'Copiado' : 'Copiar Texto'}</span>
            </button>

            {onInsertarNotas && (
              <button
                type="button"
                onClick={handleInsertar}
                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 border border-emerald-400 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-emerald-950/50"
              >
                {insertado ? <Check className="w-3.5 h-3.5" /> : <PlusCircle className="w-3.5 h-3.5" />}
                <span>{insertado ? '¡Insertado!' : 'Insertar en Notas'}</span>
              </button>
            )}
          </div>
        )}

        {/* Footer: Volver */}
        <div className="pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={handleCerrar}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>VOLVER A LA INSPECCIÓN</span>
          </button>
        </div>
      </div>
    </div>
  );
}
