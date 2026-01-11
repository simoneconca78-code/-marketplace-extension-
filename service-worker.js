/**
 * SERVICE-WORKER.JS - Background Service Worker (Manifest V3)
 * Gestisce:
 * - Event di installazione
 * - Background tasks
 * - Notifiche browser
 */

// ==================== INSTALL EVENT ====================
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installed');
    
    // Inizializza storage con valori di default
    chrome.storage.local.set({
      activityLog: [],
      categoryMappings: getDefaultMappings(),
      settings: {
        autoDelay: true,
        enableAI: true,
        baseDelay: 2000
      }
    });

    // Apri tab di benvenuto
    chrome.tabs.create({
      url: 'chrome-extension://' + chrome.runtime.id + '/popup.html'
    });
  }
});

// ==================== MESSAGE LISTENER ====================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'log_activity') {
    logActivity(request.data);
    sendResponse({ success: true });
  }
});

// ==================== HELPER FUNCTIONS ====================
function getDefaultMappings() {
  return {
    'Smartphone': {
      fields: ['Marca', 'Modello', 'Memoria', 'Batteria %', 'Condizione']
    },
    'Abbigliamento': {
      fields: ['Taglia', 'Colore', 'Brand', 'Materiale', 'Condizione']
    },
    'Arredi': {
      fields: ['Colore', 'Materiale', 'Dimensioni', 'Condizione']
    },
    'Elettronica': {
      fields: ['Marca', 'Modello', 'Anno', 'Condizione']
    }
  };
}

function logActivity(data) {
  chrome.storage.local.get('activityLog', (result) => {
    const log = result.activityLog || [];
    log.push({
      timestamp: new Date().toLocaleString('it-IT'),
      ...data
    });
    
    if (log.length > 500) {
      log.shift();
    }
    
    chrome.storage.local.set({ activityLog: log });
  });
}

console.log('Service Worker active');
