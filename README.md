# Jenn's Ultimate Decades Tool

A web app for tracking multi-generational Sims 4 Decades Challenge playthroughs. Built for mobile-first use, configurable per player, and designed to replace the spreadsheet workflow.

## Features (MVP)
- Setup wizard: configure start year, sim-day-to-year ratio, aging stages per sim type (human, pets, occults)
- Auto-generated timeline with markable days and event logging
- Sims info sheet: track every sim's name, birth/death dates, life stage, cause of death, generation
- Aging reference table
- Google Sign-In via Azure Static Web Apps auth
- Per-user save data stored in Azure Blob Storage (no database)

## Local Development

```bash
# Install frontend deps
npm install

# Install API deps
cd api && npm install && cd ..

# Start frontend (Vite dev server)
npm run dev
```

> **Auth in local dev:** `/.auth/me` isn't available locally. The app detects `import.meta.env.DEV` and falls back to a mock user automatically — no setup needed for basic UI work.

> **API in local dev:** You'll need [Azure Functions Core Tools](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local) and a local `AZURE_STORAGE_CONNECTION_STRING` in `api/local.settings.json` to test the save API locally.

## How Auth Works

Azure Static Web Apps has [built-in authentication](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-authorization). We use Google as the provider.

- Users click "Sign in with Google" → redirected to `/.auth/login/google`
- After login, `/.auth/me` returns the user's identity (userId, email, provider)
- API routes (`/api/*`) are protected — only authenticated users can call them
- No passwords are stored anywhere

### Required Google OAuth setup
1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Google OAuth 2.0 API
3. Create OAuth credentials (Web Application type)
4. Add your Azure Static Web App's auth callback URL: `https://<your-app>.azurestaticapps.net/.auth/login/google/callback`
5. Store `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as GitHub Secrets and Azure app settings

## How Storage Works

Each user gets one JSON blob:
```
Container: decades-saves
Blob key:  {userId}/tracker.json
```

The full `TrackerSave` object (config + sims + timeline) is stored as a single JSON file. No database needed.

## Deployment

### 1. Create Azure resources

```bash
# Create a resource group (if you don't have one)
az group create --name decades-tracker-rg --location eastus

# Create a Storage Account
az storage account create --name decadestrackerstorage --resource-group decades-tracker-rg --sku Standard_LRS

# Create the blob container
az storage container create --name decades-saves --account-name decadestrackerstorage

# Get the connection string
az storage account show-connection-string --name decadestrackerstorage --resource-group decades-tracker-rg

# Create the Static Web App
az staticwebapp create --name jenns-ultimate-decades-tool --resource-group decades-tracker-rg --location eastus2
```

### 2. Set GitHub Secrets

In your repo → Settings → Secrets and variables → Actions, add:
- `AZURE_STATIC_WEB_APPS_API_TOKEN` — from the Azure Static Web App resource
- `AZURE_STORAGE_CONNECTION_STRING` — from the storage account
- `GOOGLE_CLIENT_ID` — from Google Cloud Console
- `GOOGLE_CLIENT_SECRET` — from Google Cloud Console

### 3. Push to main

GitHub Actions will build and deploy automatically on every push to `main`.

## Tech Stack

- React 19 + Vite + TypeScript
- Azure Static Web Apps (hosting + auth)
- Azure Functions v4 (API)
- Azure Blob Storage (data)
- No database, no auth server, no passwords

## Project Structure

```
src/
  components/
    setup/      # Setup wizard steps
    timeline/   # Timeline view
    sims/       # Sims info sheet
    aging/      # Aging reference table
  hooks/        # useWizard hook
  types/        # TypeScript types (tracker.ts)
  utils/        # Time conversion helpers
api/
  getSave/      # Azure Function: load user save from blob
  putSave/      # Azure Function: write user save to blob
```
