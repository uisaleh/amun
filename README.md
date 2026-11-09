# Amun Organics — redesign preview

Static site for the Amun Organics redesign, hosted on Cloudflare Pages at amun.speakerfolio.com.

- No build step: Cloudflare Pages build command empty, output directory `/`.
- `index.html` is the homepage; other pages are served at clean URLs (`/shampoo`, `/about`, `/shop`, …).
- `support.js` renders the pages; images, videos and fonts are in `assets/`.

## Product reviews

The review form (with photo upload) works in the browser only; submitted reviews are not saved. Real, shared reviews will come from a Shopify review app when the store moves to Shopify.
