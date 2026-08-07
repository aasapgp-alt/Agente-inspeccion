/**
 * Emite una vibración háptica si el navegador y el dispositivo lo soportan.
 * @param {number|number[]} pattern - Duración en milisegundos o patrón de vibración
 */
export function vibrar(pattern = 30) {
  if (typeof window !== 'undefined' && 'navigator' in window && typeof window.navigator.vibrate === 'function') {
    try {
      window.navigator.vibrate(pattern);
    } catch (e) {
      // Ignorar si el navegador bloquea la vibración
    }
  }
}

export function vibrarExito() {
  vibrar([40, 30, 40]);
}

export function vibrarError() {
  vibrar([100, 50, 100]);
}
