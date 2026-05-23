/**
 * Perth Airport flight board — reads /api/flights
 * @see README.md Flight board
 */

const META_POLL_MS = 60_000;

/** @type {{ meta: object | null, flights: object[], scrapeRevision: string | null }} */
const boardCache = {
  meta: null,
  flights: [],
  scrapeRevision: null,
};

let currentDirection = "arrivals";
let metaPollTimer = null;

const HOURS_FILTER_OPTIONS = [1, 2, 4, 6, 12, 24];
const DEFAULT_HOURS_FILTER = 2;
const MS_PER_HOUR = 3600000;
const FILTER_STORAGE_KEY = "perth-airport-board-filters";
const VALID_DOM_INT = new Set(["", "domestic", "international"]);
const VALID_TERMINAL_GROUP = new Set(["", "t1t2", "t3t4", "others"]);

/** @type {{ arrivals: boolean, departures: boolean }} */
const filtersDateHydrated = { arrivals: false, departures: false };

const els = {
  flightSearchPanel: document.getElementById("flight-search-panel"),
  btnFilterToggle: document.getElementById("btn-filter-toggle"),
  filterDrawer: document.getElementById("filter-drawer"),
  updatedLabel: document.getElementById("updated-label"),
  filterDirection: document.getElementById("filter-direction"),
  filterDomInt: document.getElementById("filter-dom-int"),
  filterTerminalGroup: document.getElementById("filter-terminal-group"),
  filterHours: document.getElementById("filter-hours"),
  filterDate: document.getElementById("filter-date"),
  filterToggleLabel: document.querySelector(".filter-toggle-label"),
  filterHideCompleted: document.getElementById("filter-hide-completed"),
  btnClearFilters: document.getElementById("btn-clear-filters"),
  filterCount: document.getElementById("filter-count"),
  labelFilterDate: document.getElementById("label-filter-date"),
  labelHideCompleted: document.getElementById("label-hide-completed"),
  statusBanner: document.getElementById("status-banner"),
  flightTbody: document.getElementById("flight-tbody"),
};

function remarkLabel(remark) {
  const r = remark ?? "";
  return r === "" ? "Scheduled" : r;
}

function remarkKey(remark) {
  return remark ?? "";
}

function terminalKey(terminal) {
  if (terminal == null || terminal === "") return "";
  return terminal;
}

const TERMINAL_GROUP_T1T2 = new Set(["T1", "T2"]);
const TERMINAL_GROUP_T3T4 = new Set(["T3", "T4"]);

/** @returns {"t1t2"|"t3t4"|"others"} */
function terminalGroup(terminal) {
  const t = terminalKey(terminal);
  if (TERMINAL_GROUP_T1T2.has(t)) return "t1t2";
  if (TERMINAL_GROUP_T3T4.has(t)) return "t3t4";
  return "others";
}

const TX_TERMINALS = new Set(["T1", "T2", "T3", "T4"]);

/** @param {object} flight */
function statusCellHtml(flight) {
  const remark = escapeHtml(remarkLabel(flight.Remark));
  const terminalBlock = terminalRouteCellInner(flight);
  return `<span class="status-remark-main">${remark}</span>${terminalBlock}`;
}

function statusClass(remark) {
  const r = remarkKey(remark);
  if (r === "Cancelled") return "status-cancelled";
  if (r === "Departed" || r === "Landed") return "status-departed";
  if (r === "Delayed") return "status-delayed";
  if (r === "Early") return "status-early";
  if (r === "On-time") return "status-ontime";
  if (r === "") return "status-scheduled";
  if (
    r === "Boarding" ||
    r === "Boarding soon" ||
    r === "Final Call" ||
    r === "Boarding Closed"
  ) {
    return "status-boarding";
  }
  return "";
}

function isCompleted(flight) {
  const r = remarkKey(flight.Remark);
  if (r === "Cancelled") return true;
  if (flight._direction === "departures" && r === "Departed") return true;
  if (flight._direction === "arrivals" && r === "Landed") return true;
  return false;
}

const AWST_CLOCK_PARTS = {
  timeZone: "Australia/Perth",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
};

/** @param {Date} date */
function formatAwstClock12h(date) {
  const parts = new Intl.DateTimeFormat("en-AU", AWST_CLOCK_PARTS).formatToParts(
    date,
  );
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "";
  const dayPeriod = (
    parts.find((p) => p.type === "dayPeriod")?.value ?? ""
  ).toUpperCase();
  return `${hour}:${minute} ${dayPeriod}`;
}

