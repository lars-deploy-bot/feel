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
"[externals]/bcrypt [external] (bcrypt, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("bcrypt", () => require("bcrypt"));

module.exports = mod;
}),
"[project]/apps/web/types/guards/api.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BodySchema",
    ()=>BodySchema,
    "LoginSchema",
    ()=>LoginSchema,
    "hashPassword",
    ()=>hashPassword,
    "isDomainPasswordValid",
    ()=>isDomainPasswordValid,
    "isParseResultError",
    ()=>isParseResultError,
    "isParseResultSuccess",
    ()=>isParseResultSuccess,
    "isToolAllowed",
    ()=>isToolAllowed,
    "isValidJSON",
    ()=>isValidJSON,
    "isValidLoginRequest",
    ()=>isValidLoginRequest,
    "isValidRequestBody",
    ()=>isValidRequestBody,
    "loadDomainPasswords",
    ()=>loadDomainPasswords,
    "saveDomainPasswords",
    ()=>saveDomainPasswords,
    "updateDomainPassword",
    ()=>updateDomainPassword,
    "validateLoginRequest",
    ()=>validateLoginRequest,
    "validateRequestBody",
    ()=>validateRequestBody,
    "verifyPassword",
    ()=>verifyPassword
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:fs [external] (node:fs, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:path [external] (node:path, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$bcrypt__$5b$external$5d$__$28$bcrypt$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/bcrypt [external] (bcrypt, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__ = __turbopack_context__.i("[project]/node_modules/zod/v3/external.js [app-route] (ecmascript) <export * as z>");
;
;
;
;
const BodySchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
    message: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(1),
    workspace: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().optional(),
    conversationId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().uuid()
});
const LoginSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
    passcode: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().optional(),
    workspace: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().optional()
});
function isValidRequestBody(body) {
    const result = BodySchema.safeParse(body);
    return result.success;
}
function isValidLoginRequest(body) {
    const result = LoginSchema.safeParse(body);
    return result.success;
}
function validateRequestBody(body) {
    return BodySchema.safeParse(body);
}
function validateLoginRequest(body) {
    return LoginSchema.safeParse(body);
}
function isParseResultSuccess(result) {
    return result.success;
}
function isParseResultError(result) {
    return !result.success;
}
function isToolAllowed(toolName, allowedTools) {
    return allowedTools.has(toolName);
}
function isValidJSON(jsonString) {
    try {
        JSON.parse(jsonString);
        return true;
    } catch  {
        return false;
    }
}
const SALT_ROUNDS = 12;
async function hashPassword(plaintext) {
    return __TURBOPACK__imported__module__$5b$externals$5d2f$bcrypt__$5b$external$5d$__$28$bcrypt$2c$__cjs$29$__["default"].hash(plaintext, SALT_ROUNDS);
}
async function verifyPassword(plaintext, hash) {
    return __TURBOPACK__imported__module__$5b$externals$5d2f$bcrypt__$5b$external$5d$__$28$bcrypt$2c$__cjs$29$__["default"].compare(plaintext, hash);
}
function getDomainPasswordsPath() {
    // Check multiple possible locations for the domain-passwords.json file
    const possiblePaths = [
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["join"])(process.cwd(), "..", "..", "domain-passwords.json"),
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["join"])(process.cwd(), "domain-passwords.json"),
        "/root/webalive/claude-bridge/domain-passwords.json"
    ];
    for (const path of possiblePaths){
        if ((0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["existsSync"])(path)) {
            console.log("Found domain passwords at:", path);
            return path;
        }
    }
    console.log("Domain passwords file not found, checked:", possiblePaths);
    return possiblePaths[0] // Return default path for creation
    ;
}
function loadDomainPasswords() {
    try {
        const filePath = getDomainPasswordsPath();
        if ((0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["existsSync"])(filePath)) {
            return JSON.parse((0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["readFileSync"])(filePath, "utf8"));
        }
    } catch (error) {
        console.warn("Failed to read domain passwords file:", error);
    }
    return {};
}
function saveDomainPasswords(passwords) {
    try {
        const filePath = getDomainPasswordsPath();
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["writeFileSync"])(filePath, JSON.stringify(passwords, null, 2));
    } catch (error) {
        console.error("Failed to save domain passwords file:", error);
    }
}
async function isDomainPasswordValid(domain, providedPassword) {
    const passwords = loadDomainPasswords();
    const domainConfig = passwords[domain];
    if (!domainConfig?.passwordHash) {
        return false;
    }
    return verifyPassword(providedPassword, domainConfig.passwordHash);
}
async function updateDomainPassword(domain, newPlaintextPassword) {
    const passwords = loadDomainPasswords();
    if (passwords[domain]) {
        passwords[domain].passwordHash = await hashPassword(newPlaintextPassword);
        saveDomainPasswords(passwords);
    }
}
}),
"[project]/apps/web/app/api/login/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "OPTIONS",
    ()=>OPTIONS,
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$cors$2d$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/cors-utils.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/error-codes.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/utils.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$types$2f$guards$2f$api$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/types/guards/api.ts [app-route] (ecmascript)");
;
;
;
;
;
async function POST(req) {
    const requestId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["generateRequestId"])();
    const origin = req.headers.get("origin");
    const body = await req.json().catch(()=>({}));
    const result = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$types$2f$guards$2f$api$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["LoginSchema"].safeParse(body);
    if (!result.success) {
        const res = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            error: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].INVALID_REQUEST,
            message: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getErrorMessage"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].INVALID_REQUEST),
            details: {
                issues: result.error.issues
            },
            requestId
        }, {
            status: 400
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$cors$2d$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["addCorsHeaders"])(res, origin);
        return res;
    }
    const { passcode, workspace } = result.data;
    if (process.env.BRIDGE_ENV === "local" && workspace === "test" && passcode === "test") {
        const res = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: true
        });
        res.cookies.set("session", "test-user", {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            path: "/"
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$cors$2d$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["addCorsHeaders"])(res, origin);
        return res;
    }
    if (workspace === "manager") {
        if (passcode !== "wachtwoord") {
            const res = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].INVALID_CREDENTIALS,
                message: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getErrorMessage"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].INVALID_CREDENTIALS),
                requestId
            }, {
                status: 401
            });
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$cors$2d$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["addCorsHeaders"])(res, origin);
            return res;
        }
    } else if (workspace) {
        if (!passcode || !await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$types$2f$guards$2f$api$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isDomainPasswordValid"])(workspace, passcode)) {
            const res = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].INVALID_CREDENTIALS,
                message: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getErrorMessage"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].INVALID_CREDENTIALS),
                requestId
            }, {
                status: 401
            });
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$cors$2d$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["addCorsHeaders"])(res, origin);
            return res;
        }
    } else {
        const res = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            error: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].WORKSPACE_MISSING,
            message: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getErrorMessage"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ErrorCodes"].WORKSPACE_MISSING),
            requestId
        }, {
            status: 400
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$cors$2d$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["addCorsHeaders"])(res, origin);
        return res;
    }
    const res = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        ok: true
    });
    if (workspace === "manager") {
        res.cookies.set("manager_session", "1", {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            path: "/"
        });
    } else {
        res.cookies.set("session", "1", {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            path: "/"
        });
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$cors$2d$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["addCorsHeaders"])(res, origin);
    return res;
}
async function OPTIONS(req) {
    const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/");
    const res = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"](null, {
        status: 200
    });
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$cors$2d$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["addCorsHeaders"])(res, origin ?? null);
    return res;
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__54c87781._.js.map