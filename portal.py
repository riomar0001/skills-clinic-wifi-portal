"""Admin page for Wi-Fi logins: list, add and remove people, and show the certificate.

Runs inside the wifi-radius container. Writes /mnt/local/users (the same file users.ps1 edits),
then /reload-users.sh makes FreeRADIUS re-read it without a restart.
Reachable only from this PC: compose publishes it on 127.0.0.1, and Host/Origin are checked
so other websites open in your browser can't submit the forms.
"""

import html
import os
import re
import secrets
import subprocess
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

PORT = 8080
DATA = "/mnt/local"
USERS_FILE = f"{DATA}/users"
CA_FILES = {"/ca.der": ("ca.der", "application/x-x509-ca-cert"),
            "/ca.pem": ("ca.pem", "application/x-pem-file")}
ALLOWED_HOSTS = {f"localhost:{PORT}", f"127.0.0.1:{PORT}"}
NAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,31}$")
LINE_RE = re.compile(r"^(?P<name>[a-z0-9][a-z0-9._-]{0,31})\s+NT-Password\s")
PASSWORD_RE = re.compile(r"^[\x20-\x7e]{8,64}$")
MAX_BODY = 4096

CSRF_TOKEN = secrets.token_urlsafe(32)
write_lock = threading.Lock()


def read_lines():
    try:
        with open(USERS_FILE, encoding="utf-8") as f:
            return f.read().splitlines()
    except FileNotFoundError:
        return []


def user_names(lines):
    return sorted(m["name"] for m in map(LINE_RE.match, lines) if m)


def nt_hash(password):
    # Inside this container only; smbencrypt has no stdin mode, so the password is an argument.
    out = subprocess.run(["smbencrypt", password], capture_output=True, text=True, timeout=10, check=True)
    last = out.stdout.strip().splitlines()[-1].split()
    if not last or not re.fullmatch(r"[0-9A-F]{32}", last[-1]):
        raise RuntimeError("could not hash the password")
    return last[-1]


def save_and_reload(lines):
    fd, tmp = tempfile.mkstemp(dir=DATA, prefix=".users.")
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            f.write("\n".join(lines) + "\n")
        os.replace(tmp, USERS_FILE)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise
    subprocess.run(["/reload-users.sh"], timeout=10, check=True)


def cert_info():
    try:
        out = subprocess.run(
            ["openssl", "x509", "-in", f"{DATA}/certs/server.pem", "-noout", "-subject", "-enddate",
             "-fingerprint", "-sha256"],
            capture_output=True, text=True, timeout=10, check=True).stdout
    except (subprocess.SubprocessError, OSError):
        return None
    info = {}
    for line in out.splitlines():
        key, _, value = line.partition("=")
        info[key.strip()] = value.strip()
    cn = re.search(r"CN\s*=\s*([^,]+)", out)
    return {"name": cn.group(1).strip() if cn else "?",
            "expires": info.get("notAfter", "?"),
            "sha256": info.get("sha256 Fingerprint", info.get("SHA256 Fingerprint", "?"))}


def page(message="", error=False):
    names = user_names(read_lines())
    rows = "".join(
        f"<tr><td>{html.escape(n)}</td><td><form method=post action=/remove "
        f"onsubmit=\"return confirm('Remove {html.escape(n)}?')\">"
        f"<input type=hidden name=csrf value={CSRF_TOKEN}><input type=hidden name=name value=\"{html.escape(n)}\">"
        f"<button class=danger>Remove</button></form></td></tr>" for n in names
    ) or "<tr><td colspan=2 class=muted>No users yet.</td></tr>"
    cert = cert_info()
    cert_html = (
        f"<p>Devices will show this certificate the first time they join. Tell people to check the name "
        f"(and, if they can, the fingerprint) before tapping <b>Trust</b>.</p>"
        f"<dl><dt>Name</dt><dd><code>{html.escape(cert['name'])}</code></dd>"
        f"<dt>Valid until</dt><dd>{html.escape(cert['expires'])}</dd>"
        f"<dt>SHA-256 fingerprint</dt><dd><code class=fp>{html.escape(cert['sha256'])}</code></dd></dl>"
        f"<p>For phones that need it installed first: <a href=/ca.der>ca.der</a> (Android, Windows) · "
        f"<a href=/ca.pem>ca.pem</a></p>"
        if cert else "<p class=err>Could not read the certificate.</p>")
    note = (f"<p class={'err' if error else 'ok'}>{html.escape(message)}</p>" if message else "")
    return f"""<!doctype html><html lang=en><head><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1"><title>Wi-Fi Users</title>
<style>
:root{{--bg:#f6f7f9;--card:#fff;--text:#1d2330;--muted:#6b7280;--line:#e3e6eb;--accent:#2563eb;--danger:#c0362c;--ok:#1f7a3a}}
@media (prefers-color-scheme:dark){{:root{{--bg:#14171c;--card:#1d2128;--text:#e7e9ee;--muted:#9aa1ad;--line:#2d333c;--accent:#6b9cff;--danger:#ff7b72;--ok:#5bd17f}}}}
body{{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,sans-serif}}
main{{max-width:640px;margin:0 auto;padding:24px 16px}}
section{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 20px;margin-bottom:16px}}
h1{{font-size:22px;margin:0 0 16px}} h2{{font-size:16px;margin:0 0 12px}}
table{{width:100%;border-collapse:collapse}} td{{padding:8px 0;border-top:1px solid var(--line)}} td:last-child{{text-align:right}}
label{{display:block;margin:8px 0 4px;font-weight:600}}
input{{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--text);font:inherit}}
button{{margin-top:12px;padding:8px 16px;border:0;border-radius:6px;background:var(--accent);color:#fff;font:inherit;cursor:pointer}}
button.danger{{margin:0;background:none;color:var(--danger);border:1px solid var(--danger);padding:4px 10px}}
.muted{{color:var(--muted)}} .ok{{color:var(--ok);font-weight:600}} .err{{color:var(--danger);font-weight:600}}
dl{{display:grid;grid-template-columns:max-content 1fr;gap:4px 12px}} dt{{color:var(--muted)}} dd{{margin:0}}
code.fp{{word-break:break-all;font-size:13px}} form{{margin:0}}
</style></head><body><main>
<h1>Wi-Fi users</h1>{note}
<section><h2>Add a person</h2>
<form method=post action=/add autocomplete=off>
<input type=hidden name=csrf value={CSRF_TOKEN}>
<label for=name>Username</label><input id=name name=name required maxlength=32 pattern="[a-z0-9][a-z0-9._\\-]{{0,31}}"
 title="lowercase letters, digits, dot, dash or underscore" autocapitalize=none>
<label for=pw>Password</label><input id=pw name=password type=password required minlength=8 maxlength=64>
<label for=pw2>Password again</label><input id=pw2 name=password2 type=password required minlength=8 maxlength=64>
<button>Add</button></form></section>
<section><h2>People ({len(names)})</h2><table>{rows}</table>
<p class=muted>Removing someone takes effect the next time their device connects.</p></section>
<section><h2>Certificate</h2>{cert_html}</section>
</main></body></html>"""


