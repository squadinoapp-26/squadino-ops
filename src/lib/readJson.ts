// Reads a request's JSON body without throwing (a copy of the club app's src/lib/readJson.ts). Broken JSON from a visitor (a script, a bot, a typo in a tool) used to
// reach a route's catch-all and come back as a 500, which looks like a fault in monitoring. The routes that anyone can
// call without signing in use this and answer 400 instead.

/**
 * The JSON object the request sent, or null when there is no body, it isn't valid JSON, or it isn't an object
 * (a bare `null`, number or string). Arrays count as objects, so a route that expects one still gets it.
 */
export async function readJson<T extends object = Record<string, unknown>>(req: Pick<Request, "json">): Promise<T | null> {
  try {
    const body: unknown = await req.json();
    return body !== null && typeof body === "object" ? (body as T) : null;
  } catch {
    return null;
  }
}
