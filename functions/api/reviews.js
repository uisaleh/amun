// Product reviews API for the Amun preview site (Cloudflare Pages Function).
// Needs a KV namespace bound to this Pages project as REVIEWS.
// Each product's reviews are stored under its own key ("p:<product>"),
// so a review only ever appears on the product it was written for.

const PRODUCTS = new Set([
  'shampoo', 'leave-in-conditioner', 'conditioner', 'pomade', 'body-lotion',
  'haircare-trio', 'haircare-duo', 'origin-set',
]);
const MAX_KEEP = 500;
const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

// Decode a data URL and check it really is a JPEG, PNG or WebP image.
function parsePhoto(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  let bin;
  try { bin = atob(m[2]); } catch { return null; }
  if (!bin.length || bin.length > MAX_PHOTO_BYTES) return null;
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isWebp = bin.slice(0, 4) === 'RIFF' && bin.slice(8, 12) === 'WEBP';
  const type = isJpeg ? 'image/jpeg' : isPng ? 'image/png' : isWebp ? 'image/webp' : null;
  return type ? { type, bytes } : null;
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

export async function onRequestGet({ request, env }) {
  const product = new URL(request.url).searchParams.get('product');
  if (!PRODUCTS.has(product)) return json({ error: 'Unknown product.' }, 400);
  if (!env.REVIEWS) return json({ reviews: [], configured: false });
  const list = (await env.REVIEWS.get('p:' + product, 'json')) || [];
  return json({ reviews: list });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Something went wrong. Please try again.' }, 400); }
  const product = body && body.product;
  if (!PRODUCTS.has(product)) return json({ error: 'Unknown product.' }, 400);
  if (!env.REVIEWS) return json({ error: 'Reviews are not set up yet.', configured: false }, 503);
  if (body.website) return json({ error: 'Your review could not be submitted.' }, 400); // honeypot

  const review = {
    name: clean(body.name, 60),
    title: clean(body.title, 120),
    body: clean(body.body, 2000),
    rating: Math.round(Number(body.rating)),
    date: new Date().toISOString().slice(0, 10),
  };
  if (!review.name || !review.title || !review.body) return json({ error: 'Please fill in your name, a title and your review.' }, 400);
  if (!(review.rating >= 1 && review.rating <= 5)) return json({ error: 'Please choose a star rating.' }, 400);

  // Optional photos: up to 3 images, sent as data URLs (the page shrinks them first).
  const rawPhotos = Array.isArray(body.photos) ? body.photos.slice(0, MAX_PHOTOS) : [];
  const photos = [];
  for (const p of rawPhotos) {
    const parsed = parsePhoto(p);
    if (!parsed) return json({ error: 'One of your photos could not be uploaded. Please use a JPG, PNG or WebP under 2 MB.' }, 400);
    photos.push(parsed);
  }

  // Light rate limit: one review per visitor per product per minute.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = 'rl:' + product + ':' + ip;
  if (await env.REVIEWS.get(rlKey)) return json({ error: 'Thanks! Please wait a minute before posting another review.' }, 429);
  await env.REVIEWS.put(rlKey, '1', { expirationTtl: 60 });

  if (photos.length) {
    review.photos = [];
    for (const ph of photos) {
      const id = crypto.randomUUID();
      await env.REVIEWS.put('img:' + id, ph.bytes, { metadata: { type: ph.type, product } });
      review.photos.push('/api/review-photo?id=' + id);
    }
  }

  const key = 'p:' + product;
  const list = (await env.REVIEWS.get(key, 'json')) || [];
  list.unshift(review);
  await env.REVIEWS.put(key, JSON.stringify(list.slice(0, MAX_KEEP)));
  return json({ reviews: list.slice(0, MAX_KEEP) });
}