class Handler(BaseHTTPRequestHandler):
    timeout = 15

    def _trusted(self):
        if self.headers.get("Host", "") not in ALLOWED_HOSTS:
            return False
        origin = self.headers.get("Origin")
        return origin is None or origin in {f"http://{h}" for h in ALLOWED_HOSTS}

    def _send(self, body, status=200, ctype="text/html; charset=utf-8", extra=None):
        data = body if isinstance(body, bytes) else body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; "
                         "script-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if not self._trusted():
            return self._send("Forbidden", 403, "text/plain")
        if self.path == "/":
            return self._send(page())
        if self.path in CA_FILES:
            filename, ctype = CA_FILES[self.path]
            try:
                with open(f"{DATA}/certs/{filename}", "rb") as f:
                    body = f.read()
            except OSError:
                return self._send("Not found", 404, "text/plain")
            return self._send(body, 200, ctype, {"Content-Disposition": f'attachment; filename="{filename}"'})
        return self._send("Not found", 404, "text/plain")

    def do_POST(self):
        if not self._trusted():
            return self._send("Forbidden", 403, "text/plain")
        try:
            length = int(self.headers.get("Content-Length", ""))
        except ValueError:
            return self._send("Bad request", 400, "text/plain")
        if not 0 < length <= MAX_BODY:
            return self._send("Bad request", 400, "text/plain")
        form = {k: v[0] for k, v in parse_qs(self.rfile.read(length).decode("utf-8", "replace")).items()}
        if not secrets.compare_digest(form.get("csrf", ""), CSRF_TOKEN):
            return self._send(page("This page was out of date. Please try again.", error=True), 400)

        name = form.get("name", "").strip()
        if not NAME_RE.match(name):
            return self._send(page("Username must be 1-32 characters: lowercase letters, digits, "
                                   "dot, dash or underscore.", error=True), 400)
        if self.path == "/add":
            return self._add(name, form.get("password", ""), form.get("password2", ""))
        if self.path == "/remove":
            return self._remove(name)
        return self._send("Not found", 404, "text/plain")

    def _add(self, name, password, password2):
        if password != password2:
            return self._send(page("The two passwords don't match.", error=True), 400)
        if not PASSWORD_RE.match(password):
            return self._send(page("Password must be 8-64 plain keyboard characters "
                                   "(no accents or emoji).", error=True), 400)
        with write_lock:
            lines = read_lines()
            if name in user_names(lines):
                return self._send(page(f"'{name}' already exists. Remove it first to change the password.",
                                       error=True), 400)
            try:
                line = f"{name} NT-Password := 0x{nt_hash(password)}"
                save_and_reload(lines + [line])
            except (subprocess.SubprocessError, OSError, RuntimeError) as e:
                return self._send(page(f"Could not add {name}: {e}", error=True), 500)
        return self._send(page(f"Added {name}."))

    def _remove(self, name):
        with write_lock:
            lines = read_lines()
            if name not in user_names(lines):
                return self._send(page(f"No user named '{name}'.", error=True), 404)
            kept = [l for l in lines if not ((m := LINE_RE.match(l)) and m["name"] == name)]
            try:
                save_and_reload(kept)
            except OSError as e:
                return self._send(page(f"Could not remove {name}: {e}", error=True), 500)
        return self._send(page(f"Removed {name}."))

    def log_message(self, fmt, *args):
        pass  # don't log request lines; form bodies are never logged either


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
