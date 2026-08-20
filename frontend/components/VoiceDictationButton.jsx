import { useState, useRef, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { API_BASE_URL } from '../services/api';

export default function VoiceDictationButton({ onTranscript, initialValue = '', placeholder = 'Dictar nota' }) {
  const { token } = useAuth();
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    // Inicializar Web Speech API si está disponible en el navegador
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'es-ES';

        recognition.onresult = (event) => {
          const text = event.results[0][0].transcript;
          if (text) {
            onTranscript(initialValue ? `${initialValue} ${text}` : text);
          }
          setIsListening(false);
          setStatusMsg('');
        };

        recognition.onerror = (event) => {
          console.warn('SpeechRecognition nativo error:', event.error);
          // Si falla Web Speech, caer al grabador de audio Gemini
          fallbackMediaRecorder();
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, [initialValue, onTranscript]);

  const startListening = () => {
    if (isListening || isProcessing) return;

    if (recognitionRef.current) {
      try {
        setIsListening(true);
        setStatusMsg('Escuchando...');
        recognitionRef.current.start();
        return;
      } catch (err) {
        console.warn('No se pudo iniciar SpeechRecognition nativo, usando fallback:', err);
      }
    }

    fallbackMediaRecorder();
  };

  const fallbackMediaRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        setStatusMsg('Transcribiendo con Gemini IA...');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Detener streams de micrófono
        stream.getTracks().forEach(track => track.stop());

        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, 'grabacion.webm');

          const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null);
          const res = await fetch(`${API_BASE_URL}/ia/transcribir-audio`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${activeToken}`
            },
            body: formData
          });

          if (res.ok) {
            const data = await res.json();
            if (data.transcripcion) {
              onTranscript(initialValue ? `${initialValue} ${data.transcripcion}` : data.transcripcion);
            }
          } else {
            console.error('Error del servidor al transcribir audio');
          }
        } catch (err) {
          console.error('Error enviando audio a Gemini:', err);
        } finally {
          setIsProcessing(false);
          setIsListening(false);
          setStatusMsg('');
        }
      };

      mediaRecorder.start();
      setIsListening(true);
      setStatusMsg('Grabando audio (Toca para detener)...');
    } catch (err) {
      console.error('No se pudo acceder al micrófono:', err);
      alert('No se pudo acceder al micrófono del dispositivo.');
      setIsListening(false);
      setStatusMsg('');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <button
        type="button"
        onClick={isListening ? stopListening : startListening}
        disabled={isProcessing}
        title="Dictar nota de voz a texto"
        style={{
          backgroundColor: isListening ? 'rgba(239, 68, 68, 0.3)' : 'rgba(56, 189, 248, 0.15)',
          border: isListening ? '1px solid #ef4444' : '1px solid rgba(56, 189, 248, 0.4)',
          color: isListening ? '#fca5a5' : '#38bdf8',
          padding: '6px 12px',
          borderRadius: '20px',
          fontWeight: 700,
          fontSize: '0.8rem',
          cursor: isProcessing ? 'wait' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          animation: isListening ? 'pulse 1.5s infinite' : 'none'
        }}
      >
        <span>{isListening ? '🔴' : '🎙️'}</span>
        <span>{isProcessing ? 'Procesando...' : isListening ? 'Detener' : placeholder}</span>
      </button>

      {statusMsg && (
        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
          {statusMsg}
        </span>
      )}
    </div>
  );
}