/** @param {string | null | undefined} timeStr */
function rawClockTo12h(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return "—";
  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "—";
  const h24 = Number(m[1]);
  const minute = m[2];
  if (h24 < 0 || h24 > 23) return "—";
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${minute} ${period}`;
}

/** @param {string | null | undefined} timeStr */
function formatTime(timeStr) {
  return rawClockTo12h(timeStr);
}

/** @param {string | null | undefined} iso */
function sortInstant(iso) {
  if (!iso || typeof iso !== "string") return Number.POSITIVE_INFINITY;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

/** @returns {number} */
function selectedHoursFilter() {
  const raw = Number(els.filterHours?.value);
  if (HOURS_FILTER_OPTIONS.includes(raw)) return raw;
  return DEFAULT_HOURS_FILTER;
}

function defaultDirectionFilters() {
  return {
    domInt: "",
    terminalGroup: "",
    hours: DEFAULT_HOURS_FILTER,
    boardDate: "",
    hideCompleted: false,
  };
}

/** @param {unknown} raw */
function validateDirectionFilters(raw) {
  const d = defaultDirectionFilters();
  if (!raw || typeof raw !== "object") return d;
  const o = /** @type {Record<string, unknown>} */ (raw);
  if (typeof o.domInt === "string" && VALID_DOM_INT.has(o.domInt)) {
    d.domInt = o.domInt;
  }
  if (
    typeof o.terminalGroup === "string" &&
    VALID_TERMINAL_GROUP.has(o.terminalGroup)
  ) {
    d.terminalGroup = o.terminalGroup;
  }
  const h = Number(o.hours);
  if (HOURS_FILTER_OPTIONS.includes(h)) d.hours = h;
  if (typeof o.boardDate === "string") d.boardDate = o.boardDate;
  if (typeof o.hideCompleted === "boolean") d.hideCompleted = o.hideCompleted;
  return d;
}

function loadFilterStore() {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const lastDirection =
      parsed?.lastDirection === "departures"
        ? "departures"
        : parsed?.lastDirection === "arrivals"
          ? "arrivals"
          : null;
    return {
      lastDirection,
      arrivals: validateDirectionFilters(parsed?.arrivals),
      departures: validateDirectionFilters(parsed?.departures),
    };
  } catch {
    return null;
  }
}

/** @param {{ lastDirection: "departures"|"arrivals"|null, arrivals: ReturnType<typeof defaultDirectionFilters>, departures: ReturnType<typeof defaultDirectionFilters> }} store */
function saveFilterStore(store) {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* private mode / quota */
  }
}

function ensureFilterStore() {
  const existing = loadFilterStore();
  if (existing) return existing;
  return {
    lastDirection: null,
    arrivals: defaultDirectionFilters(),
    departures: defaultDirectionFilters(),
  };
}

function readFiltersFromForm() {
  return {
    domInt: els.filterDomInt?.value ?? "",
    terminalGroup: els.filterTerminalGroup?.value ?? "",
    hours: selectedHoursFilter(),
    boardDate: els.filterDate?.value ?? "",
    hideCompleted: !!els.filterHideCompleted?.checked,
  };
}

/** @param {ReturnType<typeof defaultDirectionFilters>} filters */
function applyFiltersToForm(filters) {
  if (els.filterHideCompleted) {
    els.filterHideCompleted.checked = filters.hideCompleted;
  }
  if (els.filterDomInt) els.filterDomInt.value = filters.domInt;
  if (els.filterTerminalGroup) {
    els.filterTerminalGroup.value = filters.terminalGroup;
  }
  if (els.filterHours) {
    els.filterHours.value = String(filters.hours);
  }
  if (els.filterDate) els.filterDate.value = filters.boardDate;
}

/** @param {"departures"|"arrivals"} direction */
function getFiltersForDirection(direction) {
  const store = loadFilterStore();
  if (!store) return defaultDirectionFilters();
  return direction === "departures" ? store.departures : store.arrivals;
}

function persistCurrentFilters() {
  const store = ensureFilterStore();
  const filters = readFiltersFromForm();
  store.lastDirection = currentDirection;
  if (currentDirection === "departures") {
    store.departures = filters;
  } else {
    store.arrivals = filters;
  }
  saveFilterStore(store);
}

/** @param {"departures"|"arrivals"} direction */
function applyStoredFiltersForDirection(direction) {
  applyFiltersToForm(getFiltersForDirection(direction));
  filtersDateHydrated[direction] = false;
}

function restorePendingBoardDateIfNeeded() {
  if (filtersDateHydrated[currentDirection]) return;
  const filters = getFiltersForDirection(currentDirection);
  const sel = els.filterDate;
  if (
    sel &&
    filters.boardDate &&
    [...sel.options].some((o) => o.value === filters.boardDate)
  ) {
    sel.value = filters.boardDate;
  }
  filtersDateHydrated[currentDirection] = true;
}

function filterQueryParams() {
  const params = new URLSearchParams();
  params.set("direction", currentDirection);
  params.set("domInt", els.filterDomInt?.value ?? "");
  params.set("terminalGroup", els.filterTerminalGroup?.value ?? "");
  params.set("hours", String(selectedHoursFilter()));
  params.set("boardDate", els.filterDate?.value ?? "");
  params.set(
    "hideCompleted",
    els.filterHideCompleted?.checked ? "true" : "false",
  );
  return params;
}

/** @param {"departures"|"arrivals"} direction */
async function fetchMeta(direction) {
  const res = await fetch(`/api/meta?direction=${direction}`);
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? `No flight data. Run \`npm run collect\` first.`
        : `Failed to load meta (${res.status})`,
    );
  }
  return res.json();
}

