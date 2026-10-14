/**
 * Windows Notepad Clone - Web / Desktop Client Application
 * Baseado na engenharia reversa do executável notepad.exe e bibliotecas MUI do Windows.
 */

// ============================================================================
// 1. Localization Dictionary (pt-BR / en-US)
// ============================================================================
const I18N = {
  'pt-BR': {
    appName: 'Bloco de Notas',
    untitled: 'Sem título',
    confirmSave: (name) => `Deseja salvar as alterações em ${name}?`,
    save: 'Salvar',
    dontSave: 'Não Salvar',
    cancel: 'Cancelar',
    lnCol: (ln, col) => `Lin ${ln}, Col ${col}`,
    chars: (count) => `${count} caractere${count === 1 ? '' : 's'}`,
    copiedToClipboard: 'Copiado para a área de transferência.',
    cannotFind: (text) => `Não foi possível encontrar "${text}".`,
    replacedCount: (n) => `${n} ocorrência(s) substituída(s).`,
    invalidLine: 'O número da linha está além do número total de linhas.',
    fileMenu: 'Arquivo',
    editMenu: 'Editar',
    formatMenu: 'Formatar',
    viewMenu: 'Exibir',
    helpMenu: 'Ajuda',
    statusBarLabel: 'Barra de status',
    wordWrapLabel: 'Quebra automática de linha'
  },
  'en-US': {
    appName: 'Notepad',
    untitled: 'Untitled',
    confirmSave: (name) => `Do you want to save changes to ${name}?`,
    save: 'Save',
    dontSave: "Don't Save",
    cancel: 'Cancel',
    lnCol: (ln, col) => `Ln ${ln}, Col ${col}`,
    chars: (count) => `${count} character${count === 1 ? '' : 's'}`,
    copiedToClipboard: 'Copied to clipboard.',
    cannotFind: (text) => `Cannot find "${text}".`,
    replacedCount: (n) => `${n} occurrence(s) replaced.`,
    invalidLine: 'Line number is beyond the total number of lines.',
    fileMenu: 'File',
    editMenu: 'Edit',
    formatMenu: 'Format',
    viewMenu: 'View',
    helpMenu: 'Help',
    statusBarLabel: 'Status Bar',
    wordWrapLabel: 'Word Wrap'
  }
};

// ============================================================================
// 2. Tab & Document State Model
// ============================================================================
class DocumentTab {
  constructor(id, title = 'Sem título', content = '') {
    this.id = id;
    this.title = title;
    this.content = content;
    this.savedContent = content;
    this.isDirty = false;
    this.fileHandle = null;
    this.cursorPos = 0;
  }
}

// ============================================================================
// 3. Application State & Controller
// ============================================================================
class NotepadApp {
  constructor() {
    this.lang = 'pt-BR';
    this.theme = 'dark';
    this.tabs = [new DocumentTab(1, 'Sem título', '')];
    this.activeTabId = 1;
    this.nextTabId = 2;

    this.zoomLevel = 100; // in percent
    this.isWordWrap = true;
    this.isStatusBarVisible = true;
    this.eolMode = 'CRLF'; // CRLF or LF

    this.fontConfig = {
      family: 'Consolas',
      style: 'normal',
      weight: 'normal',
      size: 14 // px
    };

    this.pendingConfirmAction = null; // for unsaved dialog callback

    this.initElements();
    this.bindEvents();
    this.updateUI();
  }

  // Initialize DOM references
  initElements() {
    this.editor = document.getElementById('text-editor');
    this.windowTitle = document.getElementById('window-title');
    this.statusPos = document.getElementById('status-pos');
    this.statusChars = document.getElementById('status-chars');
    this.statusZoom = document.getElementById('status-zoom');
    this.statusEol = document.getElementById('status-eol');
    this.statusEnc = document.getElementById('status-enc');
    this.statusbar = document.getElementById('statusbar');
    this.tabsContainer = document.getElementById('tabs-container');
    this.newTabBtn = document.getElementById('new-tab-btn');
    this.fileInput = document.getElementById('file-input');

    // Menu Checkmarks
    this.menuWordWrap = document.getElementById('menu-wordwrap');
    this.menuStatusBar = document.getElementById('menu-statusbar');

    // Dialogs
    this.dialogFind = document.getElementById('dialog-find');
    this.dialogReplace = document.getElementById('dialog-replace');
    this.dialogGoto = document.getElementById('dialog-goto');
    this.dialogFont = document.getElementById('dialog-font');
    this.dialogPageSetup = document.getElementById('dialog-pagesetup');
    this.dialogAbout = document.getElementById('dialog-about');
    this.dialogConfirmSave = document.getElementById('dialog-confirm-save');

    // Font dialog elements
    this.fontFamilyList = document.getElementById('font-family-list');
    this.fontStyleList = document.getElementById('font-style-list');
    this.fontSizeList = document.getElementById('font-size-list');
    this.fontSamplePreview = document.getElementById('font-sample-preview');
  }

