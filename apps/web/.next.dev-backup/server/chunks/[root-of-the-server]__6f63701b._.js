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
"[project]/apps/web/features/auth/types/guards.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "extractOriginFromReferer",
    ()=>extractOriginFromReferer,
    "getAllowedOrigin",
    ()=>getAllowedOrigin,
    "hasOrigin",
    ()=>hasOrigin,
    "hasSessionCookie",
    ()=>hasSessionCookie,
    "hasValidReferer",
    ()=>hasValidReferer,
    "hasValidUser",
    ()=>hasValidUser,
    "isOriginAllowed",
    ()=>isOriginAllowed,
    "isOriginGoaliveNLDomain",
    ()=>isOriginGoaliveNLDomain,
    "isOriginInAllowedDomains",
    ()=>isOriginInAllowedDomains,
    "isValidSessionCookie",
    ()=>isValidSessionCookie
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:fs [external] (node:fs, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:path [external] (node:path, cjs)");
;
;
function hasSessionCookie(cookie) {
    return cookie !== undefined && cookie !== null;
}
function isValidSessionCookie(value) {
    return typeof value === "string" && value.length > 0;
}
function hasValidUser(user) {
    return user !== null && user !== undefined && typeof user.id === "string";
}
function isOriginInAllowedDomains(origin) {
    try {
        const domainsFile = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["join"])(process.cwd(), "allowed-domains.json");
        if ((0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["existsSync"])(domainsFile)) {
            const allowedDomains = JSON.parse((0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["readFileSync"])(domainsFile, "utf8"));
            return Array.isArray(allowedDomains) && allowedDomains.includes(origin);
        }
    } catch (error) {
        console.warn("Failed to read allowed domains file:", error);
    }
    return false;
}
function isOriginGoaliveNLDomain(origin) {
    return origin.endsWith(".goalive.nl");
}
function isOriginAllowed(origin) {
    return isOriginInAllowedDomains(origin) || isOriginGoaliveNLDomain(origin);
}
function getAllowedOrigin(requestOrigin) {
    const fallback = "https://terminal.goalive.nl";
    if (!requestOrigin) {
        return fallback;
    }
    if (isOriginAllowed(requestOrigin)) {
        return requestOrigin;
    }
    return fallback;
}
function hasOrigin(origin) {
    return origin !== null && origin !== undefined && origin.length > 0;
}
function hasValidReferer(referer) {
    return referer !== null && referer !== undefined && referer.length > 0;
}
function extractOriginFromReferer(referer) {
    if (!hasValidReferer(referer)) {
        return undefined;
    }
    const parts = referer.split("/").slice(0, 3);
    return parts.join("/");
}
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
"[project]/apps/web/lib/cors-utils.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "addCorsHeaders",
    ()=>addCorsHeaders
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$auth$2f$types$2f$guards$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/auth/types/guards.ts [app-route] (ecmascript)");
;
function addCorsHeaders(res, origin) {
    const allowedOrigin = origin ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$auth$2f$types$2f$guards$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["hasOrigin"])(origin) ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$auth$2f$types$2f$guards$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAllowedOrigin"])(origin) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$auth$2f$types$2f$guards$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAllowedOrigin"])(null) : null;
    res.headers.set("Access-Control-Allow-Origin", allowedOrigin || "https://terminal.goalive.nl");
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.headers.set("Access-Control-Allow-Credentials", "true");
    res.headers.set("Access-Control-Max-Age", "86400");
}
}),
"[project]/apps/web/features/workspace/lib/workspace-utils.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "resolveWorkspace",
    ()=>resolveWorkspace
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$workspaceRetriever$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/lib/workspaceRetriever.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$cors$2d$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/cors-utils.ts [app-route] (ecmascript)");
;
;
function resolveWorkspace(host, body, requestId, origin = null) {
    const workspaceResult = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$workspaceRetriever$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getWorkspace"])({
        host,
        body,
        requestId
    });
    if (!workspaceResult.success) {
        // Pass through the original error response from workspaceRetriever
        // which contains more detailed error information
        if (origin) {
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$cors$2d$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["addCorsHeaders"])(workspaceResult.response, origin);
        }
        return {
            success: false,
            response: workspaceResult.response
        };
    }
    return {
        success: true,
        workspace: workspaceResult.workspace
    };
}
}),
"[externals]/@napi-rs/image [external] (@napi-rs/image, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("@napi-rs/image", () => require("@napi-rs/image"));

