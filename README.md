# Vercel build fix — Resources page

Vercel’s error was caused by one malformed JavaScript object property in the Stay Safe Resources card:

`onClick={onOpenSafety}` was being used inside an object literal. It is now correctly written as `onClick: onOpenSafety`.

The malformed pattern has been removed and the Resources navigation wiring remains intact. Replace `App.jsx` and `images.js` in the repository, commit the change, and redeploy. The current sandbox copy does not include `package.json`, so a local `npm run build` could not be executed here; the exact syntax issue reported by Vercel has been corrected and statically verified.
