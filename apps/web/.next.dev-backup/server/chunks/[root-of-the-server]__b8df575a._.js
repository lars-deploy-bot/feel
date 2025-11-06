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
"[externals]/node:child_process [external] (node:child_process, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:child_process", () => require("node:child_process"));

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
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
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
"[project]/apps/web/features/auth/lib/auth.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getSessionUser",
    ()=>getSessionUser,
    "requireSessionUser",
    ()=>requireSessionUser
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$auth$2f$types$2f$guards$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/auth/types/guards.ts [app-route] (ecmascript)");
;
;
async function getSessionUser() {
    const jar = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
    const sessionCookie = jar.get("session");
    if (!sessionCookie || !(0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$auth$2f$types$2f$guards$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["hasSessionCookie"])(sessionCookie)) {
        return null;
    }
    // For now, use a simple approach - extract user ID from session cookie
    // In production, you'd validate the session token and get actual user data
    const sessionValue = sessionCookie.value;
    // Simple implementation: use session value as user ID for now
    // You can enhance this to decode JWT or lookup in database
    const user = {
        id: sessionValue || "anonymous"
    };
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$auth$2f$types$2f$guards$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["hasValidUser"])(user) ? user : null;
}
async function requireSessionUser() {
    const user = await getSessionUser();
    if (!user) {
        throw new Error("Authentication required");
    }
    return user;
}
}),
"[project]/apps/web/lib/workspace-api-handler.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "handleWorkspaceApi",
    ()=>handleWorkspaceApi
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:fs [external] (node:fs, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$auth$2f$lib$2f$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/auth/lib/auth.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/error-codes.ts [app-route] (ecmascript)");
;
;
;
;
// Workspace base directory (from env or default)
const WORKSPACE_BASE = process.env.WORKSPACE_BASE ?? "/srv/webalive/sites";
/**
 * Validates workspace containment to prevent path traversal attacks
 * Uses realpathSync to resolve symlinks before checking containment
 */ function validateWorkspaceContainment(workspaceRoot, requestId) {
    try {
        // Resolve any symlinks to get real paths
        const realWorkspaceRoot = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["realpathSync"])(workspaceRoot);
        const realBaseRoot = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["realpathSync"])(WORKSPACE_BASE);
        // Ensure workspace is within the base directory
        if (!realWorkspaceRoot.startsWith(realBaseRoot + "/")) {
            console.error(`[workspace-api ${requestId}] Path traversal attempt: ${workspaceRoot} -> ${realWorkspaceRoot} not in ${realBaseRoot}`);
            return false;
        }
        console.log(`[workspace-api ${requestId}] Workspace validated: ${realWorkspaceRoot}`);
        return true;
    } catch (error) {
        console.error(`[workspace-api ${requestId}] Workspace validation failed:`, error);
        return false;
    }
}
async function handleWorkspaceApi(req, config) {
    const requestId = crypto.randomUUID();
    try {
        // Authentication
        const origin = req.headers.get("host");
        const isLocalhost = origin?.includes("localhost");
        if (!isLocalhost) {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$auth$2f$lib$2f$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["requireSessionUser"])();
        }
        // Parse and validate request body
        const body = await req.json();
        const parseResult = config.schema.safeParse(body);
        if (!parseResult.success) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].INVALID_REQUEST,
                message: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getErrorMessage"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].INVALID_REQUEST, {
                    field: parseResult.error.issues[0]?.path.join(".") || "unknown"
                }),
                requestId
            }, {
                status: 400
            });
        }
        // Validate workspace containment if workspaceRoot is present
        if (parseResult.data.workspaceRoot) {
            if (!validateWorkspaceContainment(parseResult.data.workspaceRoot, requestId)) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    ok: false,
                    error: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].WORKSPACE_NOT_FOUND,
                    message: "Invalid workspace path",
                    requestId
                }, {
                    status: 403
                });
            }
        }
        // Call the specific handler
        return await config.handler({
            data: parseResult.data,
            requestId
        });
    } catch (error) {
        // Handle authentication errors
        if (error instanceof Error && error.message.includes("Unauthorized")) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].UNAUTHORIZED,
                message: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getErrorMessage"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].UNAUTHORIZED),
                requestId
            }, {
                status: 401
            });
        }
        // Handle unexpected errors
        console.error(`[workspace-api ${requestId}] Unexpected error:`, error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            error: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].REQUEST_PROCESSING_FAILED,
            message: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getErrorMessage"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].REQUEST_PROCESSING_FAILED),
            details: {
                error: error instanceof Error ? error.message : "Unknown error"
            },
            requestId
        }, {
            status: 500
        });
    }
}
}),
"[project]/apps/web/app/api/install-package/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$child_process__$5b$external$5d$__$28$node$3a$child_process$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:child_process [external] (node:child_process, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:fs [external] (node:fs, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:path [external] (node:path, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__ = __turbopack_context__.i("[project]/node_modules/zod/v3/external.js [app-route] (ecmascript) <export * as z>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/error-codes.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$workspace$2d$api$2d$handler$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/workspace-api-handler.ts [app-route] (ecmascript)");
;
;
;
;
;
;
;
const InstallPackageSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
    workspaceRoot: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string(),
    packageName: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(1).max(214) // npm package name length limit
    .regex(/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/, "Invalid package name format. Must follow npm naming conventions."),
    version: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().regex(/^[\d.]+$|^\^[\d.]+$|^~[\d.]+$|^>=?[\d.]+$|^<=?[\d.]+$|^latest$|^next$/, "Invalid version format").optional(),
    dev: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].boolean().optional()
});
async function POST(req) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$workspace$2d$api$2d$handler$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["handleWorkspaceApi"])(req, {
        schema: InstallPackageSchema,
        handler: async ({ data, requestId })=>{
            const { workspaceRoot, packageName, version, dev = false } = data;
            // Verify package.json exists
            const packageJsonPath = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["join"])(workspaceRoot, "package.json");
            if (!(0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["existsSync"])(packageJsonPath)) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    ok: false,
                    error: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].INVALID_REQUEST,
                    message: "No package.json found in workspace",
                    requestId
                }, {
                    status: 400
                });
            }
            try {
                // Build package specifier with optional version
                const packageSpec = version ? `${packageName}@${version}` : packageName;
                const args = dev ? [
                    "add",
                    "-D",
                    packageSpec
                ] : [
                    "add",
                    packageSpec
                ];
                console.log(`[install-package ${requestId}] Running: bun ${args.join(" ")} in ${workspaceRoot}`);
                // Use spawnSync with args array to prevent shell injection
                const result = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$child_process__$5b$external$5d$__$28$node$3a$child_process$2c$__cjs$29$__["spawnSync"])("bun", args, {
                    cwd: workspaceRoot,
                    encoding: "utf-8",
                    timeout: 60000,
                    shell: false
                });
                if (result.error) {
                    throw result.error;
                }
                if (result.status !== 0) {
                    const stderr = result.stderr || "";
                    console.error(`[install-package ${requestId}] Command failed with status ${result.status}:`, stderr);
                    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                        ok: false,
                        success: false,
                        error: "INSTALL_FAILED",
                        message: `Failed to install ${packageSpec}`,
                        details: {
                            package: packageSpec,
                            exitCode: result.status,
                            stderr: stderr.trim(),
                            stdout: result.stdout?.trim() || ""
                        },
                        requestId
                    }, {
                        status: 500
                    });
                }
                const output = result.stdout || "";
                console.log(`[install-package ${requestId}] Success:`, output);
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    ok: true,
                    success: true,
                    message: `Successfully installed ${packageSpec}${dev ? " (dev dependency)" : ""}`,
                    output: output.trim(),
                    requestId
                });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`[install-package ${requestId}] Error:`, errorMessage);
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    ok: false,
                    success: false,
                    error: "INSTALL_FAILED",
                    message: `Failed to install ${packageName}${version ? `@${version}` : ""}`,
                    details: {
                        package: packageName,
                        version,
                        error: errorMessage
                    },
                    requestId
                }, {
                    status: 500
                });
            }
        }
    });
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__b8df575a._.js.map