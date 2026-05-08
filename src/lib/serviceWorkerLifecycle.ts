const LOCAL_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
]);

function isLocalHost(hostname: string) {
  return LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost');
}

async function clearLocalServiceWorkerState() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  }
}

function registerProductionServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Service worker support should not block the app shell.
    });
  });
}

if (isLocalHost(window.location.hostname)) {
  clearLocalServiceWorkerState().catch(() => {
    // Local cleanup is best effort; the network app must still run.
  });
} else {
  registerProductionServiceWorker();
}
