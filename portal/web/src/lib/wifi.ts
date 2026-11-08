/** The router's network name (TP-Link: Wireless → Wireless Settings). */
export const WIFI_SSID = 'CCE Skills Clinic WiFi'

/** Backslash-escapes the characters the WIFI: QR format reserves. */
function escapeQr(value: string): string {
  return value.replace(/[\\;,:"]/g, (c) => `\\${c}`)
}

/**
 * WIFI: QR payload for WPA2-Enterprise (PEAP / MSCHAPv2) with the person's ID filled in.
 * No password: the portal never stores it, so the phone asks for it after scanning.
 */
export function wifiQrPayload(username: string): string {
  if (!username) throw new Error('A Wi-Fi QR code needs a username.')
  return `WIFI:T:WPA2-EAP;S:${escapeQr(WIFI_SSID)};E:PEAP;PH2:MSCHAPV2;I:${escapeQr(username)};;`
}