module.exports = mod;
}),
"[project]/packages/images/dist/core/compress.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "compressImage",
    ()=>compressImage,
    "generateVariant",
    ()=>generateVariant
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f40$napi$2d$rs$2f$image__$5b$external$5d$__$2840$napi$2d$rs$2f$image$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/@napi-rs/image [external] (@napi-rs/image, cjs)");
;
async function compressImage(buffer, options = {}) {
    const { maxWidth = 1920, targetSize = 150 * 1024, minQuality = 1, maxQuality = 100 } = options;
    // Create transformer
    const transformer = new __TURBOPACK__imported__module__$5b$externals$5d2f40$napi$2d$rs$2f$image__$5b$external$5d$__$2840$napi$2d$rs$2f$image$2c$__cjs$29$__["Transformer"](buffer);
    const metadata = await transformer.metadata();
    // Calculate resize dimensions (preserve aspect ratio)
    // Based on huurmatcher's approach: limit BOTH width and height
    let resizeWidth = metadata.width;
    let resizeHeight = metadata.height;
    const aspectRatio = metadata.width / metadata.height;
    // Only resize if exceeds max dimension in either direction
    if (metadata.width > maxWidth || metadata.height > maxWidth) {
        if (aspectRatio > 1) {
            // Landscape: width is limiting dimension
            resizeWidth = maxWidth;
            resizeHeight = Math.round(maxWidth / aspectRatio);
        } else {
            // Portrait or square: height is limiting dimension
            resizeWidth = Math.max(1, Math.round(maxWidth * aspectRatio));
            resizeHeight = maxWidth;
        }
    }
    // Binary search for optimal quality
    let min = minQuality;
    let max = maxQuality;
    let bestBuffer = null;
    while(min <= max){
        const mid = Math.floor((min + max) / 2);
        // Create new transformer for this iteration
        const testTransformer = new __TURBOPACK__imported__module__$5b$externals$5d2f40$napi$2d$rs$2f$image__$5b$external$5d$__$2840$napi$2d$rs$2f$image$2c$__cjs$29$__["Transformer"](buffer);
        // Resize if dimensions changed
        if (resizeWidth !== metadata.width || resizeHeight !== metadata.height) {
            testTransformer.resize(resizeWidth, resizeHeight);
        }
        // Convert to WebP with current quality
        const compressed = await testTransformer.webp(mid);
        if (compressed.length > targetSize) {
            // Too large, reduce quality
            max = mid - 1;
        } else {
            // Good size, try higher quality
            bestBuffer = compressed;
            min = mid + 1;
        }
    }
    // If no suitable compression found, use lowest quality
    if (!bestBuffer) {
        const fallbackTransformer = new __TURBOPACK__imported__module__$5b$externals$5d2f40$napi$2d$rs$2f$image__$5b$external$5d$__$2840$napi$2d$rs$2f$image$2c$__cjs$29$__["Transformer"](buffer);
        if (resizeWidth !== metadata.width || resizeHeight !== metadata.height) {
            fallbackTransformer.resize(resizeWidth, resizeHeight);
        }
        bestBuffer = await fallbackTransformer.webp(minQuality);
    }
    // Get final dimensions
    const finalTransformer = new __TURBOPACK__imported__module__$5b$externals$5d2f40$napi$2d$rs$2f$image__$5b$external$5d$__$2840$napi$2d$rs$2f$image$2c$__cjs$29$__["Transformer"](bestBuffer);
    const finalMetadata = await finalTransformer.metadata();
    return {
        buffer: bestBuffer,
        width: finalMetadata.width,
        height: finalMetadata.height,
        size: bestBuffer.length
    };
}
async function generateVariant(buffer, width, quality = 85) {
    const transformer = new __TURBOPACK__imported__module__$5b$externals$5d2f40$napi$2d$rs$2f$image__$5b$external$5d$__$2840$napi$2d$rs$2f$image$2c$__cjs$29$__["Transformer"](buffer);
    const metadata = await transformer.metadata();
    // Calculate height maintaining aspect ratio
    const ratio = width / metadata.width;
    const height = Math.round(metadata.height * ratio);
    // Resize and convert to WebP
    transformer.resize(width, height);
    const compressed = await transformer.webp(quality);
    return {
        buffer: compressed,
        width,
        height,
        size: compressed.length
    };
} //# sourceMappingURL=compress.js.map
}),
"[externals]/node:crypto [external] (node:crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:crypto", () => require("node:crypto"));

