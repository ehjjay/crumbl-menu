# Crumbl Weekly Menu

Automatically fetches and displays Crumbl Cookies' weekly menu. Refreshes every Monday at 6pm MT (when Crumbl drops new flavors).

## Files

```
crumbl-menu/
├── api/
│   └── cookies.js       ← Serverless scraper (runs on Vercel)
├── public/
│   └── index.html       ← The webpage visitors see
├── vercel.json          ← Cron schedule config
└── package.json
```

## Deploy to Vercel (Step by Step)

### Step 1 — Put files on GitHub
1. Go to https://github.com and sign in (or create a free account)
2. Click the **+** icon → **New repository**
3. Name it `crumbl-menu`, set to Public, click **Create repository**
4. Click **uploading an existing file**
5. Upload ALL files maintaining the folder structure:
   - `api/cookies.js`
   - `public/index.html`
   - `vercel.json`
   - `package.json`
6. Click **Commit changes**

### Step 2 — Deploy on Vercel
1. Go to https://vercel.com and sign in with your GitHub account
2. Click **Add New → Project**
3. Find your `crumbl-menu` repo and click **Import**
4. Under **Framework Preset** select **Other**
5. Click **Deploy**
6. Wait ~1 minute — Vercel will give you a live URL like `crumbl-menu.vercel.app`

### Step 3 — Test it
1. Visit your Vercel URL
2. The page will load and automatically fetch the current Crumbl menu
3. Click **Refresh Menu** anytime to get the latest data

## How it works
- Every Monday at 6pm MT, Vercel automatically calls `/api/cookies`
- The scraper fetches crumblcookies.com and parses cookie names, descriptions, and images
- The HTML page calls the same API endpoint and displays the results beautifully
- The API response is cached for 1 hour on Vercel's edge network
