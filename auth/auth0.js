// Layer 1 (MCP client -> MCP server): protects /mcp with Auth0-issued OAuth access
// tokens (`Authorization: Bearer …`). MCP clients register via a Client ID Metadata
// Document (CIMD) instead of Dynamic Client Registration — see README.md for the
// Auth0 tenant setup. This module only *verifies* tokens; Auth0 remains the
// authorization server, so this server never sees end-user APS/Autodesk credentials.

import { createRemoteJWKSet, jwtVerify } from "jose";
import { AUTH0_ISSUER, AUTH0_AUDIENCE } from "../config.js";

const jwks = createRemoteJWKSet(new URL(`${AUTH0_ISSUER}.well-known/jwks.json`));

/**
 * Implements the `OAuthTokenVerifier` interface (see
 * `@modelcontextprotocol/server`), backed by Auth0-issued JWTs.
 * The resulting `AuthInfo.extra.sub` is the stable, per-user key used to look up
 * (Layer 2) APS tokens — the stateless replacement for the removed Mcp-Session-Id.
 */
export const tokenVerifier = {
    async verifyAccessToken(token) {
        const { payload } = await jwtVerify(token, jwks, { issuer: AUTH0_ISSUER, audience: AUTH0_AUDIENCE });
        return {
            token,
            clientId: typeof payload.azp === "string" ? payload.azp : "unknown",
            scopes: typeof payload.scope === "string" ? payload.scope.split(" ") : [],
            expiresAt: payload.exp,
            extra: { sub: payload.sub },
        };
    },
};

/** Fetches Auth0's own OAuth/OIDC discovery document, reused to advertise Auth0 as this server's authorization server. */
export async function fetchOAuthMetadata() {
    const response = await fetch(`${AUTH0_ISSUER}.well-known/openid-configuration`);
    if (!response.ok) {
        throw new Error(`Failed to fetch Auth0 OAuth metadata: ${response.status}`);
    }
    return response.json();
}
