import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import worker from '../src/index.js'

const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch })

function origin(respond) {
  globalThis.fetch = async () => respond()
}

test('passes the server’s answer through when it is up', async () => {
  origin(() => new Response('portal', { status: 200 }))
  const res = await worker.fetch(new Request('https://wifi.example/'))
  assert.equal(res.status, 200)
  assert.equal(await res.text(), 'portal')
})

test('keeps the portal’s own errors', async () => {
  origin(() => new Response('{"detail":"Wrong password"}', { status: 401 }))
  const res = await worker.fetch(new Request('https://wifi.example/api/auth/login', { method: 'POST' }))
  assert.equal(res.status, 401)
})

test('shows the offline page when the tunnel is down', async () => {
  origin(() => new Response('error 1033', { status: 530 }))
  const res = await worker.fetch(new Request('https://wifi.example/me'))
  assert.equal(res.status, 503)
  assert.match(res.headers.get('content-type'), /text\/html/)
  assert.equal(res.headers.get('cache-control'), 'no-store')
  assert.match(await res.text(), /Wi-Fi portal offline/)
})

test('answers API calls with JSON the portal can show', async () => {
  origin(() => new Response('bad gateway', { status: 502 }))
  const res = await worker.fetch(new Request('https://wifi.example/api/me'))
  assert.equal(res.status, 503)
  assert.match((await res.json()).detail, /offline/)
})

test('shows the offline page when the origin can’t be reached at all', async () => {
  origin(() => { throw new TypeError('network error') })
  const res = await worker.fetch(new Request('https://wifi.example/'))
  assert.equal(res.status, 503)
})