module.exports = mod;
}),
"[project]/packages/images/dist/core/hash.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "generateContentHash",
    ()=>generateContentHash
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
;
function generateContentHash(buffer) {
    return __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["default"].createHash("sha256").update(buffer).digest("hex").slice(0, 16);
} //# sourceMappingURL=hash.js.map
}),
"[project]/packages/images/dist/core/keys.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Generate storage key following content-addressed pattern:
 * t/{tenantId}/o/{contentHash}/v/{variant}.webp
 *
 * This format ensures:
 * - Tenant isolation via prefix
 * - Content addressing for deduplication
 * - Variant support for responsive images
 * - Migration-friendly (same key across storage backends)
 */ __turbopack_context__.s([
    "generateStorageKey",
    ()=>generateStorageKey,
    "parseStorageKey",
    ()=>parseStorageKey
]);
function generateStorageKey(tenantId, contentHash, variant) {
    return `t/${tenantId}/o/${contentHash}/v/${variant}.webp`;
}
function parseStorageKey(key) {
    const match = key.match(/^t\/([^/]+)\/o\/([^/]+)\/v\/([^.]+)\.webp$/);
    if (!match) return null;
    return {
        tenantId: match[1],
        contentHash: match[2],
        variant: match[3]
    };
} //# sourceMappingURL=keys.js.map
}),
"[project]/packages/images/dist/types/response.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Response builders
 */ __turbopack_context__.s([
    "Rs",
    ()=>Rs
]);
class Rs {
    static data(data) {
        return {
            data,
            error: null
        };
    }
    static error(message, code) {
        return {
            data: null,
            error: {
                message,
                code
            }
        };
    }
    static fromError(error, code) {
        const message = error instanceof Error ? error.message : String(error);
        return Rs.error(message, code);
    }
} //# sourceMappingURL=response.js.map
}),
"[project]/packages/images/dist/validation/magic-numbers.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * MIME type signatures (magic numbers)
 * These are the first bytes of valid image files
 *
 * SECURITY: Never trust file extensions or Content-Type headers.
 * Always validate using magic numbers to prevent .php.jpg attacks.
 */ __turbopack_context__.s([
    "getAllowedMimeTypes",
    ()=>getAllowedMimeTypes,
    "validateImageType",
    ()=>validateImageType
]);
const SIGNATURES = {
    "image/jpeg": [
        0xff,
        0xd8,
        0xff
    ],
    "image/png": [
        0x89,
        0x50,
        0x4e,
        0x47
    ],
    "image/webp": [
        0x52,
        0x49,
        0x46,
        0x46
    ],
    "image/gif": [
        0x47,
        0x49,
        0x46,
        0x38
    ]
};
function validateImageType(buffer) {
    for (const [mimeType, signature] of Object.entries(SIGNATURES)){
        if (signature.every((byte, i)=>buffer[i] === byte)) {
            return mimeType;
        }
    }
    return null;
}
function getAllowedMimeTypes() {
    return Object.keys(SIGNATURES);
} //# sourceMappingURL=magic-numbers.js.map
}),
"[project]/packages/images/dist/validation/size-limits.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Default size limits
 */ __turbopack_context__.s([
    "MAX_FILE_SIZE",
    ()=>MAX_FILE_SIZE,
    "MIN_FILE_SIZE",
    ()=>MIN_FILE_SIZE,
    "validateFileSize",
    ()=>validateFileSize
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MIN_FILE_SIZE = 100; // 100 bytes
function validateFileSize(size, maxSize = MAX_FILE_SIZE) {
    if (size < MIN_FILE_SIZE) {
        return `File too small. Minimum size: ${MIN_FILE_SIZE} bytes`;
    }
    if (size > maxSize) {
        const maxMB = (maxSize / (1024 * 1024)).toFixed(1);
        return `File too large. Maximum size: ${maxMB}MB`;
    }
    return null;
} //# sourceMappingURL=size-limits.js.map
}),
"[project]/packages/images/dist/core/upload.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "uploadImage",
    ()=>uploadImage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$types$2f$response$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/images/dist/types/response.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$validation$2f$magic$2d$numbers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/images/dist/validation/magic-numbers.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$validation$2f$size$2d$limits$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/images/dist/validation/size-limits.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$core$2f$compress$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/images/dist/core/compress.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$core$2f$hash$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/images/dist/core/hash.js [app-route] (ecmascript)");
