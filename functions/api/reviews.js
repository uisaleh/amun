// Product reviews API for the Amun preview site (Cloudflare Pages Function).
// Needs a KV namespace bound to this Pages project as REVIEWS.
// Each product's reviews are stored under its own key ("p:<product>"),
// so a review only ever appears on the product it was written for.

const PRODUCTS = new Set([
  'shampoo', 'leave-in-conditioner', 'conditioner', 'pomade', 'body-lotion',
  'haircare-trio', 'haircare-duo', 'origin-set',
]);
const MAX_KEEP = 500;

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

  // Light rate limit: one review per visitor per product per minute.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = 'rl:' + product + ':' + ip;
  if (await env.REVIEWS.get(rlKey)) return json({ error: 'Thanks! Please wait a minute before posting another review.' }, 429);
  await env.REVIEWS.put(rlKey, '1', { expirationTtl: 60 });

  const key = 'p:' + product;
  const list = (await env.REVIEWS.get(key, 'json')) || [];
  list.unshift(review);
  await env.REVIEWS.put(key, JSON.stringify(list.slice(0, MAX_KEEP)));
  return json({ reviews: list.slice(0, MAX_KEEP) });
}
