// ============================================================
// LEASE REVIEW v1
// ============================================================
// Self-contained module for uploading a lease, extracting structured
// clauses via Claude Sonnet 4, and displaying a summary panel.
//
// Entry points:
//   - leaseShowUploadModal()              -> upload + extract
//   - leaseShowSummary(leaseDocId)        -> summary view
//   - leaseListForBuilding(building)      -> render list of versions
//
// Depends on globals already in index.html:
//   - SURVEY_BUILDINGS, BUILDINGS, hasAdminAccess(), CURRENT_PROJECT_ID
//   - mammoth (for DOCX text extraction)
// ============================================================

(function () {
  'use strict'

  var GROUP_LABELS = {
    economics: 'Economics',
    term:      'Term & Options',
    use:       'Use & Alterations',
    risk:      'Risk Allocation',
    misc:      'Other',
  }
  var GROUP_ORDER = ['economics', 'term', 'use', 'risk', 'misc']

  // Risk: only HIGH gets a color signal (red). Everything else is neutral gray.
  // The point is to draw the eye to genuine risk, not to chart every clause.
  var RISK_STYLES = {
    low:     { fg: '#475569', bg: '#F1F5F9', label: 'Low risk' },
    medium:  { fg: '#334155', bg: '#F1F5F9', label: 'Medium risk' },
    high:    { fg: '#B91C1C', bg: '#FEF2F2', label: 'High risk' },
    unknown: { fg: '#94A3B8', bg: '#F8FAFC', label: 'Not assessed' },
  }

  var DOC_TYPE_LABELS = {
    initial_draft:    'Initial Draft',
    tenant_redline:   'Tenant Redline',
    landlord_redline: 'Landlord Redline',
    executed:         'Executed',
    other:            'Other',
  }

  // Negotiation status: bold blue for ACTIVE work (open / counter), gray for resolved.
  // Two-state visual signal: 'this needs attention' vs 'this is done' - not a 5-color rainbow.
  var NEG_STATUSES = [
    { key: 'open_issue',      label: 'Open Issue',      shortLabel: 'Open',     fg: '#1E40AF', bg: '#EFF6FF', borderColor: '#BFDBFE', isResolved: false },
    { key: 'counter_pending', label: 'Counter Pending', shortLabel: 'Counter',  fg: '#1E40AF', bg: '#EFF6FF', borderColor: '#BFDBFE', isResolved: false },
    { key: 'accepted',        label: 'Accepted',        shortLabel: 'Accepted', fg: '#475569', bg: '#F1F5F9', borderColor: '#E2E8F0', isResolved: true  },
    { key: 'wont_address',    label: "Won't Address",   shortLabel: "Won't",    fg: '#94A3B8', bg: '#F8FAFC', borderColor: '#E2E8F0', isResolved: true  },
    { key: 'not_applicable',  label: 'N/A',             shortLabel: 'N/A',      fg: '#94A3B8', bg: '#F8FAFC', borderColor: '#E2E8F0', isResolved: true  },
  ]
  var NEG_STATUS_BY_KEY = {}
  NEG_STATUSES.forEach(function (s) { NEG_STATUS_BY_KEY[s.key] = s })

  function getProjectId() {
    if (typeof CURRENT_PROJECT_ID !== 'undefined' && CURRENT_PROJECT_ID) return CURRENT_PROJECT_ID
    var m = (window.location.pathname || '').match(/project\/([^/?]+)/)
    return m ? m[1] : 'sf-office-search'
  }

  function getUserEmail() {
    try { return (typeof CURRENT_USER_EMAIL !== 'undefined' && CURRENT_USER_EMAIL) || localStorage.getItem('userEmail') || '' } catch (e) { return '' }
  }

  function escapeHtml(s) {
    if (s == null) return ''
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }

  function fmtCurrency(n) {
    if (n == null || isNaN(n)) return '—'
    return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
  }

  function fmtDate(s) {
    if (!s) return '—'
    try {
      var d = new Date(s)
      if (isNaN(d.getTime())) return s
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    } catch (e) { return s }
  }

  // ================================================================
  // BUILDING OPTIONS DROPDOWN (mirrors RFP modal logic)
  // ================================================================
  function buildBuildingOptions() {
    var surveyBuildings = (typeof SURVEY_BUILDINGS !== 'undefined') ? SURVEY_BUILDINGS : []
    var dealBuildings = (typeof BUILDINGS !== 'undefined') ? BUILDINGS : []
    var html = '<option value="">Select a building...</option>'
    if (dealBuildings.length > 0) {
      html += '<optgroup label="Shortlisted">'
      dealBuildings.forEach(function (b) {
        html += '<option value="deal-' + b.id + '" data-address="' + escapeHtml(b.address || b.name) + '">★ ' + escapeHtml(b.name) + '</option>'
      })
      html += '</optgroup>'
    }
    if (surveyBuildings.length > 0) {
      html += '<optgroup label="All Buildings">'
      surveyBuildings.forEach(function (b) {
        var label = b.name || b.address || ('Building ' + b.num)
        html += '<option value="' + b.num + '" data-address="' + escapeHtml(b.address || '') + '">' + escapeHtml(label) + '</option>'
      })
      html += '</optgroup>'
    }
    return html
  }

  // ================================================================
  // UPLOAD MODAL
  // ================================================================
  var _modal = null
  function leaseShowUploadModal(opts) {
    if (_modal) { _modal.remove(); _modal = null }
    opts = opts || {}

    var modal = document.createElement('div')
    modal.className = 'lease-modal-overlay'
    modal.innerHTML =
      '<div class="lease-modal-card" role="dialog" aria-modal="true">' +
        '<div class="lease-modal-header">' +
          '<div class="lease-modal-title">Lease Review — Upload</div>' +
          '<button class="lease-modal-close" aria-label="Close">×</button>' +
        '</div>' +
        '<div class="lease-modal-body">' +
          '<div class="lease-form-group">' +
            '<label class="lease-form-label">Building</label>' +
            '<select id="lease-building-select" class="lease-form-input">' + buildBuildingOptions() + '</select>' +
          '</div>' +
          '<div class="lease-form-group">' +
            '<label class="lease-form-label">Document type</label>' +
            '<select id="lease-doctype-select" class="lease-form-input">' +
              '<option value="initial_draft">Initial Draft</option>' +
              '<option value="tenant_redline">Tenant Redline</option>' +
              '<option value="landlord_redline">Landlord Redline</option>' +
              '<option value="executed">Executed</option>' +
              '<option value="other">Other</option>' +
            '</select>' +
          '</div>' +
          '<div class="lease-form-group">' +
            '<label class="lease-form-label">Version label (optional)</label>' +
            '<input id="lease-version-label" class="lease-form-input" placeholder="e.g. Landlord Draft v1, May 5" />' +
          '</div>' +
          '<div class="lease-form-group">' +
            '<label class="lease-form-label">Lease file (PDF or DOCX)</label>' +
            '<input id="lease-file-input" type="file" accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" class="lease-form-input" />' +
            '<div class="lease-form-hint">Files up to 50 MB. PDFs are sent directly to the AI; DOCX is parsed in your browser first.</div>' +
          '</div>' +
          '<div id="lease-upload-status" class="lease-upload-status" style="display:none"></div>' +
        '</div>' +
        '<div class="lease-modal-footer">' +
          '<button class="lease-btn-secondary" id="lease-modal-cancel">Cancel</button>' +
          '<button class="lease-btn-primary" id="lease-modal-submit">Upload & Extract</button>' +
        '</div>' +
      '</div>'

    document.body.appendChild(modal)
    _modal = modal

    // Preset building if requested (e.g. "Add new version for this building")
    if (opts.presetBuildingAddress) {
      var sel = modal.querySelector('#lease-building-select')
      if (sel) {
        var match = null
        for (var i = 0; i < sel.options.length; i++) {
          var opt = sel.options[i]
          var addr = opt.getAttribute('data-address') || ''
          if (addr && addr.toLowerCase() === opts.presetBuildingAddress.toLowerCase()) {
            match = opt
            break
          }
        }
        if (match) sel.value = match.value
      }
    }

    var close = function () { modal.remove(); _modal = null }
    modal.querySelector('.lease-modal-close').addEventListener('click', close)
    modal.querySelector('#lease-modal-cancel').addEventListener('click', close)
    modal.addEventListener('click', function (e) { if (e.target === modal) close() })

    modal.querySelector('#lease-modal-submit').addEventListener('click', function () {
      handleUploadSubmit(modal)
    })
  }

  function setStatus(modal, text, kind) {
    var el = modal.querySelector('#lease-upload-status')
    if (!el) return
    el.style.display = ''
    el.className = 'lease-upload-status' + (kind ? ' lease-status-' + kind : '')
    el.innerHTML = text
  }

  // ================================================================
  // FILE TEXT EXTRACTION (for DOCX only - PDFs are sent raw to Claude)
  // ================================================================
  function extractDocxText(file) {
    return new Promise(function (resolve, reject) {
      if (typeof mammoth === 'undefined') {
        reject(new Error('Mammoth.js not loaded — cannot extract DOCX text'))
        return
      }
      var reader = new FileReader()
      reader.onload = function (e) {
        mammoth.extractRawText({ arrayBuffer: e.target.result })
          .then(function (result) { resolve(result.value || '') })
          .catch(reject)
      }
      reader.onerror = function () { reject(new Error('Could not read file')) }
      reader.readAsArrayBuffer(file)
    })
  }

  // ================================================================
  // SUBMIT FLOW: upload -> create record -> extract
  // ================================================================
  async function handleUploadSubmit(modal) {
    var sel = modal.querySelector('#lease-building-select')
    var fileInput = modal.querySelector('#lease-file-input')
    var docType = modal.querySelector('#lease-doctype-select').value
    var versionLabel = modal.querySelector('#lease-version-label').value.trim()

    var selectedOption = sel.options[sel.selectedIndex]
    if (!selectedOption || !selectedOption.value) {
      setStatus(modal, 'Please select a building.', 'error')
      return
    }
    var buildingAddress = selectedOption.getAttribute('data-address') || selectedOption.textContent.replace(/^★\s*/, '')
    var buildingNum = null
    if (!selectedOption.value.startsWith('deal-')) {
      var parsed = parseInt(selectedOption.value)
      if (!isNaN(parsed)) buildingNum = parsed
    }

    var file = fileInput.files && fileInput.files[0]
    if (!file) {
      setStatus(modal, 'Please choose a file to upload.', 'error')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setStatus(modal, 'File is larger than 50 MB. Please reduce the file size.', 'error')
      return
    }

    var projectId = getProjectId()
    var userEmail = getUserEmail()
    var btn = modal.querySelector('#lease-modal-submit')
    btn.disabled = true

    try {
      // ---- Step 1: get signed upload URL ----
      setStatus(modal, '<div class="lease-spinner"></div> Preparing upload...', 'info')
      var uploadResp = await fetch('/api/lease/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId,
          buildingAddress: buildingAddress,
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
        }),
      })
      var uploadData = await uploadResp.json()
      if (!uploadResp.ok) throw new Error(uploadData.error || 'Could not create upload URL')

      // ---- Step 2: PUT file directly to signed URL ----
      setStatus(modal, '<div class="lease-spinner"></div> Uploading file...', 'info')
      var putResp = await fetch(uploadData.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'true' },
        body: file,
      })
      if (!putResp.ok) {
        var errText = await putResp.text().catch(function () { return '' })
        throw new Error('Storage upload failed: ' + (errText || putResp.status))
      }

      // ---- Step 3: create lease_documents row ----
      setStatus(modal, '<div class="lease-spinner"></div> Recording document...', 'info')
      var createResp = await fetch('/api/lease', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId,
          buildingNum: buildingNum,
          buildingAddress: buildingAddress,
          docType: docType,
          docName: versionLabel || file.name,
          versionLabel: versionLabel || null,
          sourceUrl: uploadData.publicUrl,
          sourcePath: uploadData.storagePath,
          sourceFilename: file.name,
          sourceMime: file.type || null,
          uploadedBy: userEmail || 'unknown',
        }),
      })
      var leaseDoc = await createResp.json()
      if (!createResp.ok) throw new Error(leaseDoc.error || 'Could not save lease record')

      // ---- Step 4: extract ----
      setStatus(modal, '<div class="lease-spinner"></div> Extracting clauses with AI (this can take 1–3 minutes for long leases)...', 'info')

      var extractBody = {}
      var isDocx = file.name.toLowerCase().endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      if (isDocx) {
        // DOCX: parse text in browser, then send to extract endpoint
        try {
          var docxText = await extractDocxText(file)
          if (docxText.length < 200) {
            throw new Error('DOCX appears to be empty or unreadable')
          }
          extractBody.documentText = docxText
        } catch (e) {
          throw new Error('Could not parse DOCX: ' + e.message)
        }
      }

      var extractResp = await fetch('/api/lease/extract?id=' + leaseDoc.id + '&userEmail=' + encodeURIComponent(userEmail), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extractBody),
      })
      var extractData = await extractResp.json()
      if (!extractResp.ok) throw new Error(extractData.error || 'Extraction failed')

      // ---- Done ----
      setStatus(modal, '<strong>Done.</strong> Extracted ' + (extractData.clause_count || 0) + ' clauses. Opening summary...', 'success')
      setTimeout(function () {
        if (_modal) { _modal.remove(); _modal = null }
        // Refresh the lease tab dashboard if it's currently mounted
        if (typeof leasePageInit === 'function' && document.getElementById('lease-page-root')) {
          try { leasePageInit() } catch (e) { /* non-critical */ }
        }
        leaseShowSummary(leaseDoc.id)
      }, 800)
    } catch (e) {
      console.error('Lease upload error:', e)
      setStatus(modal, '<strong>Error:</strong> ' + escapeHtml(e.message || String(e)), 'error')
      btn.disabled = false
    }
  }

  // ================================================================
  // SUMMARY VIEW (inline panel)
  // ================================================================
  async function leaseShowSummary(leaseDocId) {
    // Render a full-screen overlay with the summary
    var overlay = document.createElement('div')
    overlay.className = 'lease-summary-overlay'
    overlay.innerHTML = '<div class="lease-summary-card"><div class="lease-summary-loading"><div class="lease-spinner"></div> Loading lease summary...</div></div>'
    document.body.appendChild(overlay)

    try {
      var resp = await fetch('/api/lease?id=' + encodeURIComponent(leaseDocId))
      var lease = await resp.json()
      if (!resp.ok) throw new Error(lease.error || 'Could not load lease')
      overlay.innerHTML = renderSummaryHtml(lease)
      bindSummaryHandlers(overlay, lease)
    } catch (e) {
      overlay.innerHTML = '<div class="lease-summary-card"><div class="lease-summary-error">Error: ' + escapeHtml(e.message) + '<br><br><button class="lease-btn-secondary" onclick="this.closest(\'.lease-summary-overlay\').remove()">Close</button></div></div>'
    }
  }

  function renderSummaryHtml(lease) {
    var meta = (lease.extraction_json && lease.extraction_json.document_meta) || {}
    var clauses = (lease.extraction_json && lease.extraction_json.clauses) || []
    var summary = lease.summary_json || {}
    var counts = summary.counts || {}
    var topRisks = summary.top_risks || []

    // Group clauses
    var byGroup = {}
    GROUP_ORDER.forEach(function (g) { byGroup[g] = [] })
    clauses.forEach(function (c) {
      // Map type to group via known taxonomy (mirrored client-side)
      var group = clauseTypeGroup(c.type)
      if (!byGroup[group]) byGroup[group] = []
      byGroup[group].push(c)
    })

    var html = '<div class="lease-summary-card lease-summary-full">'

    // Header
    html += '<div class="lease-summary-header">' +
      '<div>' +
        '<div class="lease-summary-eyebrow">Lease Review · ' + escapeHtml(DOC_TYPE_LABELS[lease.doc_type] || lease.doc_type) + '</div>' +
        '<div class="lease-summary-title">' + escapeHtml(lease.doc_name || 'Lease') + '</div>' +
        '<div class="lease-summary-subtitle">' + escapeHtml(lease.building_address || '') + ' · ' + escapeHtml(lease.version_label || ('v' + lease.version_number)) + '</div>' +
      '</div>' +
      '<div class="lease-summary-actions">' +
        (lease.source_url ? '<a class="lease-btn-secondary" href="' + escapeHtml(lease.source_url) + '" target="_blank" rel="noopener">Open Source</a>' : '') +
        '<button class="lease-btn-secondary" data-action="close">Close</button>' +
      '</div>' +
    '</div>'

    // Headline metrics
    html += '<div class="lease-headline-grid">' +
      headlineCell('Tenant', escapeHtml(meta.tenant_name || '—')) +
      headlineCell('Landlord', escapeHtml(meta.landlord_name || '—')) +
      headlineCell('RSF', meta.rsf ? Number(meta.rsf).toLocaleString() : '—') +
      headlineCell('Term', meta.lease_term_months ? (Math.round(meta.lease_term_months / 12 * 10) / 10) + ' yrs (' + meta.lease_term_months + ' mo)' : '—') +
      headlineCell('Commencement', fmtDate(meta.commencement_date)) +
      headlineCell('Expiration', fmtDate(meta.expiration_date)) +
      headlineCell('Base Rent', meta.base_rent_rsf_yr ? '$' + meta.base_rent_rsf_yr.toFixed(2) + '/RSF/yr' : '—') +
      headlineCell('Free Rent', meta.free_rent_months != null ? meta.free_rent_months + ' mo' : '—') +
      headlineCell('TI Allowance', meta.ti_allowance_rsf ? '$' + meta.ti_allowance_rsf.toFixed(2) + '/RSF' : '—') +
      headlineCell('Security Deposit', meta.security_deposit ? fmtCurrency(meta.security_deposit) : '—') +
      headlineCell('Rent Basis', escapeHtml(meta.rent_basis || '—')) +
      headlineCell('Renewal', escapeHtml(meta.renewal_options_summary || 'None mentioned')) +
    '</div>'

    // Risk overview strip
    html += '<div class="lease-risk-strip">' +
      '<div class="lease-risk-pill lease-risk-high">' + (counts.high_risk || 0) + ' high-risk clauses</div>' +
      '<div class="lease-risk-pill lease-risk-medium">' + (counts.medium_risk || 0) + ' medium</div>' +
      '<div class="lease-risk-pill lease-risk-low">' + (counts.low_risk || 0) + ' low</div>' +
      '<div class="lease-risk-meta">' + (counts.total_clauses || 0) + ' clauses extracted</div>' +
    '</div>'

    // Top risks callout
    if (topRisks.length > 0) {
      html += '<div class="lease-top-risks">' +
        '<div class="lease-section-title">Top risks to negotiate</div>' +
        '<ul class="lease-risk-list">'
      topRisks.forEach(function (r) {
        html += '<li><strong>' + escapeHtml(r.label || r.type) + '</strong>'
          + (r.section ? ' <span class="lease-risk-section">(' + escapeHtml(r.section) + ')</span>' : '')
          + '<div class="lease-risk-rationale">' + escapeHtml(r.rationale || '') + '</div></li>'
      })
      html += '</ul></div>'
    }

    // Clauses by group
    GROUP_ORDER.forEach(function (g) {
      var list = byGroup[g] || []
      if (list.length === 0) return
      html += '<div class="lease-group">' +
        '<div class="lease-group-header">' + escapeHtml(GROUP_LABELS[g] || g) + ' <span class="lease-group-count">' + list.length + '</span></div>' +
        '<div class="lease-clause-list">'
      list.forEach(function (c) {
        var risk = RISK_STYLES[c.risk_level] || RISK_STYLES.unknown
        html += '<div class="lease-clause-card">' +
          '<div class="lease-clause-head">' +
            '<div class="lease-clause-type">' + escapeHtml(clauseTypeLabel(c.type)) + '</div>' +
            (c.section ? '<div class="lease-clause-section">' + escapeHtml(c.section) + '</div>' : '') +
            '<div class="lease-clause-risk" style="color:' + risk.fg + ';background:' + risk.bg + '">' + risk.label + '</div>' +
          '</div>' +
          (c.heading ? '<div class="lease-clause-heading">' + escapeHtml(c.heading) + '</div>' : '') +
          (c.summary ? '<div class="lease-clause-summary">' + escapeHtml(c.summary) + '</div>' : '') +
          renderKeyTerms(c.key_terms) +
          (c.original_excerpt ? '<details class="lease-clause-quote-wrap"><summary>Show source excerpt</summary><blockquote class="lease-clause-quote">' + escapeHtml(c.original_excerpt) + '</blockquote></details>' : '') +
          (c.risk_rationale ? '<div class="lease-clause-rationale"><span class="lease-clause-rationale-label">Why this matters:</span> ' + escapeHtml(c.risk_rationale) + '</div>' : '') +
        '</div>'
      })
      html += '</div></div>'
    })

    html += '</div>'
    return html
  }

  function headlineCell(label, value) {
    return '<div class="lease-headline-cell"><div class="lease-headline-label">' + escapeHtml(label) + '</div><div class="lease-headline-value">' + value + '</div></div>'
  }

  function renderKeyTerms(kt) {
    if (!kt || typeof kt !== 'object') return ''
    var keys = Object.keys(kt)
    if (keys.length === 0) return ''
    var html = '<div class="lease-clause-keyterms">'
    keys.forEach(function (k) {
      var v = kt[k]
      if (v == null || v === '') return
      var displayKey = k.replace(/_/g, ' ').replace(/\b\w/g, function (m) { return m.toUpperCase() })
      html += '<div class="lease-keyterm"><span class="lease-keyterm-key">' + escapeHtml(displayKey) + '</span><span class="lease-keyterm-val">' + escapeHtml(typeof v === 'object' ? JSON.stringify(v) : v) + '</span></div>'
    })
    html += '</div>'
    return html
  }

  // Mirror of LEASE_CLAUSE_TYPES (must stay in sync with src/lib/lease-clause-taxonomy.ts)
  var TYPE_META = {
    rent_base:             { group: 'economics', label: 'Base Rent' },
    rent_abatement:        { group: 'economics', label: 'Free Rent / Abatement' },
    opex_passthrough:      { group: 'economics', label: 'Operating Expenses' },
    opex_caps:             { group: 'economics', label: 'Opex Caps / Base Year' },
    security_deposit:      { group: 'economics', label: 'Security Deposit' },
    parking:               { group: 'economics', label: 'Parking' },
    tenant_improvements:   { group: 'economics', label: 'Tenant Improvements' },
    term_dates:            { group: 'term',      label: 'Term & Key Dates' },
    renewal_options:       { group: 'term',      label: 'Renewal Options' },
    expansion_rights:      { group: 'term',      label: 'Expansion Rights' },
    termination_rights:    { group: 'term',      label: 'Termination Rights' },
    holdover:              { group: 'term',      label: 'Holdover' },
    permitted_use:         { group: 'use',       label: 'Permitted Use' },
    alterations:           { group: 'use',       label: 'Alterations' },
    signage:               { group: 'use',       label: 'Signage' },
    subletting_assignment: { group: 'use',       label: 'Sublet & Assignment' },
    maintenance_repair:    { group: 'risk',      label: 'Maintenance & Repair' },
    services_utilities:    { group: 'risk',      label: 'Services & Utilities' },
    insurance:             { group: 'risk',      label: 'Insurance' },
    indemnity:             { group: 'risk',      label: 'Indemnification' },
    casualty_condemnation: { group: 'risk',      label: 'Casualty & Condemnation' },
    default_remedies:      { group: 'risk',      label: 'Default & Remedies' },
    estoppel_snda:         { group: 'risk',      label: 'Estoppel & SNDA' },
    surrender:             { group: 'risk',      label: 'Surrender Condition' },
    other:                 { group: 'misc',      label: 'Other' },
  }
  function clauseTypeGroup(t) { return (TYPE_META[t] && TYPE_META[t].group) || 'misc' }
  function clauseTypeLabel(t) { return (TYPE_META[t] && TYPE_META[t].label) || (t || 'Other') }

  function bindSummaryHandlers(overlay, lease) {
    overlay.querySelectorAll('[data-action="close"]').forEach(function (el) {
      el.addEventListener('click', function () { overlay.remove() })
    })
  }

  // ================================================================
  // LEASE PAGE (TAB) - building tiles like Financials
  // ================================================================
  async function leasePageInit() {
    var root = document.getElementById('lease-page-root')
    if (!root) return
    root.innerHTML = '<div class="lease-page-loading"><div class="lease-spinner"></div> Loading leases...</div>'

    var pid = getProjectId()
    try {
      var resp = await fetch('/api/lease?projectId=' + encodeURIComponent(pid))
      var data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Failed to load leases')
      var leases = Array.isArray(data) ? data : []
      renderLeasePage(root, leases)
    } catch (e) {
      root.innerHTML = '<div class="lease-page-error">Could not load leases: ' + escapeHtml(e.message) + '</div>'
    }
  }

  function renderLeasePage(root, leases) {
    var canUpload = (typeof hasAdminAccess === 'function') ? hasAdminAccess() : true

    // Group by building_address
    var byBuilding = {}
    leases.forEach(function (l) {
      var key = (l.building_address || 'Unknown').trim()
      if (!byBuilding[key]) byBuilding[key] = []
      byBuilding[key].push(l)
    })
    var buildingList = Object.keys(byBuilding).map(function (k) {
      var versions = byBuilding[k].sort(function (a, b) { return b.version_number - a.version_number })
      var latest = versions[0]
      return {
        address: k,
        versions: versions,
        latest: latest,
        latestUpdated: versions.reduce(function (max, v) {
          var t = new Date(v.updated_at || v.created_at).getTime()
          return t > max ? t : max
        }, 0),
      }
    }).sort(function (a, b) { return b.latestUpdated - a.latestUpdated })

    // Header
    var html = '<div class="lease-page-header">' +
      '<div>' +
        '<div class="lease-page-eyebrow">Lease Review · BETA</div>' +
        '<div class="lease-page-title">Leases</div>' +
        '<div class="lease-page-subtitle">Upload, extract, and review lease documents at the building level</div>' +
      '</div>' +
      (canUpload
        ? '<button class="lease-btn-primary" id="lease-page-upload-btn">' +
            '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
            'Upload New Lease' +
          '</button>'
        : '') +
    '</div>'

    // Empty state
    if (buildingList.length === 0) {
      html += '<div class="lease-page-empty">' +
        '<div class="lease-page-empty-icon">' +
          '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#cbd5e1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
        '</div>' +
        '<div class="lease-page-empty-title">No leases uploaded yet</div>' +
        '<div class="lease-page-empty-hint">Upload a lease PDF or DOCX and the AI will extract clauses, score risks, and surface key terms.</div>' +
        (canUpload ? '<button class="lease-btn-primary" id="lease-page-upload-btn" style="margin-top:14px">Upload First Lease</button>' : '') +
      '</div>'
      root.innerHTML = html
      bindLeasePageHandlers(root)
      return
    }

    // Building tiles
    html += '<div class="lease-tile-grid">'
    buildingList.forEach(function (b) {
      var latest = b.latest
      var meta = (latest.extraction_json && latest.extraction_json.document_meta) || {}
      var counts = (latest.summary_json && latest.summary_json.counts) || {}
      var statusBadge = renderExtractionStatusBadge(latest.extraction_status)
      html += '<div class="lease-tile" data-address="' + escapeHtml(b.address) + '">' +
        '<div class="lease-tile-header">' +
          '<div class="lease-tile-title-wrap">' +
            '<div class="lease-tile-title">' + escapeHtml(b.address) + '</div>' +
            '<div class="lease-tile-tenant">' + escapeHtml(meta.tenant_name || meta.landlord_name || '—') + '</div>' +
          '</div>' +
          statusBadge +
        '</div>' +
        '<div class="lease-tile-stats">' +
          '<div class="lease-tile-stat">' +
            '<div class="lease-tile-stat-label">Versions</div>' +
            '<div class="lease-tile-stat-value">' + b.versions.length + '</div>' +
          '</div>' +
          '<div class="lease-tile-stat">' +
            '<div class="lease-tile-stat-label">Clauses</div>' +
            '<div class="lease-tile-stat-value">' + (counts.total_clauses || 0) + '</div>' +
          '</div>' +
          '<div class="lease-tile-stat">' +
            '<div class="lease-tile-stat-label">High Risk</div>' +
            '<div class="lease-tile-stat-value lease-tile-stat-risk-high">' + (counts.high_risk || 0) + '</div>' +
          '</div>' +
          '<div class="lease-tile-stat">' +
            '<div class="lease-tile-stat-label">RSF</div>' +
            '<div class="lease-tile-stat-value">' + (meta.rsf ? Number(meta.rsf).toLocaleString() : '—') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="lease-tile-versions">' +
          '<div class="lease-tile-versions-label">Versions</div>' +
          b.versions.map(function (v) { return renderVersionRow(v, b.versions) }).join('') +
        '</div>' +
        '<div class="lease-tile-footer">' +
          (b.versions.length >= 2
            ? '<button class="lease-tile-compare-btn" data-action="compare" data-address="' + escapeHtml(b.address) + '">' +
                '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>' +
                'Compare Versions' +
              '</button>'
            : '') +
          (canUpload
            ? '<button class="lease-tile-add-btn" data-action="add-version" data-address="' + escapeHtml(b.address) + '">+ Add new version for this building</button>'
            : '') +
        '</div>' +
      '</div>'
    })
    html += '</div>'

    root.innerHTML = html
    bindLeasePageHandlers(root)
  }

  function renderVersionRow(v, allVersions) {
    var risk = (v.summary_json && v.summary_json.counts) || {}
    var dt = v.created_at ? new Date(v.created_at) : null
    var dateStr = dt ? dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
    var isMerged = v.generation_method === 'merged_counters'
    var hasSource = !!v.source_url

    // Find a predecessor for the track-changes export.
    // Priority: based_on_version_id > parent_version_id > the previous version_number
    var predecessorId = v.based_on_version_id || v.parent_version_id || null
    if (!predecessorId && Array.isArray(allVersions)) {
      var prior = allVersions
        .filter(function (x) { return x.id !== v.id && (x.version_number || 0) < (v.version_number || 0) })
        .sort(function (a, b) { return (b.version_number || 0) - (a.version_number || 0) })
      if (prior.length > 0) predecessorId = prior[0].id
    }
    var canTrackChanges = !!predecessorId

    return '<div class="lease-version-row" data-lease-id="' + escapeHtml(v.id) + '" data-source-url="' + escapeHtml(v.source_url || '') + '">' +
      '<div class="lease-version-meta">' +
        '<div class="lease-version-label">' + escapeHtml(v.version_label || ('v' + v.version_number)) +
          (isMerged ? ' <span class="lease-version-badge-ai" title="Generated by Save-as-version">AI</span>' : '') +
        '</div>' +
        '<div class="lease-version-doctype">' + escapeHtml(DOC_TYPE_LABELS[v.doc_type] || v.doc_type) + '</div>' +
      '</div>' +
      '<div class="lease-version-date">' + escapeHtml(dateStr) + '</div>' +
      '<div class="lease-version-risks">' +
        (risk.high_risk ? '<span class="lease-version-risk lease-version-risk-high">' + risk.high_risk + ' high</span>' : '') +
        (risk.medium_risk ? '<span class="lease-version-risk lease-version-risk-medium">' + risk.medium_risk + ' med</span>' : '') +
      '</div>' +
      '<div class="lease-version-actions">' +
        (canTrackChanges
          ? '<button class="lease-version-action-btn lease-version-action-tc" data-action="download-track-changes" data-v1-id="' + escapeHtml(predecessorId) + '" data-v2-id="' + escapeHtml(v.id) + '" title="Download Word document with track changes vs prior version">' +
              '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="10" y1="13" x2="14" y2="13" stroke-dasharray="2 2"/><line x1="10" y1="17" x2="14" y2="17" stroke-dasharray="2 2"/></svg>' +
              '<span class="lease-version-action-label">Track Changes</span>' +
            '</button>'
          : '') +
        (hasSource ? '<a class="lease-version-action-btn" href="' + escapeHtml(v.source_url) + '" target="_blank" rel="noopener" data-action="download-source" title="Download clean source ' + (isMerged ? 'DOCX (no markup)' : 'file') + '">' +
          '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
        '</a>' : '') +
        '<button class="lease-version-action-btn lease-version-action-danger" data-action="delete-version" data-lease-id="' + escapeHtml(v.id) + '" title="Archive this version">' +
          '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>' +
        '</button>' +
      '</div>' +
    '</div>'
  }

  function renderExtractionStatusBadge(status) {
    // Done = neutral gray (it's the resting state); error = red (only signal that matters here)
    var map = {
      pending:    { fg: '#94A3B8', bg: '#F8FAFC', label: 'Pending' },
      extracting: { fg: '#1E40AF', bg: '#EFF6FF', label: 'Extracting...' },
      done:       { fg: '#475569', bg: '#F1F5F9', label: 'Ready' },
      error:      { fg: '#B91C1C', bg: '#FEF2F2', label: 'Error' },
    }
    var s = map[status] || map.pending
    return '<div class="lease-tile-status" style="color:' + s.fg + ';background:' + s.bg + '">' + s.label + '</div>'
  }

  function bindLeasePageHandlers(root) {
    // Upload buttons
    root.querySelectorAll('#lease-page-upload-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { leaseShowUploadModal() })
    })
    // Version row click - open summary (but ignore clicks on action buttons)
    root.querySelectorAll('.lease-version-row').forEach(function (row) {
      row.addEventListener('click', function (e) {
        // Don't open summary when user clicks the inline action buttons
        if (e.target.closest('.lease-version-actions')) return
        var id = row.getAttribute('data-lease-id')
        if (id) leaseShowSummary(id)
      })
    })
    // Download source button - just let the anchor's href fire, but stop propagation
    root.querySelectorAll('[data-action="download-source"]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.stopPropagation() })
    })
    // Delete (archive) version button
    root.querySelectorAll('[data-action="delete-version"]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation()
        var id = b.getAttribute('data-lease-id')
        if (!id) return
        if (!confirm('Archive this version? It will be hidden but can be recovered later by an admin.')) return
        archiveVersion(id)
      })
    })
    // Track Changes DOCX button - generates v(N-1) -> v(N) redline DOCX
    root.querySelectorAll('[data-action="download-track-changes"]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation()
        var v1Id = b.getAttribute('data-v1-id')
        var v2Id = b.getAttribute('data-v2-id')
        if (!v1Id || !v2Id) return
        downloadTrackChangesDocx(v1Id, v2Id, b)
      })
    })
    // Add version for specific building
    root.querySelectorAll('[data-action="add-version"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation()
        var addr = btn.getAttribute('data-address')
        leaseShowUploadModal({ presetBuildingAddress: addr })
      })
    })
    // Compare versions button
    root.querySelectorAll('[data-action="compare"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation()
        var addr = btn.getAttribute('data-address')
        leaseShowComparePicker(addr)
      })
    })
  }

  async function downloadTrackChangesDocx(v1Id, v2Id, btnEl) {
    // Show inline loading state on the button
    var origHtml = btnEl.innerHTML
    btnEl.disabled = true
    btnEl.innerHTML = '<div class="lease-spinner" style="display:inline-block;width:11px;height:11px;border-width:1.5px;"></div><span class="lease-version-action-label">Generating...</span>'

    try {
      var resp = await fetch('/api/lease/export-redline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ v1Id: v1Id, v2Id: v2Id }),
      })
      if (!resp.ok) {
        var err = await resp.json().catch(function () { return {} })
        throw new Error(err.error || 'Track-changes export failed')
      }
      var blob = await resp.blob()
      var url = URL.createObjectURL(blob)
      var a = document.createElement('a')
      a.href = url
      a.download = 'Lease Redline (Track Changes) - ' + new Date().toISOString().slice(0, 10) + '.docx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(function () { URL.revokeObjectURL(url) }, 5000)
    } catch (e) {
      alert('Track-changes export failed: ' + e.message)
    } finally {
      btnEl.disabled = false
      btnEl.innerHTML = origHtml
    }
  }

  async function archiveVersion(id) {
    try {
      var resp = await fetch('/api/lease?id=' + encodeURIComponent(id), { method: 'DELETE' })
      if (!resp.ok) {
        var err = await resp.json().catch(function () { return {} })
        throw new Error(err.error || 'Archive failed')
      }
      // Reload the leases tab
      if (typeof leasePageInit === 'function') leasePageInit()
    } catch (e) {
      alert('Archive failed: ' + e.message)
    }
  }

  // ================================================================
  // COMPARE VERSIONS
  // ================================================================
  // Picker: choose which two versions to compare for this building
  function leaseShowComparePicker(buildingAddress) {
    fetch('/api/lease?projectId=' + encodeURIComponent(getProjectId()) + '&buildingAddress=' + encodeURIComponent(buildingAddress))
      .then(function (r) { return r.json() })
      .then(function (versions) {
        if (!Array.isArray(versions) || versions.length < 2) {
          alert('Need at least 2 versions to compare for this building.')
          return
        }
        // Default: newest (v2) compared to second-newest (v1)
        var sorted = versions.slice().sort(function (a, b) { return b.version_number - a.version_number })
        var newer = sorted[0]
        var older = sorted[1]

        // If exactly 2, skip picker and go straight to compare
        if (sorted.length === 2) {
          leaseRunCompare(older.id, newer.id)
          return
        }

        // Build picker modal
        var modal = document.createElement('div')
        modal.className = 'lease-modal-overlay'
        var optsHtml = sorted.map(function (v) {
          return '<option value="' + escapeHtml(v.id) + '">' + escapeHtml(v.version_label || ('v' + v.version_number)) + ' — ' + escapeHtml(DOC_TYPE_LABELS[v.doc_type] || v.doc_type) + '</option>'
        }).join('')
        modal.innerHTML = '<div class="lease-modal-card" style="width:520px">' +
          '<div class="lease-modal-header"><div class="lease-modal-title">Compare Versions</div><button class="lease-modal-close">×</button></div>' +
          '<div class="lease-modal-body">' +
            '<div class="lease-form-group"><label class="lease-form-label">Earlier version (v1)</label><select id="lease-cmp-v1" class="lease-form-input">' + optsHtml + '</select></div>' +
            '<div class="lease-form-group"><label class="lease-form-label">Later version (v2)</label><select id="lease-cmp-v2" class="lease-form-input">' + optsHtml + '</select></div>' +
          '</div>' +
          '<div class="lease-modal-footer">' +
            '<button class="lease-btn-secondary" data-action="cancel">Cancel</button>' +
            '<button class="lease-btn-primary" data-action="go">Run comparison</button>' +
          '</div>' +
        '</div>'
        document.body.appendChild(modal)
        modal.querySelector('#lease-cmp-v1').value = older.id
        modal.querySelector('#lease-cmp-v2').value = newer.id
        var close = function () { modal.remove() }
        modal.querySelector('.lease-modal-close').addEventListener('click', close)
        modal.querySelector('[data-action="cancel"]').addEventListener('click', close)
        modal.querySelector('[data-action="go"]').addEventListener('click', function () {
          var a = modal.querySelector('#lease-cmp-v1').value
          var b = modal.querySelector('#lease-cmp-v2').value
          if (a === b) { alert('Pick two different versions'); return }
          modal.remove()
          leaseRunCompare(a, b)
        })
      })
  }

  // Run comparison and show overlay
  async function leaseRunCompare(v1Id, v2Id, opts) {
    opts = opts || {}
    var overlay
    if (opts.replaceOverlay) {
      overlay = opts.replaceOverlay
    } else {
      overlay = document.createElement('div')
      overlay.className = 'lease-summary-overlay'
      document.body.appendChild(overlay)
    }
    var loadingMsg = opts.regenerate
      ? 'Regenerating AI summary (30–60 sec)...'
      : 'Comparing versions and generating change summary (30–60 sec)...'
    overlay.innerHTML = '<div class="lease-summary-card"><div class="lease-summary-loading"><div class="lease-spinner"></div> ' + loadingMsg + '</div></div>'

    try {
      var resp = await fetch('/api/lease/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          v1Id: v1Id,
          v2Id: v2Id,
          regenerateAi: !!opts.regenerate,
          userEmail: getUserEmail(),
        }),
      })
      var data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Compare failed')

      // Pull building scope from one of the source documents so we can fetch negotiations
      var buildingAddress = null
      var projectId = getProjectId()
      try {
        var docResp = await fetch('/api/lease?id=' + encodeURIComponent(v2Id))
        var docData = await docResp.json()
        if (docResp.ok && docData) {
          buildingAddress = docData.building_address
          projectId = docData.project_id || projectId
        }
      } catch (_) { /* best effort */ }

      // Fetch negotiation statuses for this building (in parallel-ish, after compare)
      var negotiationMap = {}
      if (buildingAddress) {
        try {
          var negResp = await fetch('/api/lease/negotiation?projectId=' + encodeURIComponent(projectId) + '&buildingAddress=' + encodeURIComponent(buildingAddress))
          var negData = await negResp.json()
          if (negResp.ok && negData) negotiationMap = negData
        } catch (_) { /* non-critical */ }
      }

      // Stash for export + regenerate + status update handlers
      overlay.__compareData = data
      overlay.__compareV1Id = v1Id
      overlay.__compareV2Id = v2Id
      overlay.__projectId = projectId
      overlay.__buildingAddress = buildingAddress
      overlay.__negotiationMap = negotiationMap
      overlay.__compareId = data.compare_id || null

      overlay.innerHTML = renderCompareHtml(data, negotiationMap)
      bindCompareHandlers(overlay)
    } catch (e) {
      overlay.innerHTML = '<div class="lease-summary-card"><div class="lease-summary-error">Compare failed: ' + escapeHtml(e.message) + '<br><br><button class="lease-btn-secondary" onclick="this.closest(\'.lease-summary-overlay\').remove()">Close</button></div></div>'
    }
  }

  function renderCompareHtml(diff, negotiationMap) {
    var clauseDiffs = diff.clauseDiffs || []
    var counts = diff.counts || {}
    var risk = diff.riskDelta || {}
    negotiationMap = negotiationMap || {}

    // Compute open/closed counts across all clauses (only for clauses that actually appear)
    var openCount = 0, resolvedCount = 0
    clauseDiffs.forEach(function (cd) {
      var n = negotiationMap[cd.type]
      var status = (n && n.status) || 'open_issue'
      var meta = NEG_STATUS_BY_KEY[status] || NEG_STATUS_BY_KEY.open_issue
      if (meta.isResolved) resolvedCount++
      else openCount++
    })

    var html = '<div class="lease-summary-card lease-summary-full lease-compare-card">'

    // Header (with cache indicator + export/regenerate actions)
    var cachedAtStr = ''
    if (diff.cached_at) {
      try {
        var dt = new Date(diff.cached_at)
        cachedAtStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' at ' + dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      } catch (e) { cachedAtStr = '' }
    }
    var genCount = diff.generation_count || 1
    var staleNote = diff.was_stale ? ' (refreshed - source extraction changed)' : ''
    var genCountSuffix = genCount > 1 ? ' · ' + genCount + 'x' : ''
    var fromCacheBadge = diff.from_cache
      ? '<span class="lease-cmp-cache-badge" title="Loaded from saved comparison. Click Regenerate to refresh.">Saved' + (cachedAtStr ? ' · ' + escapeHtml(cachedAtStr) : '') + genCountSuffix + '</span>'
      : (diff.cached_at ? '<span class="lease-cmp-cache-badge lease-cmp-cache-fresh" title="Just generated' + escapeHtml(staleNote) + '">Fresh · ' + escapeHtml(cachedAtStr) + genCountSuffix + '</span>' : '')

    html += '<div class="lease-summary-header">' +
      '<div>' +
        '<div class="lease-summary-eyebrow">Compare Versions ' + fromCacheBadge + '</div>' +
        '<div class="lease-summary-title">' + escapeHtml(diff.v1_label || 'v1') + ' → ' + escapeHtml(diff.v2_label || 'v2') + '</div>' +
        '<div class="lease-summary-subtitle">' + escapeHtml(DOC_TYPE_LABELS[diff.v1_doc_type] || diff.v1_doc_type || '') + ' → ' + escapeHtml(DOC_TYPE_LABELS[diff.v2_doc_type] || diff.v2_doc_type || '') + '</div>' +
      '</div>' +
      '<div class="lease-summary-actions">' +
        '<button class="lease-btn-secondary" data-action="export-excel" title="Download as Excel file">' +
          '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
          'Excel' +
        '</button>' +
        '<button class="lease-btn-secondary" data-action="export-sheets" title="Save to Google Sheets">' +
          '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
          'Google Sheets' +
        '</button>' +
        '<button class="lease-btn-secondary" data-action="open-word-menu" title="Word document exports" style="position:relative;">' +
          '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>' +
          'Word' +
          '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px;"><polyline points="6 9 12 15 18 9"/></svg>' +
        '</button>' +
        '<button class="lease-btn-primary" data-action="build-new-version" title="Assemble a new lease version from your counters">' +
          '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><path d="M12 5v14"/><path d="M5 12h14"/></svg>' +
          'Build New Version' +
        '</button>' +
        '<button class="lease-btn-secondary" data-action="regenerate" title="Regenerate AI summary with a fresh pass">' +
          '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>' +
          'Regenerate' +
        '</button>' +
        '<button class="lease-btn-secondary" data-action="close">Close</button>' +
      '</div>' +
    '</div>'

    // AI summary
    if (diff.ai_summary) {
      html += '<div class="lease-compare-ai">' +
        '<div class="lease-compare-ai-label">AI Change Summary</div>' +
        '<div class="lease-compare-ai-text">' + diff.ai_summary.split(/\n\n+/).map(function (p) { return '<p>' + escapeHtml(p) + '</p>' }).join('') + '</div>' +
      '</div>'
    }

    // Headline strip
    var netLabel = ''
    var netClass = 'lease-compare-headline-neutral'
    if (risk.net_high_risk_change > 0) {
      netLabel = '+' + risk.net_high_risk_change + ' new high-risk clause' + (risk.net_high_risk_change > 1 ? 's' : '')
      netClass = 'lease-compare-headline-worse'
    } else if (risk.net_high_risk_change < 0) {
      netLabel = Math.abs(risk.net_high_risk_change) + ' high-risk clause' + (Math.abs(risk.net_high_risk_change) > 1 ? 's' : '') + ' resolved'
      netClass = 'lease-compare-headline-better'
    } else {
      netLabel = 'No change in high-risk count'
    }

    html += '<div class="lease-compare-headline ' + netClass + '">' +
      '<div class="lease-compare-headline-cells">' +
        '<div class="lease-compare-headline-cell"><div class="lease-compare-headline-label">Modified</div><div class="lease-compare-headline-value">' + (counts.modified || 0) + '</div></div>' +
        '<div class="lease-compare-headline-cell"><div class="lease-compare-headline-label">Added</div><div class="lease-compare-headline-value">' + (counts.added || 0) + '</div></div>' +
        '<div class="lease-compare-headline-cell"><div class="lease-compare-headline-label">Removed</div><div class="lease-compare-headline-value"' + ((counts.removed || 0) > 0 ? ' style="color:#B91C1C"' : '') + '>' + (counts.removed || 0) + '</div></div>' +
        '<div class="lease-compare-headline-cell"><div class="lease-compare-headline-label">Unchanged</div><div class="lease-compare-headline-value" style="color:#94A3B8">' + (counts.unchanged || 0) + '</div></div>' +
        '<div class="lease-compare-headline-cell"><div class="lease-compare-headline-label">Risk Worse</div><div class="lease-compare-headline-value"' + ((risk.worse || 0) > 0 ? ' style="color:#B91C1C"' : '') + '>' + (risk.worse || 0) + '</div></div>' +
        '<div class="lease-compare-headline-cell"><div class="lease-compare-headline-label">Risk Better</div><div class="lease-compare-headline-value">' + (risk.better || 0) + '</div></div>' +
        '<div class="lease-compare-headline-cell lease-compare-headline-net"><div class="lease-compare-headline-label">Net</div><div class="lease-compare-headline-value">' + escapeHtml(netLabel) + '</div></div>' +
      '</div>' +
    '</div>'

    // Filter toggle
    html += '<div class="lease-compare-filter">' +
      '<button class="lease-compare-filter-btn active" data-filter="all">All (' + clauseDiffs.length + ')</button>' +
      '<button class="lease-compare-filter-btn" data-filter="changed">Changed only (' + ((counts.modified || 0) + (counts.added || 0) + (counts.removed || 0)) + ')</button>' +
      '<button class="lease-compare-filter-btn" data-filter="high">Risk worsened (' + (risk.worse || 0) + ')</button>' +
      '<button class="lease-compare-filter-btn" data-filter="open">Open issues (' + openCount + ')</button>' +
      '<button class="lease-compare-filter-btn" data-filter="resolved">Resolved (' + resolvedCount + ')</button>' +
    '</div>'

    // Clause diff rows
    html += '<div class="lease-compare-list">'
    clauseDiffs.forEach(function (cd, idx) {
      html += renderClauseDiffRow(cd, idx, diff, negotiationMap)
    })
    html += '</div>'

    html += '</div>'
    return html
  }

  function renderClauseDiffRow(cd, idx, diff, negotiationMap) {
    var label = clauseTypeLabel(cd.type)
    var statusBadge = renderStatusBadge(cd.status, cd.riskDelta)
    var section = (cd.v1 && cd.v1.section) || (cd.v2 && cd.v2.section) || ''
    var risk1 = (cd.v1 && cd.v1.risk_level) || ''
    var risk2 = (cd.v2 && cd.v2.risk_level) || ''

    var negotiation = (negotiationMap && negotiationMap[cd.type]) || null
    var negStatus = (negotiation && negotiation.status) || 'open_issue'
    var negStatusMeta = NEG_STATUS_BY_KEY[negStatus] || NEG_STATUS_BY_KEY.open_issue
    var isResolved = negStatusMeta.isResolved
    var negNotes = (negotiation && negotiation.notes) || ''

    var rowClass = 'lease-cmp-row lease-cmp-row-' + cd.status
    if (cd.status === 'modified' && (cd.riskDelta || 0) > 0) rowClass += ' lease-cmp-row-worse'
    if (cd.status === 'modified' && (cd.riskDelta || 0) < 0) rowClass += ' lease-cmp-row-better'
    if (isResolved) rowClass += ' lease-cmp-row-resolved'

    var html = '<div class="' + rowClass + '" data-status="' + cd.status + '" data-risk-delta="' + (cd.riskDelta || 0) + '" data-neg-status="' + negStatus + '" data-clause-type="' + escapeHtml(cd.type) + '">' +
      '<div class="lease-cmp-row-head" data-action="toggle-row" data-row-idx="' + idx + '">' +
        '<div class="lease-cmp-row-head-left">' +
          statusBadge +
          '<div class="lease-cmp-row-label">' + escapeHtml(label) + '</div>' +
          (section ? '<div class="lease-cmp-row-section">' + escapeHtml(section) + '</div>' : '') +
          renderNegStatusPill(cd.type, negStatus) +
        '</div>' +
        '<div class="lease-cmp-row-head-right">' +
          (risk1 || risk2 ? renderRiskMovement(risk1, risk2) : '') +
          '<svg class="lease-cmp-row-chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
        '</div>' +
      '</div>' +
      '<div class="lease-cmp-row-body">' +
        renderClauseDiffBody(cd) +
        renderNegotiationWorkspace(cd.type, negStatus, negNotes, negotiation) +
      '</div>' +
    '</div>'
    return html
  }

  // Status pill that’s clickable - opens a small dropdown of options
  function renderNegStatusPill(clauseType, currentStatus) {
    var meta = NEG_STATUS_BY_KEY[currentStatus] || NEG_STATUS_BY_KEY.open_issue
    return '<button class="lease-cmp-neg-pill" data-action="open-neg-dropdown" data-clause-type="' + escapeHtml(clauseType) + '" ' +
      'style="color:' + meta.fg + ';background:' + meta.bg + ';border-color:' + meta.borderColor + '" ' +
      'title="Click to change negotiation status">' +
      escapeHtml(meta.label) +
      '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px;vertical-align:-1px;"><polyline points="6 9 12 15 18 9"/></svg>' +
    '</button>'
  }

  // Per-clause notes textarea + last-updated metadata + counter language (if exists)
  function renderNegotiationWorkspace(clauseType, status, notes, negotiation) {
    var lastUpdated = ''
    if (negotiation && negotiation.updated_at) {
      try {
        var dt = new Date(negotiation.updated_at)
        lastUpdated = ' · updated ' + dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        if (negotiation.last_updated_by) lastUpdated += ' by ' + negotiation.last_updated_by
        if (negotiation.status_changes && negotiation.status_changes > 1) lastUpdated += ' · ' + negotiation.status_changes + ' status changes'
      } catch (e) { /* skip */ }
    }

    var statusMeta = NEG_STATUS_BY_KEY[status] || NEG_STATUS_BY_KEY.open_issue
    var hasCounter = negotiation && negotiation.counter_language

    return '<div class="lease-cmp-neg-workspace" data-clause-type="' + escapeHtml(clauseType) + '">' +
      '<div class="lease-cmp-neg-workspace-header">' +
        '<div class="lease-cmp-neg-workspace-label">Negotiation Notes' + lastUpdated + '</div>' +
      '</div>' +
      '<textarea class="lease-cmp-neg-notes" data-action="save-neg-notes" data-clause-type="' + escapeHtml(clauseType) + '" ' +
        'placeholder="Add notes: counter terms, reasoning, next steps...">' + escapeHtml(notes || '') + '</textarea>' +
      renderCounterBuilder(clauseType, negotiation, statusMeta) +
    '</div>'
  }

  // ================================================================
  // COUNTER BUILDER (3-tab panel + existing counter card)
  // ================================================================
  function renderCounterBuilder(clauseType, negotiation, statusMeta) {
    var hasCounter = negotiation && negotiation.counter_language
    var prevInstructions = (negotiation && negotiation.counter_instructions) || ''
    var prevMode = (negotiation && negotiation.counter_mode) || 'auto'

    if (hasCounter) {
      var src = negotiation.counter_source || 'manual'
      var sourceLabel = src === 'ai_generated' ? 'AI-generated' : (src === 'ai_edited' ? 'AI-edited' : 'Manual')
      var modeBadge = prevMode && prevMode !== 'manual' ? '<span class="lease-cmp-counter-mode-badge">via ' + escapeHtml(prettyMode(prevMode)) + '</span>' : ''

      // Existing counter card with edit/regen/delete actions
      return '<div class="lease-cmp-counter-result" data-clause-type="' + escapeHtml(clauseType) + '">' +
        '<div class="lease-cmp-counter-label">Counter language ' +
          '<span class="lease-cmp-counter-badge">' + escapeHtml(sourceLabel) + '</span>' +
          modeBadge +
          '<div class="lease-cmp-counter-actions">' +
            '<button class="lease-cmp-counter-action" data-action="counter-edit" data-clause-type="' + escapeHtml(clauseType) + '" title="Edit text manually">Edit</button>' +
            '<button class="lease-cmp-counter-action" data-action="counter-refine" data-clause-type="' + escapeHtml(clauseType) + '" title="Ask AI to refine this counter">Ask AI to refine</button>' +
            '<button class="lease-cmp-counter-action" data-action="counter-regen" data-clause-type="' + escapeHtml(clauseType) + '" title="Regenerate from scratch">Regenerate</button>' +
            '<button class="lease-cmp-counter-action lease-cmp-counter-action-danger" data-action="counter-delete" data-clause-type="' + escapeHtml(clauseType) + '" title="Delete this counter">Delete</button>' +
          '</div>' +
        '</div>' +
        (negotiation.counter_rationale ? '<div class="lease-cmp-counter-rationale"><strong>Why:</strong> ' + escapeHtml(negotiation.counter_rationale) + '</div>' : '') +
        (prevInstructions ? '<div class="lease-cmp-counter-instructions-shown"><strong>Instructions used:</strong> ' + escapeHtml(prevInstructions) + '</div>' : '') +
        '<div class="lease-cmp-counter-text" data-counter-display>' + escapeHtml(negotiation.counter_language) + '</div>' +
      '</div>'
    }

    if (statusMeta.isResolved) return ''

    // No counter yet - show the 3-tab Counter Builder
    return '<div class="lease-cmp-counter-builder" data-clause-type="' + escapeHtml(clauseType) + '">' +
      '<div class="lease-cmp-builder-header">' +
        '<div class="lease-cmp-builder-label">Counter Builder</div>' +
        '<div class="lease-cmp-builder-tabs">' +
          '<button class="lease-cmp-builder-tab active" data-builder-tab="auto" data-clause-type="' + escapeHtml(clauseType) + '">AI Suggest</button>' +
          '<button class="lease-cmp-builder-tab" data-builder-tab="with_instructions" data-clause-type="' + escapeHtml(clauseType) + '">With Instructions</button>' +
          '<button class="lease-cmp-builder-tab" data-builder-tab="legal_drafter" data-clause-type="' + escapeHtml(clauseType) + '">Legal Drafter</button>' +
        '</div>' +
      '</div>' +
      '<div class="lease-cmp-builder-body" data-builder-body>' +
        renderBuilderModeBody('auto', clauseType, '') +
      '</div>' +
    '</div>'
  }

  function prettyMode(m) {
    if (m === 'auto') return 'AI Suggest'
    if (m === 'with_instructions') return 'Instructions'
    if (m === 'legal_drafter') return 'Legal Drafter'
    if (m === 'ai_edit') return 'AI refinement'
    if (m === 'manual') return 'manual edit'
    return m
  }

  function renderBuilderModeBody(mode, clauseType, prefilledInstructions) {
    if (mode === 'auto') {
      return '<div class="lease-cmp-builder-mode">' +
        '<div class="lease-cmp-builder-hint">Let AI propose a tenant-favorable counter without further input. AI will read the clause and the risk rationale automatically.</div>' +
        '<button class="lease-cmp-builder-go" data-action="builder-go" data-mode="auto" data-clause-type="' + escapeHtml(clauseType) + '">' +
          '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px;"><path d="M12 2v4"/><path d="M12 18v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="m16.24 16.24 2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/></svg>' +
          'Generate Counter' +
        '</button>' +
      '</div>'
    }
    if (mode === 'with_instructions') {
      return '<div class="lease-cmp-builder-mode">' +
        '<div class="lease-cmp-builder-hint">Tell the AI exactly what you want changed. Example: "Reduce lock-in from 6 to 3 months and add a one-time termination right at month 24."</div>' +
        '<textarea class="lease-cmp-builder-prompt" data-builder-prompt rows="3" placeholder="What do you want to change?">' + escapeHtml(prefilledInstructions || '') + '</textarea>' +
        '<button class="lease-cmp-builder-go" data-action="builder-go" data-mode="with_instructions" data-clause-type="' + escapeHtml(clauseType) + '">' +
          'Generate Counter from Instructions' +
        '</button>' +
      '</div>'
    }
    if (mode === 'legal_drafter') {
      return '<div class="lease-cmp-builder-mode">' +
        '<div class="lease-cmp-builder-hint">Describe what you want in plain English - AI will translate into proper lease drafting with defined terms, lease-style construction, and proper cross-references.</div>' +
        '<textarea class="lease-cmp-builder-prompt" data-builder-prompt rows="3" placeholder="Plain-English goal: e.g. \'We want 12 months free rent up front and a 9-month free-rent bank for years 2-5\'">' + escapeHtml(prefilledInstructions || '') + '</textarea>' +
        '<button class="lease-cmp-builder-go" data-action="builder-go" data-mode="legal_drafter" data-clause-type="' + escapeHtml(clauseType) + '">' +
          'Translate to Legal Language' +
        '</button>' +
      '</div>'
    }
    return ''
  }

  function renderStatusBadge(status, riskDelta) {
    // Diff status: bold blue for any CHANGE (modified/added), gray for unchanged.
    // Removed gets a subtle red since it's the destructive case.
    var styles = {
      unchanged: { bg: '#F1F5F9', fg: '#94A3B8', label: 'Unchanged' },
      modified:  { bg: '#EFF6FF', fg: '#1E40AF', label: 'Modified' },
      added:     { bg: '#EFF6FF', fg: '#1E40AF', label: 'Added' },
      removed:   { bg: '#FEF2F2', fg: '#B91C1C', label: 'Removed' },
    }
    var s = styles[status] || styles.unchanged
    return '<span class="lease-cmp-status-badge" style="background:' + s.bg + ';color:' + s.fg + '">' + s.label + '</span>'
  }

  function renderRiskMovement(r1, r2) {
    if (!r1 && !r2) return ''
    if (r1 === r2) return '<span class="lease-cmp-risk-badge">' + (r2 || r1) + '</span>'
    var arrow = '→'
    // Only flag when risk got WORSE - that's the only signal worth a color callout
    var rankOrder = { unknown: 0, low: 1, medium: 2, high: 3 }
    var d = (rankOrder[r2] || 0) - (rankOrder[r1] || 0)
    var color = d > 0 ? '#B91C1C' : '#475569'
    var weight = d > 0 ? 'font-weight:700;' : ''
    return '<span class="lease-cmp-risk-badge" style="color:' + color + ';' + weight + '">' + (r1 || '—') + ' ' + arrow + ' ' + (r2 || '—') + '</span>'
  }

  function renderClauseDiffBody(cd) {
    if (cd.status === 'added') {
      return '<div class="lease-cmp-side-only"><div class="lease-cmp-side-label">Added in later version</div>' +
        renderSingleClause(cd.v2, 'added') +
      '</div>'
    }
    if (cd.status === 'removed') {
      return '<div class="lease-cmp-side-only"><div class="lease-cmp-side-label">Removed in later version</div>' +
        renderSingleClause(cd.v1, 'removed') +
      '</div>'
    }

    var html = ''

    // Heading + section side by side
    html += '<div class="lease-cmp-twocol">' +
      '<div class="lease-cmp-col"><div class="lease-cmp-col-label">Earlier</div>' +
        '<div class="lease-cmp-col-heading">' + escapeHtml(cd.v1.heading || '') + '</div>' +
      '</div>' +
      '<div class="lease-cmp-col"><div class="lease-cmp-col-label">Later</div>' +
        '<div class="lease-cmp-col-heading">' + escapeHtml(cd.v2.heading || '') + '</div>' +
      '</div>' +
    '</div>'

    // Summary diff (single inline)
    if (cd.summaryOps && cd.summaryOps.some(function (o) { return o.op !== 'eq' })) {
      html += '<div class="lease-cmp-section">' +
        '<div class="lease-cmp-section-label">Summary changes</div>' +
        '<div class="lease-cmp-inline-diff">' + renderInlineOps(cd.summaryOps) + '</div>' +
      '</div>'
    } else if (cd.v2.summary) {
      html += '<div class="lease-cmp-section">' +
        '<div class="lease-cmp-section-label">Summary (unchanged)</div>' +
        '<div class="lease-cmp-quiet">' + escapeHtml(cd.v2.summary) + '</div>' +
      '</div>'
    }

    // Key terms diff
    var changedKeys = (cd.keyTermsDiff || []).filter(function (k) { return k.changed })
    if (changedKeys.length > 0) {
      html += '<div class="lease-cmp-section"><div class="lease-cmp-section-label">Key term changes</div>' +
        '<table class="lease-cmp-keyterms-table"><thead><tr><th>Term</th><th>Earlier</th><th>Later</th></tr></thead><tbody>'
      changedKeys.forEach(function (k) {
        var disp = k.key.replace(/_/g, ' ').replace(/\b\w/g, function (m) { return m.toUpperCase() })
        html += '<tr>' +
          '<td class="lease-cmp-keyterms-key">' + escapeHtml(disp) + '</td>' +
          '<td class="lease-cmp-keyterms-old">' + (k.v1 == null ? '<em>(none)</em>' : escapeHtml(typeof k.v1 === 'object' ? JSON.stringify(k.v1) : String(k.v1))) + '</td>' +
          '<td class="lease-cmp-keyterms-new">' + (k.v2 == null ? '<em>(none)</em>' : escapeHtml(typeof k.v2 === 'object' ? JSON.stringify(k.v2) : String(k.v2))) + '</td>' +
        '</tr>'
      })
      html += '</tbody></table></div>'
    }

    // Original excerpt diff
    if (cd.excerptOps && cd.excerptOps.some(function (o) { return o.op !== 'eq' })) {
      html += '<details class="lease-cmp-excerpt-wrap"><summary>Show language changes</summary>' +
        '<div class="lease-cmp-inline-diff lease-cmp-excerpt">' + renderInlineOps(cd.excerptOps) + '</div>' +
      '</details>'
    }

    // Risk rationale changes
    if ((cd.v1.risk_rationale || '') !== (cd.v2.risk_rationale || '')) {
      html += '<div class="lease-cmp-section lease-cmp-section-rationale">' +
        '<div class="lease-cmp-section-label">Risk rationale</div>' +
        '<div class="lease-cmp-twocol">' +
          '<div class="lease-cmp-col"><div class="lease-cmp-col-label">Earlier</div><div class="lease-cmp-quiet">' + escapeHtml(cd.v1.risk_rationale || '—') + '</div></div>' +
          '<div class="lease-cmp-col"><div class="lease-cmp-col-label">Later</div><div class="lease-cmp-quiet">' + escapeHtml(cd.v2.risk_rationale || '—') + '</div></div>' +
        '</div>' +
      '</div>'
    }

    return html
  }

  function renderSingleClause(c, kind) {
    if (!c) return ''
    return '<div class="lease-cmp-single">' +
      (c.heading ? '<div class="lease-cmp-col-heading">' + escapeHtml(c.heading) + '</div>' : '') +
      (c.summary ? '<div class="lease-cmp-summary">' + escapeHtml(c.summary) + '</div>' : '') +
      (c.original_excerpt ? '<details><summary>Show source language</summary><blockquote class="lease-clause-quote">' + escapeHtml(c.original_excerpt) + '</blockquote></details>' : '') +
    '</div>'
  }

  function renderInlineOps(ops) {
    return ops.map(function (o) {
      if (o.op === 'eq') return '<span>' + escapeHtml(o.text) + '</span>'
      if (o.op === 'ins') return '<ins class="lease-cmp-ins">' + escapeHtml(o.text) + '</ins>'
      return '<del class="lease-cmp-del">' + escapeHtml(o.text) + '</del>'
    }).join('')
  }

  function bindCompareHandlers(overlay) {
    overlay.querySelectorAll('[data-action="close"]').forEach(function (b) {
      b.addEventListener('click', function () { overlay.remove() })
    })
    // Regenerate AI summary
    overlay.querySelectorAll('[data-action="regenerate"]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v1 = overlay.__compareV1Id
        var v2 = overlay.__compareV2Id
        if (v1 && v2) leaseRunCompare(v1, v2, { regenerate: true, replaceOverlay: overlay })
      })
    })
    // Export to Excel (.xlsx download) - includes negotiation map
    overlay.querySelectorAll('[data-action="export-excel"]').forEach(function (b) {
      b.addEventListener('click', function () { exportCompareToWorkbook(overlay.__compareData, 'excel', overlay.__negotiationMap) })
    })
    // Export to Google Sheets
    overlay.querySelectorAll('[data-action="export-sheets"]').forEach(function (b) {
      b.addEventListener('click', function () { exportCompareToWorkbook(overlay.__compareData, 'sheets', overlay.__negotiationMap) })
    })
    // Word menu (3 export options)
    overlay.querySelectorAll('[data-action="open-word-menu"]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation()
        showWordExportMenu(overlay, b)
      })
    })
    // Build New Version - opens the redline editor
    overlay.querySelectorAll('[data-action="build-new-version"]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation()
        if (typeof leaseShowRedlineEditor === 'function') {
          leaseShowRedlineEditor(overlay.__compareV2Id)
        } else {
          alert('Redline editor not loaded. Please refresh the page.')
        }
      })
    })
    bindCounterBuilderHandlers(overlay)
    // Toggle row expand
    overlay.querySelectorAll('[data-action="toggle-row"]').forEach(function (head) {
      head.addEventListener('click', function () {
        var row = head.closest('.lease-cmp-row')
        if (row) row.classList.toggle('lease-cmp-row-open')
      })
    })
    // Expand changed rows by default
    overlay.querySelectorAll('.lease-cmp-row').forEach(function (row) {
      var s = row.getAttribute('data-status')
      if (s !== 'unchanged') row.classList.add('lease-cmp-row-open')
    })
    // Filter buttons
    overlay.querySelectorAll('.lease-compare-filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        overlay.querySelectorAll('.lease-compare-filter-btn').forEach(function (b) { b.classList.remove('active') })
        btn.classList.add('active')
        var f = btn.getAttribute('data-filter')
        overlay.querySelectorAll('.lease-cmp-row').forEach(function (row) {
          var st = row.getAttribute('data-status')
          var rd = parseInt(row.getAttribute('data-risk-delta') || '0')
          var negSt = row.getAttribute('data-neg-status') || 'open_issue'
          var negMeta = NEG_STATUS_BY_KEY[negSt] || NEG_STATUS_BY_KEY.open_issue
          var show
          if (f === 'all') show = true
          else if (f === 'changed') show = (st !== 'unchanged')
          else if (f === 'high') show = (st === 'modified' && rd > 0) || (st === 'added' && row.querySelector('[data-action="toggle-row"]'))
          else if (f === 'open') show = !negMeta.isResolved
          else if (f === 'resolved') show = negMeta.isResolved
          else show = true
          row.style.display = show ? '' : 'none'
        })
      })
    })

    // Negotiation status pill -> dropdown
    overlay.querySelectorAll('[data-action="open-neg-dropdown"]').forEach(function (pill) {
      pill.addEventListener('click', function (e) {
        e.stopPropagation()  // don't toggle row collapse
        showNegStatusDropdown(overlay, pill)
      })
    })

    // Notes textarea - save on blur, debounced typing
    overlay.querySelectorAll('[data-action="save-neg-notes"]').forEach(function (ta) {
      var saveTimer = null
      var save = function () {
        var clauseType = ta.getAttribute('data-clause-type')
        var notes = ta.value
        saveNegotiation(overlay, clauseType, { notes: notes })
      }
      ta.addEventListener('input', function () {
        if (saveTimer) clearTimeout(saveTimer)
        saveTimer = setTimeout(save, 1200)
      })
      ta.addEventListener('blur', function () {
        if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
        save()
      })
      // Don't toggle row when clicking inside textarea
      ta.addEventListener('click', function (e) { e.stopPropagation() })
      ta.addEventListener('mousedown', function (e) { e.stopPropagation() })
    })
  }

  // Inline dropdown for choosing a negotiation status
  function showNegStatusDropdown(overlay, pillEl) {
    // Close any existing dropdown
    var existing = overlay.querySelector('.lease-cmp-neg-dropdown')
    if (existing) existing.remove()

    var clauseType = pillEl.getAttribute('data-clause-type')
    var dropdown = document.createElement('div')
    dropdown.className = 'lease-cmp-neg-dropdown'
    dropdown.innerHTML = NEG_STATUSES.map(function (s) {
      return '<button class="lease-cmp-neg-dropdown-item" data-status="' + s.key + '" ' +
        'style="color:' + s.fg + ';" title="' + escapeHtml(s.description || '') + '">' +
        '<span class="lease-cmp-neg-dropdown-dot" style="background:' + s.fg + '"></span>' +
        '<span>' + escapeHtml(s.label) + '</span>' +
      '</button>'
    }).join('')

    // Position relative to pill
    var rect = pillEl.getBoundingClientRect()
    dropdown.style.position = 'fixed'
    dropdown.style.top  = (rect.bottom + 4) + 'px'
    dropdown.style.left = rect.left + 'px'
    dropdown.style.zIndex = '10001'
    document.body.appendChild(dropdown)

    var closeIt = function (e) {
      if (e && dropdown.contains(e.target)) return
      dropdown.remove()
      document.removeEventListener('click', closeIt, true)
    }
    setTimeout(function () { document.addEventListener('click', closeIt, true) }, 0)

    dropdown.querySelectorAll('.lease-cmp-neg-dropdown-item').forEach(function (b) {
      b.addEventListener('click', function () {
        var newStatus = b.getAttribute('data-status')
        dropdown.remove()
        document.removeEventListener('click', closeIt, true)
        saveNegotiation(overlay, clauseType, { status: newStatus })
      })
    })
  }

  // Save a negotiation update + optimistically reflect in the UI
  async function saveNegotiation(overlay, clauseType, fields) {
    var pid = overlay.__projectId
    var addr = overlay.__buildingAddress
    if (!pid || !addr || !clauseType) return

    // Optimistic UI update
    if (fields.status !== undefined) {
      applyOptimisticStatus(overlay, clauseType, fields.status)
    }

    try {
      var resp = await fetch('/api/lease/negotiation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: pid,
          buildingAddress: addr,
          clauseType: clauseType,
          status: fields.status,
          notes: fields.notes,
          lastCompareId: overlay.__compareId || null,
          userEmail: getUserEmail(),
        }),
      })
      var data = await resp.json()
      if (resp.ok && data) {
        // Update the local map with the canonical row
        if (!overlay.__negotiationMap) overlay.__negotiationMap = {}
        overlay.__negotiationMap[clauseType] = data
      }
    } catch (e) {
      console.warn('saveNegotiation failed:', e)
    }
  }

  function applyOptimisticStatus(overlay, clauseType, newStatus) {
    var meta = NEG_STATUS_BY_KEY[newStatus] || NEG_STATUS_BY_KEY.open_issue
    var rows = overlay.querySelectorAll('.lease-cmp-row[data-clause-type="' + clauseType + '"]')
    rows.forEach(function (row) {
      row.setAttribute('data-neg-status', newStatus)
      if (meta.isResolved) row.classList.add('lease-cmp-row-resolved')
      else row.classList.remove('lease-cmp-row-resolved')
      var pill = row.querySelector('.lease-cmp-neg-pill')
      if (pill) {
        pill.style.color = meta.fg
        pill.style.background = meta.bg
        pill.style.borderColor = meta.borderColor
        // Replace label text (preserve chevron icon)
        pill.firstChild.textContent = meta.label
      }
    })
    // Update local map
    if (!overlay.__negotiationMap) overlay.__negotiationMap = {}
    var existing = overlay.__negotiationMap[clauseType] || {}
    overlay.__negotiationMap[clauseType] = Object.assign({}, existing, { status: newStatus })
    // Refresh filter counts in filter bar
    updateFilterCounts(overlay)
  }

  function updateFilterCounts(overlay) {
    var allRows = overlay.querySelectorAll('.lease-cmp-row')
    var openCount = 0, resolvedCount = 0
    allRows.forEach(function (r) {
      var ns = r.getAttribute('data-neg-status') || 'open_issue'
      var m = NEG_STATUS_BY_KEY[ns] || NEG_STATUS_BY_KEY.open_issue
      if (m.isResolved) resolvedCount++
      else openCount++
    })
    var openBtn = overlay.querySelector('.lease-compare-filter-btn[data-filter="open"]')
    var resolvedBtn = overlay.querySelector('.lease-compare-filter-btn[data-filter="resolved"]')
    if (openBtn) openBtn.textContent = 'Open issues (' + openCount + ')'
    if (resolvedBtn) resolvedBtn.textContent = 'Resolved (' + resolvedCount + ')'
  }

  // ================================================================
  // WORD EXPORT MENU
  // ================================================================
  function showWordExportMenu(overlay, btnEl) {
    var existing = document.querySelector('.lease-cmp-word-menu')
    if (existing) existing.remove()

    var v1Id = overlay.__compareV1Id
    var v2Id = overlay.__compareV2Id
    var data = overlay.__compareData || {}
    var v1Label = data.v1_label || 'v1'
    var v2Label = data.v2_label || 'v2'

    var menu = document.createElement('div')
    menu.className = 'lease-cmp-word-menu lease-cmp-neg-dropdown'  // reuse dropdown styling
    menu.innerHTML =
      '<button class="lease-cmp-word-menu-item" data-word-action="redline">' +
        '<div class="lease-cmp-word-menu-title">Version Redline (' + escapeHtml(v1Label) + ' → ' + escapeHtml(v2Label) + ')</div>' +
        '<div class="lease-cmp-word-menu-desc">All differences as native Word track changes</div>' +
      '</button>' +
      '<button class="lease-cmp-word-menu-item" data-word-action="counter">' +
        '<div class="lease-cmp-word-menu-title">Tenant Counter Proposal</div>' +
        '<div class="lease-cmp-word-menu-desc">Your saved counters as track changes against ' + escapeHtml(v2Label) + '</div>' +
      '</button>' +
      '<button class="lease-cmp-word-menu-item" data-word-action="memo">' +
        '<div class="lease-cmp-word-menu-title">Negotiation Memo</div>' +
        '<div class="lease-cmp-word-menu-desc">Executive summary by clause + status (no markup)</div>' +
      '</button>'

    var rect = btnEl.getBoundingClientRect()
    menu.style.position = 'fixed'
    menu.style.top = (rect.bottom + 6) + 'px'
    menu.style.right = (window.innerWidth - rect.right) + 'px'
    menu.style.minWidth = '320px'
    menu.style.zIndex = '10001'
    document.body.appendChild(menu)

    var closeIt = function (e) {
      if (e && menu.contains(e.target)) return
      menu.remove()
      document.removeEventListener('click', closeIt, true)
    }
    setTimeout(function () { document.addEventListener('click', closeIt, true) }, 0)

    menu.querySelectorAll('[data-word-action]').forEach(function (item) {
      item.addEventListener('click', function () {
        var action = item.getAttribute('data-word-action')
        menu.remove()
        document.removeEventListener('click', closeIt, true)
        downloadWordExport(action, v1Id, v2Id, v1Label, v2Label)
      })
    })
  }

  async function downloadWordExport(kind, v1Id, v2Id, v1Label, v2Label) {
    var endpoint, body, fileNameHint
    var labelTag = (v1Label && v2Label) ? (' ' + v1Label + ' to ' + v2Label) : ''
    if (kind === 'redline') {
      endpoint = '/api/lease/export-redline'
      body = { v1Id: v1Id, v2Id: v2Id }
      fileNameHint = 'Lease Redline' + labelTag
    } else if (kind === 'counter') {
      endpoint = '/api/lease/export-counter'
      body = { v2Id: v2Id }
      fileNameHint = 'Tenant Counter' + (v2Label ? ' against ' + v2Label : '')
    } else if (kind === 'memo') {
      endpoint = '/api/lease/export-memo'
      body = { v1Id: v1Id, v2Id: v2Id }
      fileNameHint = 'Negotiation Memo' + labelTag
    } else {
      return
    }

    // Show a non-blocking toast
    var toast = showToast('Generating Word document...')
    try {
      var resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!resp.ok) {
        var errData
        try { errData = await resp.json() } catch (e) { errData = { error: resp.statusText } }
        toast.update('Word export failed: ' + (errData.error || 'Unknown error'), 'error')
        return
      }
      var blob = await resp.blob()
      var url = URL.createObjectURL(blob)
      var fileName = fileNameHint + ' - ' + new Date().toISOString().slice(0, 10) + '.docx'
      var a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(function () { URL.revokeObjectURL(url) }, 5000)
      toast.update('Word document downloaded.', 'success')
      setTimeout(function () { toast.dismiss() }, 2000)
    } catch (e) {
      toast.update('Network error: ' + e.message, 'error')
    }
  }

  function showToast(text) {
    var existing = document.querySelector('.lease-toast')
    if (existing) existing.remove()
    var t = document.createElement('div')
    t.className = 'lease-toast'
    t.innerHTML = '<div class="lease-spinner"></div><span class="lease-toast-text">' + escapeHtml(text) + '</span>'
    document.body.appendChild(t)
    return {
      update: function (newText, kind) {
        t.className = 'lease-toast' + (kind ? ' lease-toast-' + kind : '')
        t.innerHTML = '<span class="lease-toast-text">' + escapeHtml(newText) + '</span>'
      },
      dismiss: function () { try { t.remove() } catch (e) { /* ignore */ } },
    }
  }

  // ================================================================
  // COUNTER BUILDER HANDLERS
  // ================================================================
  function bindCounterBuilderHandlers(overlay) {
    // Tab switching
    overlay.querySelectorAll('[data-builder-tab]').forEach(function (tab) {
      tab.addEventListener('click', function (e) {
        e.stopPropagation()
        var clauseType = tab.getAttribute('data-clause-type')
        var mode = tab.getAttribute('data-builder-tab')
        var builder = overlay.querySelector('.lease-cmp-counter-builder[data-clause-type="' + clauseType + '"]')
        if (!builder) return
        // Update active tab
        builder.querySelectorAll('[data-builder-tab]').forEach(function (t) { t.classList.remove('active') })
        tab.classList.add('active')
        // Swap body
        var body = builder.querySelector('[data-builder-body]')
        if (body) body.innerHTML = renderBuilderModeBody(mode, clauseType, '')
        // Re-bind go button + textarea inside new body
        bindBuilderGoHandlers(overlay, builder)
      })
    })

    // Initial wire-up of go buttons + textareas
    overlay.querySelectorAll('.lease-cmp-counter-builder').forEach(function (builder) {
      bindBuilderGoHandlers(overlay, builder)
    })

    // Existing-counter actions: edit / refine / regen / delete
    overlay.querySelectorAll('[data-action="counter-edit"]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation()
        startManualEdit(overlay, b.getAttribute('data-clause-type'))
      })
    })
    overlay.querySelectorAll('[data-action="counter-refine"]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation()
        startAiRefine(overlay, b.getAttribute('data-clause-type'))
      })
    })
    overlay.querySelectorAll('[data-action="counter-regen"]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation()
        startRegenerate(overlay, b.getAttribute('data-clause-type'))
      })
    })
    overlay.querySelectorAll('[data-action="counter-delete"]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation()
        deleteCounter(overlay, b.getAttribute('data-clause-type'))
      })
    })
  }

  function bindBuilderGoHandlers(overlay, builder) {
    builder.querySelectorAll('[data-action="builder-go"]').forEach(function (b) {
      // De-dupe handler
      if (b.__bound) return
      b.__bound = true
      b.addEventListener('click', function (e) {
        e.stopPropagation()
        var clauseType = b.getAttribute('data-clause-type')
        var mode = b.getAttribute('data-mode')
        var promptEl = builder.querySelector('[data-builder-prompt]')
        var instructions = promptEl ? promptEl.value : ''
        runCounterGenerate(overlay, clauseType, { mode: mode, instructions: instructions, btnEl: b })
      })
    })
    // Prevent textarea clicks from collapsing the row
    builder.querySelectorAll('[data-builder-prompt]').forEach(function (ta) {
      if (ta.__bound) return
      ta.__bound = true
      ta.addEventListener('click', function (e) { e.stopPropagation() })
      ta.addEventListener('mousedown', function (e) { e.stopPropagation() })
    })
  }

  // Generate or regenerate via the API, mode-aware
  async function runCounterGenerate(overlay, clauseType, opts) {
    var v2Id = overlay.__compareV2Id
    if (!v2Id || !clauseType) return
    var mode = opts.mode || 'auto'
    var instructions = opts.instructions || ''
    var currentCounter = opts.currentCounter || ''
    var btnEl = opts.btnEl

    if ((mode === 'with_instructions' || mode === 'legal_drafter' || mode === 'ai_edit') && !instructions.trim()) {
      alert('Please describe what you want changed before generating.')
      return
    }

    var origLabel = btnEl ? btnEl.innerHTML : ''
    if (btnEl) {
      btnEl.disabled = true
      btnEl.innerHTML = '<div class="lease-spinner" style="display:inline-block;width:11px;height:11px;border-width:1.5px;color:currentColor;"></div> Generating...'
    }

    try {
      var resp = await fetch('/api/lease/counter-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          v2Id: v2Id,
          clauseType: clauseType,
          mode: mode,
          instructions: instructions,
          currentCounter: currentCounter,
          userEmail: getUserEmail(),
        }),
      })
      var data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Counter generation failed')

      var negMap = overlay.__negotiationMap || {}
      var existing = negMap[clauseType] || {}

      if (data.no_counter_needed) {
        // Show a small toast / message
        var row = overlay.querySelector('.lease-cmp-row[data-clause-type="' + clauseType + '"]')
        var workspace = row && row.querySelector('.lease-cmp-neg-workspace')
        if (workspace) {
          var msg = document.createElement('div')
          msg.className = 'lease-cmp-counter-result lease-cmp-counter-none'
          msg.innerHTML = '<strong>AI: no counter recommended.</strong> ' + escapeHtml(data.rationale || '')
          workspace.appendChild(msg)
          setTimeout(function () { try { msg.remove() } catch (e) {} }, 8000)
        }
        if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = origLabel }
        return
      }

      // Update local map
      negMap[clauseType] = Object.assign({}, existing, {
        counter_language: data.counter_language,
        counter_rationale: data.counter_rationale,
        counter_source: data.counter_source,
        counter_mode: data.counter_mode,
        counter_instructions: data.counter_instructions,
        counter_ai_model: data.counter_ai_model,
        counter_generated_at: data.counter_generated_at,
        status: existing.status === 'open_issue' ? 'counter_pending' : (existing.status || 'counter_pending'),
      })
      overlay.__negotiationMap = negMap

      // Replace the workspace HTML so the existing-counter card shows
      reRenderClauseRow(overlay, clauseType)
      applyOptimisticStatus(overlay, clauseType, negMap[clauseType].status)
    } catch (e) {
      console.error('counter generate failed:', e)
      alert('Counter generation failed: ' + e.message)
      if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = origLabel }
    }
  }

  // Re-render only the workspace inside a clause row (after status/counter update)
  function reRenderClauseRow(overlay, clauseType) {
    var row = overlay.querySelector('.lease-cmp-row[data-clause-type="' + clauseType + '"]')
    if (!row) return
    var workspace = row.querySelector('.lease-cmp-neg-workspace')
    if (!workspace) return

    var negMap = overlay.__negotiationMap || {}
    var negotiation = negMap[clauseType] || null
    var status = (negotiation && negotiation.status) || 'open_issue'
    var notes = (negotiation && negotiation.notes) || ''

    // Replace workspace innerHTML using same render function
    var newHtml = '<div class="lease-cmp-neg-workspace-header"></div>'  // dummy, fully replaced below
    var fresh = renderNegotiationWorkspace(clauseType, status, notes, negotiation)
    // fresh starts with <div class="lease-cmp-neg-workspace" ...> - we want only its contents
    var tmp = document.createElement('div')
    tmp.innerHTML = fresh
    var newInner = tmp.firstElementChild
    if (newInner) {
      workspace.innerHTML = newInner.innerHTML
      // Re-attach handlers for newly rendered children
      bindNotesHandlerForElement(overlay, workspace.querySelector('[data-action="save-neg-notes"]'))
      bindCounterBuilderHandlers(overlay)
    }
  }

  // Re-attach the notes textarea handler (called after re-render)
  function bindNotesHandlerForElement(overlay, ta) {
    if (!ta) return
    var saveTimer = null
    var save = function () {
      var clauseType = ta.getAttribute('data-clause-type')
      saveNegotiation(overlay, clauseType, { notes: ta.value })
    }
    ta.addEventListener('input', function () {
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(save, 1200)
    })
    ta.addEventListener('blur', function () {
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
      save()
    })
    ta.addEventListener('click', function (e) { e.stopPropagation() })
    ta.addEventListener('mousedown', function (e) { e.stopPropagation() })
  }

  // ===== Existing counter card actions =====
  function startManualEdit(overlay, clauseType) {
    var row = overlay.querySelector('.lease-cmp-row[data-clause-type="' + clauseType + '"]')
    if (!row) return
    var card = row.querySelector('.lease-cmp-counter-result')
    if (!card) return
    var display = card.querySelector('[data-counter-display]')
    if (!display) return
    var current = display.textContent

    // Replace display with a textarea + save/cancel
    display.outerHTML =
      '<textarea class="lease-cmp-counter-text-edit" data-counter-edit data-clause-type="' + escapeHtml(clauseType) + '">' + escapeHtml(current) + '</textarea>' +
      '<div class="lease-cmp-counter-edit-actions">' +
        '<button class="lease-cmp-counter-action lease-cmp-counter-save" data-action="counter-save-edit" data-clause-type="' + escapeHtml(clauseType) + '">Save</button>' +
        '<button class="lease-cmp-counter-action" data-action="counter-cancel-edit" data-clause-type="' + escapeHtml(clauseType) + '">Cancel</button>' +
      '</div>'

    // Bind handlers
    var ta = card.querySelector('[data-counter-edit]')
    if (ta) {
      ta.addEventListener('click', function (e) { e.stopPropagation() })
      ta.addEventListener('mousedown', function (e) { e.stopPropagation() })
      ta.focus()
    }
    var saveBtn = card.querySelector('[data-action="counter-save-edit"]')
    if (saveBtn) {
      saveBtn.addEventListener('click', function (e) {
        e.stopPropagation()
        saveManualEdit(overlay, clauseType, ta.value)
      })
    }
    var cancelBtn = card.querySelector('[data-action="counter-cancel-edit"]')
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function (e) {
        e.stopPropagation()
        reRenderClauseRow(overlay, clauseType)
      })
    }
  }

  async function saveManualEdit(overlay, clauseType, newText) {
    var pid = overlay.__projectId
    var addr = overlay.__buildingAddress
    if (!pid || !addr) return

    try {
      var resp = await fetch('/api/lease/counter-suggest', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: pid,
          buildingAddress: addr,
          clauseType: clauseType,
          counter_language: newText,
          userEmail: getUserEmail(),
        }),
      })
      var data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Save failed')

      // Update local map
      var negMap = overlay.__negotiationMap || {}
      negMap[clauseType] = Object.assign({}, negMap[clauseType] || {}, data)
      overlay.__negotiationMap = negMap

      reRenderClauseRow(overlay, clauseType)
    } catch (e) {
      alert('Save failed: ' + e.message)
    }
  }

  function startAiRefine(overlay, clauseType) {
    var row = overlay.querySelector('.lease-cmp-row[data-clause-type="' + clauseType + '"]')
    if (!row) return
    var card = row.querySelector('.lease-cmp-counter-result')
    if (!card) return

    // Insert refinement input after the existing rationale, before the text
    var existingRefine = card.querySelector('.lease-cmp-counter-refine-panel')
    if (existingRefine) { existingRefine.querySelector('textarea').focus(); return }

    var negMap = overlay.__negotiationMap || {}
    var existing = negMap[clauseType] || {}
    var currentText = existing.counter_language || ''

    var panel = document.createElement('div')
    panel.className = 'lease-cmp-counter-refine-panel'
    panel.innerHTML =
      '<div class="lease-cmp-builder-hint">Tell AI how to refine the existing counter. Example: "Make this more aggressive" or "Use the same defined-term style as the rest of the lease."</div>' +
      '<textarea class="lease-cmp-builder-prompt" data-refine-prompt rows="2" placeholder="How should AI refine this counter?"></textarea>' +
      '<div class="lease-cmp-counter-edit-actions">' +
        '<button class="lease-cmp-builder-go" data-action="counter-refine-go" data-clause-type="' + escapeHtml(clauseType) + '">Refine with AI</button>' +
        '<button class="lease-cmp-counter-action" data-action="counter-refine-cancel" data-clause-type="' + escapeHtml(clauseType) + '">Cancel</button>' +
      '</div>'

    // Insert at top of card body (after the counter-label header)
    card.appendChild(panel)

    var ta = panel.querySelector('textarea')
    if (ta) {
      ta.addEventListener('click', function (e) { e.stopPropagation() })
      ta.addEventListener('mousedown', function (e) { e.stopPropagation() })
      ta.focus()
    }
    panel.querySelector('[data-action="counter-refine-go"]').addEventListener('click', function (e) {
      e.stopPropagation()
      var inst = ta.value
      runCounterGenerate(overlay, clauseType, {
        mode: 'ai_edit',
        instructions: inst,
        currentCounter: currentText,
        btnEl: panel.querySelector('[data-action="counter-refine-go"]'),
      })
    })
    panel.querySelector('[data-action="counter-refine-cancel"]').addEventListener('click', function (e) {
      e.stopPropagation()
      panel.remove()
    })
  }

  function startRegenerate(overlay, clauseType) {
    var negMap = overlay.__negotiationMap || {}
    var existing = negMap[clauseType] || {}
    var prevMode = existing.counter_mode || 'auto'
    var prevInstructions = existing.counter_instructions || ''

    if (prevMode === 'auto' && !prevInstructions) {
      // No instruction history - just hit auto again
      if (!confirm('Regenerate this counter from scratch?')) return
      runCounterGenerate(overlay, clauseType, { mode: 'auto', instructions: '' })
      return
    }

    // Open the existing-builder panel pre-filled with previous instruction + mode
    // Easiest: replace the card with a fresh builder pre-populated
    var newInstructions = prompt('Regenerate with these instructions (you can edit):', prevInstructions)
    if (newInstructions === null) return
    runCounterGenerate(overlay, clauseType, {
      mode: prevMode === 'manual' ? 'auto' : prevMode,
      instructions: newInstructions,
    })
  }

  async function deleteCounter(overlay, clauseType) {
    if (!confirm('Delete this counter? You can always generate a new one.')) return
    var pid = overlay.__projectId
    var addr = overlay.__buildingAddress
    if (!pid || !addr) return

    try {
      var resp = await fetch('/api/lease/counter-suggest', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: pid,
          buildingAddress: addr,
          clauseType: clauseType,
          userEmail: getUserEmail(),
        }),
      })
      if (!resp.ok) {
        var d = await resp.json().catch(function () { return {} })
        throw new Error(d.error || 'Delete failed')
      }
      // Clear from local map
      var negMap = overlay.__negotiationMap || {}
      if (negMap[clauseType]) {
        delete negMap[clauseType].counter_language
        delete negMap[clauseType].counter_rationale
        delete negMap[clauseType].counter_mode
        delete negMap[clauseType].counter_instructions
      }
      reRenderClauseRow(overlay, clauseType)
    } catch (e) {
      alert('Delete failed: ' + e.message)
    }
  }

  // ================================================================
  // EXPORT COMPARE TO EXCEL / GOOGLE SHEETS
  // ================================================================
  // Three columns: V1, V2, Summary of Changes - one row per clause
  // Plus header rows for AI summary and risk delta.
  function exportCompareToWorkbook(diff, target, negotiationMap) {
    negotiationMap = negotiationMap || {}
    if (!diff || !diff.clauseDiffs) {
      alert('No comparison data to export.')
      return
    }
    if (typeof XLSX === 'undefined') {
      alert('Excel library not loaded. Please refresh and try again.')
      return
    }

    var v1Label = diff.v1_label || 'v1'
    var v2Label = diff.v2_label || 'v2'
    var v1DocType = DOC_TYPE_LABELS[diff.v1_doc_type] || diff.v1_doc_type || ''
    var v2DocType = DOC_TYPE_LABELS[diff.v2_doc_type] || diff.v2_doc_type || ''
    var counts = diff.counts || {}
    var risk = diff.riskDelta || {}

    var wb = XLSX.utils.book_new()

    // ============ SHEET 1: AI Summary + headline ============
    var summaryRows = []
    summaryRows.push(['Lease Compare Versions'])
    summaryRows.push([])
    summaryRows.push(['Earlier (V1)', v1Label + ' — ' + v1DocType])
    summaryRows.push(['Later (V2)',   v2Label + ' — ' + v2DocType])
    summaryRows.push(['Generated',    diff.cached_at ? new Date(diff.cached_at).toLocaleString() : new Date().toLocaleString()])
    summaryRows.push([])
    summaryRows.push(['CHANGE COUNTS'])
    summaryRows.push(['Modified',  counts.modified  || 0])
    summaryRows.push(['Added',     counts.added     || 0])
    summaryRows.push(['Removed',   counts.removed   || 0])
    summaryRows.push(['Unchanged', counts.unchanged || 0])
    summaryRows.push([])
    summaryRows.push(['RISK MOVEMENT'])
    summaryRows.push(['Clauses where risk got worse',    risk.worse  || 0])
    summaryRows.push(['Clauses where risk improved',     risk.better || 0])
    summaryRows.push(['Net change in high-risk clauses', risk.net_high_risk_change || 0])
    summaryRows.push([])
    summaryRows.push(['AI EXECUTIVE SUMMARY'])
    if (diff.ai_summary) {
      diff.ai_summary.split(/\n\n+/).forEach(function (p) {
        summaryRows.push([p])
      })
    } else {
      summaryRows.push(['(no AI summary available)'])
    }

    var ws1 = XLSX.utils.aoa_to_sheet(summaryRows)
    ws1['!cols'] = [{ wch: 38 }, { wch: 70 }]
    // Style title + section labels
    if (ws1['A1']) ws1['A1'].s = { font: { bold: true, sz: 14 } }
    var sectionLabels = ['CHANGE COUNTS', 'RISK MOVEMENT', 'AI EXECUTIVE SUMMARY', 'Earlier (V1)', 'Later (V2)', 'Generated']
    for (var r = 0; r < summaryRows.length; r++) {
      var cellRef = XLSX.utils.encode_cell({ r: r, c: 0 })
      if (ws1[cellRef] && sectionLabels.indexOf(summaryRows[r][0]) >= 0) {
        ws1[cellRef].s = { font: { bold: true, color: { rgb: '1E40AF' } }, alignment: { vertical: 'top' } }
      }
    }
    // Wrap long AI summary cells
    summaryRows.forEach(function (row, idx) {
      var cell = ws1[XLSX.utils.encode_cell({ r: idx, c: 0 })]
      if (cell && typeof cell.v === 'string' && cell.v.length > 80) {
        cell.s = Object.assign({}, cell.s || {}, { alignment: { wrapText: true, vertical: 'top' } })
        ws1['!rows'] = ws1['!rows'] || []
        ws1['!rows'][idx] = { hpt: Math.min(220, Math.max(40, Math.ceil(cell.v.length / 90) * 18)) }
      }
    })
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary')

    // ============ SHEET 2: Clause-by-clause comparison ============
    var headers = [
      'Clause Type',
      'Section',
      'Status',
      'Negotiation Status',
      'Negotiation Notes',
      v1Label + ' — Heading',
      v1Label + ' — Summary',
      v1Label + ' — Key Terms',
      v1Label + ' — Source Excerpt',
      v1Label + ' — Risk',
      v2Label + ' — Heading',
      v2Label + ' — Summary',
      v2Label + ' — Key Terms',
      v2Label + ' — Source Excerpt',
      v2Label + ' — Risk',
      'Summary of Changes',
    ]
    var dataRows = [headers]

    diff.clauseDiffs.forEach(function (cd) {
      var label = clauseTypeLabel(cd.type)
      var section = (cd.v1 && cd.v1.section) || (cd.v2 && cd.v2.section) || ''
      var v1Heading = (cd.v1 && cd.v1.heading) || ''
      var v2Heading = (cd.v2 && cd.v2.heading) || ''
      var v1Summary = (cd.v1 && cd.v1.summary) || ''
      var v2Summary = (cd.v2 && cd.v2.summary) || ''
      var v1KT = (cd.v1 && cd.v1.key_terms) ? formatKeyTermsForExport(cd.v1.key_terms) : ''
      var v2KT = (cd.v2 && cd.v2.key_terms) ? formatKeyTermsForExport(cd.v2.key_terms) : ''
      var v1Excerpt = (cd.v1 && cd.v1.original_excerpt) || ''
      var v2Excerpt = (cd.v2 && cd.v2.original_excerpt) || ''
      var v1Risk = (cd.v1 && cd.v1.risk_level) || ''
      var v2Risk = (cd.v2 && cd.v2.risk_level) || ''
      var changeSummary = buildChangeSummary(cd)

      var n = negotiationMap[cd.type] || {}
      var negStatusKey = n.status || 'open_issue'
      var negStatusMeta = NEG_STATUS_BY_KEY[negStatusKey] || NEG_STATUS_BY_KEY.open_issue
      var negStatusLabel = negStatusMeta.label
      var negNotes = n.notes || ''

      dataRows.push([
        label,
        section,
        cd.status.toUpperCase(),
        negStatusLabel,
        negNotes,
        v1Heading, v1Summary, v1KT, v1Excerpt, v1Risk,
        v2Heading, v2Summary, v2KT, v2Excerpt, v2Risk,
        changeSummary,
      ])
    })

    var ws2 = XLSX.utils.aoa_to_sheet(dataRows)
    ws2['!cols'] = [
      { wch: 22 },              // Clause Type
      { wch: 12 },              // Section
      { wch: 12 },              // Status (modified/added/removed)
      { wch: 18 },              // Negotiation Status
      { wch: 50 },              // Negotiation Notes
      { wch: 28 }, { wch: 50 }, { wch: 35 }, { wch: 60 }, { wch: 10 }, // V1 columns
      { wch: 28 }, { wch: 50 }, { wch: 35 }, { wch: 60 }, { wch: 10 }, // V2 columns
      { wch: 70 },              // Summary of Changes
    ]
    ws2['!freeze'] = { xSplit: 0, ySplit: 1 }
    // Header row styling
    var lastCol = headers.length - 1
    for (var c = 0; c <= lastCol; c++) {
      var hdrRef = XLSX.utils.encode_cell({ r: 0, c: c })
      if (ws2[hdrRef]) {
        ws2[hdrRef].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '1E40AF' } },
          alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
        }
      }
    }
    ws2['!rows'] = [{ hpt: 38 }]
    // Color-code status column + add wrap to long text cells
    // Diff status colors - blue for changes, red only for destructive (removed)
    var statusColors = {
      MODIFIED: { rgb: 'EFF6FF', fontColor: '1E40AF' },
      ADDED:    { rgb: 'EFF6FF', fontColor: '1E40AF' },
      REMOVED:  { rgb: 'FEF2F2', fontColor: 'B91C1C' },
      UNCHANGED:{ rgb: 'F8FAFC', fontColor: '94A3B8' },
    }
    // Negotiation status colors (mirror NEG_STATUS_BY_KEY) - blue active, gray resolved
    var negStatusColors = {
      'Open Issue':       { rgb: 'EFF6FF', fontColor: '1E40AF' },
      'Counter Pending':  { rgb: 'EFF6FF', fontColor: '1E40AF' },
      'Accepted':         { rgb: 'F1F5F9', fontColor: '475569' },
      "Won't Address":    { rgb: 'F8FAFC', fontColor: '94A3B8' },
      'N/A':              { rgb: 'F8FAFC', fontColor: '94A3B8' },
    }
    for (var i = 1; i < dataRows.length; i++) {
      var status = dataRows[i][2]
      var sc = statusColors[status]
      if (sc) {
        var ref = XLSX.utils.encode_cell({ r: i, c: 2 })
        if (ws2[ref]) {
          ws2[ref].s = {
            font: { bold: true, color: { rgb: sc.fontColor } },
            fill: { fgColor: { rgb: sc.rgb } },
            alignment: { horizontal: 'center', vertical: 'center' },
          }
        }
      }
      // Negotiation Status column (col 3)
      var negStatus = dataRows[i][3]
      var negSc = negStatusColors[negStatus]
      if (negSc) {
        var negRef = XLSX.utils.encode_cell({ r: i, c: 3 })
        if (ws2[negRef]) {
          ws2[negRef].s = {
            font: { bold: true, color: { rgb: negSc.fontColor } },
            fill: { fgColor: { rgb: negSc.rgb } },
            alignment: { horizontal: 'center', vertical: 'center' },
          }
        }
      }
      // Wrap long-text columns: Notes(4), V1 Summary(6), V1 Excerpt(8),
      //                       V2 Summary(11), V2 Excerpt(13), Summary of Changes(15)
      ;[4, 6, 8, 11, 13, 15].forEach(function (cc) {
        var rr = XLSX.utils.encode_cell({ r: i, c: cc })
        if (ws2[rr] && typeof ws2[rr].v === 'string' && ws2[rr].v.length > 60) {
          ws2[rr].s = Object.assign({}, ws2[rr].s || {}, { alignment: { wrapText: true, vertical: 'top' } })
        }
      })
      ws2['!rows'].push({ hpt: 80 })
    }
    XLSX.utils.book_append_sheet(wb, ws2, 'Clause Compare')

    var fileName = 'Lease Compare ' + v1Label + ' vs ' + v2Label + ' — ' + new Date().toISOString().slice(0, 10) + '.xlsx'

    if (target === 'sheets') {
      // Reuse the existing rfp Drive helper - identical OAuth flow + Drive upload
      if (typeof rfpExportComparisonToDrive === 'function') {
        rfpExportComparisonToDrive(wb, fileName)
      } else {
        alert('Google Sheets export not available - please refresh the page.')
      }
    } else {
      XLSX.writeFile(wb, fileName)
    }
  }

  function formatKeyTermsForExport(kt) {
    if (!kt || typeof kt !== 'object') return ''
    return Object.keys(kt).map(function (k) {
      var v = kt[k]
      if (v == null || v === '') return ''
      var displayKey = k.replace(/_/g, ' ').replace(/\b\w/g, function (m) { return m.toUpperCase() })
      var displayVal = typeof v === 'object' ? JSON.stringify(v) : String(v)
      return displayKey + ': ' + displayVal
    }).filter(Boolean).join('\n')
  }

  // Build a plain-English summary for the third column of the export.
  // Includes: status verb, key term changes (with old -> new), risk movement.
  function buildChangeSummary(cd) {
    if (cd.status === 'unchanged') return 'No change.'
    if (cd.status === 'added') {
      var addedRisk = (cd.v2 && cd.v2.risk_level) || 'unknown'
      return 'NEW - this clause was added in the later version.'
        + ((cd.v2 && cd.v2.summary) ? ' ' + cd.v2.summary : '')
        + ' Risk: ' + addedRisk + '.'
    }
    if (cd.status === 'removed') {
      return 'REMOVED - this clause was removed in the later version.'
        + ((cd.v1 && cd.v1.summary) ? ' (Was: ' + cd.v1.summary + ')' : '')
    }

    // Modified - build a list of bullet points
    var parts = []
    var changedKT = (cd.keyTermsDiff || []).filter(function (k) { return k.changed })
    if (changedKT.length > 0) {
      changedKT.forEach(function (k) {
        var disp = k.key.replace(/_/g, ' ').replace(/\b\w/g, function (m) { return m.toUpperCase() })
        var oldV = k.v1 == null ? '(none)' : (typeof k.v1 === 'object' ? JSON.stringify(k.v1) : String(k.v1))
        var newV = k.v2 == null ? '(none)' : (typeof k.v2 === 'object' ? JSON.stringify(k.v2) : String(k.v2))
        parts.push('- ' + disp + ': ' + oldV + ' → ' + newV)
      })
    }

    var summaryChanged = cd.summaryOps && cd.summaryOps.some(function (o) { return o.op !== 'eq' })
    if (summaryChanged && (!cd.v1 || !cd.v2 || (cd.v1.summary || '') !== (cd.v2.summary || ''))) {
      parts.push('- Summary changed.')
    }

    var excerptChanged = cd.excerptOps && cd.excerptOps.some(function (o) { return o.op !== 'eq' })
    if (excerptChanged) parts.push('- Source language was edited.')

    if (cd.riskDelta && cd.riskDelta !== 0) {
      var verb = cd.riskDelta > 0 ? 'WORSENED' : 'IMPROVED'
      parts.push('- Risk ' + verb + ': '
        + ((cd.v1 && cd.v1.risk_level) || '—') + ' → '
        + ((cd.v2 && cd.v2.risk_level) || '—'))
    }

    if (parts.length === 0) return 'Modified (minor edits).'
    return parts.join('\n')
  }

  // ================================================================
  // EXPOSE
  // ================================================================
  window.leaseShowUploadModal = leaseShowUploadModal
  window.leaseShowSummary = leaseShowSummary
  window.leasePageInit = leasePageInit
})()