;
;
;
;
;
async function uploadImage(storage, tenantId, file, options = {}) {
    try {
        // 1. Validate file size
        const sizeError = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$validation$2f$size$2d$limits$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validateFileSize"])(file.length);
        if (sizeError) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$types$2f$response$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Rs"].error(sizeError, "validation:size");
        }
        // 2. Validate file type (magic numbers)
        const detectedType = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$validation$2f$magic$2d$numbers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validateImageType"])(file);
        if (!detectedType) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$types$2f$response$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Rs"].error("Invalid file type. Only images allowed.", "validation:type");
        }
        // 3. Generate content hash
        const contentHash = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$core$2f$hash$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["generateContentHash"])(file);
        // 4. Compress original
        const compressed = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$core$2f$compress$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["compressImage"])(file, {
            maxWidth: options.maxWidth || 1920,
            targetSize: options.targetSize || 150 * 1024
        });
        // 5. Generate variants
        const variants = options.variants || [
            "orig"
        ];
        const keys = {};
        const urls = {};
        // Store original
        if (variants.includes("orig")) {
            const result = await storage.put(tenantId, contentHash, "orig", compressed.buffer);
            if (result.error) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$types$2f$response$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Rs"].error(result.error.message, result.error.code);
            }
            keys.orig = result.data;
            urls.orig = `/_images/${result.data}`;
        }
        // Generate and store additional variants
        const variantSizes = {
            w640: 640,
            w1280: 1280,
            thumb: 300
        };
        for (const variant of variants){
            if (variant === "orig") continue;
            const width = variantSizes[variant];
            if (!width) continue;
            // Generate variant
            const variantImage = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$core$2f$compress$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["generateVariant"])(compressed.buffer, width);
            // Store variant
            const result = await storage.put(tenantId, contentHash, variant, variantImage.buffer);
            if (result.error) {
                // Log error but don't fail entire upload
                console.error(`Failed to generate variant ${variant}:`, result.error);
                continue;
            }
            keys[variant] = result.data;
            urls[variant] = `/_images/${result.data}`;
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$types$2f$response$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Rs"].data({
            contentHash,
            keys: keys,
            urls: urls,
            width: compressed.width,
            height: compressed.height,
            fileSize: compressed.size
        });
    } catch (error) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$types$2f$response$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Rs"].fromError(error, "upload:error");
    }
} //# sourceMappingURL=upload.js.map
}),
"[externals]/node:fs/promises [external] (node:fs/promises, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:fs/promises", () => require("node:fs/promises"));

