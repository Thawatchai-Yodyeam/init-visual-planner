/* Visual Planner runtime: tabs, feedback loopback, checklists, priority boards.
   Everything is driven by data-vp-* attributes, so filling a template never
   requires touching this script. */
(function () {
  'use strict';
  var doc = document;
  var cfg = doc.body.dataset;

  // ---------- helpers ----------
  function text(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function stripBrackets(s) { return s.replace(/^\[(.*)\]$/, '$1'); }
  function documentTitle() { return text(doc.querySelector('[data-vp-title]')) || doc.title; }
  function fileName() {
    var last = location.pathname.split('/').pop();
    try { return decodeURIComponent(last) || null; } catch (e) { return last || null; }
  }
  var store = {
    key: function (k) { return 'vp:' + location.pathname + ':' + k; },
    get: function (k) { try { return sessionStorage.getItem(this.key(k)); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(this.key(k), v); } catch (e) { /* storage blocked */ } }
  };

  // ---------- tabs ----------
  // Every <section data-vp-tab="id" data-vp-label="🗺️ Label"> becomes a sidebar entry.
  // The active tab is kept in the URL hash and scroll position survives live reloads.
  var app = doc.querySelector('.vp-app');
  var canvas = doc.querySelector('[data-vp-canvas]');
  var nav = doc.querySelector('[data-vp-nav]');
  var activeLabel = doc.querySelector('[data-vp-active-label]');
  var panels = Array.prototype.slice.call(doc.querySelectorAll('[data-vp-tab]'));
  var navButtons = {};
  var currentTab = null;

  if (app && panels.length <= 1) app.setAttribute('data-vp-single', '');

  panels.forEach(function (panel) {
    var id = panel.getAttribute('data-vp-tab');
    if (!nav) return;
    var btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'vp-nav-btn';
    btn.textContent = panel.getAttribute('data-vp-label') || id;
    btn.addEventListener('click', function () { activate(id, true); });
    nav.appendChild(btn);
    navButtons[id] = btn;
  });

  function saveScroll() {
    if (currentTab && canvas) store.set('scroll:' + currentTab, String(canvas.scrollTop));
  }

  function activate(id, updateHash) {
    var exists = panels.some(function (p) { return p.getAttribute('data-vp-tab') === id; });
    if (!exists) id = panels.length ? panels[0].getAttribute('data-vp-tab') : null;
    if (!id) return;
    saveScroll();
    panels.forEach(function (p) { p.hidden = p.getAttribute('data-vp-tab') !== id; });
    Object.keys(navButtons).forEach(function (key) {
      if (key === id) navButtons[key].setAttribute('aria-current', 'page');
      else navButtons[key].removeAttribute('aria-current');
    });
    if (activeLabel) activeLabel.textContent = (navButtons[id] && navButtons[id].textContent) || id;
    currentTab = id;
    store.set('tab', id);
    if (canvas) canvas.scrollTop = Number(store.get('scroll:' + id)) || 0;
    if (updateHash && location.hash.slice(1) !== id) {
      try { history.replaceState(null, '', '#' + id); } catch (e) { location.hash = id; }
    }
  }

  function hashTab() {
    try { return decodeURIComponent(location.hash.slice(1)); } catch (e) { return ''; }
  }
  window.addEventListener('hashchange', function () { activate(hashTab(), false); });
  window.addEventListener('pagehide', saveScroll);
  activate(hashTab() || store.get('tab'), false);

  // ---------- toast ----------
  var toastEl = null;
  var toastTimer = null;
  function toast(message) {
    if (!toastEl) {
      toastEl = doc.createElement('div');
      toastEl.className = 'vp-toast';
      toastEl.setAttribute('role', 'status');
      doc.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.setAttribute('data-show', '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.removeAttribute('data-show'); }, 2600);
  }

  // ---------- dialog ----------
  // Resolves to the textarea value when confirmed, or null when cancelled.
  function dialog(opts) {
    return new Promise(function (resolve) {
      var dlg = doc.createElement('dialog');
      dlg.className = 'vp-modal';
      dlg.innerHTML =
        '<form method="dialog">' +
        '<h2></h2><p></p><textarea></textarea>' +
        '<div class="vp-modal-actions"><span class="vp-modal-hint"></span>' +
        '<button type="button" class="vp-btn vp-btn-ghost" data-cancel>Cancel</button>' +
        '<button type="submit" class="vp-btn vp-btn-primary" value="ok"></button>' +
        '</div></form>';
      var form = dlg.querySelector('form');
      var ta = dlg.querySelector('textarea');
      var confirmBtn = dlg.querySelector('button[value="ok"]');
      dlg.querySelector('h2').textContent = opts.title || '';
      dlg.querySelector('p').textContent = opts.description || '';
      dlg.querySelector('.vp-modal-hint').textContent = opts.readOnly ? '' : 'Ctrl/⌘ + Enter to confirm';
      confirmBtn.textContent = opts.confirmLabel || 'Copy';
      ta.value = opts.value || '';
      ta.placeholder = opts.placeholder || '';
      ta.readOnly = !!opts.readOnly;
      ta.required = !!opts.required;
      if (opts.readOnly) dlg.querySelector('[data-cancel]').remove();

      dlg.querySelector('[data-cancel]') && dlg.querySelector('[data-cancel]').addEventListener('click', function () { dlg.close(''); });
      ta.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(confirmBtn); }
      });
      dlg.addEventListener('close', function () {
        var value = dlg.returnValue === 'ok' ? ta.value : null;
        dlg.remove();
        resolve(value);
      });
      doc.body.appendChild(dlg);
      dlg.showModal();
      ta.focus();
      if (opts.readOnly) ta.select();
    });
  }

  // ---------- clipboard ----------
  function legacyCopy(value) {
    var ta = doc.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    doc.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = doc.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  function writeClipboard(value) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(value).then(
        function () { return true; },
        function () { return legacyCopy(value); }
      );
    }
    return Promise.resolve(legacyCopy(value));
  }

  // Adds document context, copies the JSON and tells the user what happened.
  // If the browser blocks clipboard access, the JSON is shown for manual copy.
  function sendPayload(payload, successMessage) {
    var body = { status: payload.status };
    if (payload.action) body.action = payload.action;
    body.document = documentTitle();
    body.file = fileName();
    Object.keys(payload).forEach(function (k) {
      if (k !== 'status' && k !== 'action' && payload[k] !== undefined && payload[k] !== '') body[k] = payload[k];
    });
    var json = JSON.stringify(body, null, 2);
    return writeClipboard(json).then(function (ok) {
      if (ok) { toast(successMessage || '📋 Copied! Paste it back into the AI chat.'); return; }
      return dialog({
        title: 'Copy this feedback',
        description: 'This browser blocked clipboard access (common on plain http:// LAN addresses). Press Ctrl/⌘ + C, then paste into the AI chat.',
        value: json,
        readOnly: true,
        confirmLabel: 'Done'
      });
    });
  }

  // ---------- feedback actions ----------
  function sectionLabel() {
    return currentTab && navButtons[currentTab] ? navButtons[currentTab].textContent : currentTab;
  }

  function approve() {
    return sendPayload({
      status: 'APPROVED',
      message: cfg.vpApproveMessage || 'Reviewed and approved. Please proceed.'
    }, '👍 Approval copied! Paste it back into the AI chat.');
  }

  function requestChanges() {
    return dialog({
      title: '📝 Request changes',
      description: 'Describe what should change. It is copied as JSON for the AI chat.',
      placeholder: 'e.g. Move the login step before checkout and add rate limiting to POST /orders',
      required: true,
      confirmLabel: 'Copy request'
    }).then(function (changes) {
      if (changes === null) return;
      return sendPayload({
        status: 'REQUEST_CHANGES',
        viewing_section: sectionLabel(),
        changes: changes.trim(),
        message: cfg.vpChangesMessage || 'Please revise the document according to `changes`, then update the same HTML file.'
      }, '📝 Change request copied! Paste it back into the AI chat.');
    });
  }

  function selectOption(button) {
    var name = button.getAttribute('data-vp-select');
    return dialog({
      title: '🎯 ' + name,
      description: 'Optional: add direction for the implementation (constraints, tweaks, things to avoid).',
      placeholder: 'Leave empty to choose as-is',
      confirmLabel: 'Copy selection'
    }).then(function (note) {
      if (note === null) return;
      var card = button.closest('[data-vp-option]');
      if (card) {
        var group = card.closest('[data-vp-options]') || doc;
        Array.prototype.forEach.call(group.querySelectorAll('[data-vp-option]'), function (c) { c.removeAttribute('data-vp-selected'); });
        card.setAttribute('data-vp-selected', '');
      }
      return sendPayload({
        status: 'APPROVED_WITH_DIRECTION',
        action: 'SELECT_OPTION',
        selected_option: name,
        direction: note.trim(),
        message: 'I reviewed the options and chose "' + name + '". Please proceed with it' + (note.trim() ? ', following `direction`.' : '.')
      }, '🎯 Selection copied! Paste it back into the AI chat.');
    });
  }

  // ---------- checklist ----------
  function findTarget(attrValue, selector) {
    return (attrValue && doc.getElementById(attrValue)) || doc.querySelector(selector);
  }

  function checklistItems(list) {
    return Array.prototype.map.call(list.querySelectorAll('[data-vp-item]'), function (item, i) {
      var box = item.querySelector('input[type="checkbox"]');
      var entry = {
        id: item.getAttribute('data-id') || (box && box.id) || 'item-' + (i + 1),
        task: stripBrackets(text(item.querySelector('[data-vp-item-text]')) || text(item)),
        completed: !!(box && box.checked)
      };
      var assignee = text(item.querySelector('[data-vp-assignee]'));
      var due = text(item.querySelector('[data-vp-due]'));
      if (assignee) entry.assignee = stripBrackets(assignee);
      if (due) entry.due = stripBrackets(due);
      return entry;
    });
  }

  function updateProgress() {
    Array.prototype.forEach.call(doc.querySelectorAll('[data-vp-checklist]'), function (list) {
      var items = checklistItems(list);
      var done = items.filter(function (i) { return i.completed; }).length;
      Array.prototype.forEach.call(doc.querySelectorAll('[data-vp-progress="' + list.id + '"], [data-vp-progress=""]'), function (el) {
        el.textContent = done + ' / ' + items.length + ' done';
      });
    });
  }

  function copyChecklist(button) {
    var list = findTarget(button.getAttribute('data-vp-copy-checklist'), '[data-vp-checklist]');
    if (!list) return;
    return sendPayload({
      status: 'UPDATED',
      action: list.getAttribute('data-vp-action') || 'UPDATE_CHECKLIST',
      items: checklistItems(list),
      message: cfg.vpChecklistMessage || 'Here are the updated statuses of the action items. Please sync them to tasks.md.'
    }, '📋 Checklist copied! Paste it back into the AI chat.');
  }

  // ---------- priority board ----------
  function columns(board) { return Array.prototype.slice.call(board.querySelectorAll('[data-vp-column]')); }
  function dropZone(column) { return column.querySelector('[data-vp-dropzone]') || column; }
  function cardsIn(zone) { return Array.prototype.slice.call(zone.querySelectorAll('[data-vp-card]')); }

  function updateCounts() {
    Array.prototype.forEach.call(doc.querySelectorAll('[data-vp-column]'), function (col) {
      var count = col.querySelector('[data-vp-count]');
      if (count) count.textContent = String(cardsIn(dropZone(col)).length);
    });
  }

  function copyBoard(button) {
    var board = findTarget(button.getAttribute('data-vp-copy-board'), '[data-vp-board]');
    if (!board) return;
    var result = {};
    columns(board).forEach(function (col) {
      result[col.getAttribute('data-vp-column')] = cardsIn(dropZone(col)).map(function (card, i) {
        return {
          id: card.getAttribute('data-id') || 'card-' + (i + 1),
          task: stripBrackets(text(card.querySelector('[data-vp-card-text]')) || text(card))
        };
      });
    });
    return sendPayload({
      status: 'UPDATED',
      action: board.getAttribute('data-vp-action') || 'UPDATE_TASK_PRIORITY',
      priorities: result,
      message: cfg.vpBoardMessage || 'Here is the new priority order (top = most important). Please update tasks.md accordingly.'
    }, '📋 Priorities copied! Paste it back into the AI chat.');
  }

  Array.prototype.forEach.call(doc.querySelectorAll('[data-vp-card]'), function (card) {
    card.setAttribute('draggable', 'true');
    if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex', '0');
    card.setAttribute('aria-roledescription', 'draggable card');
  });

  var dragged = null;
  function clearDropTargets() {
    Array.prototype.forEach.call(doc.querySelectorAll('.vp-drop-target'), function (el) { el.classList.remove('vp-drop-target'); });
  }
  doc.addEventListener('dragstart', function (e) {
    var card = e.target.closest && e.target.closest('[data-vp-card]');
    if (!card) return;
    dragged = card;
    card.classList.add('vp-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.getAttribute('data-id') || '');
  });
  doc.addEventListener('dragend', function () {
    if (dragged) dragged.classList.remove('vp-dragging');
    dragged = null;
    clearDropTargets();
    updateCounts();
  });
  doc.addEventListener('dragover', function (e) {
    if (!dragged) return;
    var column = e.target.closest && e.target.closest('[data-vp-column]');
    if (!column || column.closest('[data-vp-board]') !== dragged.closest('[data-vp-board]')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!column.classList.contains('vp-drop-target')) { clearDropTargets(); column.classList.add('vp-drop-target'); }
    var zone = dropZone(column);
    var before = cardsIn(zone).filter(function (c) { return c !== dragged; }).find(function (c) {
      var r = c.getBoundingClientRect();
      return e.clientY < r.top + r.height / 2;
    });
    if (before) { if (dragged.nextElementSibling !== before) zone.insertBefore(dragged, before); }
    else if (zone.lastElementChild !== dragged) zone.appendChild(dragged);
  });
  doc.addEventListener('drop', function (e) { if (dragged) e.preventDefault(); });

  // Keyboard: focus a card, ↑/↓ to reorder, ←/→ to move between columns.
  doc.addEventListener('keydown', function (e) {
    var card = e.target.closest && e.target.closest('[data-vp-card]');
    if (!card || e.altKey || e.ctrlKey || e.metaKey) return;
    var board = card.closest('[data-vp-board]');
    var cols = columns(board);
    var col = card.closest('[data-vp-column]');
    var zone = dropZone(col);
    var siblings = cardsIn(zone);
    var idx = siblings.indexOf(card);
    var moved = true;
    if (e.key === 'ArrowUp' && idx > 0) zone.insertBefore(card, siblings[idx - 1]);
    else if (e.key === 'ArrowDown' && idx < siblings.length - 1) zone.insertBefore(siblings[idx + 1], card);
    else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && cols.length > 1) {
      var next = cols[cols.indexOf(col) + (e.key === 'ArrowLeft' ? -1 : 1)];
      if (next) dropZone(next).appendChild(card); else moved = false;
    } else moved = false;
    if (moved) { e.preventDefault(); card.focus(); updateCounts(); }
  });

  // ---------- event wiring ----------
  doc.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-vp-feedback], [data-vp-select], [data-vp-copy-checklist], [data-vp-copy-board]');
    if (!t) return;
    if (t.hasAttribute('data-vp-feedback')) {
      if (t.getAttribute('data-vp-feedback') === 'APPROVED') approve(); else requestChanges();
    } else if (t.hasAttribute('data-vp-select')) selectOption(t);
    else if (t.hasAttribute('data-vp-copy-checklist')) copyChecklist(t);
    else copyBoard(t);
  });
  doc.addEventListener('change', function (e) {
    if (e.target.closest && e.target.closest('[data-vp-checklist]')) updateProgress();
  });
  updateProgress();
  updateCounts();

  // Public API for custom buttons: VP.send({ status: 'UPDATED', action: '...', ... })
  window.VP = { send: sendPayload, toast: toast, dialog: dialog, showTab: function (id) { activate(id, true); } };
  // Back-compat with specs written against the v1.1 templates.
  window.copyFeedback = function (status) { return status === 'APPROVED' ? approve() : requestChanges(); };
})();
