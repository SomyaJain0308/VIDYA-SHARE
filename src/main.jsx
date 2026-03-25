import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

const mountEmergencyRoot = (message = 'The app could not finish starting on this device.') => {
  const root = document.getElementById('root')
  if (!root) return

  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:
      radial-gradient(circle at 16% 0%, rgba(79,215,255,0.16), transparent 34%),
      radial-gradient(circle at 84% 8%, rgba(0,122,255,0.12), transparent 32%),
      linear-gradient(180deg, #06101a 0%, #04070d 100%);
      color:#f3fbff;font-family:Manrope,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="width:min(100%,420px);border:1px solid rgba(120,231,255,0.18);border-radius:28px;background:linear-gradient(180deg, rgba(10,18,28,0.92), rgba(5,10,16,0.96));box-shadow:0 28px 70px -38px rgba(0,0,0,0.9);padding:28px 24px;text-align:center;">
        <div style="width:56px;height:56px;margin:0 auto 16px;border-radius:18px;display:grid;place-items:center;background:rgba(101,227,255,0.12);box-shadow:inset 0 0 0 1px rgba(132,235,255,0.14);font-size:24px;">V</div>
        <h1 style="margin:0;font-family:'Space Grotesk',Manrope,sans-serif;font-size:30px;font-weight:700;letter-spacing:0.04em;">Vidya Share</h1>
        <p style="margin:10px 0 0;color:rgba(232,248,255,0.76);font-size:14px;line-height:1.6;">${message}</p>
        <div style="margin-top:20px;display:flex;flex-wrap:wrap;gap:10px;justify-content:center;">
          <button type="button" onclick="window.__VIDYA_SHARE_RELOAD_APP__ ? window.__VIDYA_SHARE_RELOAD_APP__() : window.location.reload()" style="appearance:none;border:0;border-radius:999px;padding:11px 18px;background:linear-gradient(135deg,#5be8ff 0%,#c8f6ff 100%);color:#041018;font:inherit;font-size:14px;font-weight:700;">Reload App</button>
          <button type="button" onclick="window.__VIDYA_SHARE_OPEN_HOME__ ? window.__VIDYA_SHARE_OPEN_HOME__() : window.location.replace(window.location.origin + '/')" style="appearance:none;border:1px solid rgba(130,235,255,0.2);border-radius:999px;padding:11px 18px;background:rgba(255,255,255,0.04);color:#f5fdff;font:inherit;font-size:14px;font-weight:700;">Open Home</button>
        </div>
      </div>
    </div>
  `

  if (typeof window.__VIDYA_SHARE_BOOT_FAIL__ === 'function') {
    window.__VIDYA_SHARE_BOOT_FAIL__()
  }
}

window.addEventListener('load', () => {
  window.setTimeout(() => {
    if (typeof window.__VIDYA_SHARE_BOOT_OK__ === 'function') {
      window.__VIDYA_SHARE_BOOT_OK__();
    }
  }, 120);
});

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));

      if ('caches' in window) {
        const cacheKeys = await window.caches.keys();
        await Promise.all(cacheKeys.map((cacheKey) => window.caches.delete(cacheKey)));
      }
    } catch (error) {
      console.error('Service worker cleanup failed:', error);
    }
  });
}

const bootApp = async () => {
  try {
    const [{ default: App }] = await Promise.all([import('./App.jsx')])
    const appTree = import.meta.env.PROD ? <App /> : (
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )

    ReactDOM.createRoot(document.getElementById('root')).render(appTree)

    if (typeof window.__VIDYA_SHARE_BOOT_OK__ === 'function') {
      window.__VIDYA_SHARE_BOOT_OK__()
    }
  } catch (error) {
    console.error('App bootstrap failed:', error)
    mountEmergencyRoot('The app could not finish starting on this device. Reload once to recover the latest version.')
  }
}

bootApp()
