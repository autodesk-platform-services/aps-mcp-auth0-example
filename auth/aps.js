// Layer 2 (MCP server -> APS): standard APS 3-legged OAuth, run out-of-band in the
// user's browser. /auth/callback (see index.js) lands here and caches the user's
// APS tokens. The MCP client's own token (Layer 1) is NEVER forwarded to APS.

import { randomUUID } from "node:crypto";
import { AuthenticationClient, ResponseType } from "@aps_sdk/authentication";
import { APS_CLIENT_ID, APS_CLIENT_SECRET, APS_CALLBACK_URL, APS_SCOPES } from "../config.js";

const authenticationClient = new AuthenticationClient();

// Per-user APS token store. Use Redis (or similar) in production.
const tokensByUser = new Map();
// OAuth `state` -> the user we started login for. Short-lived; use a TTL store in production.
const pendingLogins = new Map();

/**
 * Builds the APS authorization URL for the given (Layer 1) user ID, and remembers
 * the `state` so the callback can be correlated back to that user.
 */
export function buildAuthorizationUrl(userId) {
    const state = randomUUID(); // CSRF protection + correlates the callback back to the user
    pendingLogins.set(state, userId);
    return authenticationClient.authorize(APS_CLIENT_ID, ResponseType.Code, APS_CALLBACK_URL, APS_SCOPES, { state });
}

/**
 * Exchanges the authorization `code` from the /auth/callback redirect for APS tokens,
 * and caches them under the user ID that `state` was originally issued for.
 */
export async function completeLogin(state, code) {
    const userId = pendingLogins.get(state);
    if (!userId) {
        throw new Error("Invalid or expired login.");
    }
    pendingLogins.delete(state);
    const token = await authenticationClient.getThreeLeggedToken(APS_CLIENT_ID, code, APS_CALLBACK_URL, { clientSecret: APS_CLIENT_SECRET });
    tokensByUser.set(userId, token);
}

/**
 * Returns a valid APS access token for the given user, refreshing it if necessary,
 * or `null` if the user never logged in (or their refresh token was revoked).
 */
export async function getValidAccessToken(userId) {
    const token = tokensByUser.get(userId);
    if (!token) {
        return null;
    }
    if (Date.now() < token.expires_at - 60_000) { // reuse until ~1 min before expiry
        return token.access_token;
    }
    const refreshed = await authenticationClient.refreshToken(token.refresh_token, APS_CLIENT_ID, { clientSecret: APS_CLIENT_SECRET, scopes: APS_SCOPES });
    tokensByUser.set(userId, refreshed); // rotate the refresh token
    return refreshed.access_token;
}
