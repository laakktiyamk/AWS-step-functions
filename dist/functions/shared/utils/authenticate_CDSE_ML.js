"use strict";
/**
 * ML-datan keruun CDSE-tunnukset. Vain ML-haaralle (ei käyttäjien ajoille).
 *
 * Ympäristömuuttuja CDSE_ML_CLIENTS on JSON-taulukko:
 * [{"id":"sh-xxx","secret":"yyy"},{"id":"sh-aaa","secret":"bbb"}]
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mlClientCount = mlClientCount;
exports.authenticateMl = authenticateMl;
const TOKEN_URL = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const cache = new Map();
const REFRESH_MARGIN_MS = 60000;
function getClients() {
    const raw = process.env.CDSE_ML_CLIENTS;
    if (!raw)
        throw new Error('CDSE_ML_CLIENTS puuttuu');
    const clients = JSON.parse(raw);
    if (!Array.isArray(clients) || clients.length === 0) {
        throw new Error('CDSE_ML_CLIENTS on tyhjä tai virheellinen');
    }
    return clients;
}
/** Montako ML-tunnusta on käytössä. */
function mlClientCount() {
    return getClients().length;
}
/**
 * Hakee tokenin ML-tunnuksella numero `index` (0-pohjainen).
 * Jos index ylittää listan pituuden, kierretään alkuun (index mod n).
 */
async function authenticateMl(index = 0) {
    const clients = getClients();
    const client = clients[((index % clients.length) + clients.length) % clients.length];
    const hit = cache.get(client.id);
    if (hit && hit.expiresAt - Date.now() > REFRESH_MARGIN_MS)
        return hit.token;
    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: client.id,
            client_secret: client.secret,
        }),
    });
    if (!res.ok)
        throw new Error(`ML-token-haku epäonnistui: ${res.status}`);
    const data = (await res.json());
    cache.set(client.id, {
        token: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
    });
    return data.access_token;
}
