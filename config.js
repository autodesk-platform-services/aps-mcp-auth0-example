import { Scopes } from "@aps_sdk/authentication";

const { PUBLIC_HOST, AUTH0_DOMAIN, APS_CLIENT_ID, APS_CLIENT_SECRET } = process.env;
if (!PUBLIC_HOST || !AUTH0_DOMAIN || !APS_CLIENT_ID || !APS_CLIENT_SECRET) {
    console.error("Missing one or more required environment variables: PUBLIC_HOST, AUTH0_DOMAIN, APS_CLIENT_ID, APS_CLIENT_SECRET");
    process.exit(1);
}

const ALLOWED_HOSTS = [PUBLIC_HOST];
const PORT = parseInt(process.env.PORT || "3000");

const AUTH0_ISSUER = `https://${AUTH0_DOMAIN}/`;
const AUTH0_AUDIENCE = `https://${PUBLIC_HOST}/mcp`;

const APS_CALLBACK_URL = `https://${PUBLIC_HOST}/auth/callback`;
const APS_SCOPES = [Scopes.DataRead];

const MCP_SERVER_NAME = "My APS MCP Server";
const MCP_SERVER_VERSION = "0.0.1";
const MCP_SERVER_URL = new URL(`https://${PUBLIC_HOST}/mcp`);

export {
    ALLOWED_HOSTS,
    PORT,
    AUTH0_ISSUER,
    AUTH0_AUDIENCE,
    APS_CLIENT_ID,
    APS_CLIENT_SECRET,
    APS_CALLBACK_URL,
    APS_SCOPES,
    MCP_SERVER_NAME,
    MCP_SERVER_VERSION,
    MCP_SERVER_URL,
}