  get activeTab() {
    return this.tabs.find(t => t.id === this.activeTabId) || this.tabs[0];
  }

  t(key, ...args) {
    const val = I18N[this.lang][key];
    if (typeof val === 'function') return val(...args);
    return val || key;
  }

  // ==========================================================================
  // Event Bindings
  // ==========================================================================
  bindEvents() {
    // Editor input and selection events
    this.editor.addEventListener('input', () => {
      this.activeTab.content = this.editor.value;
      this.checkDirtyState();
      this.updateCursorStats();
    });

    ['click', 'keyup', 'select'].forEach(ev => {
      this.editor.addEventListener(ev, () => this.updateCursorStats());
    });

    // Zoom via Ctrl + Mouse Wheel
    this.editor.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) this.adjustZoom(10);
        else this.adjustZoom(-10);
      }
    }, { passive: false });

    // Drag and Drop file onto editor
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) {
        this.openFileObject(e.dataTransfer.files[0]);
      }
    });

    // Menubar interactions
    this.setupMenubar();

    // Dialog Buttons
    this.setupDialogButtons();

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => this.handleGlobalShortcuts(e));

    // Titlebar Window Controls
    document.getElementById('minimize-btn').addEventListener('click', () => {
      document.body.classList.toggle('minimized');
    });

    document.getElementById('maximize-btn').addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    document.getElementById('close-btn').addEventListener('click', () => {
      this.actionExit();
    });

    // Theme toggle
    document.getElementById('theme-toggle-btn').addEventListener('click', () => {
      this.toggleTheme();
    });

    // Language toggle
    document.getElementById('lang-toggle-btn').addEventListener('click', () => {
      this.toggleLanguage();
    });

    // New Tab Button
    this.newTabBtn.addEventListener('click', () => this.addNewTab());

    // File input change
    this.fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.openFileObject(e.target.files[0]);
      }
    });

    // Status EOL toggle
    this.statusEol.addEventListener('click', () => {
      this.eolMode = this.eolMode === 'CRLF' ? 'LF' : 'CRLF';
      this.statusEol.textContent = this.eolMode === 'CRLF' ? 'Windows (CRLF)' : 'UNIX (LF)';
    });
  }

  // Menubar opening and outside-click closing
  setupMenubar() {
    const menuItems = document.querySelectorAll('.menu-item');

    menuItems.forEach(item => {
      const trigger = item.querySelector('.menu-trigger');
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = item.classList.contains('open');
        this.closeAllMenus();
        if (!isOpen) item.classList.add('open');
      });

      trigger.addEventListener('mouseenter', () => {
        const anyOpen = Array.from(menuItems).some(m => m.classList.contains('open'));
        if (anyOpen) {
          this.closeAllMenus();
          item.classList.add('open');
        }
      });
    });

    // Close menus on outside click
    window.addEventListener('click', () => this.closeAllMenus());

    // Menu Actions
    document.querySelectorAll('.menu-row[data-action]').forEach(row => {
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = row.getAttribute('data-action');
        this.closeAllMenus();
        this.dispatchAction(action);
      });
    });
  }

  closeAllMenus() {
    document.querySelectorAll('.menu-item.open').forEach(m => m.classList.remove('open'));
  }

  // ==========================================================================
  // Global Keyboard Shortcuts
  // ==========================================================================
  handleGlobalShortcuts(e) {
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const key = e.key.toLowerCase();

    if (ctrl && !shift && key === 'n') {
      e.preventDefault();
      this.actionNewFile();
    } else if (ctrl && shift && key === 'n') {
      e.preventDefault();
      this.actionNewWindow();
    } else if (ctrl && key === 't') {
      e.preventDefault();
      this.addNewTab();
    } else if (ctrl && key === 'w') {
      e.preventDefault();
      this.closeTab(this.activeTabId);
    } else if (ctrl && !shift && key === 'o') {
      e.preventDefault();
      this.actionOpenFile();
    } else if (ctrl && !shift && key === 's') {
      e.preventDefault();
      this.actionSaveFile();
    } else if (ctrl && shift && key === 's') {
      e.preventDefault();
      this.actionSaveAsFile();
    } else if (ctrl && key === 'p') {
      e.preventDefault();
      this.actionPrint();
    } else if (ctrl && key === 'f') {
      e.preventDefault();
      this.openDialog('dialog-find');
    } else if (key === 'f3' && !shift) {
      e.preventDefault();
      this.findNext(true);
    } else if (key === 'f3' && shift) {
      e.preventDefault();
      this.findNext(false);
    } else if (ctrl && key === 'h') {
      e.preventDefault();
      this.openDialog('dialog-replace');
    } else if (ctrl && key === 'g') {
      e.preventDefault();
      this.openDialog('dialog-goto');
    } else if (key === 'f5') {
      e.preventDefault();
      this.insertTimeDate();
    } else if (ctrl && (key === '+' || key === '=')) {
      e.preventDefault();
      this.adjustZoom(10);
    } else if (ctrl && key === '-') {
      e.preventDefault();
      this.adjustZoom(-10);
    } else if (ctrl && key === '0') {
      e.preventDefault();
      this.resetZoom();
    } else if (ctrl && key === 'e') {
      e.preventDefault();
      this.searchWithBing();
    } else if (e.altKey && e.key === 'F4') {
      e.preventDefault();
      this.actionExit();
    }
  }

  // ==========================================================================
  // Action Dispatcher
  // ==========================================================================
  dispatchAction(action) {
    switch (action) {
      case 'new-file': this.actionNewFile(); break;
      case 'new-window': this.actionNewWindow(); break;
      case 'open-file': this.actionOpenFile(); break;
      case 'save-file': this.actionSaveFile(); break;
      case 'save-as-file': this.actionSaveAsFile(); break;
      case 'page-setup': this.openDialog('dialog-pagesetup'); break;
      case 'print-file': this.actionPrint(); break;
      case 'exit-app': this.actionExit(); break;

      case 'undo': document.execCommand('undo'); break;
      case 'redo': document.execCommand('redo'); break;
      case 'cut': this.actionCut(); break;
      case 'copy': this.actionCopy(); break;
      case 'paste': this.actionPaste(); break;
      case 'delete': this.actionDelete(); break;
      case 'bing-search': this.searchWithBing(); break;
      case 'find': this.openDialog('dialog-find'); break;
      case 'find-next': this.findNext(true); break;
      case 'find-prev': this.findNext(false); break;
      case 'replace': this.openDialog('dialog-replace'); break;
      case 'goto': this.openDialog('dialog-goto'); break;
      case 'select-all': this.editor.select(); break;
      case 'time-date': this.insertTimeDate(); break;

      case 'toggle-wordwrap': this.toggleWordWrap(); break;
      case 'open-font-dialog': this.openFontDialog(); break;

      case 'zoom-in': this.adjustZoom(10); break;
      case 'zoom-out': this.adjustZoom(-10); break;
      case 'zoom-reset': this.resetZoom(); break;
      case 'toggle-statusbar': this.toggleStatusBar(); break;

      case 'help-view': window.open('https://support.microsoft.com/windows', '_blank'); break;
      case 'help-feedback': alert('Obrigado pelo feedback do Bloco de Notas!'); break;
      case 'help-about': this.openDialog('dialog-about'); break;
    }
  }

  // ==========================================================================
  // File Operations
  // ==========================================================================
  actionNewFile() {
    if (this.activeTab.isDirty) {
      this.promptConfirmSave(() => {
        this.resetActiveTab();
      });
    } else {
      this.resetActiveTab();
    }
  }

  actionNewWindow() {
    window.open(window.location.href, '_blank');
  }

  actionOpenFile() {
    if (this.activeTab.isDirty) {
      this.promptConfirmSave(() => {
        this.fileInput.click();
      });
    } else {
      this.fileInput.click();
    }
  }

  openFileObject(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.activeTab.title = file.name;
      this.activeTab.content = e.target.result;
      this.activeTab.savedContent = e.target.result;
      this.activeTab.isDirty = false;
      this.editor.value = e.target.result;
      this.updateUI();
    };
    reader.readAsText(file);
  }

  actionSaveFile() {
    if (!this.activeTab.title || this.activeTab.title === 'Sem título' || this.activeTab.title === 'Untitled') {
      this.actionSaveAsFile();
    } else {
      this.downloadFile(this.activeTab.title, this.editor.value);
      this.activeTab.savedContent = this.editor.value;
      this.activeTab.isDirty = false;
      this.updateUI();
    }
  }

  actionSaveAsFile() {
    let name = prompt('Salvar Como (nome do arquivo):', this.activeTab.title || 'documento.txt');
    if (name) {
      if (!name.includes('.')) name += '.txt';
      this.activeTab.title = name;
      this.downloadFile(name, this.editor.value);
      this.activeTab.savedContent = this.editor.value;
      this.activeTab.isDirty = false;
      this.updateUI();
    }
  }

  downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  actionPrint() {
    window.print();
  }

  actionExit() {
    if (this.activeTab.isDirty) {
      this.promptConfirmSave(() => {
        window.close();
      });
    } else {
      window.close();
    }
  }

  // ==========================================================================
  // Edit Actions
  // ==========================================================================
  actionCut() {
    const start = this.editor.selectionStart;
    const end = this.editor.selectionEnd;
    if (start !== end) {
      const selected = this.editor.value.substring(start, end);
      navigator.clipboard.writeText(selected).catch(() => {});
      this.editor.setRangeText('', start, end, 'end');
      this.activeTab.content = this.editor.value;
      this.checkDirtyState();
      this.updateCursorStats();
    }
  }

  actionCopy() {
    const start = this.editor.selectionStart;
    const end = this.editor.selectionEnd;
    if (start !== end) {
      const selected = this.editor.value.substring(start, end);
      navigator.clipboard.writeText(selected).catch(() => {});
    }
  }

  async actionPaste() {
    try {
      const text = await navigator.clipboard.readText();
      const start = this.editor.selectionStart;
      const end = this.editor.selectionEnd;
      this.editor.setRangeText(text, start, end, 'end');
      this.activeTab.content = this.editor.value;
      this.checkDirtyState();
      this.updateCursorStats();
    } catch (e) {
      document.execCommand('paste');
    }
  }

  actionDelete() {
    const start = this.editor.selectionStart;
    const end = this.editor.selectionEnd;
    if (start !== end) {
      this.editor.setRangeText('', start, end, 'end');
    } else if (start < this.editor.value.length) {
      this.editor.setRangeText('', start, start + 1, 'end');
    }
    this.activeTab.content = this.editor.value;
    this.checkDirtyState();
    this.updateCursorStats();
  }

  searchWithBing() {
    const start = this.editor.selectionStart;
    const end = this.editor.selectionEnd;
    const text = start !== end ? this.editor.value.substring(start, end) : this.editor.value;
    if (text.trim()) {
      window.open(`https://www.bing.com/search?q=${encodeURIComponent(text.trim())}`, '_blank');
    }
  }

  insertTimeDate() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
    const start = this.editor.selectionStart;
    const end = this.editor.selectionEnd;
    this.editor.setRangeText(timeStr, start, end, 'end');
    this.activeTab.content = this.editor.value;
    this.checkDirtyState();
    this.updateCursorStats();
  }

  // ==========================================================================
  // Find & Replace Engine
  // ==========================================================================
  findNext(forward = true) {
    const query = document.getElementById('find-input').value || document.getElementById('replace-find-input').value;
    if (!query) return false;

    const matchCase = document.getElementById('find-match-case').checked || document.getElementById('replace-match-case').checked;
    const wrapAround = document.getElementById('find-wrap-around').checked || document.getElementById('replace-wrap-around').checked;
    const text = this.editor.value;
    const currentPos = forward ? this.editor.selectionEnd : this.editor.selectionStart;

    let idx = -1;
    const searchTarget = matchCase ? text : text.toLowerCase();
    const searchPhrase = matchCase ? query : query.toLowerCase();

    if (forward) {
      idx = searchTarget.indexOf(searchPhrase, currentPos);
      if (idx === -1 && wrapAround) {
        idx = searchTarget.indexOf(searchPhrase, 0);
      }
    } else {
      idx = searchTarget.lastIndexOf(searchPhrase, currentPos - searchPhrase.length - 1);
      if (idx === -1 && wrapAround) {
        idx = searchTarget.lastIndexOf(searchPhrase);
      }
    }

    if (idx !== -1) {
      this.editor.focus();
      this.editor.setSelectionRange(idx, idx + searchPhrase.length);
      this.updateCursorStats();
      return true;
    } else {
      alert(this.t('cannotFind', query));
      return false;
    }
  }

  replaceCurrent() {
    const query = document.getElementById('replace-find-input').value;
    const replacement = document.getElementById('replace-with-input').value;
    if (!query) return;

    const start = this.editor.selectionStart;
    const end = this.editor.selectionEnd;
    const selected = this.editor.value.substring(start, end);
    const matchCase = document.getElementById('replace-match-case').checked;

    const isMatch = matchCase ? selected === query : selected.toLowerCase() === query.toLowerCase();
    if (isMatch) {
      this.editor.setRangeText(replacement, start, end, 'end');
      this.activeTab.content = this.editor.value;
      this.checkDirtyState();
      this.updateCursorStats();
    }
    this.findNext(true);
  }

  replaceAll() {
    const query = document.getElementById('replace-find-input').value;
    const replacement = document.getElementById('replace-with-input').value;
    if (!query) return;

    const matchCase = document.getElementById('replace-match-case').checked;
    const flags = matchCase ? 'g' : 'gi';
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, flags);

    let matchCount = (this.editor.value.match(regex) || []).length;
    if (matchCount > 0) {
      this.editor.value = this.editor.value.replace(regex, replacement);
      this.activeTab.content = this.editor.value;
      this.checkDirtyState();
      this.updateCursorStats();
      alert(this.t('replacedCount', matchCount));
    } else {
      alert(this.t('cannotFind', query));
    }
  }

  goToLine() {
    const input = document.getElementById('goto-line-input');
    const targetLine = parseInt(input.value, 10);
    const lines = this.editor.value.split('\n');

    if (isNaN(targetLine) || targetLine < 1 || targetLine > lines.length) {
      alert(this.t('invalidLine'));
      return;
    }

    let charOffset = 0;
    for (let i = 0; i < targetLine - 1; i++) {
      charOffset += lines[i].length + 1; // +1 for newline
    }

    this.closeDialog('dialog-goto');
    this.editor.focus();
    this.editor.setSelectionRange(charOffset, charOffset);
    this.updateCursorStats();
  }

  // ==========================================================================
  // Formatting & View Controls
  // ==========================================================================
  toggleWordWrap() {
    this.isWordWrap = !this.isWordWrap;
    if (this.isWordWrap) {
      this.editor.classList.add('word-wrap');
      this.editor.classList.remove('no-wrap');
      this.menuWordWrap.classList.add('checked');
    } else {
      this.editor.classList.remove('word-wrap');
      this.editor.classList.add('no-wrap');
      this.menuWordWrap.classList.remove('checked');
    }
  }

  toggleStatusBar() {
    this.isStatusBarVisible = !this.isStatusBarVisible;
    if (this.isStatusBarVisible) {
      this.statusbar.classList.remove('hidden');
      this.menuStatusBar.classList.add('checked');
    } else {
      this.statusbar.classList.add('hidden');
      this.menuStatusBar.classList.remove('checked');
    }
  }

  adjustZoom(delta) {
    this.zoomLevel = Math.max(10, Math.min(500, this.zoomLevel + delta));
    this.applyZoom();
  }

  resetZoom() {
    this.zoomLevel = 100;
    this.applyZoom();
  }

  applyZoom() {
    const scale = this.zoomLevel / 100;
    const baseSize = this.fontConfig.size;
    this.editor.style.fontSize = `${baseSize * scale}px`;
    this.statusZoom.textContent = `${this.zoomLevel}%`;
  }

  // ==========================================================================
  // Font Dialog Management
  // ==========================================================================
  openFontDialog() {
    this.openDialog('dialog-font');
    this.updateFontSample();
  }

  setupFontDialogLists() {
    const bindList = (containerId, inputId, onSelect) => {
      const list = document.getElementById(containerId);
      const input = document.getElementById(inputId);
      list.querySelectorAll('.list-item').forEach(item => {
        item.addEventListener('click', () => {
          list.querySelectorAll('.list-item').forEach(i => i.classList.remove('selected'));
          item.classList.add('selected');
          input.value = item.getAttribute('data-value');
          onSelect(item.getAttribute('data-value'));
          this.updateFontSample();
        });
      });
    };

    bindList('font-family-list', 'font-family-input', val => this.tempFontFamily = val);
    bindList('font-style-list', 'font-style-input', val => this.tempFontStyle = val);
    bindList('font-size-list', 'font-size-input', val => this.tempFontSize = parseInt(val, 10));

    this.tempFontFamily = this.fontConfig.family;
    this.tempFontStyle = this.fontConfig.style;
    this.tempFontSize = this.fontConfig.size;

    document.getElementById('font-ok-btn').addEventListener('click', () => {
      this.fontConfig.family = this.tempFontFamily;
      this.fontConfig.size = this.tempFontSize;
      this.fontConfig.style = this.tempFontStyle.includes('italic') ? 'italic' : 'normal';
      this.fontConfig.weight = this.tempFontStyle.includes('bold') ? 'bold' : 'normal';

      this.editor.style.fontFamily = this.fontConfig.family;
      this.editor.style.fontStyle = this.fontConfig.style;
      this.editor.style.fontWeight = this.fontConfig.weight;
      this.applyZoom();
      this.closeDialog('dialog-font');
    });
  }

  updateFontSample() {
    const fam = this.tempFontFamily || this.fontConfig.family;
    const size = 18; // fixed for preview
    const style = (this.tempFontStyle || '').includes('italic') ? 'italic' : 'normal';
    const weight = (this.tempFontStyle || '').includes('bold') ? 'bold' : 'normal';

    this.fontSamplePreview.style.fontFamily = fam;
    this.fontSamplePreview.style.fontSize = `${size}px`;
    this.fontSamplePreview.style.fontStyle = style;
    this.fontSamplePreview.style.fontWeight = weight;
  }

  // ==========================================================================
  // Tab Management
  // ==========================================================================
  addNewTab(title = 'Sem título', content = '') {
    const id = this.nextTabId++;
    const tab = new DocumentTab(id, title, content);
    this.tabs.push(tab);
    this.renderTabs();
    this.selectTab(id);
  }

  selectTab(id) {
    // Save current editor content to active tab first
    this.activeTab.content = this.editor.value;
    this.activeTab.cursorPos = this.editor.selectionStart;

    this.activeTabId = id;
    this.editor.value = this.activeTab.content;
    this.editor.setSelectionRange(this.activeTab.cursorPos, this.activeTab.cursorPos);
    this.updateUI();
  }

  closeTab(id) {
    if (this.tabs.length === 1) {
      this.actionNewFile();
      return;
    }
    const idx = this.tabs.findIndex(t => t.id === id);
    if (idx !== -1) {
      this.tabs.splice(idx, 1);
      const nextTab = this.tabs[Math.max(0, idx - 1)];
      this.selectTab(nextTab.id);
    }
  }

  renderTabs() {
    this.tabsContainer.innerHTML = '';
    this.tabs.forEach(tab => {
      const tabEl = document.createElement('div');
      tabEl.className = `tab-item ${tab.id === this.activeTabId ? 'active' : ''}`;
      tabEl.setAttribute('data-tab-id', tab.id);

      const titleEl = document.createElement('span');
      titleEl.className = 'tab-title';
      titleEl.textContent = (tab.isDirty ? '* ' : '') + tab.title;

      const closeBtn = document.createElement('button');
      closeBtn.className = 'tab-close-btn';
      closeBtn.innerHTML = '&times;';
      closeBtn.title = 'Fechar guia (Ctrl+W)';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeTab(tab.id);
      });

      tabEl.appendChild(titleEl);
      tabEl.appendChild(closeBtn);
      tabEl.addEventListener('click', () => this.selectTab(tab.id));

      this.tabsContainer.appendChild(tabEl);
    });
    this.tabsContainer.appendChild(this.newTabBtn);
  }

  resetActiveTab() {
    this.activeTab.title = this.t('untitled');
    this.activeTab.content = '';
    this.activeTab.savedContent = '';
    this.activeTab.isDirty = false;
    this.editor.value = '';
    this.updateUI();
  }

  checkDirtyState() {
    const isNowDirty = this.editor.value !== this.activeTab.savedContent;
    if (this.activeTab.isDirty !== isNowDirty) {
      this.activeTab.isDirty = isNowDirty;
      this.updateTitle();
      this.renderTabs();
    }
  }

  promptConfirmSave(onProceed) {
    this.pendingConfirmAction = onProceed;
    const msg = this.t('confirmSave', this.activeTab.title);
    document.getElementById('confirm-save-message').textContent = msg;
    this.openDialog('dialog-confirm-save');
  }

  // ==========================================================================
  // Dialog Management & UI Updates
  // ==========================================================================
  setupDialogButtons() {
    // Close dialog buttons
    document.querySelectorAll('[data-close-dialog]').forEach(btn => {
      btn.addEventListener('click', () => {
        const dialogId = btn.getAttribute('data-close-dialog');
        this.closeDialog(dialogId);
      });
    });

    // Find next buttons
    document.getElementById('find-next-btn').addEventListener('click', () => {
      const dirDown = document.querySelector('input[name="find-dir"]:checked').value === 'down';
      this.findNext(dirDown);
    });

    document.getElementById('replace-find-next-btn').addEventListener('click', () => this.findNext(true));
    document.getElementById('replace-one-btn').addEventListener('click', () => this.replaceCurrent());
    document.getElementById('replace-all-btn').addEventListener('click', () => this.replaceAll());

    // Go to line
    document.getElementById('goto-confirm-btn').addEventListener('click', () => this.goToLine());

    // Confirm save dialog buttons
    document.getElementById('confirm-save-save-btn').addEventListener('click', () => {
      this.closeDialog('dialog-confirm-save');
      this.actionSaveFile();
      if (this.pendingConfirmAction) this.pendingConfirmAction();
    });

    document.getElementById('confirm-save-dont-btn').addEventListener('click', () => {
      this.closeDialog('dialog-confirm-save');
      this.activeTab.isDirty = false;
      if (this.pendingConfirmAction) this.pendingConfirmAction();
    });

    document.getElementById('confirm-save-cancel-btn').addEventListener('click', () => {
      this.closeDialog('dialog-confirm-save');
      this.pendingConfirmAction = null;
    });

    document.getElementById('confirm-save-close-btn').addEventListener('click', () => {
      this.closeDialog('dialog-confirm-save');
      this.pendingConfirmAction = null;
    });

    this.setupFontDialogLists();
  }

  openDialog(dialogId) {
    const dialog = document.getElementById(dialogId);
    if (dialog) {
      dialog.style.display = 'flex';
      const input = dialog.querySelector('input:not([type="checkbox"]):not([type="radio"])');
      if (input) setTimeout(() => input.focus(), 50);
    }
  }

  closeDialog(dialogId) {
    const dialog = document.getElementById(dialogId);
    if (dialog) dialog.style.display = 'none';
  }

  updateCursorStats() {
    const pos = this.editor.selectionStart;
    const val = this.editor.value;
    const lines = val.substring(0, pos).split('\n');
    const currentLine = lines.length;
    const currentCol = lines[lines.length - 1].length + 1;

    this.statusPos.textContent = this.t('lnCol', currentLine, currentCol);
    this.statusChars.textContent = this.t('chars', val.length);
  }

  updateTitle() {
    const prefix = this.activeTab.isDirty ? '* ' : '';
    const titleText = `${prefix}${this.activeTab.title} - ${this.t('appName')}`;
    document.title = titleText;
    this.windowTitle.textContent = titleText;
  }

  updateUI() {
    this.updateTitle();
    this.renderTabs();
    this.updateCursorStats();
    this.applyZoom();
  }

  toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', this.theme);
  }

  toggleLanguage() {
    this.lang = this.lang === 'pt-BR' ? 'en-US' : 'pt-BR';
    document.getElementById('current-lang-label').textContent = this.lang === 'pt-BR' ? 'PT' : 'EN';
    this.updateUI();
  }
}

// Instantiate application on window load
window.addEventListener('DOMContentLoaded', () => {
  window.notepad = new NotepadApp();
});
