import express from "express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { requireBearerAuth, hostHeaderValidation, mcpAuthMetadataRouter, getOAuthProtectedResourceMetadataUrl } from "@modelcontextprotocol/express";
import { createMcpHandler } from "@modelcontextprotocol/server";
import * as auth0 from "./auth/auth0.js";
import * as aps from "./auth/aps.js";
import { createMcpServer } from "./mcp.js";
import { MCP_SERVER_NAME, MCP_SERVER_URL, ALLOWED_HOSTS, PORT } from "./config.js";

const app = express();
const authMiddleware = requireBearerAuth({
    verifier: auth0.tokenVerifier,
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(MCP_SERVER_URL)
});

// DNS rebinding protection.
app.use(hostHeaderValidation(ALLOWED_HOSTS));

// Layer 1 auth (MCP client -> MCP server): advertise Auth0 as the authorization server for
// this MCP server, so that MCP clients can obtain Auth0-issued access tokens for /mcp.
app.use(mcpAuthMetadataRouter({
    oauthMetadata: await auth0.fetchOAuthMetadata(),
    resourceServerUrl: MCP_SERVER_URL,
    resourceName: MCP_SERVER_NAME,
}));

// createMcpHandler builds a fresh server PER REQUEST (no session), keyed only on the
// Layer-1-validated caller (`ctx.authInfo`, set from Auth0's bearer token; see
// auth/auth0.js) — the stateless replacement for the removed Mcp-Session-Id. Whether
// that user is also signed in to APS (Layer 2) is resolved lazily, by each tool/resource.
const mcpHandler = createMcpHandler((ctx) => createMcpServer(ctx.authInfo?.extra?.sub));

// Layer 1 (MCP client -> MCP server): every /mcp request must carry a bearer token
// issued by Auth0. Layer 2 (MCP server -> APS) is negotiated separately, per user,
// via the out-of-band /auth/callback route below.
app.all("/mcp", authMiddleware, toNodeHandler(mcpHandler));

// Layer 2 (MCP server -> APS): out-of-band callback for APS OAuth. The MCP server
// never sees the user's APS credentials; it only receives an APS access token, which
// is stored in the MCP server's database for later use by the MCP server on behalf of
// that user.
app.get("/auth/callback", async (req, res) => {
    try {
        await aps.completeLogin(String(req.query.state ?? ""), String(req.query.code ?? ""));
        res.send("<h1>Signed in.</h1><p>Return to your assistant and try the request again.</p>");
    } catch (error) {
        res.status(400).send(`Invalid or expired login: ${error.message}`);
    }
});

app.listen(PORT, (err) => {
    if (err) {
        console.error("Failed to start server:", err);
        process.exit(1);
    }
    console.log(`MCP server listening on port ${PORT}`);
});
