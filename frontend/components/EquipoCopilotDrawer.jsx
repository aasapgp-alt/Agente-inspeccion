'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, X, Bot, User, Copy, Check, ArrowDownToLine, Mic, MicOff, RefreshCw, AlertCircle } from 'lucide-react';
import { apiService } from '../services/api';
import { useAuth } from './AuthProvider';

export default function EquipoCopilotDrawer({
  isOpen,
  onClose,
  equipo,
  onApplyDiagnostico,
  onApplyRecomendaciones
}) {
  const { token } = useAuth();
  const [messages, setMessages] = useState(() => [
    {
      id: `init-${equipo?.id || 'default'}`,
      sender: 'gemini',
      text: `Hola, soy tu Copiloto Técnico para el equipo **${equipo?.nombre || 'Equipo'}** (${equipo?.codigo || equipo?.tag || `ID: ${equipo?.id || 'N/A'}`}).\n\nTengo precargada la ficha del equipo, su material (**${equipo?.material || 'Estándar'}**), su criticidad y los antecedentes de la PGP anterior.\n\n¿En qué te puedo asesorar?`,
      timestamp: ''
    }
  ]);
  const [lastEquipoId, setLastEquipoId] = useState(equipo?.id);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [appliedField, setAppliedField] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const counterRef = useRef(1);

  // Si el equipo cambia mientras el drawer está montado, actualizar el mensaje inicial
  if (equipo?.id !== lastEquipoId) {
    setLastEquipoId(equipo?.id);
    setMessages([
      {
        id: `init-${equipo?.id || 'default'}`,
        sender: 'gemini',
        text: `Hola, soy tu Copiloto Técnico para el equipo **${equipo?.nombre || 'Equipo'}** (${equipo?.codigo || equipo?.tag || `ID: ${equipo?.id || 'N/A'}`}).\n\nTengo precargada la ficha del equipo, su material (**${equipo?.material || 'Estándar'}**), su criticidad y los antecedentes de la PGP anterior.\n\n¿En qué te puedo asesorar?`,
        timestamp: ''
      }
    ]);
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Manejo de dictado por voz para el input
  const toggleSpeechRecognition = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta reconocimiento de voz nativo.');
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
      recognition.onerror = (e) => {
        console.error('Error de voz:', e);
        setIsRecording(false);
      };
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.start();
    } catch (err) {
      console.error('Error iniciando dictado:', err);
      setIsRecording(false);
    }
  };

  const handleSend = async (customMessage) => {
    const textoMensaje = (customMessage || input).trim();
    if (!textoMensaje || !equipo?.id || loading) return;

    const userMsg = {
      id: `user-${counterRef.current++}`,
      sender: 'user',
      text: textoMensaje,
      timestamp: ''
    };

    const nuevosMensajes = [...messages, userMsg];
    setMessages(nuevosMensajes);
    if (!customMessage) setInput('');
    setLoading(true);

    try {
      // Formatear historial para el backend
      const historialPayload = nuevosMensajes
        .filter((m) => !m.id.startsWith('init'))
        .map((m) => ({
          rol: m.sender === 'user' ? 'user' : 'model',
          texto: m.text
        }));

      const res = await apiService.consultarAsistenteEquipo(
        equipo.id,
        textoMensaje,
        historialPayload,
        'desktop',
        token
      );

      const botMsg = {
        id: `gemini-${counterRef.current++}`,
        sender: 'gemini',
        text: res.respuesta || 'Sin respuesta.',
        timestamp: ''
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const errorMsg = {
        id: `error-${counterRef.current++}`,
        sender: 'gemini',
        isError: true,
        text: `⚠️ Error al comunicarse con Gemini: ${err.message || 'Error desconocido'}. Verifica que la API key esté configurada en Ajustes.`,
        timestamp: ''
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const applyToField = (field, text, idx) => {
    if (field === 'diagnostico' && onApplyDiagnostico) {
      onApplyDiagnostico(text);
      setAppliedField(`diag-${idx}`);
      setTimeout(() => setAppliedField(null), 2500);
    } else if (field === 'recomendaciones' && onApplyRecomendaciones) {
      onApplyRecomendaciones(text);
      setAppliedField(`rec-${idx}`);
      setTimeout(() => setAppliedField(null), 2500);
    }
  };

  const chipsRapidos = [
    { label: '📋 Antecedentes 2024', prompt: 'Resume los antecedentes técnicos, diagnóstico y recomendaciones registradas en la PGP 2024 para este equipo.' },
    { label: `⚠️ Puntos Críticos (${equipo?.material || 'Material'})`, prompt: `¿Cuáles son los modos de falla típicos y qué partes debo inspeccionar prioritariamente en un equipo de material ${equipo?.material || 'industrial'}?` },
    { label: '🔩 Revisar Acometidas / Bulonería', prompt: '¿Qué precauciones y criterios de apriete o reemplazo aplican para las acometidas bridadas y bulonería de este equipo?' },
    { label: '📝 Sugerir Redacción Técnica', prompt: 'Redacta un diagnóstico y recomendaciones formales en tiempo impersonal para un estado REGULAR con desgaste superficial en este equipo.' }
  ];

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '460px',
        maxWidth: '100vw',
        zIndex: 9999,
        background: 'var(--bg-card, #171a21)',
        borderLeft: '1px solid var(--border-color, #272c36)',
        boxShadow: '-8px 0 30px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        backdropFilter: 'blur(16px)',
        transition: 'transform 0.3s ease'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color, #272c36)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          background: 'rgba(59, 130, 246, 0.05)'
        }}
      >
        <div style={{ flex: 1, paddingRight: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff'
              }}
            >
              <Sparkles size={16} />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text-primary, #f3f4f6)' }}>
              Copiloto Técnico Gemini
            </h3>
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary, #98a1b0)' }}>
            Especialista acotado a: <strong style={{ color: '#3b82f6' }}>{equipo?.nombre || 'Equipo'}</strong> ({equipo?.codigo || equipo?.tag || `ID: ${equipo?.id}`})
          </p>
          {equipo?.material && (
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa',
                  fontWeight: 500
                }}
              >
                Material: {equipo.material}
              </span>
              {equipo?.area && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(107, 114, 128, 0.2)',
                    color: '#9ca3af'
                  }}
                >
                  Área: {equipo.area}
                </span>
              )}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary, #98a1b0)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Cerrar Copiloto"
        >
          <X size={20} />
        </button>
      </div>

      {/* Chips Rápidos */}
      <div
        style={{
          padding: '10px 16px',
          background: 'rgba(0, 0, 0, 0.15)',
          borderBottom: '1px solid var(--border-color, #272c36)',
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          scrollbarWidth: 'none'
        }}
      >
        {chipsRapidos.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(chip.prompt)}
            disabled={loading}
            style={{
              whiteSpace: 'nowrap',
              fontSize: '0.75rem',
              padding: '5px 10px',
              borderRadius: '16px',
              background: 'var(--bg-input, rgba(255, 255, 255, 0.05))',
              border: '1px solid var(--border-color, #272c36)',
              color: 'var(--text-primary, #f3f4f6)',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              opacity: loading ? 0.6 : 1
            }}
            onMouseOver={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
            onMouseOut={(e) => (e.currentTarget.style.borderColor = 'var(--border-color, #272c36)')}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Cuerpo de Mensajes */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
      >
        {messages.map((msg, idx) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id || idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '4px',
                  fontSize: '0.72rem',
                  color: 'var(--text-secondary, #98a1b0)'
                }}
              >
                {isUser ? (
                  <>
                    <span>Tú</span>
                    <User size={13} />
                  </>
                ) : (
                  <>
                    <Bot size={13} color="#3b82f6" />
                    <span style={{ color: '#3b82f6', fontWeight: 600 }}>Gemini Inspector</span>
                  </>
                )}
                <span>• {msg.timestamp}</span>
              </div>

              <div
                style={{
                  maxWidth: '92%',
                  padding: '12px 14px',
                  borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  background: isUser
                    ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                    : msg.isError
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'var(--bg-input, rgba(255, 255, 255, 0.05))',
                  border: isUser
                    ? 'none'
                    : msg.isError
                    ? '1px solid #ef4444'
                    : '1px solid var(--border-color, #272c36)',
                  color: isUser ? '#ffffff' : 'var(--text-primary, #f3f4f6)',
                  fontSize: '0.85rem',
                  lineHeight: '1.45',
                  whiteSpace: 'pre-wrap',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                }}
              >
                {msg.text}
              </div>

              {/* Botones de acción en respuestas de Gemini */}
              {!isUser && !msg.isError && msg.id !== 'init' && (
                <div
                  style={{
                    display: 'flex',
                    gap: '6px',
                    marginTop: '6px',
                    flexWrap: 'wrap'
                  }}
                >
                  <button
                    onClick={() => copyToClipboard(msg.text, idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.7rem',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-color, #272c36)',
                      color: 'var(--text-secondary, #98a1b0)',
                      cursor: 'pointer'
                    }}
                    title="Copiar texto al portapapeles"
                  >
                    {copiedIndex === idx ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                    {copiedIndex === idx ? 'Copiado' : 'Copiar'}
                  </button>

                  {onApplyDiagnostico && (
                    <button
                      onClick={() => applyToField('diagnostico', msg.text, idx)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.7rem',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        color: '#60a5fa',
                        cursor: 'pointer'
                      }}
                      title="Copiar respuesta al campo Diagnóstico del informe"
                    >
                      {appliedField === `diag-${idx}` ? (
                        <>
                          <Check size={11} color="#10b981" />
                          <span>¡Aplicado!</span>
                        </>
                      ) : (
                        <>
                          <ArrowDownToLine size={11} />
                          <span>Aplicar a Diagnóstico</span>
                        </>
                      )}
                    </button>
                  )}

                  {onApplyRecomendaciones && (
                    <button
                      onClick={() => applyToField('recomendaciones', msg.text, idx)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.7rem',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        color: '#34d399',
                        cursor: 'pointer'
                      }}
                      title="Copiar respuesta al campo Recomendaciones del informe"
                    >
                      {appliedField === `rec-${idx}` ? (
                        <>
                          <Check size={11} color="#10b981" />
                          <span>¡Aplicado!</span>
                        </>
                      ) : (
                        <>
                          <ArrowDownToLine size={11} />
                          <span>Aplicar a Recomendaciones</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' }}>
            <div
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                border: '2px solid #3b82f6',
                borderTopColor: 'transparent',
                animation: 'spin 1s linear infinite'
              }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #98a1b0)' }}>
              Gemini analizando ficha y antecedentes...
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer / Input */}
      <div
        style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border-color, #272c36)',
          background: 'var(--bg-card, #171a21)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-input, rgba(0, 0, 0, 0.2))',
            border: `1px solid ${isRecording ? '#ef4444' : 'var(--border-color, #272c36)'}`,
            borderRadius: '10px',
            padding: '8px 12px',
            transition: 'border-color 0.2s ease'
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? 'Escuchando tu consulta de voz...' : 'Preguntar sobre este equipo (Enter para enviar)...'}
            rows={1}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary, #f3f4f6)',
              fontSize: '0.85rem',
              resize: 'none',
              outline: 'none',
              maxHeight: '80px',
              fontFamily: 'inherit'
            }}
          />

          <button
            onClick={toggleSpeechRecognition}
            style={{
              background: isRecording ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
              border: 'none',
              color: isRecording ? '#ef4444' : 'var(--text-secondary, #98a1b0)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title={isRecording ? 'Detener dictado' : 'Dictar pregunta por voz'}
          >
            {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            style={{
              background: input.trim() && !loading ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#ffffff',
              cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              padding: '6px 10px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s ease'
            }}
            title="Enviar mensaje"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
