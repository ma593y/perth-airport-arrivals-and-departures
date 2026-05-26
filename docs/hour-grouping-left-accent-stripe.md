# Left accent stripe — implementation reference

Save this for when you wire option **2** into the live board. Working demo: [`public/hour-grouping-demo.html`](../public/hour-grouping-demo.html) (section “2. Left accent stripe”).

---

## Summary

A **4px vertical bar** on the left edge of each flight row. All flights in the **same AWST calendar hour** share one color; the color **rotates through a 6-color palette** as the hour changes. Independent of the **orange now-divider** (past vs upcoming).

---

## Design decisions

| Topic | Choice |
|--------|--------|
| **Time for bucketing** | **Estimated** (`_estimatedAt`), fallback **scheduled** (`_scheduledAt`) — same as `flightSortMs` in [`public/app.js`](../public/app.js) |
| **Timezone** | `Australia/Perth` (AWST) |
| **Bucket key** | Date + hour in AWST, e.g. `2026-05-24T14` (include date when “All dates” filter is on) |
| **Stripe width** | `4px` |
| **Palette size** | 6 colors, `bucketIndex % 6` |
| **Markup** | No extra column — `inset box-shadow` on Time `<td>` (not `tr::before`; avoids WebKit column bugs) |
| **Per-row CSS var** | `--hour-accent: var(--hour-stripe-N)` on first `<td>` (`.col-times-hour-stripe`) |

---

## Color palette (Okabe–Ito style)

Add to `:root` in [`public/styles.css`](../public/styles.css):

```css
/* Hour-group stripe palette (colorblind-friendly, max hue separation) */
--hour-stripe-0: #0072b2; /* blue */
--hour-stripe-1: #e69f00; /* gold */
--hour-stripe-2: #009e73; /* green */
--hour-stripe-3: #cc79a7; /* pink */
--hour-stripe-4: #d55e00; /* vermillion */
--hour-stripe-5: #332288; /* indigo */
```

| Index | Name | Hex | Swatch role |
|-------|------|-----|-------------|
| 0 | Blue | `#0072b2` | 1st hour block in list |
| 1 | Gold | `#e69f00` | 2nd hour block |
| 2 | Green | `#009e73` | 3rd hour block |
| 3 | Pink | `#cc79a7` | 4th hour block |
| 4 | Vermillion | `#d55e00` | 5th hour block |
| 5 | Indigo | `#332288` | 6th+ hour blocks (then repeats) |

**Note:** These are **not** status colors (boarding, delayed, etc.).

---

## CSS (production-ready)

```css
/* Left accent stripe — hour grouping (Time cell only; table-safe on mobile) */
.flight-search-res-table tbody td.col-times-hour-stripe {
  box-shadow: inset 4px 0 0 var(--hour-accent, var(--hour-stripe-0));
}
```

**Do not** use `tr::before` for the stripe — WebKit/mobile can treat it as an extra table column and misalign headers vs rows.

**Now-divider (full width):** `.now-divider td` uses `padding-left/right: 0`; `.now-divider-line` is `display: block; width: 100%`.

**Demo** [`public/hour-grouping-demo.html`](../public/hour-grouping-demo.html) still uses `tr::before` for variant 2; production uses the `td` approach above.

---

## JavaScript — hour bucket helpers

Constants:

```javascript
const AWST_TZ = "Australia/Perth";
const HOUR_PALETTE_SIZE = 6;

const awstHourFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: AWST_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
});
```

**Sort instant** (already in `app.js` as `flightSortMs`):

```javascript
function sortInstant(iso) {
  if (!iso || typeof iso !== "string") return Number.POSITIVE_INFINITY;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

function flightSortMs(f) {
  const est = sortInstant(f._estimatedAt);
  if (est !== Number.POSITIVE_INFINITY) return est;
  return sortInstant(f._scheduledAt);
}
```

**Hour bucket key** (AWST date + hour):