async function fetchFlights() {
  const params = filterQueryParams();
  const res = await fetch(`/api/flights?${params}`);
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? `No flight data. Run \`npm run collect\` first.`
        : `Failed to load flights (${res.status})`,
    );
  }
  return res.json();
}

function setBanner(message, type = "loading") {
  els.statusBanner.hidden = false;
  els.statusBanner.textContent = message;
  els.statusBanner.className = `status-banner is-${type}`;
}

function hideBanner() {
  els.statusBanner.hidden = true;
}

function formatUpdatedTodayAwst(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Updated …";
    return `Updated ${formatAwstClock12h(d)}`;
  } catch {
    return "Updated …";
  }
}

function formatBoardDateOptionLabel(iso, dates, todayIso) {
  const [, month, day] = iso.split("-").map(Number);
  const short = `${day}/${month}`;
  if (iso === todayIso) return `Today (${short})`;
  if (iso < todayIso) return `Yesterday (${short})`;
  const futureDates = dates.filter((d) => d > todayIso);
  if (futureDates.length === 1 && iso === futureDates[0]) {
    return `Tomorrow (${short})`;
  }
  return short;
}

/** @param {"departures"|"arrivals"} direction */
function directionFilterLabels(direction) {
  const kind = direction === "departures" ? "Departure" : "Arrival";
  return {
    dateLabel: `${kind} date`,
    allDates: `All ${kind.toLowerCase()} dates`,
  };
}

/** @param {"departures"|"arrivals"} direction */
function directionBarLabel(direction) {
  return direction === "departures" ? "Departures" : "Arrivals";
}

function updateTableHeaders(direction) {
  const labels = directionFilterLabels(direction);
  if (els.filterToggleLabel) {
    els.filterToggleLabel.textContent = directionBarLabel(direction);
  }
  if (els.labelFilterDate) els.labelFilterDate.textContent = labels.dateLabel;
  if (els.labelHideCompleted) {
    els.labelHideCompleted.textContent =
      direction === "departures" ? "Hide Departed" : "Hide Landed";
  }
}

function updateFilterPanelAria(direction) {
  const name = directionBarLabel(direction);
  els.flightSearchPanel?.setAttribute(
    "aria-label",
    `Flight board filters — ${name}`,
  );
  if (els.btnFilterToggle) {
    els.btnFilterToggle.setAttribute(
      "aria-label",
      `Toggle ${name} filters`,
    );
  }
}

function updateUpdatedLabel() {
  if (!boardCache.meta?.lastScrapeAt) {
    els.updatedLabel.textContent = "Updated …";
    return;
  }
  els.updatedLabel.textContent = formatUpdatedTodayAwst(
    boardCache.meta.lastScrapeAt,
  );
}

