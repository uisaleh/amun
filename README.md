# Amun Organics — redesign preview

Static site for the Amun Organics redesign, hosted on Cloudflare Pages at amun.speakerfolio.com.

- No build step: Cloudflare Pages build command empty, output directory `/`.
- `index.html` is the homepage; other pages are served at clean URLs (`/shampoo`, `/about`, `/shop`, …).
- `support.js` renders the pages; images, videos and fonts are in `assets/`.

## Product reviews

`functions/api/reviews.js` is a Cloudflare Pages Function that stores customer reviews in Workers KV.
Bind a KV namespace to this Pages project with the variable name `REVIEWS` (Settings → Bindings), then redeploy.
Each product's reviews are stored under its own key (`p:<product>`, e.g. `p:origin-set`), so a review only shows on the product it was written for.
To remove a review, edit that key's JSON in the KV namespace in the Cloudflare dashboard.