```javascript
function hourBucketKey(ms) {
  if (!Number.isFinite(ms)) return "";
  const parts = awstHourFmt.formatToParts(new Date(ms));
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const mo = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  const h = parts.find((p) => p.type === "hour")?.value ?? "";
  return `${y}-${mo}-${d}T${h}`;
}
```

**Assign palette index** (walk sorted flights; increment when bucket key changes):

```javascript
function assignHourBucketIndices(flights) {
  let bucketSeq = -1;
  let prevKey = null;
  return flights.map((f) => {
    const ms = flightSortMs(f);
    const key = hourBucketKey(ms);
    if (key !== prevKey) {
      bucketSeq += 1;
      prevKey = key;
    }
    return bucketSeq % HOUR_PALETTE_SIZE;
  });
}
```

---

## JavaScript — row HTML change

In `flightRowHtml` (or equivalent), for each flight at index `i`:

```javascript
const bucketIndex = hourBucketIndices[i]; // from assignHourBucketIndices(flights)
const rowClass = f._routeType === "international" ? "row-international" : "";
const stripeStyle = ` style="--hour-accent: var(--hour-stripe-${bucketIndex})"`;

return `<tr class="${rowClass}">
  ${tableCell(timesInner, "col-times col-times-hour-stripe", stripeStyle)}
  ...
</tr>`;
```

In `renderTable`, compute indices once per render:

```javascript
const bucketIndices = assignHourBucketIndices(flights);
for (let i = 0; i < flights.length; i++) {
  parts.push(flightRowHtml(flights[i], showDateInTimes, bucketIndices[i]));
  // now-divider unchanged
}
```

**Do not** apply stripe classes to `now-divider` or `empty-row` rows.

---

## HTML structure (unchanged columns)

Still **3 columns**: Time | Status | Flight. No new `<th>`.

Example row:

```html
<tr class="row-international">
  <td class="col-times col-times-hour-stripe" style="--hour-accent: var(--hour-stripe-2)">...</td>
  <td class="col-status status-boarding">...</td>
  <td class="flight-cell">...</td>
</tr>
```

---

## Interaction with existing features

| Feature | Behavior |
|---------|----------|
| **Now-divider** | Keep as-is; orange line is separate from hour stripes |
| **International rows** | Keep `row-international` background; stripe on Time cell via inset shadow |
| **Row hover** | Existing hover on `<tr>`; stripe color unchanged |
| **Sort order** | Buckets follow **sorted** list order (same as board) |
| **Missing times** | `flightSortMs` → `Infinity`; bucket key `""` — use index `0` or skip stripe |

---

## Files to touch (when implementing on live board)

| File | Changes |
|------|---------|
| [`public/styles.css`](../public/styles.css) | `:root` palette + stripe rules |
| [`public/app.js`](../public/app.js) | `hourBucketKey`, `assignHourBucketIndices`, pass bucket into `flightRowHtml` / `renderTable` |
| [`public/index.html`](../public/index.html) | **No change** (no extra column) |

After deploy via Docker: rebuild image per project rule (`docker compose build; docker compose --profile scheduler up -d --force-recreate`).

---

## Accessibility

- Stripes are a **supplement** to the Time column, not the only cue.
- Do not use red/green that mirror status semantics; current palette avoids that.
- Optional later: `aria-label` on first row of each hour (not required for stripe-only).

---

## Demo reference

- **URL:** `http://localhost:3000/hour-grouping-demo.html` → section **“2. Left accent stripe”**
- **Source:** [`public/hour-grouping-demo.html`](../public/hour-grouping-demo.html) — search for `variant-stripe`, `--hour-stripe-`, `assignBucketMeta`, `useAccent: variant === "stripe"`

---

## One-line spec (for tickets/notes)

> Left 4px stripe on Time cell (inset box-shadow + `--hour-accent` on `.col-times-hour-stripe`), AWST hour buckets via estimated→scheduled, 6-color Okabe–Ito palette; 3 columns; independent of now-divider.
