import z from "zod";
import { McpServer } from "@modelcontextprotocol/server";
import { DataManagementClient } from "@aps_sdk/data-management";
import { IssuesClient } from "@aps_sdk/construction-issues";
import { getValidAccessToken, buildAuthorizationUrl } from "./auth/aps.js";
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from "./config.js";

export function createMcpServer(userId) {
    const server = new McpServer(
        { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
        { capabilities: { tools: {} } },
    );

    async function withAuth(handler) {
        const accessToken = await getValidAccessToken(userId);
        if (!accessToken) {
            return { content: [{ type: "text", text: `Please sign in with your Autodesk account to continue.\n${buildAuthorizationUrl(userId)}` }] };
        }
        return handler(accessToken);
    }

    server.registerTool(
        "get-hubs-projects",
        {
            title: "Get hubs and projects",
            description: "Retrieves all Autodesk Forma (formerly Autodesk Construction Cloud) hubs and projects accessible to the signed-in user.",
            annotations: { readOnlyHint: true },
        },
        () => withAuth(async (accessToken) => {
            const dataManagementClient = new DataManagementClient();
            const hubs = await dataManagementClient.getHubs({ accessToken }).then(response => response.data || []);
            const projects = await Promise.all(hubs.map(hub => dataManagementClient.getHubProjects(hub.id, { accessToken })));
            const output = hubs.map((hub, i) => ({
                id: hub.id,
                name: hub.attributes.name,
                projects: (projects[i].data || []).map(project => ({
                    id: project.id,
                    name: project.attributes.name,
                }))
            }));
            return {
                content: [{ type: "text", text: JSON.stringify(output, null, 2) }]
            };
        })
    );

    server.registerTool(
        "get-project-issues",
        {
            title: "Get project issues",
            description: "Retrieves all issues in an Autodesk Forma (formerly Autodesk Construction Cloud) project.",
            inputSchema: {
                projectId: z.string().nonempty().describe("The ID of the project to get issues for (without the leading \"b.\" prefix).")
            },
            annotations: { readOnlyHint: true },
        },
        ({ projectId }) => withAuth(async (accessToken) => {
            const issuesClient = new IssuesClient();
            const response = await issuesClient.getIssues(projectId, { accessToken });
            const issues = (response.results || []).map((issue) => ({
                id: issue.id,
                title: issue.title,
                status: issue.status,
            }));
            return {
                content: [{ type: "text", text: JSON.stringify(issues, null, 2) }]
            };
        })
    );

    return server;
}
