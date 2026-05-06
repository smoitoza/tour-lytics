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

  var RISK_STYLES = {
    low:     { fg: '#15803D', bg: '#F0FDF4', label: 'Low risk' },
    medium:  { fg: '#B45309', bg: '#FFFBEB', label: 'Medium risk' },
    high:    { fg: '#B91C1C', bg: '#FEF2F2', label: 'High risk' },
    unknown: { fg: '#475569', bg: '#F8FAFC', label: 'Not assessed' },
  }

  var DOC_TYPE_LABELS = {
    initial_draft:    'Initial Draft',
    tenant_redline:   'Tenant Redline',
    landlord_redline: 'Landlord Redline',
    executed:         'Executed',
    other:            'Other',
  }

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
          b.versions.map(renderVersionRow).join('') +
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

  function renderVersionRow(v) {
    var risk = (v.summary_json && v.summary_json.counts) || {}
    var dt = v.created_at ? new Date(v.created_at) : null
    var dateStr = dt ? dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
    return '<div class="lease-version-row" data-lease-id="' + escapeHtml(v.id) + '">' +
      '<div class="lease-version-meta">' +
        '<div class="lease-version-label">' + escapeHtml(v.version_label || ('v' + v.version_number)) + '</div>' +
        '<div class="lease-version-doctype">' + escapeHtml(DOC_TYPE_LABELS[v.doc_type] || v.doc_type) + '</div>' +
      '</div>' +
      '<div class="lease-version-date">' + escapeHtml(dateStr) + '</div>' +
      '<div class="lease-version-risks">' +
        (risk.high_risk ? '<span class="lease-version-risk lease-version-risk-high">' + risk.high_risk + ' high</span>' : '') +
        (risk.medium_risk ? '<span class="lease-version-risk lease-version-risk-medium">' + risk.medium_risk + ' med</span>' : '') +
      '</div>' +
    '</div>'
  }

  function renderExtractionStatusBadge(status) {
    var map = {
      pending:    { fg: '#475569', bg: '#F1F5F9', label: 'Pending' },
      extracting: { fg: '#1E40AF', bg: '#DBEAFE', label: 'Extracting...' },
      done:       { fg: '#15803D', bg: '#F0FDF4', label: 'Ready' },
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
    // Version row click - open summary
    root.querySelectorAll('.lease-version-row').forEach(function (row) {
      row.addEventListener('click', function () {
        var id = row.getAttribute('data-lease-id')
        if (id) leaseShowSummary(id)
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
  async function leaseRunCompare(v1Id, v2Id) {
    var overlay = document.createElement('div')
    overlay.className = 'lease-summary-overlay'
    overlay.innerHTML = '<div class="lease-summary-card"><div class="lease-summary-loading"><div class="lease-spinner"></div> Comparing versions and generating change summary (30–60 sec)...</div></div>'
    document.body.appendChild(overlay)

    try {
      var resp = await fetch('/api/lease/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ v1Id: v1Id, v2Id: v2Id }),
      })
      var data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Compare failed')
      overlay.innerHTML = renderCompareHtml(data)
      bindCompareHandlers(overlay)
    } catch (e) {
      overlay.innerHTML = '<div class="lease-summary-card"><div class="lease-summary-error">Compare failed: ' + escapeHtml(e.message) + '<br><br><button class="lease-btn-secondary" onclick="this.closest(\'.lease-summary-overlay\').remove()">Close</button></div></div>'
    }
  }

  function renderCompareHtml(diff) {
    var clauseDiffs = diff.clauseDiffs || []
    var counts = diff.counts || {}
    var risk = diff.riskDelta || {}

    var html = '<div class="lease-summary-card lease-summary-full lease-compare-card">'

    // Header
    html += '<div class="lease-summary-header">' +
      '<div>' +
        '<div class="lease-summary-eyebrow">Compare Versions</div>' +
        '<div class="lease-summary-title">' + escapeHtml(diff.v1_label || 'v1') + ' → ' + escapeHtml(diff.v2_label || 'v2') + '</div>' +
        '<div class="lease-summary-subtitle">' + escapeHtml(DOC_TYPE_LABELS[diff.v1_doc_type] || diff.v1_doc_type || '') + ' → ' + escapeHtml(DOC_TYPE_LABELS[diff.v2_doc_type] || diff.v2_doc_type || '') + '</div>' +
      '</div>' +
      '<div class="lease-summary-actions">' +
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
        '<div class="lease-compare-headline-cell"><div class="lease-compare-headline-label">Added</div><div class="lease-compare-headline-value" style="color:#15803D">' + (counts.added || 0) + '</div></div>' +
        '<div class="lease-compare-headline-cell"><div class="lease-compare-headline-label">Removed</div><div class="lease-compare-headline-value" style="color:#B91C1C">' + (counts.removed || 0) + '</div></div>' +
        '<div class="lease-compare-headline-cell"><div class="lease-compare-headline-label">Unchanged</div><div class="lease-compare-headline-value" style="color:#64748B">' + (counts.unchanged || 0) + '</div></div>' +
        '<div class="lease-compare-headline-cell"><div class="lease-compare-headline-label">Risk Worse</div><div class="lease-compare-headline-value" style="color:#B91C1C">' + (risk.worse || 0) + '</div></div>' +
        '<div class="lease-compare-headline-cell"><div class="lease-compare-headline-label">Risk Better</div><div class="lease-compare-headline-value" style="color:#15803D">' + (risk.better || 0) + '</div></div>' +
        '<div class="lease-compare-headline-cell lease-compare-headline-net"><div class="lease-compare-headline-label">Net</div><div class="lease-compare-headline-value">' + escapeHtml(netLabel) + '</div></div>' +
      '</div>' +
    '</div>'

    // Filter toggle
    html += '<div class="lease-compare-filter">' +
      '<button class="lease-compare-filter-btn active" data-filter="all">All (' + clauseDiffs.length + ')</button>' +
      '<button class="lease-compare-filter-btn" data-filter="changed">Changed only (' + ((counts.modified || 0) + (counts.added || 0) + (counts.removed || 0)) + ')</button>' +
      '<button class="lease-compare-filter-btn" data-filter="high">Risk worsened (' + (risk.worse || 0) + ')</button>' +
    '</div>'

    // Clause diff rows
    html += '<div class="lease-compare-list">'
    clauseDiffs.forEach(function (cd, idx) {
      html += renderClauseDiffRow(cd, idx, diff)
    })
    html += '</div>'

    html += '</div>'
    return html
  }

  function renderClauseDiffRow(cd, idx, diff) {
    var label = clauseTypeLabel(cd.type)
    var statusBadge = renderStatusBadge(cd.status, cd.riskDelta)
    var section = (cd.v1 && cd.v1.section) || (cd.v2 && cd.v2.section) || ''
    var risk1 = (cd.v1 && cd.v1.risk_level) || ''
    var risk2 = (cd.v2 && cd.v2.risk_level) || ''

    var rowClass = 'lease-cmp-row lease-cmp-row-' + cd.status
    if (cd.status === 'modified' && (cd.riskDelta || 0) > 0) rowClass += ' lease-cmp-row-worse'
    if (cd.status === 'modified' && (cd.riskDelta || 0) < 0) rowClass += ' lease-cmp-row-better'

    var html = '<div class="' + rowClass + '" data-status="' + cd.status + '" data-risk-delta="' + (cd.riskDelta || 0) + '">' +
      '<div class="lease-cmp-row-head" data-action="toggle-row" data-row-idx="' + idx + '">' +
        '<div class="lease-cmp-row-head-left">' +
          statusBadge +
          '<div class="lease-cmp-row-label">' + escapeHtml(label) + '</div>' +
          (section ? '<div class="lease-cmp-row-section">' + escapeHtml(section) + '</div>' : '') +
        '</div>' +
        '<div class="lease-cmp-row-head-right">' +
          (risk1 || risk2 ? renderRiskMovement(risk1, risk2) : '') +
          '<svg class="lease-cmp-row-chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
        '</div>' +
      '</div>' +
      '<div class="lease-cmp-row-body">' +
        renderClauseDiffBody(cd) +
      '</div>' +
    '</div>'
    return html
  }

  function renderStatusBadge(status, riskDelta) {
    var styles = {
      unchanged: { bg: '#F1F5F9', fg: '#64748B', label: 'Unchanged' },
      modified:  { bg: '#FFFBEB', fg: '#B45309', label: 'Modified' },
      added:     { bg: '#F0FDF4', fg: '#15803D', label: 'Added' },
      removed:   { bg: '#FEF2F2', fg: '#B91C1C', label: 'Removed' },
    }
    var s = styles[status] || styles.unchanged
    return '<span class="lease-cmp-status-badge" style="background:' + s.bg + ';color:' + s.fg + '">' + s.label + '</span>'
  }

  function renderRiskMovement(r1, r2) {
    if (!r1 && !r2) return ''
    if (r1 === r2) return '<span class="lease-cmp-risk-badge">' + (r2 || r1) + '</span>'
    var arrow = '→'
    var rankOrder = { unknown: 0, low: 1, medium: 2, high: 3 }
    var d = (rankOrder[r2] || 0) - (rankOrder[r1] || 0)
    var color = d > 0 ? '#B91C1C' : (d < 0 ? '#15803D' : '#64748B')
    return '<span class="lease-cmp-risk-badge" style="color:' + color + '">' + (r1 || '—') + ' ' + arrow + ' ' + (r2 || '—') + '</span>'
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
          var show
          if (f === 'all') show = true
          else if (f === 'changed') show = (st !== 'unchanged')
          else if (f === 'high') show = (st === 'modified' && rd > 0) || (st === 'added' && row.querySelector('[data-action="toggle-row"]'))
          else show = true
          row.style.display = show ? '' : 'none'
        })
      })
    })
  }

  // ================================================================
  // EXPOSE
  // ================================================================
  window.leaseShowUploadModal = leaseShowUploadModal
  window.leaseShowSummary = leaseShowSummary
  window.leasePageInit = leasePageInit
})()
