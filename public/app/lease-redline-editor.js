// ============================================================
// LEASE REDLINE EDITOR (Save-as-v3)
// ============================================================
// Full-screen overlay that lets you assemble a new lease version from
// accumulated counters. Launched from the Compare overlay via the
// "Build v3 from these counters" button.
//
// Three-pane layout:
//   - Left: clause navigation (groupable tree, status badges)
//   - Center: focused clause editor with 3 tabs
//   - Right: AI panel + counter builder + status pill + notes
//
// On save: POSTs to /api/lease/save-as-version which generates a DOCX,
// inserts a new lease_documents row, and marks promoted negotiations.
// ============================================================

(function () {
  'use strict'

  var GROUP_ORDER = ['economics', 'term', 'use', 'risk', 'misc']
  var GROUP_LABELS = {
    economics: 'Economics',
    term:      'Term & Options',
    use:       'Use & Alterations',
    risk:      'Risk Allocation',
    misc:      'Other',
  }

  var TYPE_GROUP = {
    rent_base: 'economics', rent_abatement: 'economics', opex_passthrough: 'economics',
    opex_caps: 'economics', security_deposit: 'economics', parking: 'economics',
    tenant_improvements: 'economics',
    term_dates: 'term', renewal_options: 'term', expansion_rights: 'term',
    termination_rights: 'term', holdover: 'term',
    permitted_use: 'use', alterations: 'use', signage: 'use',
    subletting_assignment: 'use',
    maintenance_repair: 'risk', services_utilities: 'risk', insurance: 'risk',
    indemnity: 'risk', casualty_condemnation: 'risk', default_remedies: 'risk',
    estoppel_snda: 'risk', surrender: 'risk',
    other: 'misc',
  }

  var TYPE_LABEL = {
    rent_base: 'Base Rent', rent_abatement: 'Free Rent / Abatement',
    opex_passthrough: 'Operating Expenses', opex_caps: 'Opex Caps / Base Year',
    security_deposit: 'Security Deposit', parking: 'Parking',
    tenant_improvements: 'Tenant Improvements', term_dates: 'Term & Key Dates',
    renewal_options: 'Renewal Options', expansion_rights: 'Expansion Rights',
    termination_rights: 'Termination Rights', holdover: 'Holdover',
    permitted_use: 'Permitted Use', alterations: 'Alterations',
    signage: 'Signage', subletting_assignment: 'Sublet & Assignment',
    maintenance_repair: 'Maintenance & Repair', services_utilities: 'Services & Utilities',
    insurance: 'Insurance', indemnity: 'Indemnification',
    casualty_condemnation: 'Casualty & Condemnation', default_remedies: 'Default & Remedies',
    estoppel_snda: 'Estoppel & SNDA', surrender: 'Surrender Condition',
    other: 'Other',
  }

  function escapeHtml(s) {
    if (s == null) return ''
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }

  function getUserEmail() {
    try { return (typeof CURRENT_USER_EMAIL !== 'undefined' && CURRENT_USER_EMAIL) || localStorage.getItem('userEmail') || '' } catch (e) { return '' }
  }

  // ================================================================
  // ENTRY POINT
  // ================================================================
  // basedOnDocId: the v2 lease_documents.id (this is what we're countering against)
  async function showRedlineEditor(basedOnDocId) {
    if (!basedOnDocId) return

    var overlay = document.createElement('div')
    overlay.className = 'lease-editor-overlay'
    overlay.innerHTML = '<div class="lease-editor-loading"><div class="lease-spinner"></div> Loading clause editor...</div>'
    document.body.appendChild(overlay)

    try {
      // Fetch v2 doc
      var docResp = await fetch('/api/lease?id=' + encodeURIComponent(basedOnDocId))
      var doc = await docResp.json()
      if (!docResp.ok) throw new Error(doc.error || 'Could not load base version')

      var clauses = (doc.extraction_json && doc.extraction_json.clauses) || []
      if (clauses.length === 0) {
        throw new Error('Base version has no extracted clauses')
      }

      // Fetch negotiations for this building
      var negResp = await fetch('/api/lease/negotiation?projectId=' + encodeURIComponent(doc.project_id) + '&buildingAddress=' + encodeURIComponent(doc.building_address))
      var negotiations = await negResp.json()
      if (!negResp.ok) throw new Error('Could not load negotiations')

      // Initialize editor state
      var state = {
        baseDoc: doc,
        baseClauses: clauses,
        negotiations: negotiations || {},
        // Per-clause editor state: { type -> { proposedText, excluded, dirty } }
        editorState: {},
        focusedType: null,
        versionLabel: 'v' + ((doc.version_number || 2) + 1) + ' (Tenant Counter)',
        showRationaleAnnotations: false,
        refreshChangedClauses: true,
      }

      // Pre-populate editor state from existing counters
      clauses.forEach(function (c) {
        var neg = state.negotiations[c.type]
        var startingText = (neg && neg.counter_language) ? neg.counter_language : (c.original_excerpt || '')
        state.editorState[c.type] = {
          proposedText: startingText,
          excluded: false,
          dirty: false,
        }
      })

      // Default focus: first clause that has a counter, else the first clause
      var firstWithCounter = clauses.find(function (c) {
        return state.negotiations[c.type] && state.negotiations[c.type].counter_language
      })
      state.focusedType = firstWithCounter ? firstWithCounter.type : clauses[0].type

      overlay.__editorState = state
      overlay.innerHTML = renderEditor(state)
      bindHandlers(overlay)
    } catch (e) {
      console.error('Redline editor load failed:', e)
      overlay.innerHTML = '<div class="lease-editor-loading lease-editor-error">Error: ' + escapeHtml(e.message) +
        '<br><br><button class="lease-btn-secondary" onclick="this.closest(\'.lease-editor-overlay\').remove()">Close</button></div>'
    }
  }

  // ================================================================
  // RENDER
  // ================================================================
  function renderEditor(state) {
    var doc = state.baseDoc
    var totalClauses = state.baseClauses.length
    var counteredCount = countCountered(state)
    var excludedCount = countExcluded(state)
    var unchangedCount = totalClauses - counteredCount - excludedCount

    return '<div class="lease-editor-card">' +
      // ---- Header ----
      '<div class="lease-editor-header">' +
        '<div class="lease-editor-titles">' +
          '<div class="lease-editor-eyebrow">Build New Version</div>' +
          '<input class="lease-editor-version-name" data-version-name value="' + escapeHtml(state.versionLabel) + '" />' +
          '<div class="lease-editor-subtitle">Based on ' + escapeHtml(doc.version_label || 'v' + doc.version_number) + ' \u00b7 ' + escapeHtml(doc.building_address) + '</div>' +
        '</div>' +
        '<div class="lease-editor-actions">' +
          '<label class="lease-editor-toggle" title="Add italic [Drafting note: ...] beneath each countered clause in the DOCX">' +
            '<input type="checkbox" data-show-annotations /> Drafting notes' +
          '</label>' +
          '<label class="lease-editor-toggle" title="Use AI to refresh the summary, key terms, and risk level for changed clauses">' +
            '<input type="checkbox" data-refresh-changed checked /> AI refresh' +
          '</label>' +
          '<button class="lease-btn-secondary" data-action="cancel">Cancel</button>' +
          '<button class="lease-btn-primary" data-action="save">Save as ' + escapeHtml(state.versionLabel) + '</button>' +
        '</div>' +
      '</div>' +

      // ---- Footer/progress strip ----
      '<div class="lease-editor-progress">' +
        '<span class="lease-editor-progress-pill lease-editor-progress-counter"><strong data-counter-count>' + counteredCount + '</strong> with counters</span>' +
        '<span class="lease-editor-progress-pill"><strong data-unchanged-count>' + unchangedCount + '</strong> unchanged</span>' +
        '<span class="lease-editor-progress-pill"><strong data-excluded-count>' + excludedCount + '</strong> excluded</span>' +
        '<span class="lease-editor-progress-pill lease-editor-progress-total">Total: ' + totalClauses + '</span>' +
      '</div>' +

      // ---- Body: 3-pane ----
      '<div class="lease-editor-body">' +
        '<div class="lease-editor-rail-left">' + renderLeftRail(state) + '</div>' +
        '<div class="lease-editor-center" data-editor-center>' + renderCenter(state) + '</div>' +
      '</div>' +
    '</div>'
  }

  // ---- Left rail: clause nav grouped by economics/term/use/risk/misc ----
  function renderLeftRail(state) {
    var clausesByGroup = {}
    GROUP_ORDER.forEach(function (g) { clausesByGroup[g] = [] })
    state.baseClauses.forEach(function (c, i) {
      var g = TYPE_GROUP[c.type] || 'misc'
      clausesByGroup[g].push({ clause: c, idx: i })
    })

    var html = '<div class="lease-editor-nav">'
    GROUP_ORDER.forEach(function (g) {
      var list = clausesByGroup[g] || []
      if (list.length === 0) return
      html += '<div class="lease-editor-nav-group">' +
        '<div class="lease-editor-nav-group-label">' + escapeHtml(GROUP_LABELS[g] || g) + '</div>'
      list.forEach(function (item) {
        var c = item.clause
        var st = state.editorState[c.type] || {}
        var neg = state.negotiations[c.type]
        var hasCounter = neg && neg.counter_language && !st.excluded
        var label = (TYPE_LABEL[c.type] || c.type)
        var section = c.section ? ' <span class="lease-editor-nav-section">' + escapeHtml(c.section) + '</span>' : ''
        var classes = ['lease-editor-nav-item']
        if (state.focusedType === c.type) classes.push('lease-editor-nav-item-focused')
        if (hasCounter) classes.push('lease-editor-nav-item-counter')
        if (st.excluded) classes.push('lease-editor-nav-item-excluded')

        var statusDot = hasCounter ? '<span class="lease-editor-nav-dot lease-editor-nav-dot-counter" title="Has counter"></span>'
          : (st.excluded ? '<span class="lease-editor-nav-dot lease-editor-nav-dot-excluded" title="Excluded"></span>'
          : '<span class="lease-editor-nav-dot lease-editor-nav-dot-unchanged" title="Unchanged from base"></span>')

        html += '<button class="' + classes.join(' ') + '" data-focus-type="' + escapeHtml(c.type) + '">' +
          statusDot +
          '<span class="lease-editor-nav-label">' + escapeHtml(label) + section + '</span>' +
        '</button>'
      })
      html += '</div>'
    })
    html += '</div>'
    return html
  }

  // ---- Center: focused clause editor ----
  function renderCenter(state) {
    var c = state.baseClauses.find(function (cc) { return cc.type === state.focusedType })
    if (!c) return '<div class="lease-editor-empty">Select a clause from the left rail.</div>'

    var st = state.editorState[c.type]
    var neg = state.negotiations[c.type]
    var label = TYPE_LABEL[c.type] || c.type
    var section = c.section || ''
    var hasCounter = neg && neg.counter_language

    return '<div class="lease-editor-clause" data-clause-type="' + escapeHtml(c.type) + '">' +
      // Header with metadata
      '<div class="lease-editor-clause-header">' +
        '<div>' +
          '<div class="lease-editor-clause-label">' + escapeHtml(label) + (section ? ' <span class="lease-editor-clause-section">' + escapeHtml(section) + '</span>' : '') + '</div>' +
          (c.heading ? '<div class="lease-editor-clause-heading">' + escapeHtml(c.heading) + '</div>' : '') +
        '</div>' +
        '<div class="lease-editor-quick-actions">' +
          '<button class="lease-btn-secondary lease-editor-mini-btn" data-action="reset-to-original" title="Reset to base version original">Reset to ' + escapeHtml(state.baseDoc.version_label || 'base') + '</button>' +
          (hasCounter ? '<button class="lease-btn-secondary lease-editor-mini-btn" data-action="apply-counter" title="Use the existing AI counter">Apply AI Counter</button>' : '') +
          '<button class="lease-btn-secondary lease-editor-mini-btn ' + (st.excluded ? 'lease-editor-excluded-active' : '') + '" data-action="toggle-excluded" title="Carry forward base version language; do not include the counter">' + (st.excluded ? 'Included' : 'Exclude from save') + '</button>' +
        '</div>' +
      '</div>' +

      // Tabs
      '<div class="lease-editor-tabs">' +
        '<button class="lease-editor-tab active" data-editor-tab="proposed">Proposed (your text)</button>' +
        '<button class="lease-editor-tab" data-editor-tab="original">Original (base)</button>' +
        '<button class="lease-editor-tab" data-editor-tab="diff">Diff Preview</button>' +
      '</div>' +

      // Tab body
      '<div class="lease-editor-tab-body" data-editor-tab-body>' +
        renderEditorTab('proposed', c, st, neg) +
      '</div>' +

      // Right rail INSIDE center for now (collapsed below proposed). Showing here for context.
      '<div class="lease-editor-context">' +
        renderRightRailContext(c, neg) +
      '</div>' +
    '</div>'
  }

  function renderEditorTab(tab, c, st, neg) {
    if (tab === 'proposed') {
      return '<textarea class="lease-editor-textarea" data-proposed-textarea ' +
        (st.excluded ? 'disabled' : '') + '>' + escapeHtml(st.proposedText) + '</textarea>' +
        (st.excluded ? '<div class="lease-editor-excluded-hint">This clause is marked as excluded. The base version language will be used. Click \u201cInclude\u201d above to edit.</div>' : '')
    }
    if (tab === 'original') {
      return '<div class="lease-editor-readonly">' + escapeHtml(c.original_excerpt || '(no original text)') + '</div>'
    }
    if (tab === 'diff') {
      var origText = c.original_excerpt || ''
      var newText = st.excluded ? origText : st.proposedText
      var ops = wordDiffSimple(origText, newText)
      var diffHtml = ops.map(function (op) {
        if (op.op === 'eq') return escapeHtml(op.text)
        if (op.op === 'ins') return '<ins class="lease-cmp-ins">' + escapeHtml(op.text) + '</ins>'
        return '<del class="lease-cmp-del">' + escapeHtml(op.text) + '</del>'
      }).join('')
      return '<div class="lease-editor-diff">' + diffHtml + '</div>'
    }
    return ''
  }

  function renderRightRailContext(c, neg) {
    var risk = c.risk_level || 'unknown'
    var riskColor = risk === 'high' ? '#B91C1C' : (risk === 'medium' ? '#B45309' : (risk === 'low' ? '#15803D' : '#475569'))
    var riskBg = risk === 'high' ? '#FEF2F2' : (risk === 'medium' ? '#FFFBEB' : (risk === 'low' ? '#F0FDF4' : '#F1F5F9'))

    var keyTermsHtml = ''
    if (c.key_terms && Object.keys(c.key_terms).length > 0) {
      keyTermsHtml = '<div class="lease-editor-context-block"><div class="lease-editor-context-label">Key Terms (base)</div>'
      Object.keys(c.key_terms).forEach(function (k) {
        var v = c.key_terms[k]
        if (v == null || v === '') return
        var disp = k.replace(/_/g, ' ').replace(/\b\w/g, function (m) { return m.toUpperCase() })
        keyTermsHtml += '<div class="lease-editor-keyterm"><span>' + escapeHtml(disp) + '</span><strong>' + escapeHtml(typeof v === 'object' ? JSON.stringify(v) : v) + '</strong></div>'
      })
      keyTermsHtml += '</div>'
    }

    var rationaleHtml = ''
    if (neg && neg.counter_rationale) {
      rationaleHtml = '<div class="lease-editor-context-block lease-editor-context-rationale">' +
        '<div class="lease-editor-context-label">Counter Rationale</div>' +
        '<div>' + escapeHtml(neg.counter_rationale) + '</div>' +
      '</div>'
    }

    var notesHtml = ''
    if (neg && neg.notes) {
      notesHtml = '<div class="lease-editor-context-block">' +
        '<div class="lease-editor-context-label">Negotiation Notes</div>' +
        '<div>' + escapeHtml(neg.notes) + '</div>' +
      '</div>'
    }

    return '<div class="lease-editor-context-row">' +
      '<div class="lease-editor-context-block">' +
        '<div class="lease-editor-context-label">Base Risk</div>' +
        '<div class="lease-editor-context-risk" style="color:' + riskColor + ';background:' + riskBg + '">' + escapeHtml(risk) + '</div>' +
        (c.risk_rationale ? '<div class="lease-editor-context-quiet">' + escapeHtml(c.risk_rationale) + '</div>' : '') +
      '</div>' +
      keyTermsHtml +
      rationaleHtml +
      notesHtml +
    '</div>'
  }

  // Lightweight word-level diff (LCS) - mirrors src/lib/lease-compare.ts wordDiff
  function wordDiffSimple(a, b) {
    var aTokens = tokenize(a || '')
    var bTokens = tokenize(b || '')
    if (aTokens.length === 0 && bTokens.length === 0) return []
    var n = aTokens.length, m = bTokens.length
    var dp = []
    for (var i = 0; i <= n; i++) dp.push(new Array(m + 1).fill(0))
    for (var i = n - 1; i >= 0; i--) {
      for (var j = m - 1; j >= 0; j--) {
        if (aTokens[i].toLowerCase() === bTokens[j].toLowerCase()) dp[i][j] = dp[i + 1][j + 1] + 1
        else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }
    var ops = []
    var i = 0, j = 0
    while (i < n && j < m) {
      if (aTokens[i].toLowerCase() === bTokens[j].toLowerCase()) {
        pushOp(ops, 'eq', aTokens[i]); i++; j++
      } else if (dp[i + 1][j] >= dp[i][j + 1]) { pushOp(ops, 'del', aTokens[i]); i++ }
      else { pushOp(ops, 'ins', bTokens[j]); j++ }
    }
    while (i < n) { pushOp(ops, 'del', aTokens[i++]) }
    while (j < m) { pushOp(ops, 'ins', bTokens[j++]) }
    return ops
  }
  function tokenize(s) {
    var out = [], re = /(\s+|[^\s\w]+|\w+)/g, m
    while ((m = re.exec(s)) !== null) out.push(m[0])
    return out
  }
  function pushOp(ops, op, text) {
    var last = ops[ops.length - 1]
    if (last && last.op === op) last.text += text
    else ops.push({ op: op, text: text })
  }

  // ================================================================
  // HANDLERS
  // ================================================================
  function bindHandlers(overlay) {
    // Cancel
    overlay.querySelectorAll('[data-action="cancel"]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (hasUnsavedChanges(overlay.__editorState)) {
          if (!confirm('Discard your changes?')) return
        }
        overlay.remove()
      })
    })

    // Save
    overlay.querySelectorAll('[data-action="save"]').forEach(function (b) {
      b.addEventListener('click', function () { handleSave(overlay) })
    })

    // Version name input
    var nameInput = overlay.querySelector('[data-version-name]')
    if (nameInput) {
      nameInput.addEventListener('input', function () {
        overlay.__editorState.versionLabel = nameInput.value
        // Update Save button label
        var saveBtn = overlay.querySelector('[data-action="save"]')
        if (saveBtn) saveBtn.textContent = 'Save as ' + nameInput.value
      })
    }

    // Toggles
    var annInput = overlay.querySelector('[data-show-annotations]')
    if (annInput) annInput.addEventListener('change', function () { overlay.__editorState.showRationaleAnnotations = annInput.checked })
    var refInput = overlay.querySelector('[data-refresh-changed]')
    if (refInput) refInput.addEventListener('change', function () { overlay.__editorState.refreshChangedClauses = refInput.checked })

    // Left rail clause focus
    overlay.querySelectorAll('[data-focus-type]').forEach(function (item) {
      item.addEventListener('click', function () {
        // Save current proposed text before switching
        savePendingText(overlay)
        var newType = item.getAttribute('data-focus-type')
        overlay.__editorState.focusedType = newType
        // Re-render center + left rail
        var center = overlay.querySelector('[data-editor-center]')
        if (center) center.innerHTML = renderCenter(overlay.__editorState)
        var leftRail = overlay.querySelector('.lease-editor-rail-left')
        if (leftRail) leftRail.innerHTML = renderLeftRail(overlay.__editorState)
        bindHandlers(overlay)
      })
    })

    // Tab switching inside the focused clause
    overlay.querySelectorAll('[data-editor-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        // Save current text before tab switch (so diff tab shows latest)
        savePendingText(overlay)
        overlay.querySelectorAll('[data-editor-tab]').forEach(function (t) { t.classList.remove('active') })
        tab.classList.add('active')
        var which = tab.getAttribute('data-editor-tab')
        var state = overlay.__editorState
        var c = state.baseClauses.find(function (cc) { return cc.type === state.focusedType })
        if (!c) return
        var st = state.editorState[c.type]
        var neg = state.negotiations[c.type]
        var body = overlay.querySelector('[data-editor-tab-body]')
        if (body) body.innerHTML = renderEditorTab(which, c, st, neg)
        // Re-bind any new textareas
        bindTextareaHandler(overlay)
      })
    })

    // Quick actions
    overlay.querySelectorAll('[data-action="reset-to-original"]').forEach(function (b) {
      b.addEventListener('click', function () {
        var state = overlay.__editorState
        var c = state.baseClauses.find(function (cc) { return cc.type === state.focusedType })
        if (!c) return
        state.editorState[c.type].proposedText = c.original_excerpt || ''
        state.editorState[c.type].dirty = true
        state.editorState[c.type].excluded = false
        rerenderClause(overlay)
      })
    })
    overlay.querySelectorAll('[data-action="apply-counter"]').forEach(function (b) {
      b.addEventListener('click', function () {
        var state = overlay.__editorState
        var c = state.baseClauses.find(function (cc) { return cc.type === state.focusedType })
        if (!c) return
        var neg = state.negotiations[c.type]
        if (!neg || !neg.counter_language) return
        state.editorState[c.type].proposedText = neg.counter_language
        state.editorState[c.type].dirty = true
        state.editorState[c.type].excluded = false
        rerenderClause(overlay)
      })
    })
    overlay.querySelectorAll('[data-action="toggle-excluded"]').forEach(function (b) {
      b.addEventListener('click', function () {
        var state = overlay.__editorState
        var c = state.baseClauses.find(function (cc) { return cc.type === state.focusedType })
        if (!c) return
        state.editorState[c.type].excluded = !state.editorState[c.type].excluded
        state.editorState[c.type].dirty = true
        rerenderClause(overlay)
      })
    })

    bindTextareaHandler(overlay)
  }

  function bindTextareaHandler(overlay) {
    var ta = overlay.querySelector('[data-proposed-textarea]')
    if (!ta) return
    if (ta.__bound) return
    ta.__bound = true
    var saveTimer = null
    ta.addEventListener('input', function () {
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(function () {
        savePendingText(overlay)
      }, 400)
    })
    ta.addEventListener('blur', function () {
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
      savePendingText(overlay)
    })
  }

  function savePendingText(overlay) {
    var state = overlay.__editorState
    var ta = overlay.querySelector('[data-proposed-textarea]')
    if (!ta) return
    var c = state.baseClauses.find(function (cc) { return cc.type === state.focusedType })
    if (!c) return
    var st = state.editorState[c.type]
    if (st.proposedText !== ta.value) {
      st.proposedText = ta.value
      st.dirty = true
      // Update progress bar counts
      updateProgressCounts(overlay)
      // Update left-rail status dot for this clause
      updateLeftRailItem(overlay, c.type)
    }
  }

  function rerenderClause(overlay) {
    var state = overlay.__editorState
    var center = overlay.querySelector('[data-editor-center]')
    if (center) center.innerHTML = renderCenter(state)
    var leftRail = overlay.querySelector('.lease-editor-rail-left')
    if (leftRail) leftRail.innerHTML = renderLeftRail(state)
    updateProgressCounts(overlay)
    bindHandlers(overlay)
  }

  function updateLeftRailItem(overlay, clauseType) {
    var item = overlay.querySelector('[data-focus-type="' + clauseType + '"]')
    if (!item) return
    var state = overlay.__editorState
    var c = state.baseClauses.find(function (cc) { return cc.type === clauseType })
    if (!c) return
    var st = state.editorState[clauseType]
    var neg = state.negotiations[clauseType]
    var origText = (c.original_excerpt || '').trim()
    var hasCustomText = !st.excluded && st.proposedText.trim() !== origText
    var hasCounter = !st.excluded && neg && neg.counter_language && st.proposedText.trim() === neg.counter_language.trim()
    item.classList.toggle('lease-editor-nav-item-counter', hasCustomText || hasCounter)
    item.classList.toggle('lease-editor-nav-item-excluded', st.excluded)
  }

  function updateProgressCounts(overlay) {
    var state = overlay.__editorState
    var counter = countCountered(state)
    var excluded = countExcluded(state)
    var total = state.baseClauses.length
    var unchanged = total - counter - excluded
    var ce = overlay.querySelector('[data-counter-count]')
    var ee = overlay.querySelector('[data-excluded-count]')
    var ue = overlay.querySelector('[data-unchanged-count]')
    if (ce) ce.textContent = counter
    if (ee) ee.textContent = excluded
    if (ue) ue.textContent = unchanged
  }

  function countCountered(state) {
    var n = 0
    state.baseClauses.forEach(function (c) {
      var st = state.editorState[c.type]
      if (st.excluded) return
      var origText = (c.original_excerpt || '').trim()
      if (st.proposedText.trim() !== origText) n++
    })
    return n
  }
  function countExcluded(state) {
    var n = 0
    state.baseClauses.forEach(function (c) {
      var st = state.editorState[c.type]
      var neg = state.negotiations[c.type]
      // Only counts as "excluded" if there's actually a counter that's being excluded
      if (st.excluded && neg && neg.counter_language) n++
    })
    return n
  }
  function hasUnsavedChanges(state) {
    return Object.keys(state.editorState).some(function (k) { return state.editorState[k].dirty })
  }

  // ================================================================
  // SAVE FLOW
  // ================================================================
  async function handleSave(overlay) {
    savePendingText(overlay)  // commit any pending textarea edits
    var state = overlay.__editorState

    var counterCount = countCountered(state)
    if (counterCount === 0) {
      alert('Nothing to save - no counters or edits have been made. Make at least one change before saving.')
      return
    }

    var saveBtn = overlay.querySelector('[data-action="save"]')
    var origLabel = saveBtn.textContent
    saveBtn.disabled = true
    saveBtn.innerHTML = '<div class="lease-spinner" style="display:inline-block;width:13px;height:13px;border-width:2px;color:#fff;"></div> Saving...'

    // Show staged toast
    var toast = showStageToast('Assembling new version...')

    try {
      // Build overrides payload
      var overrides = state.baseClauses.map(function (c) {
        var st = state.editorState[c.type]
        var neg = state.negotiations[c.type]
        var origText = (c.original_excerpt || '').trim()
        // Only send override for clauses that differ from base or are excluded
        if (st.excluded) {
          return { clause_type: c.type, excluded: true }
        }
        if (st.proposedText.trim() !== origText) {
          return { clause_type: c.type, use_text: st.proposedText }
        }
        return null
      }).filter(Boolean)

      if (state.refreshChangedClauses && overrides.length > 0) {
        toast.update('Refreshing AI metadata for ' + overrides.filter(function (o) { return !o.excluded }).length + ' changed clauses...')
      }

      var resp = await fetch('/api/lease/save-as-version', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basedOnVersionId: state.baseDoc.id,
          versionLabel: state.versionLabel,
          docType: 'tenant_redline',
          userEmail: getUserEmail(),
          overrides: overrides,
          refreshChangedClauses: !!state.refreshChangedClauses,
          showRationaleAnnotations: !!state.showRationaleAnnotations,
        }),
      })
      var data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Save failed')

      toast.update('New version saved. Opening summary...', 'success')
      setTimeout(function () { toast.dismiss() }, 1800)

      // Refresh the leases tab dashboard if it's mounted
      if (typeof leasePageInit === 'function') {
        try { leasePageInit() } catch (e) { /* non-critical */ }
      }

      // Close editor and open the new version's summary
      overlay.remove()
      if (typeof leaseShowSummary === 'function' && data.lease_doc_id) {
        setTimeout(function () { leaseShowSummary(data.lease_doc_id) }, 200)
      }
    } catch (e) {
      console.error('Save-as-version failed:', e)
      toast.update('Save failed: ' + e.message, 'error')
      saveBtn.disabled = false
      saveBtn.textContent = origLabel
    }
  }

  function showStageToast(text) {
    var existing = document.querySelector('.lease-toast')
    if (existing) existing.remove()
    var t = document.createElement('div')
    t.className = 'lease-toast'
    t.innerHTML = '<div class="lease-spinner"></div><span class="lease-toast-text">' + escapeHtml(text) + '</span>'
    document.body.appendChild(t)
    return {
      update: function (newText, kind) {
        t.className = 'lease-toast' + (kind ? ' lease-toast-' + kind : '')
        t.innerHTML = (kind === 'success' || kind === 'error' ? '' : '<div class="lease-spinner"></div>') + '<span class="lease-toast-text">' + escapeHtml(newText) + '</span>'
      },
      dismiss: function () { try { t.remove() } catch (e) { /* ignore */ } },
    }
  }

  // ================================================================
  // EXPOSE
  // ================================================================
  window.leaseShowRedlineEditor = showRedlineEditor
})()
