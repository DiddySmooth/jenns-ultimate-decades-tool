# Decades Challenge Tracker — Research & Planning

## Source
Write-up by Grayson's wife (April 11, 2026). Based on "The Ultimate Decades Challenge" ruleset.

---

## What It Is
A generational Sims 4 legacy challenge from ~1890s to modern day. Players track:
- A "converted" timeline (1 sim day = X months/years, configurable)
- Family demographics and life events
- Aging stages per sim type (human, pet, occult)
- Events, rolls, deaths, births, marriages

---

## Core Data Structures Needed

### 1. Tracker Config (per user/save)
- `startYear` (number, no default)
- `daysPerYear` (number, default: 4)
- `startDayOfWeek` (string, default: "Sunday")
- `lifeStages` (array, human — configurable, draggable order)
  - `name`, `simDays`, `yearsEquivalent` (auto-calc)
- `pets` (array of selected types: Dog, Cat, Horse, Custom)
  - Each has own `lifeStages`
- `occults` (array of selected types: Vampire, Werewolf, Fairy, Mermaid, Ghost, Alien, Spellcaster, Custom)
  - Each has own `lifeStages`
  - Option to "import human aging settings as base"

### 2. Timeline
- Grid: rows = days (sim day #, day of week, year), columns = tracked events
- Default columns: Deaths, Events
- Columns can be hidden/removed by user
- Cells can contain: sim name (birthday/aging up), event name, death name
- Current day marker (highlight/blackout)
- Auto-generated from config (start year, days per year, start day of week)

### 3. Sims Info Sheet
Per sim entry:
- Name
- Date of Birth (challenge date)
- Date of Death (challenge date)
- Life Stage (current)
- Cause of Death
- Generation #
- (Optional) marriage/pregnancy tracking data

### 4. Pregnancy/Baby/Marriage Tracker
- Per non-heir teen: married (yes/no rolled), # pregnancy attempts
- Track progress through attempts

### 5. Aging Table (reference)
- Life stage name
- Sim days in stage
- Equivalent years
- Required rolls at age-up (per life stage, configurable)

### 6. Family Tree (future)
- MVP: flat list grouped by family/household
- Future: visual tree, importable from Sims Info Sheet data

---

## MVP Scope

**Must have:**
- [ ] Tracker setup wizard (3-4 steps)
- [ ] Timeline view (auto-generated, markable current day)
- [ ] Sims Info Sheet (add/edit/view sims)
- [ ] Aging Table (auto-generated from config, viewable)

**Nice to have (v2):**
- [ ] Pregnancy/Marriage tracker
- [ ] Stats page
- [ ] Preset aging templates (Morbid's rules, Plumbobs & the Past, Several's rules)
- [ ] Event import list for timeline
- [ ] Family tree visual

**Future:**
- [ ] Visual family tree (simsdynastytree.com-style)
- [ ] Occult/pet cross-stage "add to all" feature

---

## Setup Wizard Flow

```
Step 1: Basic Config
  - Start year (required)
  - Days per year (default: 4)
  - Start day of week (default: Sunday)
  → Next

Step 2: Human Aging
  - Table: Life Stage | Sim Days | Years Equivalent (auto-calc)
  - Default stages: Baby/Newborn, Infant, Toddler, Child, Teen, Young Adult, Adult, Elder
  - Add/delete/reorder life stages
  - Required to move forward
  → Next

Step 3: Pets & Occults
  - Checkbox: Pets (Dog, Cat, Horse, Custom)
  - Checkbox: Occults (Vampire, Werewolf, Fairy, Mermaid, Ghost, Alien, Spellcaster, Custom)
  → Next

Step 3b: Individual pet/occult aging tables (one screen each)
  - Same interface as human aging
  - Option: "Import human aging settings (editable)"
  - Option: "Add this life stage to other pets/occults"
  → Next (repeat for each selected type)

Step 4: Review/Overview
  - Summary of all settings
  → Complete Setup → generates Timeline + Aging Tables
```

---

## Tech Stack Recommendation

- **Frontend:** React + Vite (matches Grayson's stack, easy Azure Static Web App deploy)
- **Storage:** Azure Blob Storage — one JSON blob per user save
  - Key: `saves/{userId}/{saveId}.json`
  - No DB needed for MVP
- **Auth:** Optional for MVP (localStorage save), Azure Static Web Apps built-in auth for multi-user later
- **Hosting:** Azure Static Web App (matches portfolio + SneakerTracker pattern)
- **Repo:** DiddySmooth/decades-tracker (new repo)

---

## Mobile-First Considerations
- Setup wizard: full-screen step-by-step (like onboarding flow)
- Timeline: horizontal scroll table, sticky first column (day/date)
- Sims sheet: card list on mobile, table on desktop
- Aging table: compact, collapsible sections

---

## Open Questions for Wife's Write-up (follow-up)
1. Does she want other users to be able to create their own saves (multi-user) or is this just for her initially?
2. What are the specific rolls at each life stage (if any defaults she uses)?
3. Does she track anything else per sim beyond Name, DoB, DoD, Life Stage, CoD, Generation?
4. Preset templates — does she know which popular rule sets she wants preloaded?
