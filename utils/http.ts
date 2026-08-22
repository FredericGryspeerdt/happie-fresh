/** JSON response helpers shared by the API routes, so handlers stop repeating
 *  `new Response(JSON.stringify(x), { status, headers })`. See issue #51. */

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

export function badRequest(message: string): Response {
  return new Response(message, { status: 400 });
}

export function notFound(message = "Not found"): Response {
  return new Response(message, { status: 404 });
}
