// Guymacyb243 — setup-preload (wizard)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('guymacyb243Setup', {
  detect: () => ipcRenderer.invoke('setup:detect'),
  installWsl: () => ipcRenderer.invoke('setup:install-wsl'),
  installTools: () => ipcRenderer.invoke('setup:install-tools'),
  complete: () => ipcRenderer.invoke('setup:complete'),
  onProgress: (cb) => {
    const h = (_e, line) => cb(line);
    ipcRenderer.on('setup:progress', h);
    return () => ipcRenderer.removeListener('setup:progress', h);
  },
});
