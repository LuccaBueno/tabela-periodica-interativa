/* =========================================================
   Tabela Periódica Interativa — lógica da interface
   Depende de window.PERIODIC_ELEMENTS (elements.js).
   JavaScript puro, sem dependências, compatível com file://.
   ========================================================= */
(function () {
  "use strict";

  const ELEMENTS = Array.isArray(window.PERIODIC_ELEMENTS) ? window.PERIODIC_ELEMENTS : [];
  const BY_NUMBER = new Map(ELEMENTS.map((e) => [e.number, e]));
  const MAX_COMPARE = 3;

  const CATEGORIES = [
    { id: "alkali", label: "Metais alcalinos" },
    { id: "alkaline-earth", label: "Metais alcalino-terrosos" },
    { id: "transition", label: "Metais de transição" },
    { id: "post-transition", label: "Outros metais" },
    { id: "metalloid", label: "Semimetais" },
    { id: "nonmetal", label: "Ametais" },
    { id: "halogen", label: "Halogênios" },
    { id: "noble-gas", label: "Gases nobres" },
    { id: "lanthanide", label: "Lantanídeos" },
    { id: "actinide", label: "Actinídeos" },
    { id: "unknown", label: "Classificação incerta" },
  ];
  const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));

  const STATE_LABEL = {
    solid: "Sólido",
    liquid: "Líquido",
    gas: "Gasoso",
    unknown: "Desconhecido",
  };
  const ORIGIN_LABEL = {
    primordial: "Natural (primordial)",
    trace: "Natural, apenas em traços",
    synthetic: "Sintético",
  };
  const ORIGIN_DETAIL = {
    primordial: "Presente na Terra desde a sua formação.",
    trace: "Ocorre na natureza apenas em quantidades mínimas, por decaimento radioativo ou reações nucleares naturais.",
    synthetic: "Obtido apenas artificialmente, em reatores ou aceleradores de partículas.",
  };

  /* ---------- Estado da aplicação ---------- */
  const state = {
    selected: null,
    compare: [],
    families: new Set(),
    physState: "",
    origin: "",
    query: "",
    compareMode: false,
    focusNumber: 1,
    hoverNumber: null,
    lastMatches: [],
  };

  /* ---------- Referências do DOM ---------- */
  const $ = (sel) => document.querySelector(sel);
  const dom = {
    table: $("#ptable"),
    preview: $("#preview"),
    search: $("#search-input"),
    status: $("#search-status"),
    filterState: $("#filter-state"),
    filterOrigin: $("#filter-origin"),
    legend: $("#legend"),
    legendList: $("#legend-list"),
    btnLegend: $("#btn-legend"),
    btnTheme: $("#btn-theme"),
    btnAbout: $("#btn-about"),
    btnCompareMode: $("#btn-compare-mode"),
    btnClearFilters: $("#btn-clear-filters"),
    btnClearSelection: $("#btn-clear-selection"),
    panel: $("#detail-panel"),
    panelContent: $("#detail-content"),
    tray: $("#compare-tray"),
    trayChips: $("#compare-chips"),
    trayCount: $("#compare-count"),
    btnOpenCompare: $("#btn-open-compare"),
    btnClearCompare: $("#btn-clear-compare"),
    compareDialog: $("#compare-dialog"),
    compareBody: $("#compare-body"),
    aboutDialog: $("#about-dialog"),
  };
  const cells = new Map(); // number -> button

  /* ---------- Utilitários ---------- */
  const nf = (max) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: max });
  const NF = { 0: nf(0), 1: nf(1), 2: nf(2), 3: nf(3), 4: nf(4) };

  function normalize(text) {
    return String(text).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (err) { return null; }
  }
  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (err) { /* armazenamento indisponível: ignora */ }
  }

  function formatMass(e) {
    const value = e.atomicMass.replace(".", ",");
    return e.massIsMostStableIsotope ? `[${value}]` : value;
  }

  function formatTemp(kelvin) {
    const celsius = Math.round((kelvin - 273.15) * 100) / 100;
    return `${NF[2].format(kelvin)} K (${NF[1].format(celsius)} °C)`;
  }

  const NA = '<span class="na">Indisponível</span>';
  const badgeEst = '<span class="badge badge-est" title="Valor estimado ou extrapolado, não medido diretamente">estimado</span>';
  const badgePred = '<span class="badge badge-pred" title="Configuração prevista por cálculos teóricos">previsto</span>';

  function isEstimated(e, field) {
    return Array.isArray(e.estimated) && e.estimated.includes(field);
  }

  function densityHtml(e) {
    if (e.density == null) return NA;
    const cond = e.densityUnit === "g/L" ? " (gás, 25 °C, 1 atm)" : "";
    return `${NF[4].format(e.density)} ${e.densityUnit}${cond}${isEstimated(e, "density") ? badgeEst : ""}`;
  }

  function thermalHtml(e, field) {
    const value = field === "melt" ? e.meltingPoint : e.boilingPoint;
    const note = field === "melt" ? e.meltingNote : e.boilingNote;
    const key = field === "melt" ? "meltingPoint" : "boilingPoint";
    if (value == null) return note ? escapeHtml(note) : NA;
    let html = formatTemp(value);
    if (note) html += ` — ${escapeHtml(note)}`;
    if (isEstimated(e, key)) html += badgeEst;
    return html;
  }

  function stateText(e) {
    if (e.state === "unknown") return "Desconhecido (nunca obtido em quantidade macroscópica)";
    return STATE_LABEL[e.state];
  }

  function groupText(e) {
    return e.group == null ? "— (série f)" : String(e.group);
  }

  function discoveryText(e) {
    return e.discoveryLabel ? escapeHtml(e.discoveryLabel) : NA;
  }

  function discovererText(e) {
    if (e.discoverer) return escapeHtml(e.discoverer);
    if (e.discoveryLabel === "Antiguidade") return "Não atribuído — conhecido desde a Antiguidade";
    return NA;
  }

  function tileHtml(e, extraClass) {
    return `<div class="preview-tile ${extraClass || ""}" style="--cat: var(--c-${e.category})" aria-hidden="true">
      <span class="pt-z">${e.number}</span><span class="pt-sym">${e.symbol}</span></div>`;
  }

  /* ---------- Construção da tabela ---------- */
  function buildTable() {
    const frag = document.createDocumentFragment();

    for (let g = 1; g <= 18; g++) {
      const label = document.createElement("div");
      label.className = "axis-label group-label";
      label.style.gridColumn = String(g + 1);
      label.style.gridRow = "1";
      label.textContent = g;
      label.title = `Grupo ${g}`;
      label.setAttribute("aria-hidden", "true");
      frag.appendChild(label);
    }
    for (let p = 1; p <= 7; p++) {
      const label = document.createElement("div");
      label.className = "axis-label";
      label.style.gridColumn = "1";
      label.style.gridRow = String(p + 1);
      label.textContent = p;
      label.title = `Período ${p}`;
      label.setAttribute("aria-hidden", "true");
      frag.appendChild(label);
    }
    [["Lantanídeos", 10, "lanthanide"], ["Actinídeos", 11, "actinide"]].forEach(([text, row, cat]) => {
      const label = document.createElement("div");
      label.className = "axis-label series-label";
      label.style.gridRow = String(row);
      label.style.color = `color-mix(in srgb, var(--c-${cat}) var(--sym-mix), var(--text))`;
      label.textContent = text;
      label.setAttribute("aria-hidden", "true");
      frag.appendChild(label);
    });

    [
      { row: 7, range: "57–71", label: "La–Lu", cat: "lanthanide", cls: "" },
      { row: 8, range: "89–103", label: "Ac–Lr", cat: "actinide", cls: "actinides" },
    ].forEach((m) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `series-marker ${m.cls}`;
      btn.style.gridColumn = "4";
      btn.style.gridRow = String(m.row);
      btn.innerHTML = `<span class="sm-range">${m.range}</span><span class="sm-label">${m.label}</span>`;
      btn.setAttribute("aria-label", `${CATEGORY_LABEL[m.cat]}, elementos ${m.range.replace("–", " a ")}, exibidos na linha separada abaixo. Clique para destacar a série.`);
      btn.tabIndex = -1;
      btn.addEventListener("click", () => toggleFamily(m.cat));
      frag.appendChild(btn);
    });

    ELEMENTS.forEach((e) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cell";
      btn.dataset.number = e.number;
      btn.style.setProperty("--cat", `var(--c-${e.category})`);
      btn.style.gridColumn = String(e.col + 1);
      btn.style.gridRow = String(e.row + 1);
      btn.tabIndex = e.number === state.focusNumber ? 0 : -1;
      btn.title = `${e.namePt} (${e.nameEn})`;
      btn.setAttribute(
        "aria-label",
        `${e.namePt}, símbolo ${e.symbol}, número atômico ${e.number}, ${CATEGORY_LABEL[e.category]}`
      );
      btn.innerHTML =
        `<span class="cell-z">${e.number}</span>` +
        `<span class="cell-sym">${e.symbol}</span>` +
        `<span class="cell-name">${escapeHtml(e.namePt.replace(/ \(.+\)$/, ""))}</span>` +
        `<span class="cell-mass">${formatMass(e)}</span>`;
      frag.appendChild(btn);
      cells.set(e.number, btn);
    });

    dom.table.appendChild(frag);
  }

  function buildLegend() {
    const counts = {};
    ELEMENTS.forEach((e) => { counts[e.category] = (counts[e.category] || 0) + 1; });
    dom.legendList.innerHTML = CATEGORIES.map((c) => `
      <li><button type="button" class="legend-chip" data-family="${c.id}" aria-pressed="false"
        style="--cat: var(--c-${c.id})">
        <span class="swatch" aria-hidden="true"></span>${c.label}
        <span class="count" aria-label="${counts[c.id] || 0} elementos">${counts[c.id] || 0}</span>
      </button></li>`).join("");
  }

  /* ---------- Pré-visualização ---------- */
  function renderPreview(number) {
    const e = BY_NUMBER.get(number);
    if (!e) {
      dom.preview.classList.add("is-empty");
      dom.preview.innerHTML = `<p class="preview-help">Passe o cursor sobre um elemento para ver um resumo. Clique para abrir todas as propriedades.</p>`;
      return;
    }
    dom.preview.classList.remove("is-empty");
    dom.preview.innerHTML = `
      ${tileHtml(e)}
      <div class="preview-info">
        <div class="preview-name">${escapeHtml(e.namePt)}<small>${escapeHtml(e.nameEn)}</small></div>
        <div class="preview-meta">
          <span class="cat-pill" style="--cat: var(--c-${e.category})">${CATEGORY_LABEL[e.category]}</span>
          <span class="dot">·</span>Massa ${formatMass(e)}
          <span class="dot">·</span>${e.group == null ? "Série f" : "Grupo " + e.group}, período ${e.period}
          <span class="dot">·</span>${STATE_LABEL[e.state]}
        </div>
        <div class="preview-conf">${escapeHtml(e.electronConfig)}${e.configPredicted ? " (prevista)" : ""}</div>
      </div>`;
  }

  /* ---------- Pesquisa e filtros ---------- */
  function matchesSearch(e, query) {
    if (!query) return true;
    if (/^\d+$/.test(query)) return e.number === Number(query);
    const q = normalize(query);
    if (!q) return true;
    const sym = e.symbol.toLowerCase();
    const pt = normalize(e.namePt);
    const en = normalize(e.nameEn);
    if (q.length <= 2) return sym.startsWith(q) || pt.startsWith(q) || en.startsWith(q);
    return sym === q || pt.includes(q) || en.includes(q);
  }

  function searchRank(e, query) {
    const q = normalize(query);
    if (/^\d+$/.test(q) && e.number === Number(q)) return 0;
    if (e.symbol.toLowerCase() === q) return 0;
    if (normalize(e.namePt) === q || normalize(e.nameEn) === q) return 1;
    if (normalize(e.namePt).startsWith(q) || normalize(e.nameEn).startsWith(q)) return 2;
    if (e.symbol.toLowerCase().startsWith(q)) return 3;
    return 4;
  }

  function matchesFilters(e) {
    if (state.families.size && !state.families.has(e.category)) return false;
    if (state.physState && e.state !== state.physState) return false;
    if (state.origin) {
      if (state.origin === "natural") {
        if (e.origin === "synthetic") return false;
      } else if (e.origin !== state.origin) return false;
    }
    return matchesSearch(e, state.query);
  }

  function applyFilters() {
    const searching = state.query.trim() !== "";
    const filtering = searching || state.families.size > 0 || !!state.physState || !!state.origin;
    const matches = [];

    ELEMENTS.forEach((e) => {
      const ok = matchesFilters(e);
      const cell = cells.get(e.number);
      cell.classList.toggle("is-dim", filtering && !ok);
      cell.classList.toggle("is-match", searching && ok);
      if (ok) matches.push(e);
    });

    dom.table.classList.toggle("is-filtering", filtering);
    dom.table.classList.toggle("is-searching", searching);
    dom.filterState.classList.toggle("is-active", !!state.physState);
    dom.filterOrigin.classList.toggle("is-active", !!state.origin);

    dom.legendList.classList.toggle("has-active", state.families.size > 0);
    dom.legendList.querySelectorAll(".legend-chip").forEach((chip) => {
      chip.setAttribute("aria-pressed", String(state.families.has(chip.dataset.family)));
    });

    if (searching) matches.sort((a, b) => searchRank(a, state.query) - searchRank(b, state.query) || a.number - b.number);
    state.lastMatches = matches;
    renderStatus(filtering, searching, matches);
  }

  function renderStatus(filtering, searching, matches) {
    if (!filtering) {
      dom.status.innerHTML = `<span><strong>${ELEMENTS.length}</strong> elementos</span>`;
      return;
    }
    if (matches.length === 0) {
      dom.status.innerHTML = `Nenhum elemento corresponde aos critérios.`;
      return;
    }
    let text = `<span><strong>${matches.length}</strong> de ${ELEMENTS.length} elementos em destaque`;
    if (searching) {
      const first = matches[0];
      text += ` · <kbd>Enter</kbd> abre ${escapeHtml(first.namePt)} (${first.symbol})`;
    }
    dom.status.innerHTML = text + "</span>";
  }

  function toggleFamily(id) {
    if (state.families.has(id)) state.families.delete(id);
    else state.families.add(id);
    applyFilters();
  }

  function clearFilters() {
    state.query = "";
    state.families.clear();
    state.physState = "";
    state.origin = "";
    dom.search.value = "";
    dom.filterState.value = "";
    dom.filterOrigin.value = "";
    applyFilters();
  }

  /* ---------- Seleção e painel de detalhes ---------- */
  function selectElement(number, opts) {
    const e = BY_NUMBER.get(number);
    if (!e) return;
    if (state.selected) cells.get(state.selected).classList.remove("is-selected");
    state.selected = number;
    const cell = cells.get(number);
    cell.classList.remove("is-selected");
    void cell.offsetWidth; // reinicia a animação
    cell.classList.add("is-selected");
    setRovingFocus(number, false);
    renderPanel(e);
    dom.panel.hidden = false;
    document.body.classList.add("body-panel-open");
    if (!opts || opts.focusPanel !== false) {
      const heading = dom.panel.querySelector("#detail-title");
      if (heading) heading.focus({ preventScroll: true });
    }
  }

  function closePanel(returnFocus) {
    if (dom.panel.hidden) return;
    dom.panel.hidden = true;
    document.body.classList.remove("body-panel-open");
    const previous = state.selected;
    if (state.selected) cells.get(state.selected).classList.remove("is-selected");
    state.selected = null;
    if (returnFocus && previous) cells.get(previous).focus();
  }

  function renderPanel(e) {
    const inCompare = state.compare.includes(e.number);
    const compareFull = !inCompare && state.compare.length >= MAX_COMPARE;
    const prev = BY_NUMBER.get(e.number - 1);
    const next = BY_NUMBER.get(e.number + 1);

    const rows = [
      ["Número atômico", `<span class="mono">${e.number}</span>`],
      ["Símbolo", `<span class="mono">${e.symbol}</span>`],
      ["Massa atômica", `<span class="mono">${formatMass(e)} u</span>${e.massIsMostStableIsotope ? " <span class=\"na\">(número de massa do isótopo mais estável)</span>" : ""}`],
      ["Grupo", groupText(e)],
      ["Período", String(e.period)],
      ["Bloco", e.block],
      ["Categoria", `<span class="cat-pill" style="--cat: var(--c-${e.category})">${CATEGORY_LABEL[e.category]}</span>`],
      ["Configuração eletrônica", e.electronConfig ? `<span class="mono">${escapeHtml(e.electronConfig)}</span>${e.configPredicted ? badgePred : ""}` : NA],
      ["Estado a 25 °C, 1 atm", stateText(e)],
      ["Densidade", densityHtml(e)],
      ["Ponto de fusão", thermalHtml(e, "melt")],
      ["Ponto de ebulição", thermalHtml(e, "boil")],
      ["Descoberta", discoveryText(e)],
      ["Descobridor(es)", discovererText(e)],
      ["Origem", `${ORIGIN_LABEL[e.origin]}<br><span class="na">${ORIGIN_DETAIL[e.origin]}</span>`],
    ];

    dom.panelContent.innerHTML = `
      <div class="detail-nav">
        <div class="detail-nav-group">
          <button type="button" class="icon-btn" data-nav="${prev ? prev.number : ""}" ${prev ? "" : "disabled"}
            aria-label="${prev ? "Elemento anterior: " + escapeHtml(prev.namePt) : "Sem elemento anterior"}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></button>
          <button type="button" class="icon-btn" data-nav="${next ? next.number : ""}" ${next ? "" : "disabled"}
            aria-label="${next ? "Próximo elemento: " + escapeHtml(next.namePt) : "Sem próximo elemento"}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>
        </div>
        <button type="button" class="icon-btn" data-panel-close aria-label="Fechar detalhes">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>
      <div class="detail-hero">
        ${tileHtml(e)}
        <div>
          <h2 id="detail-title" tabindex="-1">${escapeHtml(e.namePt)}</h2>
          <p class="detail-en">${escapeHtml(e.nameEn)} · ${e.symbol}</p>
          <span class="cat-pill" style="--cat: var(--c-${e.category})">${CATEGORY_LABEL[e.category]}</span>
        </div>
      </div>
      <div class="detail-actions">
        <button type="button" class="btn ${inCompare ? "" : "btn-primary"}" data-compare-toggle="${e.number}" ${compareFull ? "disabled" : ""}>
          ${inCompare ? "Remover da comparação" : compareFull ? "Comparação cheia (3/3)" : "Adicionar à comparação"}
        </button>
      </div>
      <dl class="prop-list">
        ${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}
      </dl>
      <section class="detail-section">
        <h3>Usos e aplicações</h3>
        <p>${e.uses ? escapeHtml(e.uses) : NA}</p>
      </section>
      <section class="detail-section">
        <h3>Curiosidade</h3>
        <p>${e.fact ? escapeHtml(e.fact) : NA}</p>
      </section>
      ${e.note ? `<p class="detail-note">${escapeHtml(e.note)}</p>` : ""}
    `;
  }

  /* ---------- Comparação ---------- */
  function toggleCompare(number) {
    const idx = state.compare.indexOf(number);
    if (idx >= 0) {
      state.compare.splice(idx, 1);
    } else if (state.compare.length >= MAX_COMPARE) {
      const e = BY_NUMBER.get(number);
      dom.status.textContent = `Limite de ${MAX_COMPARE} elementos na comparação. Remova um antes de adicionar ${e.namePt}.`;
      return;
    } else {
      state.compare.push(number);
    }
    renderCompareState();
  }

  function renderCompareState() {
    cells.forEach((cell, number) => {
      const pos = state.compare.indexOf(number);
      let badge = cell.querySelector(".compare-badge");
      if (pos >= 0) {
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "compare-badge";
          badge.setAttribute("aria-hidden", "true");
          cell.appendChild(badge);
        }
        badge.textContent = String(pos + 1);
      } else if (badge) {
        badge.remove();
      }
    });

    dom.tray.hidden = state.compare.length === 0;
    dom.trayCount.textContent = String(state.compare.length);
    dom.trayChips.innerHTML = state.compare.map((n) => {
      const e = BY_NUMBER.get(n);
      return `<li class="compare-chip" style="--cat: var(--c-${e.category})">
        <b>${e.symbol}</b>${escapeHtml(e.namePt)}
        <button type="button" class="icon-btn" data-compare-remove="${n}" aria-label="Remover ${escapeHtml(e.namePt)} da comparação">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></li>`;
    }).join("");
    dom.btnOpenCompare.disabled = state.compare.length < 2;
    dom.btnOpenCompare.title = state.compare.length < 2 ? "Selecione pelo menos 2 elementos" : "";

    if (state.selected) renderPanel(BY_NUMBER.get(state.selected));
    if (dom.compareDialog.open) {
      if (state.compare.length < 2) dom.compareDialog.close();
      else renderCompareTable();
    }
  }

  function densityComparable(e) {
    if (e.density == null) return null;
    return e.densityUnit === "g/L" ? e.density / 1000 : e.density;
  }

  function renderCompareTable() {
    const list = state.compare.map((n) => BY_NUMBER.get(n));
    const rows = [
      { label: "Número atômico", html: (e) => `<span class="mono">${e.number}</span>`, num: (e) => e.number },
      { label: "Massa atômica (u)", html: (e) => `<span class="mono">${formatMass(e)}</span>`, num: (e) => parseFloat(e.atomicMass), bar: true },
      { label: "Categoria", html: (e) => `<span class="cat-pill" style="--cat: var(--c-${e.category})">${CATEGORY_LABEL[e.category]}</span>` },
      { label: "Grupo", html: groupText },
      { label: "Período", html: (e) => String(e.period) },
      { label: "Bloco", html: (e) => e.block },
      { label: "Configuração eletrônica", html: (e) => `<span class="mono">${escapeHtml(e.electronConfig)}</span>${e.configPredicted ? badgePred : ""}` },
      { label: "Estado (25 °C, 1 atm)", html: (e) => STATE_LABEL[e.state] },
      { label: "Densidade", html: densityHtml, num: densityComparable, bar: true },
      { label: "Ponto de fusão", html: (e) => thermalHtml(e, "melt"), num: (e) => e.meltingPoint, bar: true },
      { label: "Ponto de ebulição", html: (e) => thermalHtml(e, "boil"), num: (e) => e.boilingPoint, bar: true },
      { label: "Descoberta", html: discoveryText },
      { label: "Descobridor(es)", html: discovererText },
      { label: "Origem", html: (e) => ORIGIN_LABEL[e.origin] },
    ];

    const head = list.map((e) => `<th scope="col"><div class="compare-head">${tileHtml(e)}
      <div><div class="name">${escapeHtml(e.namePt)}</div><div class="en">${escapeHtml(e.nameEn)}</div></div></div></th>`).join("");

    const body = rows.map((row) => {
      let max = null;
      let values = [];
      if (row.bar) {
        values = list.map((e) => row.num(e));
        const known = values.filter((v) => v != null);
        if (known.length >= 2) max = Math.max(...known);
      }
      const tds = list.map((e, i) => {
        const v = values[i];
        const isBest = max != null && v === max;
        const bar = max != null && v != null
          ? `<span class="bar" aria-hidden="true"><i style="width:${Math.max(3, (v / max) * 100).toFixed(1)}%"></i></span>`
          : "";
        return `<td class="${isBest ? "best" : ""}">${row.html(e)}${bar}</td>`;
      }).join("");
      return `<tr><th scope="row">${row.label}</th>${tds}</tr>`;
    }).join("");

    dom.compareBody.innerHTML = `
      <div class="compare-table-wrap">
        <table class="compare-table">
          <thead><tr><th scope="col"><span class="visually-hidden">Propriedade</span></th>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      <p class="compare-legend">As barras comparam os valores conhecidos de cada linha; o maior valor aparece destacado. Densidades de gases são convertidas para g/cm³ apenas para essa comparação.</p>`;
  }

  function openCompare() {
    if (state.compare.length < 2) return;
    renderCompareTable();
    dom.compareDialog.showModal();
  }

  /* ---------- Navegação por teclado ---------- */
  function setRovingFocus(number, moveFocus) {
    const prev = cells.get(state.focusNumber);
    if (prev) prev.tabIndex = -1;
    state.focusNumber = number;
    const cell = cells.get(number);
    cell.tabIndex = 0;
    if (moveFocus) cell.focus();
  }

  function findNeighbor(number, dx, dy) {
    const cur = BY_NUMBER.get(number);
    let best = null;
    let bestDist = Infinity;
    ELEMENTS.forEach((e) => {
      if (dx !== 0) {
        if (e.row !== cur.row) return;
        const d = (e.col - cur.col) * dx;
        if (d > 0 && d < bestDist) { best = e; bestDist = d; }
      } else {
        if (e.col !== cur.col) return;
        const d = (e.row - cur.row) * dy;
        if (d > 0 && d < bestDist) { best = e; bestDist = d; }
      }
    });
    return best;
  }

  function onCellKeydown(ev) {
    const cell = ev.target.closest(".cell");
    if (!cell) return;
    const number = Number(cell.dataset.number);
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (moves[ev.key]) {
      ev.preventDefault();
      const target = findNeighbor(number, moves[ev.key][0], moves[ev.key][1]);
      if (target) {
        setRovingFocus(target.number, true);
        renderPreview(target.number);
      }
    } else if (ev.key === "Home" || ev.key === "End") {
      ev.preventDefault();
      setRovingFocus(ev.key === "Home" ? 1 : ELEMENTS.length, true);
    } else if (ev.key === "Enter" && ev.shiftKey) {
      ev.preventDefault();
      toggleCompare(number);
    }
  }

  /* ---------- Tema e legenda ---------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const next = theme === "dark" ? "claro" : "escuro";
    dom.btnTheme.setAttribute("aria-label", `Alternar para tema ${next}`);
    dom.btnTheme.querySelector(".theme-label").textContent = `Tema ${next}`;
  }

  function setLegendVisible(visible) {
    dom.legend.hidden = !visible;
    dom.btnLegend.setAttribute("aria-pressed", String(visible));
    dom.btnLegend.setAttribute("aria-label", visible ? "Ocultar legenda" : "Mostrar legenda");
  }

  /* ---------- Eventos ---------- */
  function bindEvents() {
    dom.table.addEventListener("click", (ev) => {
      const cell = ev.target.closest(".cell");
      if (!cell) return;
      const number = Number(cell.dataset.number);
      if (state.compareMode || ev.shiftKey) {
        toggleCompare(number);
        setRovingFocus(number, false);
        return;
      }
      if (state.selected === number && !dom.panel.hidden) {
        closePanel(false);
        return;
      }
      // foco no painel só quando a ativação veio do teclado (detail === 0)
      selectElement(number, { focusPanel: ev.detail === 0 });
    });
    dom.table.addEventListener("keydown", onCellKeydown);

    dom.table.addEventListener("mouseover", (ev) => {
      const cell = ev.target.closest(".cell");
      if (cell) renderPreview(Number(cell.dataset.number));
    });
    dom.table.addEventListener("focusin", (ev) => {
      const cell = ev.target.closest(".cell");
      if (cell) renderPreview(Number(cell.dataset.number));
    });
    dom.table.addEventListener("mouseleave", () => renderPreview(state.selected));

    dom.search.addEventListener("input", () => {
      state.query = dom.search.value;
      applyFilters();
    });
    dom.search.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        if (state.query.trim() && state.lastMatches.length) {
          const first = state.lastMatches[0];
          selectElement(first.number, { focusPanel: false });
          renderPreview(first.number);
        }
      } else if (ev.key === "Escape" && dom.search.value) {
        ev.preventDefault();
        ev.stopPropagation();
        dom.search.value = "";
        state.query = "";
        applyFilters();
      }
    });

    dom.filterState.addEventListener("change", () => { state.physState = dom.filterState.value; applyFilters(); });
    dom.filterOrigin.addEventListener("change", () => { state.origin = dom.filterOrigin.value; applyFilters(); });

    dom.legendList.addEventListener("click", (ev) => {
      const chip = ev.target.closest(".legend-chip");
      if (chip) toggleFamily(chip.dataset.family);
    });

    dom.btnClearFilters.addEventListener("click", clearFilters);
    dom.btnClearSelection.addEventListener("click", () => {
      closePanel(false);
      state.compare = [];
      renderCompareState();
      renderPreview(null);
    });

    dom.btnCompareMode.addEventListener("click", () => {
      state.compareMode = !state.compareMode;
      dom.btnCompareMode.setAttribute("aria-pressed", String(state.compareMode));
      dom.status.textContent = state.compareMode
        ? "Modo comparação ativo: clique nos elementos para adicioná-los (até 3)."
        : "Modo comparação desativado: clique abre os detalhes.";
    });

    dom.btnTheme.addEventListener("click", () => {
      const theme = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(theme);
      storageSet("pt-theme", theme);
    });

    dom.btnLegend.addEventListener("click", () => {
      const visible = dom.legend.hidden;
      setLegendVisible(visible);
      storageSet("pt-legend", visible ? "1" : "0");
    });

    dom.btnAbout.addEventListener("click", () => dom.aboutDialog.showModal());

    dom.panel.addEventListener("click", (ev) => {
      const nav = ev.target.closest("[data-nav]");
      if (nav && nav.dataset.nav) {
        const n = Number(nav.dataset.nav);
        const isNext = n > state.selected;
        selectElement(n, { focusPanel: false });
        renderPreview(n);
        const btns = dom.panel.querySelectorAll(".detail-nav-group .icon-btn");
        const keep = btns[isNext ? 1 : 0];
        (keep && !keep.disabled ? keep : btns[isNext ? 0 : 1]).focus();
        return;
      }
      if (ev.target.closest("[data-panel-close]")) { closePanel(true); return; }
      const cmp = ev.target.closest("[data-compare-toggle]");
      if (cmp) toggleCompare(Number(cmp.dataset.compareToggle));
    });

    dom.trayChips.addEventListener("click", (ev) => {
      const rm = ev.target.closest("[data-compare-remove]");
      if (rm) toggleCompare(Number(rm.dataset.compareRemove));
    });
    dom.btnOpenCompare.addEventListener("click", openCompare);
    dom.btnClearCompare.addEventListener("click", () => { state.compare = []; renderCompareState(); });

    [dom.compareDialog, dom.aboutDialog].forEach((dialog) => {
      dialog.addEventListener("click", (ev) => {
        if (ev.target === dialog || ev.target.closest("[data-close]")) dialog.close();
      });
    });

    document.addEventListener("keydown", (ev) => {
      const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName);
      if (ev.key === "/" && !typing && !document.querySelector("dialog[open]")) {
        ev.preventDefault();
        dom.search.focus();
        dom.search.select();
      } else if (ev.key === "Escape" && !document.querySelector("dialog[open]") && !dom.panel.hidden) {
        closePanel(true);
      }
    });
  }

  /* ---------- Inicialização ---------- */
  function init() {
    if (ELEMENTS.length !== 118) {
      dom.status.textContent = "Erro: os dados dos elementos (elements.js) não foram carregados corretamente.";
      return;
    }
    applyTheme(storageGet("pt-theme") === "light" ? "light" : "dark");
    setLegendVisible(storageGet("pt-legend") !== "0");
    buildLegend();
    buildTable();
    bindEvents();
    renderPreview(null);
    renderCompareState();
    applyFilters();
  }

  init();
})();
