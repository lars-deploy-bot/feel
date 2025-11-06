module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/node:fs [external] (node:fs, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:fs", () => require("node:fs"));

module.exports = mod;
}),
"[externals]/node:path [external] (node:path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:path", () => require("node:path"));

module.exports = mod;
}),
"[project]/apps/web/features/manager/lib/domain-utils.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Domain normalization utilities for consistent domain handling
 */ /**
 * Normalizes a domain name by:
 * - Converting to lowercase
 * - Removing protocol (http://, https://)
 * - Removing www. prefix
 * - Removing trailing slashes and paths
 * - Removing port numbers
 * - Trimming whitespace
 */ __turbopack_context__.s([
    "isValidDomain",
    ()=>isValidDomain,
    "normalizeAndValidateDomain",
    ()=>normalizeAndValidateDomain,
    "normalizeDomain",
    ()=>normalizeDomain
]);
function normalizeDomain(input) {
    if (!input || typeof input !== "string") {
        return "";
    }
    let domain = input.trim();
    // Remove protocol (http://, https://, ftp://, etc.)
    domain = domain.replace(/^[a-zA-Z][a-zA-Z\d+.-]*:\/\//, "");
    // Remove www. prefix (case insensitive)
    domain = domain.replace(/^www\./i, "");
    // Remove trailing slashes and everything after
    domain = domain.replace(/\/.*$/, "");
    // Remove port numbers
    domain = domain.replace(/:\d+$/, "");
    // Convert to lowercase
    domain = domain.toLowerCase();
    // Final trim
    domain = domain.trim();
    return domain;
}
function isValidDomain(domain) {
    if (!domain) return false;
    // Basic domain regex - allows letters, numbers, hyphens, and dots
    // Must have at least one dot and valid TLD
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
}
function normalizeAndValidateDomain(input) {
    const normalized = normalizeDomain(input);
    if (!normalized) {
        return {
            domain: "",
            isValid: false,
            error: "Domain is required"
        };
    }
    if (!isValidDomain(normalized)) {
        return {
            domain: normalized,
            isValid: false,
            error: "Invalid domain format (e.g., example.com)"
        };
    }
    return {
        domain: normalized,
        isValid: true
    };
}
}),
"[project]/apps/web/features/workspace/types/workspace.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Workspace and path validation guards
 * These guards prevent path traversal attacks and validate workspace constraints
 */ /**
 * Check if a hostname is in terminal mode (requires explicit workspace)
 * Terminal mode hostnames start with "terminal." or contain ".terminal."
 *
 * Examples:
 * - terminal.goalive.nl → true
 * - staging.terminal.goalive.nl → true
 * - demo.goalive.nl → false
 *
 * TODO: This is not safe if someone creates a domain like bla.staging.terminal.goalive.nl.joost.nl
 * Should validate that .terminal. is followed by a known domain (e.g., .terminal.goalive.nl)
 */ __turbopack_context__.s([
    "containsPathTraversal",
    ()=>containsPathTraversal,
    "isPathWithinWorkspace",
    ()=>isPathWithinWorkspace,
    "isTerminalMode",
    ()=>isTerminalMode,
    "isValidWorkspacePath",
    ()=>isValidWorkspacePath,
    "isValidWorkspaceString",
    ()=>isValidWorkspaceString,
    "isWorkspaceError",
    ()=>isWorkspaceError,
    "isWorkspaceResolved",
    ()=>isWorkspaceResolved
]);
function isTerminalMode(host) {
    return host.startsWith("terminal.") || host.includes(".terminal.");
}
function isValidWorkspaceString(workspace) {
    return typeof workspace === "string" && workspace.length > 0;
}
function isPathWithinWorkspace(normalizedPath, workspacePath, pathSeparator) {
    return normalizedPath.startsWith(workspacePath + pathSeparator);
}
function containsPathTraversal(path) {
    return path.includes("..");
}
function isValidWorkspacePath(workspace) {
    return workspace.startsWith("webalive/sites/") || !workspace.includes("/");
}
function isWorkspaceResolved(result) {
    return typeof result === "object" && result !== null && result.success === true && typeof result.workspace === "string";
}
function isWorkspaceError(result) {
    return typeof result === "object" && result !== null && result.success === false && result.response !== undefined;
}
}),
"[project]/apps/web/lib/error-codes.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Centralized error codes for consistent error handling across frontend and backend
 */ __turbopack_context__.s([
    "ErrorCodes",
    ()=>ErrorCodes,
    "getErrorHelp",
    ()=>getErrorHelp,
    "getErrorMessage",
    ()=>getErrorMessage,
    "isWorkspaceError",
    ()=>isWorkspaceError
]);
const ErrorCodes = {
    // Workspace errors (1xxx)
    WORKSPACE_NOT_FOUND: "WORKSPACE_NOT_FOUND",
    WORKSPACE_INVALID: "WORKSPACE_INVALID",
    WORKSPACE_MISSING: "WORKSPACE_MISSING",
    PATH_OUTSIDE_WORKSPACE: "PATH_OUTSIDE_WORKSPACE",
    // Authentication errors (2xxx)
    NO_SESSION: "NO_SESSION",
    AUTH_REQUIRED: "AUTH_REQUIRED",
    UNAUTHORIZED: "UNAUTHORIZED",
    INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
    // Request errors (3xxx)
    INVALID_JSON: "INVALID_JSON",
    INVALID_REQUEST: "INVALID_REQUEST",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    MISSING_SLUG: "MISSING_SLUG",
    INVALID_SLUG: "INVALID_SLUG",
    UNKNOWN_ACTION: "UNKNOWN_ACTION",
    // Conversation errors (4xxx)
    CONVERSATION_BUSY: "CONVERSATION_BUSY",
    // SDK errors (5xxx)
    QUERY_FAILED: "QUERY_FAILED",
    ERROR_MAX_TURNS: "ERROR_MAX_TURNS",
    API_AUTH_FAILED: "API_AUTH_FAILED",
    // Tool errors (5.5xxx)
    TOOL_NOT_ALLOWED: "TOOL_NOT_ALLOWED",
    // File errors (6xxx)
    FILE_READ_ERROR: "FILE_READ_ERROR",
    FILE_WRITE_ERROR: "FILE_WRITE_ERROR",
    // Image errors (7xxx)
    TENANT_NOT_CONFIGURED: "TENANT_NOT_CONFIGURED",
    NO_FILE: "NO_FILE",
    FILE_TOO_SMALL: "FILE_TOO_SMALL",
    FILE_TOO_LARGE: "FILE_TOO_LARGE",
    INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
    IMAGE_PROCESSING_FAILED: "IMAGE_PROCESSING_FAILED",
    IMAGE_UPLOAD_FAILED: "IMAGE_UPLOAD_FAILED",
    IMAGE_LIST_FAILED: "IMAGE_LIST_FAILED",
    IMAGE_DELETE_FAILED: "IMAGE_DELETE_FAILED",
    // Stream errors (8xxx)
    STREAM_ERROR: "STREAM_ERROR",
    STREAM_PARSE_ERROR: "STREAM_PARSE_ERROR",
    RESPONSE_CREATION_FAILED: "RESPONSE_CREATION_FAILED",
    // Workspace management errors (9xxx)
    WORKSPACE_RESTART_FAILED: "WORKSPACE_RESTART_FAILED",
    SLUG_TAKEN: "SLUG_TAKEN",
    SITE_NOT_FOUND: "SITE_NOT_FOUND",
    DEPLOYMENT_FAILED: "DEPLOYMENT_FAILED",
    // General errors
    INTERNAL_ERROR: "INTERNAL_ERROR",
    REQUEST_PROCESSING_FAILED: "REQUEST_PROCESSING_FAILED",
    UNKNOWN_ERROR: "UNKNOWN_ERROR",
    TEST_MODE_BLOCK: "TEST_MODE_BLOCK"
};
function getErrorMessage(code, details) {
    switch(code){
        case ErrorCodes.WORKSPACE_NOT_FOUND:
            return details?.host ? `I cannot find the workspace directory for '${details.host}'. Please ask your administrator to set up the workspace.` : "I cannot find the workspace directory. Please ask your administrator to set up the workspace.";
        case ErrorCodes.WORKSPACE_INVALID:
            return "The workspace path is not valid. Please contact your administrator.";
        case ErrorCodes.WORKSPACE_MISSING:
            return "I need a workspace to work in. Please provide a workspace parameter.";
        case ErrorCodes.PATH_OUTSIDE_WORKSPACE:
            return details?.attemptedPath ? `I cannot access '${details.attemptedPath}' - it's outside my allowed workspace. I can only access files within your project directory.` : "I cannot access this file - it's outside my allowed workspace. I can only access files within your project directory.";
        case ErrorCodes.NO_SESSION:
        case ErrorCodes.AUTH_REQUIRED:
            return "You need to log in first. Please refresh the page and enter your passcode.";
        case ErrorCodes.UNAUTHORIZED:
            return "You don't have access to this. Please check with your administrator if you need permission.";
        case ErrorCodes.INVALID_CREDENTIALS:
            return "The passcode is incorrect. Please check your passcode and try again.";
        case ErrorCodes.INVALID_JSON:
            return "I received malformed data. Please try sending your message again.";
        case ErrorCodes.INVALID_REQUEST:
            return details?.field ? `The ${details.field} field is missing or invalid. Please check your input.` : "Something is missing or incorrect in your request. Please check your input and try again.";
        case ErrorCodes.CONVERSATION_BUSY:
            return "I'm still working on your previous request. Please wait for me to finish before sending another message.";
        case ErrorCodes.QUERY_FAILED:
            return "I encountered an error while processing your request. This might be a temporary issue - please try again.";
        case ErrorCodes.ERROR_MAX_TURNS:
            return "This conversation has become too long. Please start a new conversation to continue.";
        case ErrorCodes.TOOL_NOT_ALLOWED:
            {
                const tool = details?.tool || "this tool";
                const allowed = details?.allowed?.join(", ") || "file operation tools";
                return `I cannot use ${tool} for security reasons. I can only use these tools: ${allowed}`;
            }
        case ErrorCodes.FILE_READ_ERROR:
            return details?.filePath ? `I cannot read the file '${details.filePath}'. It might not exist, or I might not have permission to read it.` : "I cannot read this file. It might not exist, or I might not have permission to read it.";
        case ErrorCodes.FILE_WRITE_ERROR:
            return details?.filePath ? `I cannot write to '${details.filePath}'. I might not have permission to modify it.` : "I cannot write to this file. I might not have permission to modify it.";
        case ErrorCodes.API_AUTH_FAILED:
            return "API authentication failed. The API key may be expired or invalid.";
        case ErrorCodes.TENANT_NOT_CONFIGURED:
            return "Image uploads are not set up for this workspace yet. Please contact your administrator.";
        case ErrorCodes.NO_FILE:
            return "You didn't select a file. Please choose an image to upload.";
        case ErrorCodes.FILE_TOO_SMALL:
            return details?.minSize ? `This image is too small. Please select an image larger than ${details.minSize}.` : "This image is too small. Please select a larger image.";
        case ErrorCodes.FILE_TOO_LARGE:
            return details?.maxSize ? `This image is too large. Please select an image smaller than ${details.maxSize}.` : "This image is too large. Please select a smaller image (max 10MB).";
        case ErrorCodes.INVALID_FILE_TYPE:
            return "I can only process image files (PNG, JPG, WebP). Please select a valid image.";
        case ErrorCodes.IMAGE_PROCESSING_FAILED:
            return "I couldn't process this image. The file might be corrupted - please try a different image.";
        case ErrorCodes.IMAGE_UPLOAD_FAILED:
            return "I couldn't upload the image. Please check your connection and try again.";
        case ErrorCodes.IMAGE_LIST_FAILED:
            return "I couldn't load the list of images. Please refresh the page and try again.";
        case ErrorCodes.IMAGE_DELETE_FAILED:
            return "I couldn't delete the image. Please try again or contact support if the problem persists.";
        case ErrorCodes.STREAM_ERROR:
            return "I encountered an error while streaming my response. You might see incomplete messages. Please try asking again.";
        case ErrorCodes.STREAM_PARSE_ERROR:
            return "I had trouble sending my response. Some parts might be missing. Please try again.";
        case ErrorCodes.RESPONSE_CREATION_FAILED:
            return "I couldn't start responding to your message. Please try sending it again.";
        case ErrorCodes.WORKSPACE_RESTART_FAILED:
            return "I couldn't restart your workspace. Please try again or contact support if the problem continues.";
        case ErrorCodes.VALIDATION_ERROR:
            return details?.message || "Something in your input isn't valid. Please check what you entered and try again.";
        case ErrorCodes.MISSING_SLUG:
            return "You need to provide a site name (slug). Please enter a site name.";
        case ErrorCodes.INVALID_SLUG:
            return "The site name format is invalid. Please use only letters, numbers, and hyphens.";
        case ErrorCodes.UNKNOWN_ACTION:
            return details?.action ? `I don't know how to handle the action '${details.action}'. Please check the available actions.` : "I don't recognize that action. Please check the available actions.";
        case ErrorCodes.SLUG_TAKEN:
            return details?.slug ? `The site name '${details.slug}' is already in use. Please choose a different name.` : "This site name is already in use. Please choose a different name.";
        case ErrorCodes.SITE_NOT_FOUND:
            return details?.slug ? `I couldn't find a site named '${details.slug}'. Please check the name and try again.` : "I couldn't find that site. Please check the site name and try again.";
        case ErrorCodes.DEPLOYMENT_FAILED:
            return "I couldn't deploy your site. Please check the deployment logs to see what went wrong.";
        case ErrorCodes.TEST_MODE_BLOCK:
            return "I'm in test mode right now and can't make real API calls. Please mock this endpoint in your test.";
        case ErrorCodes.INTERNAL_ERROR:
            return "Something went wrong on my end. This is usually temporary - please try again in a moment.";
        case ErrorCodes.REQUEST_PROCESSING_FAILED:
            return "I couldn't process your request. Please try again, and contact support if the problem continues.";
        default:
            return "Something unexpected went wrong. Please try again, and let support know if you keep seeing this.";
    }
}
function getErrorHelp(code, details) {
    switch(code){
        case ErrorCodes.WORKSPACE_NOT_FOUND:
            if (details?.suggestion) {
                return details.suggestion;
            }
            return "Ask your administrator to create the workspace directory for this domain.";
        case ErrorCodes.PATH_OUTSIDE_WORKSPACE:
            return details?.workspacePath ? `I can only work with files in: ${details.workspacePath}` : "For security, I can only access files within your project workspace.";
        case ErrorCodes.ERROR_MAX_TURNS:
            return "Click 'New Conversation' to start fresh and continue working.";
        case ErrorCodes.TOOL_NOT_ALLOWED:
            return "For security, I'm limited to file operations: Read, Write, Edit, Glob (find files), and Grep (search files).";
        case ErrorCodes.FILE_READ_ERROR:
            return "Make sure the file exists and hasn't been deleted. Check that the file path is correct.";
        case ErrorCodes.FILE_WRITE_ERROR:
            return "Make sure the file isn't locked by another program and that your workspace has write permissions.";
        case ErrorCodes.STREAM_PARSE_ERROR:
            return "This usually happens with network issues. Try refreshing the page or checking your connection.";
        case ErrorCodes.CONVERSATION_BUSY:
            return "Wait a moment for my current response to finish, then you can send your next message.";
        case ErrorCodes.INVALID_CREDENTIALS:
            return "Check your passcode and try again.";
        case ErrorCodes.API_AUTH_FAILED:
            return "Please contact the system administrator to update the API key.";
        default:
            return null;
    }
}
function isWorkspaceError(code) {
    return code.startsWith("WORKSPACE_");
}
}),
"[project]/apps/web/features/chat/lib/workspaceRetriever.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getWorkspace",
    ()=>getWorkspace
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:fs [external] (node:fs, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:path [external] (node:path, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$manager$2f$lib$2f$domain$2d$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/manager/lib/domain-utils.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$workspace$2f$types$2f$workspace$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/workspace/types/workspace.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/error-codes.ts [app-route] (ecmascript)");
;
;
;
;
;
;
function getWorkspace({ host, body, requestId }) {
    console.log(`[Workspace ${requestId}] Resolving workspace for host: ${host}`);
    // Check for terminal mode using centralized guard function
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$workspace$2f$types$2f$workspace$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isTerminalMode"])(host)) {
        return getTerminalWorkspace(body, requestId);
    }
    return getHostnameWorkspace(host, requestId);
}
function getTerminalWorkspace(body, requestId) {
    const customWorkspace = body?.workspace;
    if (!customWorkspace || typeof customWorkspace !== "string") {
        console.error(`[Workspace ${requestId}] Missing or invalid workspace parameter`);
        return {
            success: false,
            response: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].WORKSPACE_MISSING,
                message: "Terminal hostname requires workspace parameter in request body (string)"
            }, {
                status: 400
            })
        };
    }
    // Normalize domain name to handle protocols, www, uppercase, etc.
    const normalizedDomain = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$manager$2f$lib$2f$domain$2d$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["normalizeDomain"])(customWorkspace);
    console.log(`[Workspace ${requestId}] Normalized workspace: ${customWorkspace} → ${normalizedDomain}`);
    // Auto-prepend webalive/sites/ if not present, and always append /user
    let workspacePath = normalizedDomain.startsWith("webalive/sites/") ? normalizedDomain : `webalive/sites/${normalizedDomain}`;
    // Always append /user to the workspace path
    if (!workspacePath.endsWith("/user")) {
        workspacePath = `${workspacePath}/user`;
    }
    // Prevent path traversal attacks
    const normalizedWorkspace = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].normalize(workspacePath);
    if (normalizedWorkspace !== workspacePath || normalizedWorkspace.includes("..")) {
        console.error(`[Workspace ${requestId}] Potential path traversal in workspace: ${workspacePath}`);
        return {
            success: false,
            response: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].WORKSPACE_INVALID,
                message: "Invalid workspace path detected"
            }, {
                status: 400
            })
        };
    }
    const fullPath = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join("/srv", normalizedWorkspace);
    // Check if workspace directory exists
    if (!(0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["existsSync"])(fullPath)) {
        console.error(`[Workspace ${requestId}] Workspace directory does not exist: ${fullPath}`);
        return {
            success: false,
            response: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].WORKSPACE_NOT_FOUND,
                message: `Workspace directory not found: ${normalizedWorkspace}`,
                details: {
                    workspace: normalizedWorkspace,
                    fullPath,
                    suggestion: `Create the workspace directory at: ${fullPath}`
                }
            }, {
                status: 404
            })
        };
    }
    console.log(`[Workspace ${requestId}] Using custom workspace: ${fullPath}`);
    return {
        success: true,
        workspace: fullPath
    };
}
function getHostnameWorkspace(host, requestId) {
    // Check for local development mode using template seed repo
    if (process.env.BRIDGE_ENV === "local") {
        const templateWorkspace = process.env.LOCAL_TEMPLATE_PATH;
        if (!templateWorkspace) {
            console.error(`[Workspace ${requestId}] BRIDGE_ENV=local but LOCAL_TEMPLATE_PATH not set`);
            return {
                success: false,
                response: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    ok: false,
                    error: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].WORKSPACE_NOT_FOUND,
                    message: "LOCAL_TEMPLATE_PATH environment variable required when BRIDGE_ENV=local",
                    details: {
                        suggestion: `Run 'bun run setup' and add LOCAL_TEMPLATE_PATH to apps/web/.env.local`
                    }
                }, {
                    status: 500
                })
            };
        }
        // Validate that the path is absolute
        if (!__TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].isAbsolute(templateWorkspace)) {
            console.error(`[Workspace ${requestId}] LOCAL_TEMPLATE_PATH must be absolute: ${templateWorkspace}`);
            return {
                success: false,
                response: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    ok: false,
                    error: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].WORKSPACE_INVALID,
                    message: "LOCAL_TEMPLATE_PATH must be an absolute path",
                    details: {
                        providedPath: templateWorkspace,
                        suggestion: "Use an absolute path like: /Users/you/alive-brug/.alive/template"
                    }
                }, {
                    status: 500
                })
            };
        }
        // Check if the workspace exists
        if (!(0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["existsSync"])(templateWorkspace)) {
            console.error(`[Workspace ${requestId}] Local template workspace does not exist: ${templateWorkspace}`);
            return {
                success: false,
                response: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    ok: false,
                    error: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].WORKSPACE_NOT_FOUND,
                    message: "Local template workspace not found",
                    details: {
                        expectedPath: templateWorkspace,
                        suggestion: `Run 'bun run setup' to create the workspace`
                    }
                }, {
                    status: 404
                })
            };
        }
        // Check if it's actually a directory (not a file)
        try {
            const stat = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["statSync"])(templateWorkspace);
            if (!stat.isDirectory()) {
                console.error(`[Workspace ${requestId}] LOCAL_TEMPLATE_PATH exists but is not a directory: ${templateWorkspace}`);
                return {
                    success: false,
                    response: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                        ok: false,
                        error: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].WORKSPACE_INVALID,
                        message: "LOCAL_TEMPLATE_PATH exists but is not a directory",
                        details: {
                            path: templateWorkspace,
                            suggestion: `Remove the file and run 'bun run setup'`
                        }
                    }, {
                        status: 500
                    })
                };
            }
        } catch (error) {
            console.error(`[Workspace ${requestId}] Failed to stat LOCAL_TEMPLATE_PATH: ${templateWorkspace}`, error);
            return {
                success: false,
                response: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    ok: false,
                    error: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].WORKSPACE_INVALID,
                    message: "Cannot access LOCAL_TEMPLATE_PATH",
                    details: {
                        path: templateWorkspace,
                        error: error instanceof Error ? error.message : String(error),
                        suggestion: `Check permissions and run 'bun run setup'`
                    }
                }, {
                    status: 500
                })
            };
        }
        console.log(`[Workspace ${requestId}] Using local template workspace: ${templateWorkspace}`);
        return {
            success: true,
            workspace: templateWorkspace
        };
    }
    const base = process.env.WORKSPACE_BASE || "/srv/webalive/sites";
    const workspace = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(base, host, "user", "src");
    // Check if workspace directory exists
    if (!(0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["existsSync"])(workspace)) {
        console.error(`[Workspace ${requestId}] Hostname workspace does not exist: ${workspace}`);
        return {
            success: false,
            response: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].WORKSPACE_NOT_FOUND,
                message: `Workspace directory not found for hostname '${host}'.`,
                details: {
                    host,
                    expectedPath: workspace,
                    workspaceBase: base,
                    suggestion: `Create the workspace directory at: ${workspace}`
                }
            }, {
                status: 404
            })
        };
    }
    console.log(`[Workspace ${requestId}] Using hostname workspace: ${workspace}`);
    return {
        success: true,
        workspace
    };
}
}),
"[project]/apps/web/lib/utils.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "cn",
    ()=>cn,
    "generateRequestId",
    ()=>generateRequestId,
    "truncateDeep",
    ()=>truncateDeep
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/clsx/dist/clsx.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/tailwind-merge/dist/bundle-mjs.mjs [app-route] (ecmascript)");
;
;
function cn(...inputs) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["twMerge"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["clsx"])(inputs));
}
function generateRequestId() {
    return Math.random().toString(36).substring(2, 8);
}
function truncateDeep(value, maxLength = 200, maxDepth = 50, currentDepth = 0, seen = new WeakSet()) {
    // Depth limit protection (prevent stack overflow)
    if (currentDepth >= maxDepth) {
        return "[max depth reached]";
    }
    // Handle null/undefined
    if (value === null || value === undefined) {
        return value;
    }
    // Handle strings
    if (typeof value === "string") {
        if (value.length > maxLength) {
            const remaining = value.length - maxLength;
            return `${value.slice(0, maxLength)}...[truncated ${remaining} chars]`;
        }
        return value;
    }
    // Handle primitives
    if (typeof value === "number" || typeof value === "boolean") {
        return value;
    }
    // Handle special primitives
    if (typeof value === "bigint") {
        return `${value.toString()}n`;
    }
    if (typeof value === "symbol") {
        return value.toString();
    }
    if (typeof value === "function") {
        return `[Function: ${value.name || "anonymous"}]`;
    }
    // Handle Date objects
    if (value instanceof Date) {
        try {
            return value.toISOString();
        } catch  {
            return "[Invalid Date]";
        }
    }
    // Handle RegExp objects
    if (value instanceof RegExp) {
        return value.toString();
    }
    // Handle Error objects
    if (value instanceof Error) {
        try {
            return {
                name: value.name,
                message: truncateDeep(value.message, maxLength, maxDepth, currentDepth + 1, seen),
                stack: truncateDeep(value.stack, maxLength, maxDepth, currentDepth + 1, seen)
            };
        } catch  {
            return "[Error object processing failed]";
        }
    }
    // Handle arrays
    if (Array.isArray(value)) {
        // Circular reference check
        if (seen.has(value)) {
            return "[Circular Reference]";
        }
        seen.add(value);
        try {
            return value.map((item)=>truncateDeep(item, maxLength, maxDepth, currentDepth + 1, seen));
        } catch (err) {
            return `[Array processing error: ${err instanceof Error ? err.message : String(err)}]`;
        }
    }
    // Handle objects
    if (typeof value === "object") {
        // Circular reference check
        if (seen.has(value)) {
            return "[Circular Reference]";
        }
        seen.add(value);
        try {
            const result = {};
            // Use Object.keys to safely handle getters that might throw
            const keys = Object.keys(value);
            for (const key of keys){
                try {
                    // Access property value - this is where getters execute
                    const val = value[key];
                    result[key] = truncateDeep(val, maxLength, maxDepth, currentDepth + 1, seen);
                } catch (err) {
                    // Property getter threw an error
                    result[key] = `[Error accessing property: ${err instanceof Error ? err.message : String(err)}]`;
                }
            }
            return result;
        } catch (err) {
            return `[Object processing error: ${err instanceof Error ? err.message : String(err)}]`;
        }
    }
    // Fallback for unknown types
    try {
        return String(value);
    } catch  {
        return "[Unstringifiable value]";
    }
}
}),
"[project]/apps/web/app/api/verify/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$workspaceRetriever$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/lib/workspaceRetriever.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/error-codes.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/utils.ts [app-route] (ecmascript)");
;
;
;
;
;
async function POST(req) {
    const requestId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["generateRequestId"])();
    console.log(`[Verify API ${requestId}] === VERIFICATION START ===`);
    try {
        const jar = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
        if (!jar.get("session")) {
            console.log(`[Verify API ${requestId}] No session cookie found`);
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].NO_SESSION,
                message: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getErrorMessage"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].NO_SESSION)
            }, {
                status: 401
            });
        }
        let body;
        try {
            body = await req.json();
            console.log(`[Verify API ${requestId}] Raw body:`, body);
        } catch (jsonError) {
            console.error(`[Verify API ${requestId}] Failed to parse JSON body:`, jsonError);
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].INVALID_JSON,
                message: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getErrorMessage"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].INVALID_JSON)
            }, {
                status: 400
            });
        }
        const host = (await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["headers"])()).get("host") || "localhost";
        console.log(`[Verify API ${requestId}] Host: ${host}`);
        // Use workspace checker to validate
        const workspaceResult = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$workspaceRetriever$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getWorkspace"])({
            host,
            body,
            requestId
        });
        if (!workspaceResult.success) {
            console.log(`[Verify API ${requestId}] Workspace verification failed`);
            // Extract error details from the NextResponse
            const errorResponse = await workspaceResult.response.json();
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                verified: false,
                ...errorResponse
            }, {
                status: 200
            }) // Return 200 so frontend can handle verification result
            ;
        }
        console.log(`[Verify API ${requestId}] Workspace verification successful: ${workspaceResult.workspace}`);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: true,
            verified: true,
            workspace: workspaceResult.workspace,
            message: "Workspace directory found and accessible",
            requestId
        });
    } catch (error) {
        console.error(`[Verify API ${requestId}] Verification failed:`, error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            verified: false,
            error: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].REQUEST_PROCESSING_FAILED,
            message: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getErrorMessage"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].REQUEST_PROCESSING_FAILED),
            details: error instanceof Error ? error.message : "Unknown error",
            requestId
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1fea6ade._.js.map