function rebuildDateSelect() {
  const sel = els.filterDate;
  const prev = sel.value;
  const dates = [...(boardCache.meta?.retainedBoardDates ?? [])].sort();
  const todayIso = boardCache.meta?.boardDate ?? dates[0];
  const { allDates } = directionFilterLabels(currentDirection);
  sel.replaceChildren();
  sel.append(new Option(allDates, ""));
  dates.forEach((iso) => {
    sel.append(
      new Option(formatBoardDateOptionLabel(iso, dates, todayIso), iso),
    );
  });
  if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
}

function resetFiltersExceptDirection() {
  els.filterHideCompleted.checked = false;
  els.filterDomInt.value = "";
  els.filterTerminalGroup.value = "";
  if (els.filterHours) {
    els.filterHours.value = String(DEFAULT_HOURS_FILTER);
  }
  els.filterDate.value = "";
}

/**
 * @param {object} flight
 * @param {"_scheduledAt"|"_estimatedAt"} isoField
 * @param {"ScheduledTime"|"EstimatedTime"} rawField
 * @param {boolean} showDate
 */
function formatBoardTime(flight, isoField, rawField, showDate) {
  const iso = flight[isoField];
  if (iso && typeof iso === "string") {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      const clock = formatAwstClock12h(d);
      if (showDate) {
        const parts = new Intl.DateTimeFormat("en-AU", {
          timeZone: "Australia/Perth",
          day: "numeric",
          month: "numeric",
        }).formatToParts(d);
        const day = parts.find((p) => p.type === "day")?.value ?? "";
        const month = parts.find((p) => p.type === "month")?.value ?? "";
        return `${clock} ${day}/${month}`;
      }
      return clock;
    }
  }
  return formatTime(flight[rawField]);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tableCell(innerHtml, className = "") {
  const cls = className ? ` class="${className}"` : "";
  return `<td${cls}>${innerHtml}</td>`;
}

/** @param {object} f */
function flightMainLine(f) {
  const num = (f.FlightNumber ?? "").trim();
  const airline = (f.AirlineName ?? "").trim();
  if (num && airline) return `${num} - ${airline}`;
  return num || airline || "—";
}

/** @param {object} f */
function portSubline(f) {
  const port = (f.PortName ?? "").trim();
  if (!port) return "";
  return `<span class="cell-sub flight-cell-sub">${escapeHtml(port)}</span>`;
}

/** @param {object} f */
function flightCellInner(f) {
  return `<span class="flight-cell-main">${escapeHtml(flightMainLine(f))}</span>${portSubline(f)}`;
}

/** @param {object} f */
function routeTypeLabel(f) {
  if (f._routeType === "domestic") return "Domestic";
  if (f._routeType === "international") return "International";
  return "—";
}

/** @param {object} f */
function terminalDisplay(f) {
  const term = terminalKey(f.Terminal);
  return TX_TERMINALS.has(term) ? term : "—";
}

/** @param {object} f */
function terminalRouteCellInner(f) {
  const term = terminalDisplay(f);
  const route = routeTypeLabel(f);
  let line;
  if (term === "—") {
    line = "—";
  } else if (route === "—") {
    line = term;
  } else {
    line = `${term} · ${route}`;
  }
  return `<span class="cell-sub terminal-route-sub">${escapeHtml(line)}</span>`;
}

/**
 * @param {object} f
 * @param {boolean} showDateInTimes
 */
function timesCellInner(f, showDateInTimes) {
  const est = escapeHtml(
    formatBoardTime(f, "_estimatedAt", "EstimatedTime", showDateInTimes),
  );
  const sched = escapeHtml(
    formatBoardTime(f, "_scheduledAt", "ScheduledTime", showDateInTimes),
  );
  return `<span class="times-est-main">${est}</span><span class="cell-sub times-sched-sub">${sched}</span>`;
}

function renderTable() {
  const flights = boardCache.flights;
  const total = flights.length;
  const sorted = [...flights].sort((a, b) => {
    let cmp = sortInstant(a._estimatedAt) - sortInstant(b._estimatedAt);
    if (cmp !== 0) return cmp;
    cmp = sortInstant(a._scheduledAt) - sortInstant(b._scheduledAt);
    if (cmp !== 0) return cmp;
    return (a.FlightNumber ?? "").localeCompare(b.FlightNumber ?? "");
  });

  els.filterCount.textContent = `(${sorted.length})`;

  if (sorted.length === 0) {
    els.flightTbody.innerHTML = `<tr class="empty-row"><td colspan="3">No flights match</td></tr>`;
    return;
  }

  const showDateInTimes = els.filterDate.value === "";

  const rows = sorted
    .map((f) => {
      const flightInner = flightCellInner(f);
      const timesInner = timesCellInner(f, showDateInTimes);
      const stClass = statusClass(f.Remark);
      const stInner = statusCellHtml(f);
      const stTdClass = ["col-status", stClass].filter(Boolean).join(" ");

      return `<tr>
        ${tableCell(timesInner, "col-times")}
        <td class="${stTdClass}">${stInner}</td>
        ${tableCell(flightInner, "flight-cell")}
      </tr>`;
    })
    .join("");

  els.flightTbody.innerHTML = rows;
}

