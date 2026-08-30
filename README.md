# Service-worker deployment fix

The live app was loading the registration code but `https://resiliencehubnsw.vercel.app/sw.js` was returning a Vercel 404. The local Vite build contains the worker correctly, so the deployed project needs the complete `public/sw.js` asset and the Vercel configuration below.

Replace `App.jsx`, copy `public/sw.js` into the deployed project’s `public` folder, and replace `vercel.json`. Then redeploy the whole project—not only `App.jsx`.

After deployment, open this exact URL in Safari:

`https://resiliencehubnsw.vercel.app/sw.js`

It must display JavaScript beginning with `// The Resilience Hub`. Once that works, remove the old Home Screen app if necessary, reopen the website in Safari, and enable notifications again.
