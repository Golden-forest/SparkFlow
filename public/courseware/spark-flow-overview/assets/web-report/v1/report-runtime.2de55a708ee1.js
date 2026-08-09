(() => {
  const body = document.body;
  const shell = document.querySelector('[data-report-shell]');
  const reportMainStage = document.querySelector('[data-report-main-stage]');
  const themeToggle = document.querySelector('[data-theme-toggle]');
  const fullscreenToggle = document.querySelector('[data-fullscreen-toggle]');
  const sidebarToggle = document.querySelector('[data-sidebar-toggle]');
  const printToggle = document.querySelector('[data-print-toggle]');
  const imageToggle = document.querySelector('[data-image-toggle]');
  const themeIcon = document.querySelector('[data-theme-icon]');
  const fullscreenIcon = document.querySelector('[data-fullscreen-icon]');
  const sidebarIcon = document.querySelector('[data-sidebar-icon]');
  const navLinksDoc = Array.from(document.querySelectorAll('[data-nav-link-doc]'));
  const navLinksStage = Array.from(document.querySelectorAll('[data-nav-link-stage]'));
  const docSections = Array.from(document.querySelectorAll('[data-doc-section-id]'));
  const panels = Array.from(document.querySelectorAll('[data-panel-id]'));
  const progressBar = document.querySelector('[data-progress-bar]');
  const mediaLightbox = document.querySelector('[data-media-lightbox]');
  const mediaLightboxImage = mediaLightbox?.querySelector('[data-media-lightbox-image]');
  const mediaLightboxClose = mediaLightbox?.querySelector('[data-media-lightbox-close]');
  const themeStorageKey = 'copyclaw:web-report-theme';
  const sidebarStorageKey = 'copyclaw:web-report-sidebar';
  let activePanelId = panels[0]?.id || null;
  let activeDocId = docSections[0]?.id || null;
  let navigationLocked = false;
  let navigationUnlockTimer = 0;
  let syncFrame = 0;
  let lastWheelAt = 0;
  let revealIndex = 0;
  let currentRevealStep = 0;
  let autoRevealTimer = 0;
  let lastEntryAnimationKey = '';

  /* ── Autoplay State ── */
  let autoplayActive = false;
  let autoplayTimer = 0;
  let autoplayDisplayTimer = 0;
  let autoplayStartTime = 0;
  let autoplayTotalMs = 300000;
  let autoplayUserTotalSec = 300;
  const autoplayToggle = document.querySelector('[data-autoplay-toggle]');
  const autoplayIcon = document.querySelector('[data-autoplay-icon]');
  const autoplayMinInput = document.querySelector('[data-autoplay-min]');
  const autoplaySecInput = document.querySelector('[data-autoplay-sec]');
  const autoplayControls = document.querySelector('[data-autoplay-controls]');

  const autoplayGetTotalSec = () => {
    const m = parseInt(autoplayMinInput?.value) || 0;
    const s = parseInt(autoplaySecInput?.value) || 0;
    return m * 60 + s;
  };

  const autoplayGetStepIntervalMs = () => {
    const totalMs = Math.max(10000, autoplayTotalMs);
    const steps = totalRevealSteps();
    return Math.max(80, totalMs / Math.max(1, steps));
  };

  const autoplaySetInputs = (sec) => {
    const rm = String(Math.floor(sec / 60)).padStart(2, '0');
    const rs = String(Math.round(sec % 60)).padStart(2, '0');
    if (autoplayMinInput) { autoplayMinInput.value = rm; }
    if (autoplaySecInput) { autoplaySecInput.value = rs; }
  };

  const autoplayStop = () => {
    autoplayActive = false;
    body.classList.remove('is-autoplay');
    autoplayControls?.classList.remove('is-playing');
    if (autoplayMinInput) { autoplayMinInput.readOnly = false; }
    if (autoplaySecInput) { autoplaySecInput.readOnly = false; }
    autoplaySetInputs(autoplayUserTotalSec);
    window.clearTimeout(autoplayTimer);
    autoplayTimer = 0;
    window.clearInterval(autoplayDisplayTimer);
    autoplayDisplayTimer = 0;
    autoplayUpdateUI();
  };

  const autoplayStart = async () => {
    /* Enter fullscreen if not already */
    if (!isPresentationMode()) {
      const shell = document.querySelector('[data-report-shell]');
      if (shell && shell.requestFullscreen) {
        try { await shell.requestFullscreen(); } catch (_) { return; }
      } else { return; }
    }
    autoplayUserTotalSec = autoplayGetTotalSec();
    autoplayTotalMs = Math.max(10000, autoplayUserTotalSec * 1000);
    autoplayActive = true;
    autoplayStartTime = Date.now();
    body.classList.add('is-autoplay');
    autoplayControls?.classList.add('is-playing');
    if (autoplayMinInput) { autoplayMinInput.readOnly = true; }
    if (autoplaySecInput) { autoplaySecInput.readOnly = true; }
    /* Go to first panel */
    if (panels.length > 0) { goToStagePanel(0); }
    autoplayUpdateUI();
    autoplayDisplayTimer = window.setInterval(() => {
      if (!autoplayActive) return;
      const elapsed = Date.now() - autoplayStartTime;
      const remaining = Math.max(0, (autoplayTotalMs - elapsed) / 1000);
      autoplaySetInputs(remaining);
    }, 250);
    autoplayTimer = window.setTimeout(autoplayTick, autoplayGetStepIntervalMs());
  };

  const autoplayTick = () => {
    if (!autoplayActive) return;
    const idx = getActiveStagePanelIndex();
    const activePanel = panels[idx];
    /* If on last panel and last step, stop */
    if (idx >= panels.length - 1) {
      const items = getRevealItems(activePanel);
      if (revealIndex >= items.length) { autoplayStop(); return; }
    }
    /* Reuse the same "next step" logic as manual navigation */
    stepStagePanel(1);
    /* Check if we've reached the end after stepping */
    const newIdx = getActiveStagePanelIndex();
    if (newIdx >= panels.length - 1) {
      const newPanel = panels[newIdx];
      const items = getRevealItems(newPanel);
      if (revealIndex >= items.length) { autoplayStop(); return; }
    }
    autoplayTimer = window.setTimeout(autoplayTick, autoplayGetStepIntervalMs());
  };

  const autoplayTogglePlay = () => {
    if (!autoplayActive) { autoplayStart(); }
    else { autoplayStop(); }
  };

  const autoplayUpdateUI = () => {
    if (!autoplayIcon || !autoplayToggle) return;
    const playing = autoplayActive;
    autoplayIcon.innerHTML = playing ? iconSet.pause : iconSet.play;
    autoplayToggle.setAttribute('aria-label', playing ? '停止' : '自动播放');
    autoplayToggle.setAttribute('title', playing ? '停止' : '自动播放');
    autoplayControls?.classList.toggle('is-playing', playing);
  };

  const iconSet = {
    sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="iconoir"><path d="M12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M22 12L23 12" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M12 2V1" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M12 23V22" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M20 20L19 19" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M20 4L19 5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M4 20L5 19" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M4 4L5 5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M1 12L2 12" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="iconoir"><path d="M3 11.5066C3 16.7497 7.25034 21 12.4934 21C16.2209 21 19.4466 18.8518 21 15.7259C12.4934 15.7259 8.27411 11.5066 8.27411 3C5.14821 4.55344 3 7.77915 3 11.5066Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    fullscreen: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="iconoir"><path d="M9 9L4 4M4 4V8M4 4H8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M15 9L20 4M20 4V8M20 4H16" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M9 15L4 20M4 20V16M4 20H8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M15 15L20 20M20 20V16M20 20H16" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    minimize: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="iconoir"><path d="M18 12L6 12" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M12 22V16M12 16L15 19M12 16L9 19" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M12 2V8M12 8L15 5M12 8L9 5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    panelOpen: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="iconoir"><path d="M19 21L5 21C3.89543 21 3 20.1046 3 19L3 5C3 3.89543 3.89543 3 5 3L19 3C20.1046 3 21 3.89543 21 5L21 19C21 20.1046 20.1046 21 19 21Z" stroke="currentColor"  stroke-linecap="round" stroke-linejoin="round"/>
<path d="M9.5 21V3" stroke="currentColor"  stroke-linecap="round" stroke-linejoin="round"/>
<path d="M5.5 10L7.25 12L5.5 14" stroke="currentColor"  stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    panelClosed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="iconoir"><path d="M19 21L5 21C3.89543 21 3 20.1046 3 19L3 5C3 3.89543 3.89543 3 5 3L19 3C20.1046 3 21 3.89543 21 5L21 19C21 20.1046 20.1046 21 19 21Z" stroke="currentColor"  stroke-linecap="round" stroke-linejoin="round"/>
<path d="M7.25 10L5.5 12L7.25 14" stroke="currentColor"  stroke-linecap="round" stroke-linejoin="round"/>
<path d="M9.5 21V3" stroke="currentColor"  stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    play: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="iconoir"><path d="M6.95839 4.34202C6.73947 4.22054 6.47001 4.37707 6.47001 4.62706V19.3729C6.47001 19.6229 6.73947 19.7795 6.95839 19.658L19.4103 12.7851C19.6453 12.6555 19.6453 12.3445 19.4103 12.2149L6.95839 4.34202Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    pause: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="iconoir"><path d="M15.9966 5.5H17.5C17.7761 5.5 18 5.72386 18 6V18C18 18.2761 17.7761 18.5 17.5 18.5H15.9966C15.7205 18.5 15.4966 18.2761 15.4966 18V6C15.4966 5.72386 15.7205 5.5 15.9966 5.5Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M8.00336 5.5H6.5C6.22386 5.5 6 5.72386 6 6V18C6 18.2761 6.22386 18.5 6.5 18.5H8.00336C8.2795 18.5 8.50336 18.2761 8.50336 18V6C8.50336 5.72386 8.2795 5.5 8.00336 5.5Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  };

  const applyTheme = (theme) => {
    body.setAttribute('data-theme', theme);
    if (themeToggle && themeIcon) {
      const targetTheme = theme === 'dark' ? 'light' : 'dark';
      themeIcon.innerHTML = targetTheme === 'light' ? iconSet.sun : iconSet.moon;
      themeToggle.setAttribute('aria-label', targetTheme === 'light' ? '切换到白色主题' : '切换到黑色主题');
      themeToggle.setAttribute('title', targetTheme === 'light' ? '切换到白色主题' : '切换到黑色主题');
    }
  };

  const applySidebarState = (collapsed) => {
    body.classList.toggle('sidebar-collapsed', collapsed);
    if (sidebarToggle && sidebarIcon) {
      sidebarIcon.innerHTML = collapsed ? iconSet.panelClosed : iconSet.panelOpen;
      sidebarToggle.setAttribute('aria-label', collapsed ? '展开侧边栏' : '折叠侧边栏');
      sidebarToggle.setAttribute('title', collapsed ? '展开侧边栏' : '折叠侧边栏');
    }
  };

  const updateFullscreenIcon = () => {
    if (!fullscreenToggle || !fullscreenIcon) return;
    const active = Boolean(document.fullscreenElement);
    fullscreenIcon.innerHTML = active ? iconSet.minimize : iconSet.fullscreen;
    fullscreenToggle.setAttribute('aria-label', active ? '退出全屏' : '进入全屏');
    fullscreenToggle.setAttribute('title', active ? '退出全屏' : '进入全屏');
  };

  const isPresentationMode = () => body.classList.contains('is-fullscreen');

  const syncFullscreenState = () => {
    const active = Boolean(document.fullscreenElement);
    body.classList.toggle('is-fullscreen', active);
    if (active) {
      revealIndex = 0;
      currentRevealStep = 0;
    } else {
      if (autoRevealTimer) {
        window.clearTimeout(autoRevealTimer);
        autoRevealTimer = 0;
      }
      if (autoplayActive) { autoplayStop(); }
    }
    updateFullscreenIcon();
  };

  const storedTheme = window.localStorage.getItem(themeStorageKey);
  const storedSidebar = window.localStorage.getItem(sidebarStorageKey);
  applyTheme(storedTheme || body.dataset.theme || 'dark');
  applySidebarState(storedSidebar !== 'open');
  syncFullscreenState();

  themeToggle?.addEventListener('click', () => {
    const next = body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    window.localStorage.setItem(themeStorageKey, next);
  });

  sidebarToggle?.addEventListener('click', () => {
    const collapsed = !body.classList.contains('sidebar-collapsed');
    applySidebarState(collapsed);
    window.localStorage.setItem(sidebarStorageKey, collapsed ? 'collapsed' : 'open');
  });

  fullscreenToggle?.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await (shell || document.documentElement).requestFullscreen();
      }
      updateFullscreenIcon();
    } catch (error) {
      console.warn('Failed to toggle fullscreen', error);
    }
  });

  const _getDocElement = () => document.querySelector('[data-report-main-doc]');
  const _exportingTitle = () => {
    const t = document.querySelector('.topbar-title');
    return t ? t.textContent.trim() : 'report';
  };

  printToggle?.addEventListener('click', () => {
    window.print();
  });

  const _exportImage = (el) => {
    if (typeof html2canvas === 'undefined') {
      console.warn('html2canvas not loaded');
      return;
    }
    imageToggle.style.opacity = '0.5';
    imageToggle.style.pointerEvents = 'none';
    const _showToast = (msg) => {
      const t = document.createElement('div');
      t.textContent = msg;
      Object.assign(t.style, {position:'fixed',bottom:'2rem',left:'50%',transform:'translateX(-50%)',
        background:'rgba(0,0,0,0.8)',color:'#fff',padding:'0.6rem 1.2rem',borderRadius:'0.5rem',
        fontSize:'0.85rem',zIndex:'99999',whiteSpace:'nowrap',opacity:'0',transition:'opacity 0.3s'});
      document.body.appendChild(t);
      requestAnimationFrame(() => t.style.opacity = '1');
      setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3000);
    };
    html2canvas(el, {
      scale: 2, useCORS: true, scrollY: 0, windowWidth: el.scrollWidth,
      onclone: (doc) => {
        doc.body.classList.remove('is-fullscreen', 'sidebar-collapsed');
        doc.body.setAttribute('data-theme', 'dark');
        window._exportNote = '';
      }
    }).then(canvas => {
      return new Promise((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/png');
      });
    }).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = _exportingTitle() + '.png'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      _showToast(window._exportNote || '长图导出成功');
    }).catch(err => {
      console.warn('Image export failed:', err);
      _showToast('导出失败: ' + (err.message || '未知错误'));
    }).finally(() => {
      imageToggle.style.opacity = '';
      imageToggle.style.pointerEvents = '';
    });
  };

  imageToggle?.addEventListener('click', () => {
    const el = _getDocElement();
    if (!el) return;
    _exportImage(el);
  });

  const getHashId = () => {
    const raw = window.location.hash.replace(/^#/, '');
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  };

  const docToStageId = (docId) => {
    if (!docId) return panels[0]?.id || null;
    if (docId === 'doc-cover') return 'cover';
    if (docId.startsWith('doc-agenda')) return docId.replace(/^doc-/, '');
    const sourceId = docId.replace(/^doc-/, '');
    const firstPage = panels.find((panel) => panel.dataset.sectionId === sourceId);
    return firstPage?.id || sourceId || panels[0]?.id || null;
  };

  const stageToDocId = (stageId) => {
    if (!stageId) return docSections[0]?.id || null;
    if (stageId === 'cover') return 'doc-cover';
    if (stageId.startsWith('agenda')) return `doc-${stageId}`;
    const panel = document.getElementById(stageId);
    const sourceId = panel?.dataset.sectionId || stageId.replace(/--p\d+$/, '');
    const section = docSections.find(
      (item) => item.dataset.docSourceId === sourceId || item.id === `doc-${sourceId}`
    );
    return section?.id || docSections[0]?.id || null;
  };

  document.addEventListener('fullscreenchange', () => {
    syncFullscreenState();
    window.setTimeout(() => {
      if (autoplayActive) return;
      if (isPresentationMode()) {
        const targetStageId = docToStageId(activeDocId || getHashId() || 'doc-cover');
        goToStageById(targetStageId, 'auto');
        if (targetStageId && window.history && window.history.replaceState) {
          window.history.replaceState(null, '', `#${targetStageId}`);
        }
        requestAnimationFrame(rescaleActiveSlide);
      } else {
        const targetDocId = stageToDocId(activePanelId || getHashId() || 'cover');
        goToDocById(targetDocId, 'auto');
        if (targetDocId && window.history && window.history.replaceState) {
          window.history.replaceState(null, '', `#${targetDocId}`);
        }
        // Clear stale inline scaling variables when leaving fullscreen
        document.querySelectorAll('.panel-inner').forEach((el) => {
          el.style.removeProperty('--slide-scale');
          el.style.removeProperty('--content-scale');
        });
      }
    }, 48);
  });

  const activateStagePanel = (id) => {
    if (!id) return;
    const samePanel = activePanelId === id;
    activePanelId = id;
    const activePanel = document.getElementById(id);
    const sourceId = activePanel?.dataset.sectionId || '';
    panels.forEach((panel) => {
      panel.classList.toggle('is-active', panel.id === id);
    });
    navLinksStage.forEach((link) => {
      const href = link.getAttribute('href') || '';
      const active = href === `#${id}` || (sourceId && href === `#${sourceId}`);
      link.classList.toggle('active', active);
    });
    if (!samePanel) clearAutoReveal();
    syncRevealState(activePanel, samePanel ? revealIndex : 0);
    runPanelEntryAnimations(activePanel);
    if (!samePanel || !autoRevealTimer) scheduleAutoReveal(activePanel);
  };

  const activateDocSection = (id) => {
    if (!id) return;
    activeDocId = id;
    navLinksDoc.forEach((link) => {
      const active = link.getAttribute('href') === `#${id}`;
      link.classList.toggle('active', active);
    });
  };

  const getStagePanelIndex = (id) => panels.findIndex((panel) => panel.id === id);
  const getDocSectionIndex = (id) => docSections.findIndex((section) => section.id === id);

  const getActiveStagePanelIndex = () => {
    const index = getStagePanelIndex(activePanelId || '');
    return index >= 0 ? index : 0;
  };

  const getRevealMode = (panel) => panel?.dataset.revealMode || 'none';
  const isRevealEnabled = (panel) => ['step', 'auto'].includes(getRevealMode(panel));

  const getRevealItems = (panel) => {
    if (!panel) return [];
    return Array.from(panel.querySelectorAll('[data-reveal-item]'));
  };

  const timeToMs = (value, fallback) => {
    const raw = String(value || '').trim();
    if (!raw) return fallback;
    const numeric = Number.parseFloat(raw);
    if (!Number.isFinite(numeric)) return fallback;
    return raw.endsWith('ms') ? numeric : numeric * 1000;
  };

  const clearAutoReveal = () => {
    window.clearTimeout(autoRevealTimer);
    autoRevealTimer = 0;
  };

  const totalRevealSteps = () => panels.reduce(
    (total, panel) => total + 1 + (isRevealEnabled(panel) ? getRevealItems(panel).length : 0),
    0
  );

  const updateStageProgress = (panel) => {
    if (!progressBar || panels.length <= 0) return;
    const activeIndex = Math.max(0, getActiveStagePanelIndex());
    const completedBefore = panels
      .slice(0, activeIndex)
      .reduce((total, item) => total + 1 + (isRevealEnabled(item) ? getRevealItems(item).length : 0), 0);
    const currentPanel = panel || panels[activeIndex];
    const currentRevealCount = isPresentationMode() && isRevealEnabled(currentPanel)
      ? revealIndex
      : 0;
    const currentStep = completedBefore + 1 + currentRevealCount;
    const totalSteps = Math.max(1, totalRevealSteps());
    progressBar.style.width = `${Math.min(100, (currentStep / totalSteps) * 100)}%`;
  };

  const syncRevealState = (panel, nextIndex = revealIndex) => {
    const items = getRevealItems(panel);
    const revealActive = isPresentationMode() && isRevealEnabled(panel);
    const revealCount = revealActive
      ? Math.max(0, Math.min(nextIndex, items.length))
      : items.length;
    revealIndex = revealCount;
    currentRevealStep = revealCount;
    panel?.style.setProperty('--reveal-step', String(revealCount));
    items.forEach((item, index) => {
      const revealed = index < revealCount;
      item.classList.toggle('is-revealed', revealed);
      if (revealActive && !revealed) {
        item.setAttribute('aria-hidden', 'true');
      } else {
        item.removeAttribute('aria-hidden');
      }
    });
    updateStageProgress(panel);
  };

  const advanceReveal = (panel) => {
    if (!isPresentationMode() || getRevealMode(panel) !== 'step') return false;
    const items = getRevealItems(panel);
    if (!items.length || revealIndex >= items.length) return false;
    syncRevealState(panel, revealIndex + 1);
    requestAnimationFrame(rescaleActiveSlide);
    return true;
  };

  const reverseReveal = (panel) => {
    if (!isPresentationMode() || getRevealMode(panel) !== 'step') return false;
    const items = getRevealItems(panel);
    if (!items.length || revealIndex <= 0) return false;
    syncRevealState(panel, revealIndex - 1);
    requestAnimationFrame(rescaleActiveSlide);
    return true;
  };

  const scheduleAutoReveal = (panel) => {
    if (!isPresentationMode() || getRevealMode(panel) !== 'auto') return;
    const items = getRevealItems(panel);
    if (!items.length) return;
    const interval = timeToMs(panel.dataset.revealInterval, 420);
    const tick = () => {
      if (!panel.classList.contains('is-active') || getRevealMode(panel) !== 'auto') return;
      if (revealIndex >= items.length) return;
      syncRevealState(panel, revealIndex + 1);
      requestAnimationFrame(rescaleActiveSlide);
      autoRevealTimer = window.setTimeout(tick, interval);
    };
    autoRevealTimer = window.setTimeout(tick, 120);
  };

  const scheduleSync = () => {
    window.cancelAnimationFrame(syncFrame);
    syncFrame = window.requestAnimationFrame(() => {
      if (isPresentationMode()) {
        activateStagePanel(activePanelId || panels[0]?.id || null);
        return;
      }
      if (!docSections.length || navigationLocked) return;
      const viewportTop = 0;
      const viewportHeight = window.innerHeight;
      const viewportCenter = viewportTop + viewportHeight / 2;
      let bestSection = docSections[0];
      let bestDistance = Number.POSITIVE_INFINITY;

      docSections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        const sectionCenter = rect.top + Math.min(rect.height, viewportHeight) / 2;
        const distance = Math.abs(sectionCenter - viewportCenter);
        if (distance < bestDistance) {
          bestSection = section;
          bestDistance = distance;
        }
      });

      if (bestSection) activateDocSection(bestSection.id);
    });
  };

  const unlockNavigationLater = (delay = 520) => {
    window.clearTimeout(navigationUnlockTimer);
    navigationUnlockTimer = window.setTimeout(() => {
      navigationLocked = false;
      scheduleSync();
    }, delay);
  };

  const goToStagePanel = (index, behavior = 'smooth') => {
    if (index < 0 || index >= panels.length) return;
    const panel = panels[index];
    if (!panel) return;
    activateStagePanel(panel.id);
    if (isPresentationMode()) {
      reportMainStage?.scrollTo({ top: 0, behavior: 'auto' });
      navigationLocked = false;
      return;
    }

    navigationLocked = behavior === 'smooth';
    const top = Math.max(0, window.scrollY + panel.getBoundingClientRect().top - 96);
    window.scrollTo({ top, behavior });
    unlockNavigationLater(behavior === 'smooth' ? 520 : 90);
  };

  const goToStageById = (id, behavior = 'smooth') => {
    const index = getStagePanelIndex(id);
    if (index >= 0) {
      goToStagePanel(index, behavior);
    }
  };

  const goToDocById = (id, behavior = 'smooth') => {
    const index = getDocSectionIndex(id);
    if (index < 0) return;
    const section = docSections[index];
    if (!section) return;
    activateDocSection(section.id);
    navigationLocked = behavior === 'smooth';
    const top = Math.max(0, window.scrollY + section.getBoundingClientRect().top - 96);
    window.scrollTo({ top, behavior });
    unlockNavigationLater(behavior === 'smooth' ? 520 : 90);
  };

  const stepStagePanel = (direction) => {
    if (!direction) return;
    const activePanel = panels[getActiveStagePanelIndex()];
    if (direction > 0 && advanceRevealOrPanel(activePanel)) return;
    if (direction < 0 && reverseRevealOrPanel(activePanel)) return;
    const nextIndex = getActiveStagePanelIndex() + direction;
    if (nextIndex < 0 || nextIndex >= panels.length) return;
    goToStagePanel(nextIndex);
  };

  const advanceRevealOrPanel = (panel) => advanceReveal(panel);
  const reverseRevealOrPanel = (panel) => reverseReveal(panel);

  const isInteractiveTarget = (target) => {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest(
        'a, button, input, textarea, select, option, label, summary, details, video, audio, [contenteditable="true"]'
      )
    );
  };

  const isChromeTarget = (target) => {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest('.report-nav, .topbar'));
  };

  navLinksDoc.forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href') || '';
      if (!href.startsWith('#')) return;
      const id = href.slice(1);
      event.preventDefault();
      goToDocById(id);
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', `#${id}`);
      } else {
        window.location.hash = id;
      }
    });
  });

  navLinksStage.forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href') || '';
      if (!href.startsWith('#')) return;
      const id = href.slice(1);
      event.preventDefault();
      goToStageById(id);
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', `#${id}`);
      } else {
        window.location.hash = id;
      }
    });
  });

  shell?.addEventListener('wheel', (event) => {
    if (!isPresentationMode() || isChromeTarget(event.target) || Math.abs(event.deltaY) < 2) return;
    const now = Date.now();
    if (now - lastWheelAt < 300) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    lastWheelAt = now;
    stepStagePanel(event.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  shell?.addEventListener('click', (event) => {
    if (mediaLightbox && !mediaLightbox.hidden) return;
    if (!isPresentationMode() || isInteractiveTarget(event.target) || isChromeTarget(event.target)) return;
    if (!(event.target instanceof Element) || !event.target.closest('.report-main-stage')) return;
    const selection = window.getSelection ? String(window.getSelection()).trim() : '';
    if (selection) return;
    const bounds = reportMainStage?.getBoundingClientRect();
    if (!bounds) return;
    const direction = event.clientX < bounds.left + bounds.width * 0.28 ? -1 : 1;
    stepStagePanel(direction);
  });

  const openMediaLightbox = (src, alt) => {
    if (!mediaLightbox || !(mediaLightboxImage instanceof HTMLImageElement) || !src) return;
    mediaLightboxImage.src = src;
    mediaLightboxImage.alt = alt || '';
    mediaLightbox.hidden = false;
    body.classList.add('media-lightbox-open');
  };

  const closeMediaLightbox = () => {
    if (!mediaLightbox || !(mediaLightboxImage instanceof HTMLImageElement)) return;
    mediaLightbox.hidden = true;
    mediaLightboxImage.removeAttribute('src');
    body.classList.remove('media-lightbox-open');
  };

  document.querySelectorAll('[data-lightbox-src]').forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      const src = trigger.getAttribute('data-lightbox-src') || '';
      if (!src) return;
      event.preventDefault();
      event.stopPropagation();
      openMediaLightbox(src, trigger.getAttribute('data-lightbox-alt') || '');
    });
  });

  mediaLightboxClose?.addEventListener('click', (event) => {
    event.preventDefault();
    closeMediaLightbox();
  });

  mediaLightbox?.addEventListener('click', (event) => {
    if (event.target === mediaLightbox) closeMediaLightbox();
  });

  window.addEventListener('scroll', scheduleSync, { passive: true });
  window.addEventListener('resize', scheduleSync);
  window.addEventListener('hashchange', () => {
    const id = getHashId();
    if (!id) return;
    if (isPresentationMode()) {
      goToStageById(id, 'auto');
    } else {
      const targetDocId = (!id.startsWith('doc-') && document.getElementById(id))
        ? stageToDocId(id)
        : id;
      goToDocById(targetDocId, 'auto');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLElement) {
      const tag = event.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
    }

    if (event.key === 'Escape' && mediaLightbox && !mediaLightbox.hidden) {
      event.preventDefault();
      closeMediaLightbox();
      return;
    }

    if (event.key.toLowerCase() === 't') {
      event.preventDefault();
      themeToggle?.click();
      return;
    }

    if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      fullscreenToggle?.click();
      return;
    }

    if (event.key.toLowerCase() === 'b') {
      event.preventDefault();
      sidebarToggle?.click();
      return;
    }
    if (event.key.toLowerCase() === 'p' && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      printToggle?.click();
      return;
    }
    if (event.key.toLowerCase() === 'i' && !event.metaKey && !event.ctrlKey && !isPresentationMode()) {
      event.preventDefault();
      imageToggle?.click();
      return;
    }

    if (!isPresentationMode()) return;

    if (['ArrowDown', 'PageDown', ' '].includes(event.key)) {
      event.preventDefault();
      stepStagePanel(1);
      return;
    }

    if (['ArrowUp', 'PageUp'].includes(event.key)) {
      event.preventDefault();
      stepStagePanel(-1);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      goToStagePanel(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      goToStagePanel(panels.length - 1);
    }
  });

  /* ── Autoplay Events ── */
  autoplayToggle?.addEventListener('click', (event) => {
    event.stopPropagation();
    autoplayTogglePlay();
  });

  const clampInput = (el, min, max) => {
    el?.addEventListener('change', () => {
      let v = parseInt(el.value) || 0;
      el.value = String(Math.max(min, Math.min(max, v))).padStart(2, '0');
    });
  };
  clampInput(autoplayMinInput, 0, 99);
  clampInput(autoplaySecInput, 0, 59);

  if (panels.length > 0) {
    activateStagePanel(panels[0].id);
  }

  if (docSections.length > 0) {
    activateDocSection(docSections[0].id);
  }

  if (getHashId()) {
    if (isPresentationMode()) {
      goToStageById(getHashId(), 'auto');
    } else {
      const hashId = getHashId();
      const targetDocId = (!hashId.startsWith('doc-') && document.getElementById(hashId))
        ? stageToDocId(hashId)
        : hashId;
      goToDocById(targetDocId, 'auto');
    }
  } else {
    scheduleSync();
  }

  function classifyMediaOrientation(img) {
    if (!(img instanceof HTMLImageElement) || !img.naturalWidth || !img.naturalHeight) return;
    const frame = img.closest('.block-media');
    if (!frame) return;
    frame.classList.remove('media-orientation-landscape', 'media-orientation-portrait', 'media-orientation-square');
    const ratio = img.naturalWidth / img.naturalHeight;
    const orientation = ratio < 0.86 ? 'portrait' : ratio > 1.16 ? 'landscape' : 'square';
    frame.classList.add(`media-orientation-${orientation}`);
    updateGalleryOrientation(frame.closest('.gallery-grid'));
  }

  function updateGalleryOrientation(grid) {
    if (!grid) return;
    const items = Array.from(grid.querySelectorAll('.gallery-item'));
    const portraitCount = items.filter((item) => item.classList.contains('media-orientation-portrait')).length;
    const landscapeCount = items.filter((item) => item.classList.contains('media-orientation-landscape')).length;
    const squareCount = items.filter((item) => item.classList.contains('media-orientation-square')).length;
    grid.classList.toggle('gallery-has-portrait', portraitCount > 0);
    grid.classList.toggle('gallery-has-landscape', landscapeCount > 0);
    grid.classList.toggle('gallery-has-square', squareCount > 0);
    Array.from(grid.classList)
      .filter((name) => /^gallery-(portrait|landscape|square)-count-/.test(name))
      .forEach((name) => grid.classList.remove(name));
    grid.classList.add(`gallery-portrait-count-${portraitCount}`);
    grid.classList.add(`gallery-landscape-count-${landscapeCount}`);
    grid.classList.add(`gallery-square-count-${squareCount}`);
  }

  document.querySelectorAll('.gallery-item img').forEach((img) => {
    if (img.complete) classifyMediaOrientation(img);
    img.addEventListener('load', () => classifyMediaOrientation(img), { once: true });
  });

  document.querySelectorAll('.panel img').forEach((img) => {
    img.addEventListener('load', () => {
      if (img.closest('.panel.is-active')) requestAnimationFrame(rescaleActiveSlide);
    });
  });

  // Counter animation
  function animateCounter(el) {
    const target = parseInt(el.dataset.to, 10);
    if (isNaN(target)) return;
    const duration = 1200;
    const start = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3);
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      el.textContent = Math.round(target * ease(p));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // Stagger animation re-trigger on panel switch
  function retriggerStagger(panel) {
    panel.querySelectorAll('.anim-stagger-list').forEach(list => {
      list.classList.remove('anim-stagger-list');
      void list.offsetWidth; // force reflow
      list.classList.add('anim-stagger-list');
    });
  }

  function runPanelEntryAnimations(panel) {
    if (!panel) return;
    const animationKey = `${panel.id}:${isPresentationMode() ? 'stage' : 'doc'}`;
    if (animationKey === lastEntryAnimationKey) return;
    lastEntryAnimationKey = animationKey;
    panel.querySelectorAll('.counter').forEach((counter) => {
      counter.textContent = '0';
      animateCounter(counter);
    });
    retriggerStagger(panel);
  }

  // Observe panel activation for counter + stagger + scale
  const observer = new MutationObserver(mutations => {
    mutations.forEach(m => {
      if (m.type !== 'attributes' || m.attributeName !== 'class') return;
      const panel = m.target;
      if (panel.classList.contains('is-active')) {
        requestAnimationFrame(rescaleActiveSlide);
      }
    });
  });
  panels.forEach(panel => observer.observe(panel, { attributes: true }));

  // Slide scaling for fullscreen mode (adapted from html-ppt-skill runtime.js)
  function rescaleActiveSlide() {
    var stage = document.querySelector('[data-report-main-stage]');
    var activePanel = stage ? stage.querySelector('.panel.is-active') : null;
    if (!activePanel || !document.body.classList.contains('is-fullscreen')) return;
    var pi = activePanel.querySelector('.panel-inner');
    if (!pi) return;
    // Use stage container's actual rendered size for accurate scaling
    // The stage already accounts for topbar height via grid layout
    var sw = stage.clientWidth, sh = stage.clientHeight;
    if (!sw || sh <= 0) { requestAnimationFrame(rescaleActiveSlide); return; }
    var dw = 1280, dh = 720;
    // Leave a small margin to avoid sub-pixel overflow
    var s = Math.min(sw / dw, (sh - 4) / dh, 2);
    pi.style.setProperty('--slide-scale', s);

    // Content auto-fit: if section-shell content overflows the design canvas,
    // compute a scale-down factor so everything fits within 720px height.
    var shell = pi.querySelector('.section-shell');
    if (shell) {
      pi.style.setProperty('--content-scale', '1');
      var contentH = shell.scrollHeight;
      if (contentH > dh) {
        var cs = Math.max(0.62, dh / contentH);
        pi.style.setProperty('--content-scale', cs.toFixed(4));
      }
    }
  }

  window.addEventListener('resize', rescaleActiveSlide);
})();
