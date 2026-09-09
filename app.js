import { configured, escapeHtml as safeHtml, supabase } from "./core.js";
import { clearDemoDocuments, demoDocuments, demoProfile, invokeFunction, invokePublicFunction, saveDemoDocuments, saveProfile as persistProfile, uploadOriginal } from "./data.js";

(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = {
    mode: "draft",
    files: [],
    sourceFiles: [],
    profile: demoProfile(),
    documents: demoDocuments(),
    revision: 1,
    originalHtml: "",
    profileSignatureMode: "font",
    signSignatureMode: "font",
    signingToken: "",
    sessionEmail: "",
    aiReady: false,
    fields: []
  };
  const agreementTemplates = [
    { category: "Confidentiality", id: "mutual-nda", name: "Mutual NDA", prompt: "A mutual non-disclosure agreement between [PARTY ONE] and [PARTY TWO] for discussing [PURPOSE]. Both parties may disclose confidential information. The confidentiality period is [NUMBER] years, with customary exclusions and return-or-destruction terms. Governing law: [STATE/COUNTRY]." },
    { category: "Confidentiality", id: "unilateral-nda", name: "Unilateral NDA", prompt: "A unilateral non-disclosure agreement where [DISCLOSING PARTY] will share confidential information with [RECEIVING PARTY] for [PURPOSE]. Confidentiality lasts [NUMBER] years. Include customary exclusions, permitted disclosures, and return-or-destruction terms." },
    { category: "Business & services", id: "service-agreement", name: "Service agreement", prompt: "A service agreement where [PROVIDER] will perform [SERVICES] for [CLIENT]. Deliverables: [DELIVERABLES]. Fee and payment timing: [PAYMENT TERMS]. Project dates: [DATES]. Include scope changes, ownership, confidentiality, termination, and liability terms." },
    { category: "Business & services", id: "independent-contractor", name: "Independent contractor agreement", prompt: "An independent contractor agreement between [CLIENT] and [CONTRACTOR] for [WORK]. Compensation: [AMOUNT/SCHEDULE]. Term: [DATES]. Address deliverables, expenses, intellectual property, confidentiality, contractor status, termination, and governing law." },
    { category: "Business & services", id: "consulting-agreement", name: "Consulting agreement", prompt: "A consulting agreement for [CONSULTANT] to advise [CLIENT] about [SUBJECT]. Describe services, availability, fees, expenses, confidentiality, work-product ownership, conflicts, term, and termination." },
    { category: "Business & services", id: "vendor-agreement", name: "Vendor agreement", prompt: "A vendor agreement for [VENDOR] to supply [GOODS/SERVICES] to [CUSTOMER]. Include specifications, pricing, delivery, acceptance, warranties, confidentiality, data handling, indemnity, term, and termination." },
    { category: "Business & services", id: "partnership-agreement", name: "Partnership agreement", prompt: "A partnership agreement among [PARTNERS] for [BUSINESS]. Contributions: [CONTRIBUTIONS]. Ownership and profit shares: [PERCENTAGES]. Include management, voting, duties, distributions, new partners, withdrawal, disputes, and dissolution." },
    { category: "Business & services", id: "operating-agreement", name: "LLC operating agreement", prompt: "An operating agreement for [LLC NAME], organized in [STATE], with members [MEMBERS]. State ownership percentages, contributions, management structure, voting, distributions, transfers, departures, and dissolution." },
    { category: "Business & services", id: "purchase-agreement", name: "Goods purchase agreement", prompt: "A purchase agreement for [BUYER] to buy [GOODS] from [SELLER] for [PRICE]. Include quantity, specifications, payment, delivery, inspection, risk of loss, warranties, and remedies." },
    { category: "Business & services", id: "settlement-agreement", name: "Settlement agreement", prompt: "A settlement agreement between [PARTIES] resolving [DISPUTE]. Settlement amount or performance: [TERMS]. Include payment timing, releases, no-admission language, confidentiality if intended, default, and dismissal obligations." },
    { category: "Business & services", id: "amendment", name: "Contract amendment", prompt: "An amendment to the [ORIGINAL AGREEMENT] dated [DATE] between [PARTIES]. Change these provisions: [CHANGES]. All other terms remain effective. State the amendment effective date and signature requirements." },
    { category: "Employment", id: "employment-agreement", name: "Employment agreement", prompt: "An employment agreement between [EMPLOYER] and [EMPLOYEE] for the position of [TITLE]. Include start date, duties, compensation, benefits, work location, confidentiality, intellectual property, termination, and governing law." },
    { category: "Employment", id: "offer-letter", name: "Offer letter", prompt: "A concise employment offer letter from [EMPLOYER] to [CANDIDATE] for [ROLE], starting [DATE], with compensation of [AMOUNT], [BENEFITS], reporting to [MANAGER], and any contingencies. Clearly state whether employment is at-will where applicable." },
    { category: "Employment", id: "separation-agreement", name: "Separation agreement", prompt: "An employee separation agreement between [EMPLOYER] and [EMPLOYEE], effective [DATE]. Include final pay, severance, benefits, property return, releases, confidentiality, non-disparagement if desired, and review/revocation periods requiring confirmation." },
    { category: "Real estate", id: "residential-lease", name: "Residential lease", prompt: "A residential lease for [PROPERTY ADDRESS] between [LANDLORD] and [TENANT]. Term: [START/END]. Rent: [AMOUNT/DUE DATE]. Deposit: [AMOUNT]. Include occupants, utilities, maintenance, entry, pets, parking, late fees, renewal, and jurisdiction-specific disclosures marked for confirmation." },
    { category: "Real estate", id: "commercial-lease", name: "Commercial lease", prompt: "A commercial lease for [PREMISES] between [LANDLORD] and [TENANT] for [PERMITTED USE]. Include term, base rent, additional rent/CAM, deposit, improvements, maintenance, insurance, assignment, default, options, and governing law." },
    { category: "Real estate", id: "lease-amendment", name: "Lease amendment", prompt: "An amendment to the lease for [PROPERTY] dated [DATE] between [LANDLORD] and [TENANT]. Revise [RENT/TERM/OCCUPANTS/OTHER TERMS] as follows: [CHANGES]. Preserve all unaffected lease terms." },
    { category: "Real estate", id: "sublease", name: "Sublease agreement", prompt: "A sublease of [PROPERTY/ROOM] from [TENANT] to [SUBTENANT], subject to the original lease and landlord approval where required. Include term, rent, deposit, utilities, house rules, damages, and original-lease obligations." },
    { category: "Real estate", id: "roommate-agreement", name: "Roommate agreement", prompt: "A roommate agreement for residents of [ADDRESS]. Include each person's rent and deposit share, utilities, rooms, chores, guests, quiet hours, shared property, move-out notice, and handling unpaid amounts." },
    { category: "Real estate", id: "land-contract", name: "Land contract / installment sale", prompt: "A land installment contract for [PROPERTY ADDRESS/LEGAL DESCRIPTION] where [SELLER] finances the sale to [BUYER]. Price: [PRICE]. Down payment: [AMOUNT]. Principal, interest, payment schedule, balloon payment, taxes, insurance, possession, maintenance, title delivery, default remedies, recording, and governing law must be stated. Mark all jurisdiction-specific requirements for legal review." },
    { category: "Real estate", id: "real-estate-purchase", name: "Real-estate purchase agreement", prompt: "A purchase agreement for [PROPERTY] between [SELLER] and [BUYER] for [PRICE]. Include deposit, financing, inspection, title, disclosures, closing date and costs, possession, prorations, contingencies, default, and governing law." },
    { category: "Real estate", id: "property-management", name: "Property management agreement", prompt: "A property management agreement for [PROPERTY] between [OWNER] and [MANAGER]. Include authority, leasing duties, rent collection, maintenance limits, fees, reserves, accounting, insurance, term, termination, and owner approvals." },
    { category: "Loans & sales", id: "promissory-note", name: "Promissory note", prompt: "A promissory note from [BORROWER] to [LENDER] for [PRINCIPAL]. Interest: [RATE]. Payments: [SCHEDULE]. Maturity: [DATE]. State whether secured, address prepayment, late payment, default, acceleration, costs, and governing law." },
    { category: "Loans & sales", id: "loan-agreement", name: "Loan agreement", prompt: "A loan agreement between [LENDER] and [BORROWER] for [AMOUNT/PURPOSE]. Include funding, interest, repayment, collateral if any, representations, covenants, default, remedies, notices, and governing law." },
    { category: "Loans & sales", id: "bill-of-sale", name: "Bill of sale", prompt: "A bill of sale transferring [ITEM AND IDENTIFIERS] from [SELLER] to [BUYER] for [PRICE] on [DATE]. Include condition, warranties or as-is status, title, delivery, and signatures." },
    { category: "Creative & technology", id: "license-agreement", name: "License agreement", prompt: "A license agreement allowing [LICENSEE] to use [INTELLECTUAL PROPERTY] owned by [LICENSOR]. Define scope, territory, term, exclusivity, fees/royalties, restrictions, ownership, quality control, termination, and post-termination duties." },
    { category: "Creative & technology", id: "work-for-hire", name: "Work-for-hire agreement", prompt: "A work-for-hire and IP assignment agreement for [CREATOR] to create [WORK] for [CLIENT]. Include deliverables, compensation, ownership/assignment, portfolio use, third-party materials, revisions, warranties, and deadlines." },
    { category: "Creative & technology", id: "software-development", name: "Software development agreement", prompt: "A software development agreement for [DEVELOPER] to build [PRODUCT] for [CLIENT]. Include specifications, milestones, acceptance tests, fees, change requests, source-code ownership, third-party components, support, security, confidentiality, and termination." },
    { category: "Creative & technology", id: "saas-agreement", name: "SaaS subscription agreement", prompt: "A SaaS agreement for [PROVIDER] to supply [SERVICE] to [CUSTOMER]. Include users, fees, service levels, acceptable use, data rights, security, confidentiality, support, warranties, liability, term, renewal, and termination." },
    { category: "Releases & consent", id: "release-waiver", name: "Release and waiver", prompt: "A release and assumption-of-risk waiver for participation in [ACTIVITY] organized by [ORGANIZATION]. Describe risks, released parties, emergency treatment consent if relevant, governing law, and any provisions requiring jurisdiction-specific review." },
    { category: "Releases & consent", id: "photo-release", name: "Photo and media release", prompt: "A media release permitting [PERSON] to be photographed or recorded by [ORGANIZATION] for [USES]. Address media, territory, duration, compensation, editing, attribution, revocation if applicable, and whether a guardian must sign." },
    { category: "Releases & consent", id: "acknowledgment", name: "Acknowledgment", prompt: "A plain-language acknowledgment that [PERSON] received, understood, or accepted [ITEM/POLICY/INFORMATION] on [DATE]. Describe any return, care, or compliance responsibilities and avoid adding unrelated obligations." },
    { category: "Personal", id: "repayment-plan", name: "Repayment plan", prompt: "A repayment agreement where [DEBTOR] owes [CREDITOR] [AMOUNT] and will pay [SCHEDULE]. Include due dates, payment method, interest if any, prepayment, missed-payment consequences, and when the obligation is satisfied." },
    { category: "Personal", id: "pet-agreement", name: "Pet ownership agreement", prompt: "An agreement between [PEOPLE] concerning care and ownership of [PET]. Include primary residence, expenses, veterinary decisions, schedules, travel, records, and what happens if circumstances change." },
  ];

  function toast(message) {
    const el = $("#toast"); el.textContent = message; el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2300);
  }
  function saveStatus(text = "Saved") {
    $("#saveState").textContent = text;
    if (text !== "Saved") setTimeout(() => $("#saveState").textContent = "Saved", 900);
  }
  function initials(name) {
    return (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase();
  }
  function setMode(mode) {
    state.mode = mode;
    $("#draftCard").classList.toggle("active", mode === "draft");
    $("#uploadCard").classList.toggle("active", mode === "upload");
    $("#draftPanel").classList.toggle("hidden", mode !== "draft");
    $("#uploadPanel").classList.toggle("hidden", mode !== "upload");
  }
  function applyTemplate(id) {
    const template = agreementTemplates.find(item => item.id === id);
    if (!template) return;
    $("#intent").value = template.prompt;
    $("#intent").focus();
    $("#agreementCategory").value = template.category;
    populateAgreementTypes(template.category, template.id);
    saveStatus("Template added");
  }
  function populateAgreementTypes(category, selected = "") {
    const select = $("#agreementType");
    const matches = agreementTemplates.filter(item => item.category === category);
    select.innerHTML = '<option value="">Choose an agreement…</option>' + matches.map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("");
    select.disabled = !matches.length;
    select.value = selected;
  }
  function initializeTemplates() {
    const categories = [...new Set(agreementTemplates.map(item => item.category))];
    $("#agreementCategory").insertAdjacentHTML("beforeend", categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join(""));
  }
  function showEditor() {
    $("#homeView").classList.add("hidden");
    $("#editorView").classList.remove("hidden");
    window.scrollTo(0, 0);
  }
  function showHome() {
    $("#editorView").classList.add("hidden");
    $("#homeView").classList.remove("hidden");
  }
  function addPerson(person = {}) {
    const row = $("#personTemplate").content.firstElementChild.cloneNode(true);
    const name = $(".person-name", row), email = $(".person-email", row), avatar = $(".person-avatar", row);
    name.value = person.name || ""; email.value = person.email || "";
    const update = () => { avatar.textContent = initials(name.value); updatePeopleCount(); saveStatus("Saving…"); };
    name.addEventListener("input", update); email.addEventListener("input", () => saveStatus("Saving…"));
    $(".remove-person", row).addEventListener("click", () => { row.remove(); updatePeopleCount(); });
    $("#peopleList").append(row); update();
  }
  function setOnlyMe(enabled) {
    if (enabled && (!state.profile.name || !state.sessionEmail)) {
      $("#onlyMe").checked = false; $("#profileDialog").showModal(); toast("Complete your name and email first."); return;
    }
    if (enabled) { $("#peopleList").innerHTML = ""; addPerson({ name: state.profile.name, email: state.sessionEmail }); }
    $$("input", $("#peopleList")).forEach(input => input.readOnly = enabled);
    $$(".remove-person", $("#peopleList")).forEach(button => button.classList.toggle("hidden", enabled));
    $("#addPerson").classList.toggle("hidden", enabled);
    $("#reviewButton").textContent = enabled ? "Review & sign →" : "Review & send →";
    updatePeopleCount();
  }
  function signaturePad(canvas) {
    const context = canvas.getContext("2d"); let drawing = false, ink = false;
    context.lineWidth = 2.2; context.lineCap = "round"; context.lineJoin = "round"; context.strokeStyle = "#1e6048";
    const point = event => { const rect = canvas.getBoundingClientRect(); const source = event.touches?.[0] || event; return { x: (source.clientX - rect.left) * canvas.width / rect.width, y: (source.clientY - rect.top) * canvas.height / rect.height }; };
    const start = event => { event.preventDefault(); drawing = true; const p = point(event); context.beginPath(); context.moveTo(p.x, p.y); };
    const move = event => { if (!drawing) return; event.preventDefault(); const p = point(event); context.lineTo(p.x, p.y); context.stroke(); ink = true; };
    const stop = () => { drawing = false; };
    canvas.addEventListener("pointerdown", start); canvas.addEventListener("pointermove", move); window.addEventListener("pointerup", stop);
    return { clear() { context.clearRect(0, 0, canvas.width, canvas.height); ink = false; }, hasInk() { return ink; }, data() { return ink ? canvas.toDataURL("image/png") : ""; }, load(data) { if (!data) return; const image = new Image(); image.onload = () => { context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height); ink = true; }; image.src = data; } };
  }
  const profilePad = signaturePad($("#profileSignatureCanvas"));
  const signPad = signaturePad($("#signSignatureCanvas"));
  function setSignatureMode(scope, mode) {
    state[`${scope}SignatureMode`] = mode;
    $(`#${scope}TypeTab`).classList.toggle("active", mode === "font"); $(`#${scope}DrawTab`).classList.toggle("active", mode === "draw");
    $(`#${scope}TypePanel`).classList.toggle("hidden", mode !== "font"); $(`#${scope}DrawPanel`).classList.toggle("hidden", mode !== "draw");
  }
  function applySignatureFont(scope, font) {
    const preview = scope === "profile" ? $("#signaturePreview") : $("#typedSignature");
    preview.className = `signature-preview signature-${font}`;
  }
  function updateSignReady() {
    $("#completeSignature").disabled = !$("#signConsent").checked || !$("#signerName").value.trim();
  }
  function documentHtmlWithoutFieldMarkers() {
    const copy = $("#documentPaper").cloneNode(true);
    $$(".auto-field", copy).forEach(marker => marker.remove());
    return copy.innerHTML;
  }
  function fallbackFields() {
    const anchors = $$("p,h2,li", $("#documentPaper"));
    const anchorText = (anchors.at(-1)?.textContent || $("#documentPaper").textContent || "Agreement").trim().slice(0, 90);
    const needsInitials = /\binitials?\b/i.test($("#documentPaper").textContent);
    return people().filter(person => person.name && person.email).flatMap((person, partyIndex) => [
      { type: "full_name", partyIndex, anchorText, placement: "after", page: 0, x: 0, y: 0, width: 0, height: 0 },
      { type: "signature", partyIndex, anchorText, placement: "after", page: 0, x: 0, y: 0, width: 0, height: 0 },
      { type: "date", partyIndex, anchorText, placement: "after", page: 0, x: 0, y: 0, width: 0, height: 0 },
      ...(needsInitials ? [{ type: "initials", partyIndex, anchorText, placement: "after", page: 0, x: 0, y: 0, width: 0, height: 0 }] : []),
    ]);
  }
  function renderAutomaticFields(fields) {
    $$(".auto-field", $("#documentPaper")).forEach(marker => marker.remove());
    const nodes = $$("p,h1,h2,li", $("#documentPaper"));
    for (const field of fields) {
      const party = people()[field.partyIndex]; if (!party) continue;
      const anchor = nodes.find(node => field.anchorText && node.textContent.includes(field.anchorText)) || nodes.at(-1) || $("#documentPaper");
      const marker = document.createElement("span"); marker.className = `auto-field auto-field-${field.type}`; marker.contentEditable = "false";
      marker.textContent = `${field.type.replace("_", " ")} · ${party.name}`;
      field.placement === "before" ? anchor.before(marker) : anchor.after(marker);
    }
  }
  function updatePeopleCount() { $("#peopleCount").textContent = $$(".person-row", $("#peopleList")).length; }
  function people() {
    return $$(".person-row", $("#peopleList")).map(row => ({ name: $(".person-name", row).value.trim(), email: $(".person-email", row).value.trim() }));
  }
  function renderRecent() {
    const list = $("#recentList");
    if (!state.documents.length) { list.innerHTML = '<div class="empty-row">Your drafts and sent agreements will appear here.</div>'; return; }
    list.innerHTML = state.documents.map((doc, i) => `<div class="recent-row" data-index="${i}"><div><strong>${escapeHtml(doc.title)}</strong><span>${escapeHtml(doc.people || "No recipients")} · ${escapeHtml(doc.date)}</span></div><em>${escapeHtml(doc.status)}</em></div>`).join("");
  }
  function escapeHtml(value) { return safeHtml(value); }
  async function invokeAI(action, payload) {
    return invokeFunction("ink-ai-document", { action, ...payload });
  }
  async function refreshAIStatus(hasSession = Boolean(state.sessionEmail)) {
    const status = $("#aiStatus"), button = $("#createDraft");
    state.aiReady = false; button.disabled = true;
    if (!configured) {
      status.textContent = "AI drafting needs Supabase configuration.";
      status.className = "ai-status unavailable"; button.textContent = "AI setup required"; return;
    }
    if (!hasSession) {
      status.textContent = "Sign in to use private AI drafting.";
      status.className = "ai-status unavailable"; button.textContent = "Sign in to draft"; return;
    }
    status.textContent = "Checking OpenAI connection…"; status.className = "ai-status"; button.textContent = "Checking AI…";
    try {
      await invokeAI("status", {});
      state.aiReady = true; status.textContent = "AI drafting is ready."; status.className = "ai-status ready";
      button.disabled = false; button.innerHTML = 'Create draft <span>→</span>';
    } catch (error) {
      status.textContent = error.message || "OpenAI drafting is unavailable.";
      status.className = "ai-status unavailable"; button.textContent = "AI unavailable";
    }
  }
  async function createDraft() {
    const intent = $("#intent").value.trim();
    if (intent.length < 12) { toast("Describe the agreement in a little more detail."); return; }
    if (!state.aiReady) { toast("AI drafting must be connected before creating a draft."); return; }
    const button = $("#createDraft"); button.disabled = true; button.textContent = "Drafting…";
    try {
      const draft = await invokeAI("draft", { intent, parties: [state.profile] });
      $("#documentTitle").value = draft.title;
      $("#documentPaper").innerHTML = draft.html;
      state.fields = Array.isArray(draft.fields) ? draft.fields : [];
      state.originalHtml = draft.html;
      $("#peopleList").innerHTML = ""; addPerson(state.profile);
      showEditor(); toast("AI draft created");
    } catch (error) { toast(error.message || "Could not create the draft."); }
    finally { button.disabled = !state.aiReady; button.innerHTML = 'Create draft <span>→</span>'; }
  }
  async function reviseDraft() {
    const instruction = $("#revisionPrompt").value.trim();
    if (!instruction) { toast("Tell the AI what you want changed."); return; }
    const button = $("#reviseButton"); button.disabled = true; button.textContent = "Revising…";
    try {
      let result = await invokeAI("revise", { title: $("#documentTitle").value, html: $("#documentPaper").innerHTML, instruction, parties: people() });
      if (result) { $("#documentTitle").value = result.title; $("#documentPaper").innerHTML = result.html; state.fields = Array.isArray(result.fields) ? result.fields : []; }
      else {
        const note = document.createElement("p"); note.innerHTML = `<mark>Revision ${++state.revision} guidance:</mark> ${escapeHtml(instruction)}`; $("#documentPaper").append(note);
      }
      $("#revisionPrompt").value = ""; saveStatus("Saving…"); toast(configured ? "Draft revised" : "Revision guidance added in demo mode");
    } catch (error) { toast(error.message || "Could not revise the draft."); }
    finally { button.disabled = false; button.textContent = "Revise with AI"; }
  }
  async function chooseFiles(files) {
    for (const file of [...files]) {
      const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
      if (!allowed.includes(file.type) && !/\.(pdf|docx|txt)$/i.test(file.name)) { toast(`${file.name} is not a PDF, DOCX, or TXT file.`); continue; }
      if (file.size > 10 * 1024 * 1024) { toast(`${file.name} is larger than 10 MB.`); continue; }
      if (state.files.some(item => item.file.name === file.name && item.file.size === file.size)) continue;
      const item = { id: crypto.randomUUID(), file, url: URL.createObjectURL(file), textPreview: "" };
      if (file.type === "text/plain" || /\.txt$/i.test(file.name)) item.textPreview = (await file.text()).slice(0, 900);
      state.files.push(item);
    }
    renderFiles();
  }
  function moveFile(index, direction) {
    const next = index + direction;
    if (next < 0 || next >= state.files.length) return;
    [state.files[index], state.files[next]] = [state.files[next], state.files[index]];
    renderFiles();
  }
  function removeFile(index) {
    URL.revokeObjectURL(state.files[index].url);
    state.files.splice(index, 1);
    renderFiles();
  }
  function renderFiles() {
    const list = $("#fileList"); list.innerHTML = "";
    state.files.forEach((item, index) => {
      const card = document.createElement("div"); card.className = "file-card"; card.draggable = true; card.dataset.index = index;
      const preview = /\.pdf$/i.test(item.file.name)
        ? `<object data="${item.url}#page=1&view=FitH" type="application/pdf" aria-label="Preview of ${escapeHtml(item.file.name)}"></object>`
        : item.textPreview ? `<pre>${escapeHtml(item.textPreview)}</pre>` : '<span class="docx-preview">DOCX</span>';
      card.innerHTML = `<div class="file-preview">${preview}</div><div class="file-meta"><strong class="file-name" title="${escapeHtml(item.file.name)}">${index + 1}. ${escapeHtml(item.file.name)}</strong><span class="file-size">${(item.file.size / 1024).toFixed(0)} KB</span></div><div class="file-controls"><button data-move="-1" aria-label="Move earlier">←</button><button data-move="1" aria-label="Move later">→</button><button class="remove-file" aria-label="Remove file">×</button></div>`;
      $$('[data-move]', card).forEach(button => button.addEventListener("click", () => moveFile(index, Number(button.dataset.move))));
      $(".remove-file", card).addEventListener("click", () => removeFile(index));
      card.addEventListener("dragstart", () => card.classList.add("dragging"));
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
      card.addEventListener("dragover", event => event.preventDefault());
      card.addEventListener("drop", event => {
        event.preventDefault();
        const from = Number($(".file-card.dragging")?.dataset.index);
        if (Number.isInteger(from) && from !== index) { const [moved] = state.files.splice(from, 1); state.files.splice(index, 0, moved); renderFiles(); }
      });
      list.append(card);
    });
    $("#fileInfo").classList.toggle("hidden", !state.files.length);
    $("#prepareUpload").disabled = !state.files.length;
  }
  async function prepareUpload() {
    if (!state.files.length) return;
    const button = $("#prepareUpload"); button.disabled = true; button.textContent = "Preparing…";
    try {
      const sections = []; state.sourceFiles = [];
      for (const item of state.files) {
        button.textContent = `Preparing ${sections.length + 1} of ${state.files.length}…`;
        let body;
        if (configured) {
          const uploaded = await uploadOriginal(item.file); state.sourceFiles.push(uploaded);
          const result = await invokeAI("extract", { fileUrl: uploaded.url, filename: item.file.name, parties: [state.profile] });
          body = result.html;
        } else if (item.textPreview) {
          body = (await item.file.text()).split(/\n{2,}/).map(text => `<p>${escapeHtml(text)}</p>`).join("");
        } else {
          body = `<p class="lede">Preview and AI extraction activate after Supabase is configured. The original ${escapeHtml(item.file.name)} remains part of this ordered signing packet.</p>`;
        }
        sections.push(`<section data-source-file="${escapeHtml(item.file.name)}"><p class="eyebrow">DOCUMENT ${sections.length + 1} · ${escapeHtml(item.file.name)}</p>${body}</section>`);
      }
      $("#documentPaper").innerHTML = sections.join('<hr class="document-break">');
      $("#documentTitle").value = state.files.length === 1 ? state.files[0].file.name.replace(/\.[^.]+$/, "") : `${state.files[0].file.name.replace(/\.[^.]+$/, "")} + ${state.files.length - 1} more`;
      $("#peopleList").innerHTML = ""; addPerson(state.profile); showEditor();
    } catch (error) { toast(error.message || "Could not prepare that document."); }
    finally { button.disabled = false; button.innerHTML = 'Prepare for signing <span>→</span>'; }
  }
  async function openReview() {
    const valid = people().filter(p => p.name && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email));
    if (!valid.length) { toast("Add at least one signer with a valid email."); return; }
    const reviewButton = $("#reviewButton"); reviewButton.disabled = true; reviewButton.textContent = "Placing fields…";
    try {
      const result = await invokeAI("place", { title: $("#documentTitle").value, html: documentHtmlWithoutFieldMarkers(), parties: valid });
      state.fields = result?.fields?.length ? result.fields : fallbackFields();
    } catch { state.fields = fallbackFields(); toast("Used safe automatic field placement."); }
    renderAutomaticFields(state.fields);
    reviewButton.disabled = false; reviewButton.textContent = $("#onlyMe").checked ? "Review & sign →" : "Review & send →";
    $("#reviewSummary").innerHTML = `<p><strong>${escapeHtml($("#documentTitle").value)}</strong></p><p>${valid.length} signer${valid.length === 1 ? "" : "s"}: ${valid.map(p => escapeHtml(p.name)).join(", ")}</p><p>${state.fields.length} signature, initials, name, and date fields placed automatically.</p><p>Once frozen, edits require a new version.</p>`;
    $("#reviewConfirm").checked = false; $("#sendButton").disabled = true; $("#reviewDialog").showModal();
  }
  async function sendDocument() {
    const doc = { title: $("#documentTitle").value || "Untitled agreement", people: people().filter(p => p.name).map(p => p.name).join(", "), date: new Date().toLocaleDateString(), status: configured ? "SENT" : "DEMO · READY" };
    try {
      let envelope = null;
      if (configured) envelope = await invokeFunction("ink-envelope", { action: "send", title: doc.title, html: documentHtmlWithoutFieldMarkers(), parties: people(), sourceFiles: state.sourceFiles, fields: state.fields });
      state.documents.unshift(doc); saveDemoDocuments(state.documents); renderRecent(); $("#reviewDialog").close(); showHome(); toast(configured ? "Invitations created" : "Saved locally in demo mode");
      if (configured && envelope?.invitations?.some(invite => !invite.emailSent)) showInvitationLinks(envelope.invitations.filter(invite => !invite.emailSent));
      if (configured && $("#onlyMe").checked && envelope?.invitations?.[0]?.url) location.href = envelope.invitations[0].url;
    } catch (error) { toast(error.message || "Could not send invitations."); }
  }
  function showInvitationLinks(invitations) {
    const list = $("#linksList"); list.innerHTML = "";
    for (const invite of invitations) {
      const row = document.createElement("div"); row.className = "invite-link";
      const label = document.createElement("span"); label.textContent = `${invite.email} · ${invite.url}`;
      const button = document.createElement("button"); button.type = "button"; button.textContent = "Copy";
      button.addEventListener("click", async () => { await navigator.clipboard.writeText(invite.url); toast("Private link copied"); });
      row.append(label, button); list.append(row);
    }
    $("#linksDialog").showModal();
  }
  async function loadSigningRequest(token) {
    state.signingToken = token;
    $("#homeView").classList.add("hidden"); $("#editorView").classList.add("hidden"); $("#signView").classList.remove("hidden");
    try {
      const result = await invokePublicFunction("ink-envelope", { action: "get", token });
      $("#signTitle").textContent = result.title; $("#signPaper").innerHTML = result.html; $("#signerName").value = result.signerName; $("#typedSignature").textContent = result.signerName || "Your signature";
      if (result.files?.length) {
        const originals = result.files.map((file, index) => `<li><a href="${file.url}" target="_blank" rel="noopener">${index + 1}. ${escapeHtml(file.filename)}</a> <small>SHA-256 ${escapeHtml(file.sha256.slice(0, 12))}…</small></li>`).join("");
        $("#signPaper").insertAdjacentHTML("afterbegin", `<section class="original-files"><h2>Original files</h2><p>These originals are part of the frozen signing packet.</p><ol>${originals}</ol></section>`);
      }
      if (result.fields?.length) $("#signPaper").insertAdjacentHTML("beforeend", `<section class="auto-fill-summary"><h2>Automatic fields</h2><p>Your signature, initials, full name, and signing date will be applied to ${result.fields.length} assigned field${result.fields.length === 1 ? "" : "s"} when you approve below.</p></section>`);
      if (result.savedSignature) {
        const saved = result.savedSignature;
        $("#signSignatureFont").value = saved.signature_font || "newsreader"; applySignatureFont("sign", $("#signSignatureFont").value);
        setSignatureMode("sign", saved.signature_method === "draw" ? "draw" : "font");
        if (saved.signature_data) signPad.load(saved.signature_data);
      }
    } catch (error) { $("#signPaper").innerHTML = `<h1>Link unavailable</h1><p>${escapeHtml(error.message)}</p>`; $("#completeSignature").disabled = true; }
  }
  async function completeSignature() {
    const token = state.signingToken;
    try {
      const method = state.signSignatureMode;
      const signatureData = method === "draw" ? signPad.data() : $("#signerName").value.trim();
      if (method === "draw" && !signPad.hasInk()) return toast("Draw your signature first.");
      await invokePublicFunction("ink-envelope", { action: "sign", token, adoptedName: $("#signerName").value.trim(), consent: $("#signConsent").checked, signatureMethod: method, signatureData, signatureFont: $("#signSignatureFont").value });
      $("#signPaper").insertAdjacentHTML("beforeend", `<h2>Signed</h2><p>Electronically signed by <strong>${escapeHtml($("#signerName").value)}</strong> on ${new Date().toLocaleString()}.</p>`);
      $("#completeSignature").disabled = true; toast("Signature recorded");
    } catch (error) { toast(error.message); }
  }
  function downloadHtml() {
    const html = `<!doctype html><meta charset="utf-8"><title>${escapeHtml($("#documentTitle").value)}</title><style>body{max-width:760px;margin:60px auto;font:16px/1.6 Georgia,serif;padding:20px}h1{text-align:center}</style>${$("#documentPaper").innerHTML}`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" })); const a = document.createElement("a"); a.href = url; a.download = `${$("#documentTitle").value || "agreement"}.html`; a.click(); URL.revokeObjectURL(url);
  }
  async function refreshAuth() {
    if (!configured) {
      $("#authStatus").textContent = "Demo mode · configure Supabase to enable login and AI.";
      await refreshAIStatus(false);
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    state.sessionEmail = session?.user?.email || "";
    $("#authPanel").classList.toggle("hidden", Boolean(session)); $("#onlyMeOption").classList.toggle("hidden", !session);
    $("#signOutButton").classList.toggle("hidden", !session);
    $("#authStatus").textContent = session ? `Signed in as ${session.user.email}` : "Not signed in";
    if (session?.user?.email) { $("#profileEmail").value = session.user.email; $("#profileEmail").readOnly = true; }
    else $("#profileEmail").readOnly = false;
    await refreshAIStatus(Boolean(session));
  }
  async function sendSignInLink() {
    const email = $("#authEmail").value.trim();
    if (!email) return toast("Enter your email address.");
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href.split("#")[0] } });
    if (error) return toast(error.message);
    toast("Check your email for the sign-in link.");
  }
  async function saveProfile(event) {
    event.preventDefault();
    if (state.profileSignatureMode === "draw" && !profilePad.hasInk()) return toast("Draw your signature or choose a font.");
    state.profile = { name: $("#profileName").value.trim(), email: $("#profileEmail").value.trim(), signatureMethod: state.profileSignatureMode, signatureFont: $("#profileSignatureFont").value, signatureData: state.profileSignatureMode === "draw" ? profilePad.data() : "" };
    try { await persistProfile(state.profile); $("#profileButton").textContent = initials(state.profile.name); $("#signaturePreview").textContent = state.profile.name.split(" ")[0] || "Signature"; $("#profileDialog").close(); toast(configured ? "Profile saved" : "Profile saved on this device"); }
    catch (error) { toast(error.message); }
  }

  $("#draftCard").addEventListener("click", () => setMode("draft")); $("#uploadCard").addEventListener("click", () => setMode("upload"));
  $(".brand").addEventListener("click", event => { event.preventDefault(); showHome(); });
  $$("[data-template]").forEach(button => button.addEventListener("click", () => applyTemplate(button.dataset.template)));
  $("#agreementCategory").addEventListener("change", event => populateAgreementTypes(event.target.value));
  $("#agreementType").addEventListener("change", event => applyTemplate(event.target.value));
  $("#createDraft").addEventListener("click", createDraft); $("#backButton").addEventListener("click", showHome); $("#addPerson").addEventListener("click", () => addPerson()); $("#reviseButton").addEventListener("click", reviseDraft);
  $("#onlyMe").addEventListener("change", event => setOnlyMe(event.target.checked));
  $("#profileButton").addEventListener("click", () => $("#profileDialog").showModal()); $("#saveProfile").addEventListener("click", saveProfile);
  $("#signInButton").addEventListener("click", sendSignInLink);
  $("#signOutButton").addEventListener("click", async () => { await supabase.auth.signOut(); await refreshAuth(); toast("Signed out"); });
  $("#fileInput").addEventListener("change", e => chooseFiles(e.target.files)); $("#dropzone").addEventListener("click", () => $("#fileInput").click());
  ["dragenter", "dragover"].forEach(type => $("#dropzone").addEventListener(type, e => { e.preventDefault(); $("#dropzone").classList.add("dragging"); }));
  ["dragleave", "drop"].forEach(type => $("#dropzone").addEventListener(type, e => { e.preventDefault(); $("#dropzone").classList.remove("dragging"); }));
  $("#dropzone").addEventListener("drop", e => chooseFiles(e.dataTransfer.files)); $("#prepareUpload").addEventListener("click", prepareUpload);
  $("#reviewButton").addEventListener("click", openReview); $("#reviewConfirm").addEventListener("change", e => $("#sendButton").disabled = !e.target.checked); $("#sendButton").addEventListener("click", sendDocument);
  $("#signerName").addEventListener("input", e => { $("#typedSignature").textContent = e.target.value || "Your signature"; updateSignReady(); });
  $("#profileTypeTab").addEventListener("click", () => setSignatureMode("profile", "font")); $("#profileDrawTab").addEventListener("click", () => setSignatureMode("profile", "draw"));
  $("#signTypeTab").addEventListener("click", () => setSignatureMode("sign", "font")); $("#signDrawTab").addEventListener("click", () => setSignatureMode("sign", "draw"));
  $("#profileSignatureFont").addEventListener("change", event => applySignatureFont("profile", event.target.value)); $("#signSignatureFont").addEventListener("change", event => applySignatureFont("sign", event.target.value));
  $("#clearProfileSignature").addEventListener("click", () => profilePad.clear()); $("#clearSignSignature").addEventListener("click", () => signPad.clear());
  $("#signConsent").addEventListener("change", updateSignReady);
  $("#completeSignature").addEventListener("click", completeSignature);
  $("#downloadButton").addEventListener("click", downloadHtml); $("#clearDemo").addEventListener("click", () => { state.documents = []; clearDemoDocuments(); renderRecent(); });
  $("#documentPaper").addEventListener("input", () => saveStatus("Saving…")); $("#documentTitle").addEventListener("input", () => saveStatus("Saving…"));
  $("#profileName").value = state.profile.name || ""; $("#profileEmail").value = state.profile.email || ""; $("#profileButton").textContent = initials(state.profile.name); $("#signaturePreview").textContent = state.profile.name || "Signature";
  $("#profileSignatureFont").value = state.profile.signatureFont || "newsreader"; applySignatureFont("profile", $("#profileSignatureFont").value); setSignatureMode("profile", state.profile.signatureMethod || "font"); profilePad.load(state.profile.signatureData);
  initializeTemplates(); addPerson(state.profile); renderRecent(); refreshAuth();
  if (supabase) supabase.auth.onAuthStateChange(() => refreshAuth());
  const signingToken = new URLSearchParams(location.hash.replace(/^#/, "")).get("sign") || new URLSearchParams(location.search).get("sign");
  if (signingToken) loadSigningRequest(signingToken);
})();
