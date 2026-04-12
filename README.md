# Jenn's Ultimate Decades Tool (JUDT)

A mobile-first web app for tracking a Sims 4 “Ultimate Decades Challenge” playthrough.

At its core this project is a **spreadsheet replacement**:
- a generated **Timeline** (Sim days → challenge years)
- a **Sims Info Sheet** (who exists, when they were born/died/married, etc.)
- configurable **Aging Tables** (human + pets + occults)

Live site (Azure Static Web Apps):
- https://wonderful-tree-03105d910.6.azurestaticapps.net

---

## What users can do

### 1) Create a tracker (Setup Wizard)
The first run is an onboarding wizard that generates your Timeline + Aging tables.

**Step 1 — Basic Config**
- Start year (required)
- Sim days per year (default: 4)
- Starting day of week (default: Sunday)

**Step 2 — Human Aging**
- Define life stages (add/remove/reorder)
- Define how many **Sim days** each stage lasts
- Years equivalent is computed automatically

**Step 3 — Pets & Occults**
- Select which pets/occults you want to track
- Configure their aging tables

**Step 4 — Review**
- Review everything before generation
- Generates a Timeline through **year 2050**


### 2) Timeline
The Timeline is the “spreadsheet” view.

Columns:
- Day of week
- Day #
- Year
- Events
- Deaths
- Births
- **Human** life stage columns (from your setup)
- **Pet** life stage columns (appended after human)
- **Custom columns** (manually added; useful for occult-specific stages)

Key interactions:
- Click any cell to edit.
- Events are free-text (no dropdown).
- Click a **Day #** to mark progress.
  - Clicking a future day marks everything up to that day as done.
  - Clicking a past day “rewinds” (undo) back to that day.

### 3) Sims Info Sheet
The Sims sheet is your roster.

It includes all previous fields plus:
- First name / last name
- Sex
- Father / mother / spouse (links to other Sims)
- Day # fields:
  - Birth day
  - Death day
  - Marriage day
- Place of birth

**Life stage is auto-computed** (no dropdown):
- From Birth Day # + current timeline day + configured aging lengths.

### 4) Settings
- Theme picker (top bar dropdown)
- Column label editor (Settings → Timeline Columns)
  - Safely rename life stage column headers without breaking stored data

---

## Themes / design tokens

This app is designed around **global CSS variables**.

- Theme selection sets `data-theme="<id>"` on `<html>`.
- Theme tokens live in `src/index.css`.
- Theme list lives in `src/theme/themeRegistry.ts`.

Current themes:
- Default
- Light
- Dark
- Klein Blue
- Berry Jungle
- Petal Pop

To add a new palette:
1. Add an entry to `THEME_OPTIONS` in `src/theme/themeRegistry.ts`
2. Add a `:root[data-theme='<id>'] { ... }` token block in `src/index.css`
3. Add preview swatches for the dropdown (see `theme-swatch-dot` rules)

---

## Saving & performance

### Save format
Each user has a single JSON save stored in Azure Blob Storage:

```
Container: decades-saves
Blob key:  {userId}/tracker.json
```

The stored object is `TrackerSave`:
- `config` (setup wizard output)
- `timeline` (generated rows + edits)
- `sims`
- `currentDay`

Type definitions:
- `src/types/tracker.ts`

### Debounced auto-save
To keep edits snappy and avoid expensive writes, changes are persisted with a **debounced save** (~30 seconds):
- UI updates immediately
- Blob write happens after you pause
- Save also flushes on sign out / page close

Implementation:
- `src/hooks/useDebouncedSave.ts`

### Timeline performance strategy
The timeline can be large. We use multiple layers of optimization:
- Cell edits are local and do not re-render the whole page.
- Row rendering uses CSS containment hints:
  - `content-visibility: auto`
  - `contain-intrinsic-height`

---

## Authentication (Google Sign-In)

We intentionally do **not** store passwords.

This project uses the **Google Identity Services SDK** (client-side) similar to the existing PlexRequest site:
- `https://accounts.google.com/gsi/client`
- The returned JWT is decoded client-side
- `sub` is used as the stable user id for blob storage

Where this lives:
- `src/App.tsx`

> Note: Google OAuth setup requires configuring authorized JavaScript origins for both local dev and the deployed SWA domain.

---

## Azure Functions API

There are two HTTP-trigger functions:
- `api/getSave` (GET) — reads `{userId}/tracker.json`
- `api/putSave` (POST) — writes `{userId}/tracker.json`

Dependencies:
- `@azure/storage-blob`

Environment:
- `AZURE_STORAGE_CONNECTION_STRING`

---

## Local development

```bash
# frontend
npm install
npm run dev

# api deps (only needed if you run the functions locally)
cd api
npm install
```

Notes:
- Local dev uses the real Google Identity script (so you may want to add `http://localhost:5173` to Google OAuth authorized origins).
- API calls in local dev will require running Azure Functions locally OR you can test UI-only flows.

---

## Deployment (Azure Static Web Apps)

CI/CD is handled by GitHub Actions on push to `main`.

Workflow:
- `.github/workflows/azure-static-web-apps.yml`

Required secrets:
- `AZURE_STATIC_WEB_APPS_API_TOKEN`
- `AZURE_STORAGE_CONNECTION_STRING`

(And Google OAuth configuration in Google Cloud Console.)

---

## Repo structure

```
src/
  components/
    setup/                # setup wizard
    timeline/             # timeline view
    sims/                 # sims info sheet
    aging/                # aging reference
  hooks/
    useDebouncedSave.ts
    useTheme.ts
    useWizard.ts
  theme/
    themeRegistry.ts
  types/
    tracker.ts
  utils/
    timeConvert.ts
    lifeStage.ts
    migrateSim.ts
api/
  getSave/
  putSave/
staticwebapp.config.json
```

---

## Design intent (non-negotiables)

This is a utility tool, not a generic SaaS dashboard:
- Typography-led UI
- Spreadsheet-like interactions
- Mobile-first
- Avoid AI-ish gradients/hero sections/card grids

