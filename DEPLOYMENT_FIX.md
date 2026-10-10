# FLOW AI — deployment repair checklist

## What was fixed in this package

- Added `netlify.toml` so Netlify builds Vite into `dist` and browser refreshes on the React single-page app return `index.html`.
- Added `render.yaml` to describe a separate Render-hosted Flask API, with `/api/health` as the health check and a restrictive CORS origin for the current Netlify URL.
- Changed the API client so a production build without `VITE_API_BASE_URL` gives a clear configuration error instead of silently requesting `http://localhost:5000` on every visitor's computer. Local development still defaults to `http://localhost:5000`.

## Required deployment steps

1. Push this project to GitHub (include `netlify.toml`, `render.yaml`, `DEPLOYMENT_FIX.md`, and the changed `src/api/client.js`). Do not commit `.env` files, API keys, `.git`, `node_modules`, `.venv`, or build output.
2. In Render, create a new Blueprint from this repository and deploy `render.yaml`. Wait for the service to become healthy. Copy the actual service URL, for example `https://YOUR-SERVICE.onrender.com` (do not use the example literally).
3. In Netlify → Site configuration → Environment variables, set `VITE_API_BASE_URL` to that actual Render service URL with no trailing slash. Trigger a new deploy because Vite embeds this variable at build time.
4. In Render → Environment, set `FLOW_AI_ALLOWED_ORIGINS` to `https://keen-mandazi-418c3b.netlify.app` (exact origin, no path). If you add a custom domain, include it as another comma-separated origin. Save and redeploy/restart the API.
5. Open `https://YOUR-SERVICE.onrender.com/api/health`. It should return JSON with `status: "healthy"`. Then open the Netlify site, hard refresh, and test dashboard, incidents, and mission actions.

## Local validation

- Frontend: `npm ci`, then `npm run build`.
- Backend: from the repository root, `python -m venv .venv`, activate it, `pip install -r backend/requirements.txt`, then `python -m pytest backend/tests -v`.
- Run the API locally with `python backend/app.py` and frontend with `npm run dev`.
- Integration test (with backend running): `npm run test:integration`.

## Honest limitations

The API currently serves simulated, in-memory traffic data. It is a functional hackathon prototype, not live traffic intelligence. State resets when the backend restarts; no real signal control, emergency dispatch, or real-world navigation is performed.
