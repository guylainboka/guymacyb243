// Guymacyb243 — preload (fenêtre principale)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('guymacyb243', {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },
  isDev: process.env.GCYB243_DEV === '1' || process.env.NODE_ENV === 'development',
  version: '1.0.0',
});
