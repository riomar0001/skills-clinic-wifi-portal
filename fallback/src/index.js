// Cloudflare Worker in front of the portal (route wifi.riomar.dev/*). Passes every request through the
// tunnel to this server; when the server can't answer, shows a friendly "offline" page instead of
// Cloudflare's error. See docs/SETUP.md, step 12.

// 502/504: nginx is up but the portal isn't. 503: the portal is overloaded or restarting.
// 520-524: Cloudflare couldn't get a usable answer. 530: the tunnel is down (error 1033): server off.
const SERVER_DOWN = new Set([502, 503, 504, 520, 521, 522, 523, 524, 530])

const MESSAGE =
  'The Wi-Fi portal is offline right now. The server may be off or restarting. ' +
  'Try again in a few minutes. If it stays down, tell the CCE Skills Clinic staff.'

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="60">
<title>Wi-Fi portal offline</title>
<style>
  :root { color-scheme: light dark; --bg: #f7f7f8; --card: #fff; --text: #18181b; --muted: #52525b; --line: #e4e4e7; }
  @media (prefers-color-scheme: dark) { :root { --bg: #09090b; --card: #18181b; --text: #fafafa; --muted: #a1a1aa; --line: #27272a; } }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; box-sizing: border-box;
         background: var(--bg); color: var(--text); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 28rem; background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 28px; }
  h1 { margin: 0 0 8px; font-size: 1.25rem; }
  p { margin: 0 0 12px; color: var(--muted); }
  a { color: inherit; font-weight: 600; }
</style>
</head>
<body>
<main>
  <h1>Wi-Fi portal offline</h1>
  <p>${MESSAGE}</p>
  <p>Devices already on the Wi-Fi stay connected. This page checks again every minute, or <a href="">try now</a>.</p>
</main>
</body>
</html>`

function offline(request) {
  const headers = { 'cache-control': 'no-store', 'retry-after': '60' }
  // The portal's own screens show API errors from "detail", like the server's JSON errors.
  if (new URL(request.url).pathname.startsWith('/api/')) {
    return Response.json({ detail: MESSAGE }, { status: 503, headers })
  }
  return new Response(PAGE, { status: 503, headers: { ...headers, 'content-type': 'text/html; charset=utf-8' } })
}

export default {
  async fetch(request) {
    let response
    try {
      response = await fetch(request)
    } catch (err) {
      // Network failure reaching the origin: same as the server being down.
      console.error('Origin unreachable:', err)
      return offline(request)
    }
    if (!SERVER_DOWN.has(response.status)) return response
    console.warn(`Origin answered ${response.status}; showing the offline page.`)
    return offline(request)
  },
}