async function loadBoard() {
  const data = await fetchFlights();
  boardCache.meta = data.meta;
  boardCache.flights = data.flights.map((f) => ({
    ...f,
    _direction: currentDirection,
  }));
  boardCache.scrapeRevision = data.meta?.scrapeRevision ?? null;
}

async function render() {
  updateTableHeaders(currentDirection);
  updateFilterPanelAria(currentDirection);
  rebuildDateSelect();
  restorePendingBoardDateIfNeeded();
  updateUpdatedLabel();
  renderTable();
}

async function refreshBoard(showLoading = false) {
  if (showLoading) setBanner(`Loading ${currentDirection}…`, "loading");
  try {
    await loadBoard();
    hideBanner();
    await render();
  } catch (err) {
    setBanner(err instanceof Error ? err.message : String(err), "error");
    els.flightTbody.innerHTML = "";
    els.filterCount.textContent = "";
  }
}

/** @param {"departures"|"arrivals"} direction */
async function onDirectionChange(direction) {
  persistCurrentFilters();
  currentDirection = direction;
  els.filterDirection.value = direction;
  const store = ensureFilterStore();
  store.lastDirection = direction;
  saveFilterStore(store);
  applyStoredFiltersForDirection(direction);
  await refreshBoard(true);
}

async function pollMeta() {
  try {
    const meta = await fetchMeta(currentDirection);
    const revision = meta.scrapeRevision ?? null;
    if (
      revision &&
      boardCache.scrapeRevision &&
      revision !== boardCache.scrapeRevision
    ) {
      await refreshBoard(false);
    } else if (!boardCache.scrapeRevision && revision) {
      boardCache.scrapeRevision = revision;
      boardCache.meta = meta;
      updateUpdatedLabel();
    }
  } catch {
    /* ignore poll errors */
  }
}

function startMetaPoll() {
  if (metaPollTimer) clearInterval(metaPollTimer);
  metaPollTimer = setInterval(() => {
    void pollMeta();
  }, META_POLL_MS);
}

function wireFilterDrawer() {
  const panel = els.flightSearchPanel;
  const toggle = els.btnFilterToggle;
  if (!panel || !toggle) return;

  const setDrawerOpen = (open) => {
    panel.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  };

  const mq = window.matchMedia("(min-width: 768px)");
  const sync = () => {
    if (mq.matches) setDrawerOpen(true);
  };
  mq.addEventListener("change", sync);
  sync();

  toggle.addEventListener("click", () => {
    setDrawerOpen(!panel.classList.contains("is-open"));
  });
}

function wireFilterListeners() {
  els.filterDirection?.addEventListener("change", () => {
    const dir = els.filterDirection.value;
    if (dir === "departures" || dir === "arrivals") {
      void onDirectionChange(dir);
    }
  });

  for (const el of [
    els.filterHideCompleted,
    els.filterDomInt,
    els.filterTerminalGroup,
    els.filterHours,
    els.filterDate,
  ]) {
    el?.addEventListener("change", () => {
      persistCurrentFilters();
      void refreshBoard(true);
    });
  }

  els.btnClearFilters?.addEventListener("click", () => {
    resetFiltersExceptDirection();
    persistCurrentFilters();
    void refreshBoard(true);
  });
}

async function init() {
  wireFilterDrawer();
  wireFilterListeners();

  const store = loadFilterStore();
  if (store?.lastDirection) {
    currentDirection = store.lastDirection;
  }
  els.filterDirection.value = currentDirection;
  applyStoredFiltersForDirection(currentDirection);

  if (typeof console.time === "function") {
    console.time("board-load");
  }

  try {
    await refreshBoard(true);
    startMetaPoll();
  } finally {
    if (typeof console.timeEnd === "function") {
      console.timeEnd("board-load");
    }
  }
}

init();