module.exports = mod;
}),
"[project]/packages/images/dist/storage/filesystem.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FilesystemStorage",
    ()=>FilesystemStorage
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs$2f$promises__$5b$external$5d$__$28$node$3a$fs$2f$promises$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:fs/promises [external] (node:fs/promises, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:path [external] (node:path, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$types$2f$response$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/images/dist/types/response.js [app-route] (ecmascript)");
;
;
;
;
class FilesystemStorage {
    basePath;
    signatureSecret;
    constructor(config){
        this.basePath = config.basePath;
        this.signatureSecret = config.signatureSecret || "default-secret-change-in-production";
    }
    async put(tenantId, contentHash, variant, data) {
        try {
            const key = `t/${tenantId}/o/${contentHash}/v/${variant}.webp`;
            const fullPath = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(this.basePath, key);
            // Ensure directory exists
            await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs$2f$promises__$5b$external$5d$__$28$node$3a$fs$2f$promises$2c$__cjs$29$__["default"].mkdir(__TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].dirname(fullPath), {
                recursive: true
            });
            // Write file
            await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs$2f$promises__$5b$external$5d$__$28$node$3a$fs$2f$promises$2c$__cjs$29$__["default"].writeFile(fullPath, data);
            return __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$types$2f$response$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Rs"].data(key);
        } catch (error) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$types$2f$response$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Rs"].fromError(error, "fs:put");
        }
    }
    async get(key) {
        try {
            const fullPath = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(this.basePath, key);
            // Check if file exists
            try {
                await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs$2f$promises__$5b$external$5d$__$28$node$3a$fs$2f$promises$2c$__cjs$29$__["default"].access(fullPath);
            } catch  {
                return __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$types$2f$response$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Rs"].data(null);
            }
            // Read file
            const data = await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs$2f$promises__$5b$external$5d$__$28$node$3a$fs$2f$promises$2c$__cjs$29$__["default"].readFile(fullPath);
            return __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$types$2f$response$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Rs"].data(data);
        } catch (error) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$types$2f$response$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Rs"].fromError(error, "fs:get");
        }
    }
    async delete(key) {
        try {
            const fullPath = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(this.basePath, key);
            // Delete file (ignore if doesn't exist)
            try {
                await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs$2f$promises__$5b$external$5d$__$28$node$3a$fs$2f$promises$2c$__cjs$29$__["default"].unlink(fullPath);
            } catch (error) {
                if (error.code !== "ENOENT") {
                    throw error;
                }
            }
            return __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$types$2f$response$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Rs"].data(undefined);
        } catch (error) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$types$2f$response$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Rs"].fromError(error, "fs:delete");
        }
    }
    async list(tenantId, prefix) {
        try {
            const tenantPath = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(this.basePath, "t", tenantId);
            // Check if tenant directory exists
            try {
                await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs$2f$promises__$5b$external$5d$__$28$node$3a$fs$2f$promises$2c$__cjs$29$__["default"].access(tenantPath);
            } catch  {
                return __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$types$2f$response$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Rs"].data([]);
            }
            // Recursively find all .webp files
            const files = await this.findFiles(tenantPath, ".webp");
            // Convert absolute paths to relative keys
            const keys = files.map((file)=>{
                const relativePath = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].relative(this.basePath, file);
                return relativePath.split(__TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].sep).join("/"); // Normalize to forward slashes
            });
            // Apply prefix filter if provided
            if (prefix) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$types$2f$response$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Rs"].data(keys.filter((key)=>key.includes(prefix)));
            }
            return __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$types$2f$response$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Rs"].data(keys);
        } catch (error) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$types$2f$response$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Rs"].fromError(error, "fs:list");
        }
    }
    async getSignedUrl(key, expiresIn) {
        try {
            const expiry = Math.floor(Date.now() / 1000) + expiresIn;
            // Generate HMAC signature
            const signature = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["default"].createHmac("sha256", this.signatureSecret).update(`${key}:${expiry}`).digest("hex");
            // Return signed URL query parameters
            const signedUrl = `?key=${encodeURIComponent(key)}&sig=${signature}&exp=${expiry}`;
            return __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$types$2f$response$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Rs"].data(signedUrl);
        } catch (error) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$types$2f$response$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Rs"].fromError(error, "fs:sign");
        }
    }
    /**
     * Verify signed URL signature
     */ verifySignature(key, signature, expiry) {
        // Check expiry
        if (Math.floor(Date.now() / 1000) > expiry) {
            return false;
        }
        // Generate expected signature
        const expected = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["default"].createHmac("sha256", this.signatureSecret).update(`${key}:${expiry}`).digest("hex");
        // Constant-time comparison
        return __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["default"].timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    }
    /**
     * Recursively find files with extension
     */ async findFiles(dir, ext) {
        const results = [];
        try {
            const entries = await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs$2f$promises__$5b$external$5d$__$28$node$3a$fs$2f$promises$2c$__cjs$29$__["default"].readdir(dir, {
                withFileTypes: true
            });
            for (const entry of entries){
                const fullPath = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(dir, entry.name);
                if (entry.isDirectory()) {
                    const subFiles = await this.findFiles(fullPath, ext);
                    results.push(...subFiles);
                } else if (entry.isFile() && entry.name.endsWith(ext)) {
                    results.push(fullPath);
                }
            }
        } catch  {
        // Ignore errors (directory might not exist)
        }
        return results;
    }
} //# sourceMappingURL=filesystem.js.map
}),
"[project]/packages/images/dist/index.js [app-route] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

