/**
 * POPUP.JS - Logica principale del popup
 * Gestisce:
 * - Caricamento annunci da Airtable
 * - Gestione tab
 * - Log attività
 * - Mappature categorie (AI-ready)
 */

// STATE
let currentAnnouncements = [];
let categoryMappings = {};

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', async () => {
  setupTabNavigation();
  setupEventListeners();
  await loadCategoryMappings();
  await loadLog();
});

// ==================== TAB NAVIGATION ====================
function setupTabNavigation() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      
      // Remove active class
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Add active class
      btn.classList.add('active');
      document.getElementById(tabName).classList.add('active');
    });
  });
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
  // Annunci tab
  document.getElementById('loadAnnunci').addEventListener('click', loadAnnouncements);
  document.getElementById('settingsBtn').addEventListener('click', () => {
    document.querySelector('.tab-btn[data-tab="config"]').click();
  });

  // Log tab
  document.getElementById('clearLog').addEventListener('click', clearLog);
  document.getElementById('exportLog').addEventListener('click', exportLog);

  // Config tab
  document.getElementById('addCategory').addEventListener('click', addCategoryMapping);
}

// ==================== AIRTABLE INTEGRATION ====================
async function loadAnnouncements() {
  const apiKey = document.getElementById('apiKey').value;
  const baseId = document.getElementById('baseId').value;
  const tableName = document.getElementById('tableName').value;

  if (!apiKey || !baseId || !tableName) {
    showNotification('⚠️ Compila API Key, Base ID e Tabella', 'warning');
    return;
  }

  setLoading(true);
  clearError();

  try {
    const response = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?filterByFormula={Stato}='Bozza'`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Airtable error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    currentAnnouncements = data.records;

    // Log azione
    logActivity('LOAD_AIRTABLE', 'success', `Caricati ${currentAnnouncements.length} annunci`);

    renderAnnouncements();
    showNotification(`✅ Caricati ${currentAnnouncements.length} annunci`, 'success');

  } catch (error) {
    console.error('Airtable error:', error);
    showError(`❌ Errore Airtable: ${error.message}`);
    logActivity('LOAD_AIRTABLE', 'error', error.message);
  } finally {
    setLoading(false);
  }
}

// ==================== RENDER ANNOUNCEMENTS ====================
function renderAnnouncements() {
  const list = document.getElementById('announcements-list');
  list.innerHTML = '';

  if (currentAnnouncements.length === 0) {
    list.innerHTML = '<p style="padding: 16px; text-align: center; color: #999;">Nessun annuncio da pubblicare</p>';
    return;
  }

  currentAnnouncements.forEach((record, index) => {
    const fields = record.fields;
    const card = document.createElement('div');
    card.className = 'announcement-card';

    const category = fields.Categoria || 'N/A';
    const price = fields.Prezzo || 'N/A';
    const condition = fields.Condizione || 'Usato';

    card.innerHTML = `
      <div class="announcement-header">
        <div>
          <div class="announcement-title">${fields.Titolo || 'Senza titolo'}</div>
          <div class="announcement-category">${category}</div>
          <div class="announcement-price">€ ${price}</div>
          <div class="announcement-status status-draft">📋 Bozza</div>
        </div>
      </div>
      
      <div class="announcement-actions">
        <button class="btn-small" onclick="compileOnSubito(${index}, '${record.id}', '${document.getElementById('apiKey').value}', '${document.getElementById('baseId').value}', '${document.getElementById('tableName').value}')">
          → Subito
        </button>
        <button class="btn-small" onclick="compileOnWallapop(${index})">
          → Wallapop
        </button>
        <button class="btn-small" onclick="markAsPublished(${index}, '${record.id}', '${document.getElementById('apiKey').value}', '${document.getElementById('baseId').value}', '${document.getElementById('tableName').value}')">
          ✓ Pubblicato
        </button>
      </div>
    `;

    list.appendChild(card);
  });
}

// ==================== COMPILE ON MARKETPLACE ====================
async function compileOnSubito(index, recordId, apiKey, baseId, tableName) {
  const announcement = currentAnnouncements[index];
  const fields = announcement.fields;

  // Invia message al content script
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const compilationData = {
    marketplace: 'subito',
    fields: {
      titolo: fields.Titolo,
      descrizione: fields.Descrizione,
      prezzo: fields.Prezzo,
      categoria: fields.Categoria,
      condizione: fields.Condizione,
      marca: fields.Marca || '',
      colore: fields.Colore || '',
      airtableId: recordId
    }
  };

  chrome.tabs.sendMessage(tab.id, { action: 'compile_form', data: compilationData }, (response) => {
    if (response?.success) {
      logActivity('COMPILE_FORM', 'success', `Form compilato: ${fields.Titolo}`);
      showNotification('✅ Form compilato! Verifica e pubblica manualmente.', 'success');
    } else {
      logActivity('COMPILE_FORM', 'error', `Errore compilazione: ${response?.error}`);
      showNotification('❌ Errore nella compilazione del form', 'error');
    }
  });
}

async function compileOnWallapop(index) {
  const announcement = currentAnnouncements[index];
  logActivity('COMPILE_WALLAPOP', 'info', `Wallapop non ancora implementato: ${announcement.fields.Titolo}`);
  showNotification('⚠️ Wallapop disponibile nella prossima versione', 'warning');
}

// ==================== UPDATE AIRTABLE STATUS ====================
async function markAsPublished(index, recordId, apiKey, baseId, tableName) {
  const announcement = currentAnnouncements[index];

  try {
    const response = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}/${recordId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: {
            'Stato': 'Pubblicato',
            'Data Pubblicazione': new Date().toISOString().split('T')[0]
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Airtable PATCH error: ${response.status}`);
    }

    logActivity('UPDATE_STATUS', 'success', `Stato aggiornato: ${announcement.fields.Titolo}`);
    showNotification('✅ Stato aggiornato a "Pubblicato"', 'success');

    // Ricarica annunci
    setTimeout(() => loadAnnouncements(), 500);

  } catch (error) {
    console.error('Update status error:', error);
    logActivity('UPDATE_STATUS', 'error', error.message);
    showNotification('❌ Errore aggiornamento stato', 'error');
  }
}

