'use client';

import React from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { vibrar } from '../../../utils/haptics';
import { CampoButton } from '../shared/CampoButton';

export function GuardarSiguiente({
  onGuardar,
  isGuardando = false,
  mostrarModalConfirmacion = false,
  isOnline = true,
  onNavegarSiguiente,
  onNavegarInicio,
  onNavegarBuscar,
  fuente = 'busqueda',
  hasSiguiente = false
}) {
  const esItinerario = fuente === 'itinerario' && hasSiguiente;

  return (
    <>
      <div className="mt-3 space-y-2">
        <CampoButton
          variant="success"
          size="medium"
          onClick={onGuardar}
          disabled={isGuardando}
          fullWidth
          icon={ArrowRight}
        >
          {isGuardando
            ? 'GUARDANDO...'
            : esItinerario
            ? 'GUARDAR Y SIGUIENTE'
            : 'GUARDAR Y VOLVER AL INICIO'}
        </CampoButton>

        {!esItinerario && (
          <CampoButton
            variant="secondary"
            size="medium"
            onClick={() => {
              vibrar(20);
              if (onNavegarInicio) onNavegarInicio();
            }}
            disabled={isGuardando}
            fullWidth
          >
            VOLVER AL INICIO SIN GUARDAR
          </CampoButton>
        )}
      </div>

      {/* Modal Confirmación Guardado */}
      {mostrarModalConfirmacion && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="bg-[#090d16] border border-emerald-500 max-w-sm w-full p-5 rounded-2xl space-y-3 text-center shadow-2xl animate-in fade-in zoom-in duration-200">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <div>
              <h3 className="text-xl font-black text-white m-0">¡Inspección Guardada!</h3>
              <p className="text-xs font-semibold mt-1 text-slate-300">
                {isOnline
                  ? '🔄 Subiendo evidencias a Drive y transcribiendo audios...'
                  : '⏳ Guardado localmente en el celular (se subirá al conectar).'}
              </p>
            </div>

            <div className="space-y-2 pt-1">
              {esItinerario ? (
                <>
                  <CampoButton
                    variant="success"
                    size="medium"
                    onClick={onNavegarSiguiente}
                    fullWidth
                    icon={ArrowRight}
                  >
                    SIGUIENTE EQUIPO
                  </CampoButton>

                  <CampoButton
                    variant="secondary"
                    size="medium"
                    onClick={() => {
                      vibrar(20);
                      if (onNavegarInicio) onNavegarInicio();
                    }}
                    fullWidth
                  >
                    Ir al Inicio
                  </CampoButton>
                </>
              ) : (
                <>
                  <CampoButton
                    variant="success"
                    size="medium"
                    onClick={() => {
                      vibrar(20);
                      if (onNavegarInicio) onNavegarInicio();
                    }}
                    fullWidth
                    icon={CheckCircle2}
                  >
                    VOLVER AL INICIO
                  </CampoButton>

                  {onNavegarBuscar && (
                    <CampoButton
                      variant="secondary"
                      size="medium"
                      onClick={() => {
                        vibrar(20);
                        if (onNavegarBuscar) onNavegarBuscar();
                      }}
                      fullWidth
                    >
                      NUEVA BÚSQUEDA
                    </CampoButton>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default GuardarSiguiente;
