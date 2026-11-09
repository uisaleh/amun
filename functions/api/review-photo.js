// Serves a customer review photo stored in KV by /api/reviews.
export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^[0-9a-f-]{36}$/.test(id) || !env.REVIEWS) return new Response('Not found', { status: 404 });
  const { value, metadata } = await env.REVIEWS.getWithMetadata('img:' + id, 'arrayBuffer');
  if (!value) return new Response('Not found', { status: 404 });
  const type = metadata && /^image\/(jpeg|png|webp)$/.test(metadata.type) ? metadata.type : 'image/jpeg';
  return new Response(value, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
