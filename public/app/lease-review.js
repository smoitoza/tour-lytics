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
  // EXPOSE
  // ================================================================
  window.leaseShowUploadModal = leaseShowUploadModal
  window.leaseShowSummary = leaseShowSummary
})()
