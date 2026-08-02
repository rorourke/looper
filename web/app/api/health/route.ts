export function GET(): Response {
  return Response.json(
    { product: "looper-open-source", status: "ok" },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
