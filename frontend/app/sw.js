import { defaultCache } from '@serwist/next/worker';
import { Serwist } from 'serwist';

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-inspecciones') {
    event.waitUntil(
      (async () => {
        const { sincronizarColaPendientes } = await import('../utils/sync');
        await sincronizarColaPendientes();
      })()
    );
  }
});

serwist.addEventListeners();