// ==================== CATEGORY MAPPINGS ====================
async function loadCategoryMappings() {
  const stored = await chrome.storage.local.get('categoryMappings');
  categoryMappings = stored.categoryMappings || getDefaultMappings();
  renderCategoryMappings();
}

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

function renderCategoryMappings() {
  const container = document.getElementById('categoryMappings');
  container.innerHTML = '';

  Object.entries(categoryMappings).forEach(([category, mapping]) => {
    const item = document.createElement('div');
    item.className = 'category-item';
    item.innerHTML = `
      <div class="category-item-header">
        <div class="category-item-name">${category}</div>
        <button class="category-item-remove" onclick="removeCategory('${category}')">Rimuovi</button>
      </div>
      <div class="category-item-fields">
        <strong>Campi:</strong><br>
        ${mapping.fields.join(', ')}
      </div>
    `;
    container.appendChild(item);
  });
}

function addCategoryMapping() {
  const categoryName = prompt('Nome categoria:');
  if (!categoryName) return;

  const fieldsStr = prompt('Campi separati da virgola (es: Marca, Modello, RAM):');
  if (!fieldsStr) return;

  categoryMappings[categoryName] = {
    fields: fieldsStr.split(',').map(f => f.trim())
  };

  chrome.storage.local.set({ categoryMappings });
  renderCategoryMappings();
  showNotification(`✅ Categoria "${categoryName}" aggiunta`, 'success');
  logActivity('ADD_CATEGORY', 'success', categoryName);
}

function removeCategory(category) {
  if (confirm(`Rimuovere categoria "${category}"?`)) {
    delete categoryMappings[category];
    chrome.storage.local.set({ categoryMappings });
    renderCategoryMappings();
    showNotification(`✅ Categoria rimossa`, 'success');
    logActivity('REMOVE_CATEGORY', 'success', category);
  }
}

// ==================== LOG ACTIVITY ====================
function logActivity(action, status, details = '') {
  const logEntry = {
    timestamp: new Date().toLocaleString('it-IT'),
    action,
    status,
    details
  };

  chrome.storage.local.get('activityLog', (result) => {
    const log = result.activityLog || [];
    log.push(logEntry);
    
    // Mantieni ultimi 500 log
    if (log.length > 500) {
      log.shift();
    }

    chrome.storage.local.set({ activityLog: log });
  });
}

async function loadLog() {
  const result = await chrome.storage.local.get('activityLog');
  const log = result.activityLog || [];
  const logList = document.getElementById('log-list');

  logList.innerHTML = '';

  if (log.length === 0) {
    logList.innerHTML = '<p style="padding: 16px; text-align: center; color: #999;">Nessuna attività</p>';
    return;
  }

  // Mostra log in reverse order (più recente prima)
  [...log].reverse().forEach(entry => {
    const logElement = document.createElement('div');
    logElement.className = `log-entry log-status-${entry.status}`;
    logElement.innerHTML = `
      <span class="log-time">${entry.timestamp}</span>
      <span class="log-action">${entry.action}</span>
      ${entry.details ? `<div class="log-details">${entry.details}</div>` : ''}
    `;
    logList.appendChild(logElement);
  });
}

function clearLog() {
  if (confirm('Cancellare tutto il log?')) {
    chrome.storage.local.set({ activityLog: [] });
    loadLog();
    showNotification('✅ Log cancellato', 'success');
  }
}

function exportLog() {
  chrome.storage.local.get('activityLog', (result) => {
    const log = result.activityLog || [];
    const csv = convertToCSV(log);
    downloadCSV(csv, 'marketplace-log.csv');
    showNotification('✅ Log esportato', 'success');
  });
}

function convertToCSV(log) {
  const headers = ['Timestamp', 'Action', 'Status', 'Details'];
  const rows = log.map(entry => [
    entry.timestamp,
    entry.action,
    entry.status,
    entry.details
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  return csv;
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ==================== UI HELPERS ====================
function showNotification(message, type = 'info') {
  const notif = document.getElementById('notification');
  notif.textContent = message;
  notif.className = `notification ${type}`;
  
  setTimeout(() => {
    notif.classList.add('hidden');
  }, 3000);
}

function showError(message) {
  const errorDiv = document.getElementById('errorMsg');
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');
}

function clearError() {
  const errorDiv = document.getElementById('errorMsg');
  errorDiv.classList.add('hidden');
}

function setLoading(isLoading) {
  const loading = document.getElementById('loading');
  if (isLoading) {
    loading.classList.remove('hidden');
  } else {
    loading.classList.add('hidden');
  }
}
