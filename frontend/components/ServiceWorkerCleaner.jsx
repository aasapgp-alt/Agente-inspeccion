'use client';

import { useEffect } from 'react';

export function ServiceWorkerCleaner() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // In development or when force updating, unregister old PWA service workers and clear cache storage
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            console.log('[PWA] Unregistering ServiceWorker:', registration);
            registration.unregister();
          }
        });
      }

      if ('caches' in window) {
        caches.keys().then((names) => {
          for (const name of names) {
            console.log('[PWA] Deleting CacheStorage:', name);
            caches.delete(name);
          }
        });
      }
    }
  }, []);

  return null;
}
