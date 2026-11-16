# Amun Organics — Shopify theme

This branch (`shopify-theme`) is the Amun design as a Shopify Online Store 2.0 theme. The `main` branch is still the static preview site.

## Install (no code needed)
1. **Back up the current theme first.** Online Store → Themes → on the live theme (Dawn + GemPages) click **…** → **Duplicate**, then **…** → **Download theme file**.
2. Online Store → Themes → **Add theme** → **Connect from GitHub** → pick `uisaleh/amun` and the branch **shopify-theme**. It is added as an unpublished theme.
3. Click **Preview** to check it on your real store. Publish it when you’re happy.

## One-time store settings
- **Discounts → Create discount → Amount off order**, code **WELCOME10**, 10%, one use per customer. The signup popup and footer give out this code.
- **Settings → Shipping and delivery**: rates that match the cart — Standard $8.95 (free over $150), Express $19.95, Overnight $39.95.
- **Reviews**: the theme shows the existing reviews and emails new ones to the store. For photo reviews that publish themselves, install a review app (for example Judge.me) and add its block in the theme editor: Products → Reviews section → **Add block**.

## Where things live
- `snippets/amun-data.liquid` — per-product design text (benefits, ingredients, gallery photos, ritual, videos, reviews), keyed by product handle.
- Turn off **Theme settings → Brand → Use the Amun design photos** to use the photos saved on each product instead.
- Homepage sections, header links, footer links, popup text and shipping messages are all editable in the theme editor.
- Videos stream from `https://amun.keeply.workers.dev/assets/`. You can upload them to Content → Files and set them per video block instead.
