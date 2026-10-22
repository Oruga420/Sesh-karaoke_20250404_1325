export function registerOfflineShell(): void {
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
  const host = window.location.hostname;
  if (!window.isSecureContext && host !== 'localhost' && host !== '127.0.0.1' && host !== '[::1]') return;
  // Failure leaves online use intact; saved lyrics remain separate in browser JSON storage.
  void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}