// Storage
__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$core$2f$compress$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/images/dist/core/compress.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$core$2f$hash$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/images/dist/core/hash.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$core$2f$keys$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/images/dist/core/keys.js [app-route] (ecmascript)");
// Core
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$core$2f$upload$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/images/dist/core/upload.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$storage$2f$filesystem$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/images/dist/storage/filesystem.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$types$2f$response$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/images/dist/types/response.js [app-route] (ecmascript)");
// Validation
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$validation$2f$magic$2d$numbers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/images/dist/validation/magic-numbers.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$validation$2f$size$2d$limits$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/images/dist/validation/size-limits.js [app-route] (ecmascript)"); //# sourceMappingURL=index.js.map
;
;
;
;
;
;
;
;
}),
"[project]/apps/web/lib/storage.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "imageStorage",
    ()=>imageStorage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/images/dist/index.js [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$storage$2f$filesystem$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/images/dist/storage/filesystem.js [app-route] (ecmascript)");
;
const imageStorage = new __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$images$2f$dist$2f$storage$2f$filesystem$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["FilesystemStorage"]({
    basePath: process.env.IMAGES_STORAGE_PATH || "/srv/webalive/storage",
    signatureSecret: process.env.IMAGES_SIGNATURE_SECRET
});
}),
"[project]/apps/web/lib/tenant-utils.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Tenant ID utilities for image storage
 */ __turbopack_context__.s([
    "workspaceToTenantId",
    ()=>workspaceToTenantId
]);
function workspaceToTenantId(workspace) {
    // Convert workspace path to tenant ID
    // Examples:
    // /srv/webalive/sites/demo.goalive.nl/user/src -> demo.goalive.nl
    // /srv/webalive/sites/homable.nl/user -> homable.nl
    const normalized = workspace.replace(/\/+$/, "") // Remove trailing slashes
    ;
    const match = normalized.match(/\/srv\/webalive\/sites\/([^/]+)/);
    if (match) {
        return match[1] // Extract domain from path
        ;
    }
    // Fallback: use last part of workspace path
    const parts = normalized.split("/");
    return parts[parts.length - 1] || "unknown";
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
"[project]/apps/web/app/api/images/list/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$auth$2f$types$2f$guards$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/auth/types/guards.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$workspace$2f$lib$2f$workspace$2d$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/workspace/lib/workspace-utils.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/error-codes.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$storage$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/storage.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$tenant$2d$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/tenant-utils.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/utils.ts [app-route] (ecmascript)");
;
;
;
;
;
;
;
async function GET(request) {
    try {
        // 1. Auth check
        const jar = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
        const requestId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["generateRequestId"])();
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$auth$2f$types$2f$guards$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["hasSessionCookie"])(jar)) {
            return Response.json({
                ok: false,
                error: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].UNAUTHORIZED,
                message: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getErrorMessage"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].UNAUTHORIZED),
                requestId
            }, {
                status: 401
            });
        }
        // 2. Resolve workspace (same logic as upload)
        const host = request.headers.get("host") || "";
        const searchParams = request.nextUrl.searchParams;
        const workspaceParam = searchParams.get("workspace");
        const body = workspaceParam ? {
            workspace: workspaceParam
        } : {};
        const workspaceResult = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$workspace$2f$lib$2f$workspace$2d$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["resolveWorkspace"])(host, body, requestId);
        if (!workspaceResult.success) {
            return workspaceResult.response;
        }
        // 3. Convert workspace to tenant ID
        const tenantId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$tenant$2d$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["workspaceToTenantId"])(workspaceResult.workspace);
        // 4. List images for this tenant
        const listResult = await __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$storage$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["imageStorage"].list(tenantId);
        if (listResult.error) {
            return Response.json({
                ok: false,
                error: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].IMAGE_LIST_FAILED,
                message: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getErrorMessage"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].IMAGE_LIST_FAILED),
                requestId
            }, {
                status: 500
            });
        }
        // 5. Convert keys to structured format
        const images = listResult.data.map((key)=>{
            // Parse key: t/{tenantId}/o/{hash}/v/{variant}.webp
            const match = key.match(/^t\/([^/]+)\/o\/([^/]+)\/v\/([^.]+)\.webp$/);
            if (!match) return null;
            const [, , contentHash, variant] = match;
            return {
                contentHash,
                variant,
                key
            };
        }).filter(Boolean);
        // 6. Group by content hash and create variant URLs
        const groupedImages = {};
        for (const img of images){
            if (!img) continue;
            if (!groupedImages[img.contentHash]) {
                groupedImages[img.contentHash] = {
                    key: `${tenantId}/${img.contentHash}`,
                    variants: {},
                    uploadedAt: new Date().toISOString()
                };
            }
            groupedImages[img.contentHash].variants[img.variant] = img.key;
        }
        const formattedImages = Object.values(groupedImages);
        return Response.json({
            success: true,
            images: formattedImages,
            count: formattedImages.length
        });
    } catch (error) {
        console.error("List images error:", error);
        const requestId = Math.random().toString(36).substring(7);
        return Response.json({
            ok: false,
            error: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].IMAGE_LIST_FAILED,
            message: error instanceof Error ? error.message : (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getErrorMessage"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].IMAGE_LIST_FAILED),
            requestId
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__6f63701b._.js.map