# RHA Students (React)

Lightweight React app (Vite) for listing and editing student data via a Google Apps Script API. Designed to deploy on GitHub Pages (`github.io`).

## Setup

1) Create `.env.local`:

```bash
cp .env.example .env.local
```

Then edit `.env.local` and set:

- `VITE_STUDENT_API_BASE_URL` (required)
- `VITE_STUDENT_API_KEY` (optional)

2) Run locally:

```bash
npm install
npm run dev
```

## Deploy (GitHub Pages)

This repo includes a workflow at `.github/workflows/deploy.yml`.

In your GitHub repo:

- **Settings → Pages → Build and deployment**: select **GitHub Actions**
- Push to `main` and the site will deploy to `https://<user>.github.io/<repo>/`
# rha_student_details
