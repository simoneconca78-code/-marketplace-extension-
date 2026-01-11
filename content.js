/**
 * CONTENT.JS - Esecuzione nel contesto della pagina
 * Gestisce:
 * - Compilazione form Subito
 * - Rilevamento campi dinamici
 * - Upload foto (dove possibile)
 * - Notifiche in-page
 */

console.log('Content script loaded');

// ==================== MESSAGE LISTENER ====================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'compile_form') {
    handleCompileForm(request.data, sendResponse);
    return true; // Keep channel open for async response
  }
});

// ==================== SUBITO FORM COMPILATION ====================
async function handleCompileForm(data, sendResponse) {
  try {
    const { marketplace, fields } = data;

    if (marketplace === 'subito') {
      await compileSubitoForm(fields);
      showInPageNotification('✅ Form compilato! Verifica e pubblica.', 'success');
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Marketplace non supportato' });
    }
  } catch (error) {
    console.error('Compilation error:', error);
    showInPageNotification(`❌ Errore: ${error.message}`, 'error');
    sendResponse({ success: false, error: error.message });
  }
}

async function compileSubitoForm(fields) {
  console.log('Starting Subito form compilation...', fields);

  // Selector mapping per Subito
  const selectors = {
    titolo: 'input[placeholder*="Titolo"], input[name*="title"], input[data-qa*="title"]',
    descrizione: 'textarea[placeholder*="Descrizione"], textarea[name*="description"], div[contenteditable="true"]',
    prezzo: 'input[placeholder*="Prezzo"], input[name*="price"], input[data-qa*="price"]',
    categoria: 'select[name*="category"], button[data-qa*="category"]',
    condizione: 'select[name*="condition"], button[data-qa*="condition"]',
    marca: 'input[placeholder*="Marca"], input[name*="brand"]',
    colore: 'input[placeholder*="Colore"], select[name*="color"]'
  };

  // Filling titolo
  const titoloInput = document.querySelector(selectors.titolo);
  if (titoloInput && fields.titolo) {
    titoloInput.value = fields.titolo;
    titoloInput.dispatchEvent(new Event('input', { bubbles: true }));
    titoloInput.dispatchEvent(new Event('change', { bubbles: true }));
    await delay(300);
  }

  // Filling descrizione
  const descrizioneInput = document.querySelector(selectors.descrizione);
  if (descrizioneInput && fields.descrizione) {
    if (descrizioneInput.tagName === 'TEXTAREA') {
      descrizioneInput.value = fields.descrizione;
      descrizioneInput.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (descrizioneInput.contentEditable === 'true') {
      descrizioneInput.innerText = fields.descrizione;
      descrizioneInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await delay(300);
  }

  // Filling prezzo
  const prezzoInput = document.querySelector(selectors.prezzo);
  if (prezzoInput && fields.prezzo) {
    prezzoInput.value = fields.prezzo;
    prezzoInput.dispatchEvent(new Event('input', { bubbles: true }));
    await delay(300);
  }

  // Filling categoria (dropdown)
  await selectDropdownOption(selectors.categoria, fields.categoria);

  // Filling condizione
  await selectDropdownOption(selectors.condizione, fields.condizione);

  // Filling marca
  const marcaInput = document.querySelector(selectors.marca);
  if (marcaInput && fields.marca) {
    marcaInput.value = fields.marca;
    marcaInput.dispatchEvent(new Event('input', { bubbles: true }));
    await delay(300);
  }

  // Filling colore
  const coloreInput = document.querySelector(selectors.colore);
  if (coloreInput && fields.colore) {
    if (coloreInput.tagName === 'SELECT') {
      coloreInput.value = fields.colore;
      coloreInput.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      coloreInput.value = fields.colore;
      coloreInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await delay(300);
  }

  console.log('Subito form compilation completed');
}

// ==================== DROPDOWN SELECTION ====================
async function selectDropdownOption(selector, optionText) {
  const element = document.querySelector(selector);
  if (!element || !optionText) return;

  // Se è un select nativo
  if (element.tagName === 'SELECT') {
    const option = Array.from(element.options).find(opt => 
      opt.textContent.toLowerCase().includes(optionText.toLowerCase())
    );
    if (option) {
      element.value = option.value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return;
  }

  // Se è un dropdown personalizzato (button)
  element.click();
  await delay(500);

  // Cerca l'opzione nella lista dropdown
  const dropdownItems = document.querySelectorAll('[role="option"], .dropdown-item, li[data-value]');
  for (const item of dropdownItems) {
    if (item.textContent.toLowerCase().includes(optionText.toLowerCase())) {
      item.click();
      await delay(300);
      break;
    }
  }
}

// ==================== IN-PAGE NOTIFICATIONS ====================
function showInPageNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `marketplace-notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 20px;
    background: ${getNotificationColor(type)};
    color: white;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 100000;
    animation: slideIn 0.3s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function getNotificationColor(type) {
  const colors = {
    success: '#28a745',
    error: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8'
  };
  return colors[type] || colors.info;
}

// ==================== UTILITY ====================
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Add animations to document if not present
function addAnimationsToPage() {
  if (!document.getElementById('marketplace-animations')) {
    const style = document.createElement('style');
    style.id = 'marketplace-animations';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

addAnimationsToPage();

console.log('Content script ready');
