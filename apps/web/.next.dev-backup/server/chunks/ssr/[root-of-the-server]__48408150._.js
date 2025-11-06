module.exports = [
"[externals]/next/dist/server/app-render/action-async-storage.external.js [external] (next/dist/server/app-render/action-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/action-async-storage.external.js", () => require("next/dist/server/app-render/action-async-storage.external.js"));

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
"[project]/apps/web/components/ui/SettingsDropdown.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SettingsDropdown",
    ()=>SettingsDropdown
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$moon$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Moon$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/moon.js [app-ssr] (ecmascript) <export default as Moon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sun$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Sun$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/sun.js [app-ssr] (ecmascript) <export default as Sun>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$themes$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next-themes/dist/index.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
function SettingsDropdown({ onNewChat }) {
    const [isOpen, setIsOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRouter"])();
    const { theme, setTheme } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$themes$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useTheme"])();
    const handleLogout = async ()=>{
        try {
            await fetch("/api/logout", {
                method: "POST",
                credentials: "include"
            });
            // Clear session storage
            sessionStorage.removeItem("workspace");
            // Redirect to login
            router.push("/");
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };
    const handleAction = (action)=>{
        setIsOpen(false);
        action();
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "relative",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                onClick: ()=>setIsOpen(!isOpen),
                className: "inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-black dark:text-white border border-black/20 dark:border-white/20 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors",
                type: "button",
                "aria-label": "Menu",
                children: "Menu"
            }, void 0, false, {
                fileName: "[project]/apps/web/components/ui/SettingsDropdown.tsx",
                lineNumber: 39,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: `absolute top-full right-0 mt-2 w-48 bg-white dark:bg-[#2a2a2a] border border-black/10 dark:border-white/10 shadow-lg transition-all duration-200 ease-out origin-top-right ${isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"}`,
                style: {
                    borderRadius: "2px"
                },
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "py-1",
                    children: [
                        onNewChat && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: ()=>handleAction(onNewChat),
                            className: "w-full px-4 py-2.5 text-left text-sm text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium",
                            type: "button",
                            children: "Start new chat"
                        }, void 0, false, {
                            fileName: "[project]/apps/web/components/ui/SettingsDropdown.tsx",
                            lineNumber: 59,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: ()=>handleAction(()=>setTheme(theme === "dark" ? "light" : "dark")),
                            className: "w-full px-4 py-2.5 text-left text-sm text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium flex items-center gap-2",
                            type: "button",
                            children: [
                                theme === "dark" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sun$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Sun$3e$__["Sun"], {
                                    size: 16
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/components/ui/SettingsDropdown.tsx",
                                    lineNumber: 72,
                                    columnNumber: 33
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$moon$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Moon$3e$__["Moon"], {
                                    size: 16
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/components/ui/SettingsDropdown.tsx",
                                    lineNumber: 72,
                                    columnNumber: 53
                                }, this),
                                theme === "dark" ? "Light mode" : "Dark mode"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/apps/web/components/ui/SettingsDropdown.tsx",
                            lineNumber: 67,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "border-t border-black/10 dark:border-white/10 my-1"
                        }, void 0, false, {
                            fileName: "[project]/apps/web/components/ui/SettingsDropdown.tsx",
                            lineNumber: 75,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: handleLogout,
                            className: "w-full px-4 py-2.5 text-left text-sm text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium",
                            type: "button",
                            children: "Logout"
                        }, void 0, false, {
                            fileName: "[project]/apps/web/components/ui/SettingsDropdown.tsx",
                            lineNumber: 76,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/apps/web/components/ui/SettingsDropdown.tsx",
                    lineNumber: 57,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/apps/web/components/ui/SettingsDropdown.tsx",
                lineNumber: 49,
                columnNumber: 7
            }, this),
            isOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                className: "fixed inset-0 z-[-1]",
                onClick: ()=>setIsOpen(false),
                "aria-label": "Close menu",
                onKeyDown: (e)=>{
                    if (e.key === "Escape") {
                        setIsOpen(false);
                    }
                }
            }, void 0, false, {
                fileName: "[project]/apps/web/components/ui/SettingsDropdown.tsx",
                lineNumber: 88,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/components/ui/SettingsDropdown.tsx",
        lineNumber: 38,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/ChatInput/ChatInputContext.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ChatInputProvider",
    ()=>ChatInputProvider,
    "useChatInput",
    ()=>useChatInput
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
const ChatInputContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createContext"])(null);
function useChatInput() {
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useContext"])(ChatInputContext);
    if (!context) {
        throw new Error("ChatInput compound components must be used within ChatInput.Root");
    }
    return context;
}
const ChatInputProvider = ChatInputContext.Provider;
}),
"[project]/apps/web/features/chat/components/ChatInput/components/AttachFileButton.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AttachFileButton",
    ()=>AttachFileButton
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$paperclip$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Paperclip$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/paperclip.js [app-ssr] (ecmascript) <export default as Paperclip>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/ChatInputContext.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
;
function AttachFileButton() {
    const { addAttachment, config } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatInput"])();
    const inputRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const handleFileSelect = (e)=>{
        const files = Array.from(e.target.files || []);
        for (const file of files){
            addAttachment(file);
        }
        // Reset input to allow selecting the same file again
        if (inputRef.current) {
            inputRef.current.value = "";
        }
    };
    if (!config.enableAttachments) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                ref: inputRef,
                type: "file",
                multiple: true,
                accept: config.allowedFileTypes?.join(",") || "image/*,.pdf,.txt,.md",
                onChange: handleFileSelect,
                className: "hidden",
                "aria-label": "Attach files"
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/AttachFileButton.tsx",
                lineNumber: 26,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: ()=>inputRef.current?.click(),
                className: "flex items-center justify-center w-8 h-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors group",
                "aria-label": "Attach file (images, PDFs, text)",
                title: "Attach file",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$paperclip$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Paperclip$3e$__["Paperclip"], {
                    className: "size-4 group-hover:scale-110 transition-transform"
                }, void 0, false, {
                    fileName: "[project]/apps/web/features/chat/components/ChatInput/components/AttachFileButton.tsx",
                    lineNumber: 42,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/AttachFileButton.tsx",
                lineNumber: 35,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true);
}
}),
"[project]/apps/web/features/chat/components/ChatInput/components/Attachments.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Attachments",
    ()=>Attachments
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/file-text.js [app-ssr] (ecmascript) <export default as FileText>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-ssr] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/image.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/ChatInputContext.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
;
function Attachments() {
    const { attachments, removeAttachment } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatInput"])();
    if (attachments.length === 0) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "px-3 pb-2 flex flex-wrap gap-2",
        children: attachments.map((attachment)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "relative group flex items-center gap-2 px-3 py-2 rounded-lg border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]",
                children: [
                    attachment.type === "image" && attachment.preview ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "w-12 h-12 relative rounded overflow-hidden",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                            src: attachment.preview,
                            alt: attachment.file.name,
                            fill: true,
                            className: "object-cover"
                        }, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/Attachments.tsx",
                            lineNumber: 22,
                            columnNumber: 15
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/Attachments.tsx",
                        lineNumber: 21,
                        columnNumber: 13
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "w-12 h-12 flex items-center justify-center rounded bg-black/5 dark:bg-white/5",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__["FileText"], {
                            className: "size-6 text-black/40 dark:text-white/40"
                        }, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/Attachments.tsx",
                            lineNumber: 26,
                            columnNumber: 15
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/Attachments.tsx",
                        lineNumber: 25,
                        columnNumber: 13
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-col min-w-0",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-xs font-medium text-black dark:text-white truncate max-w-[150px]",
                                children: attachment.file.name
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/Attachments.tsx",
                                lineNumber: 32,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-xs text-black/50 dark:text-white/50",
                                children: [
                                    (attachment.file.size / 1024).toFixed(1),
                                    " KB"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/Attachments.tsx",
                                lineNumber: 35,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/Attachments.tsx",
                        lineNumber: 31,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: ()=>removeAttachment(attachment.id),
                        className: "absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black dark:bg-white text-white dark:text-black opacity-0 group-hover:opacity-100 hover:scale-110 transition-all shadow-lg",
                        "aria-label": "Remove attachment",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                            className: "size-3",
                            strokeWidth: 3
                        }, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/Attachments.tsx",
                            lineNumber: 47,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/Attachments.tsx",
                        lineNumber: 41,
                        columnNumber: 11
                    }, this),
                    attachment.uploadProgress !== undefined && attachment.uploadProgress < 100 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute bottom-0 left-0 right-0 h-1 bg-black/10 dark:bg-white/10 rounded-b overflow-hidden",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 animate-pulse",
                            style: {
                                width: `${attachment.uploadProgress}%`
                            }
                        }, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/Attachments.tsx",
                            lineNumber: 53,
                            columnNumber: 15
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/Attachments.tsx",
                        lineNumber: 52,
                        columnNumber: 13
                    }, this),
                    attachment.error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute inset-0 flex items-center justify-center bg-red-500/10 rounded-lg",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "text-xs text-red-600 dark:text-red-400",
                            children: "Error"
                        }, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/Attachments.tsx",
                            lineNumber: 63,
                            columnNumber: 15
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/Attachments.tsx",
                        lineNumber: 62,
                        columnNumber: 13
                    }, this)
                ]
            }, attachment.id, true, {
                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/Attachments.tsx",
                lineNumber: 15,
                columnNumber: 9
            }, this))
    }, void 0, false, {
        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/Attachments.tsx",
        lineNumber: 13,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/ChatInput/components/CameraButton.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CameraButton",
    ()=>CameraButton
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$camera$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Camera$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/camera.js [app-ssr] (ecmascript) <export default as Camera>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/ChatInputContext.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
function CameraButton() {
    const { openCamera, config } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatInput"])();
    if (!config.enableCamera) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        type: "button",
        onClick: openCamera,
        className: "flex items-center justify-center w-8 h-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-black/60 dark:text-white/60 transition-colors",
        "aria-label": "Take photo",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$camera$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Camera$3e$__["Camera"], {
            className: "size-4"
        }, void 0, false, {
            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/CameraButton.tsx",
            lineNumber: 18,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/CameraButton.tsx",
        lineNumber: 12,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/ChatInput/components/CameraModal.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CameraModal",
    ()=>CameraModal
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$camera$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Camera$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/camera.js [app-ssr] (ecmascript) <export default as Camera>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-ssr] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/ChatInputContext.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
;
function CameraModal() {
    const { isCameraOpen, closeCamera, capturePhoto } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatInput"])();
    const videoRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const streamRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!isCameraOpen) return;
        async function startCamera() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: "user",
                        width: 1280,
                        height: 720
                    }
                });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                setError("Failed to access camera. Please check permissions.");
                console.error("Camera error:", err);
            }
        }
        startCamera();
        return ()=>{
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track)=>track.stop());
                streamRef.current = null;
            }
        };
    }, [
        isCameraOpen
    ]);
    const handleCapture = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        if (!videoRef.current) return;
        const canvas = document.createElement("canvas");
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(videoRef.current, 0, 0);
        canvas.toBlob((blob)=>{
            if (blob) {
                capturePhoto(blob);
            }
        }, "image/jpeg", 0.9);
    }, [
        capturePhoto
    ]);
    if (!isCameraOpen) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "relative bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full mx-4",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center justify-between p-4 border-b border-black/10 dark:border-white/10",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                            className: "text-lg font-medium text-black dark:text-white",
                            children: "Take Photo"
                        }, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/CameraModal.tsx",
                            lineNumber: 69,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: closeCamera,
                            className: "w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-black/60 dark:text-white/60 transition-colors",
                            "aria-label": "Close camera",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                className: "size-5"
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/CameraModal.tsx",
                                lineNumber: 76,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/CameraModal.tsx",
                            lineNumber: 70,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/apps/web/features/chat/components/ChatInput/components/CameraModal.tsx",
                    lineNumber: 68,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "relative aspect-video bg-black",
                    children: error ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute inset-0 flex items-center justify-center text-white text-sm",
                        children: error
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/CameraModal.tsx",
                        lineNumber: 83,
                        columnNumber: 13
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("video", {
                        ref: videoRef,
                        autoPlay: true,
                        playsInline: true,
                        muted: true,
                        className: "w-full h-full object-cover"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/CameraModal.tsx",
                        lineNumber: 85,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/apps/web/features/chat/components/ChatInput/components/CameraModal.tsx",
                    lineNumber: 81,
                    columnNumber: 9
                }, this),
                !error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center justify-center p-6",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: handleCapture,
                        className: "flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$camera$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Camera$3e$__["Camera"], {
                                className: "size-5"
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/CameraModal.tsx",
                                lineNumber: 97,
                                columnNumber: 15
                            }, this),
                            "Capture"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/CameraModal.tsx",
                        lineNumber: 92,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/apps/web/features/chat/components/ChatInput/components/CameraModal.tsx",
                    lineNumber: 91,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/CameraModal.tsx",
            lineNumber: 66,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/CameraModal.tsx",
        lineNumber: 65,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/ChatInput/components/ErrorMessage.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ErrorMessage",
    ()=>ErrorMessage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-alert.js [app-ssr] (ecmascript) <export default as AlertCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/ChatInputContext.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
function ErrorMessage() {
    const { error } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatInput"])();
    if (!error) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "mx-3 mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__["AlertCircle"], {
                className: "size-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0"
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/ErrorMessage.tsx",
                lineNumber: 13,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-sm text-red-700 dark:text-red-300 flex-1",
                children: error
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/ErrorMessage.tsx",
                lineNumber: 14,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/ErrorMessage.tsx",
        lineNumber: 12,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/ChatInput/components/InputArea.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "InputArea",
    ()=>InputArea
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/ChatInputContext.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
function InputArea({ placeholder, testId = "message-input" }) {
    const { message, setMessage, onSubmit, config } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatInput"])();
    const textareaRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    // Auto-resize textarea
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [
        message
    ]);
    const handleKeyDown = (e)=>{
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
        ref: textareaRef,
        value: message,
        onChange: (e)=>setMessage(e.target.value),
        onKeyDown: handleKeyDown,
        placeholder: placeholder || config.placeholder || "Tell me what to change...",
        className: "w-full resize-none border-0 bg-transparent text-base font-normal focus:outline-none p-3 pr-20 text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 transition-colors",
        style: {
            minHeight: config.minHeight || "80px",
            maxHeight: config.maxHeight || "200px",
            overflow: "auto"
        },
        "data-testid": testId,
        "aria-label": placeholder || config.placeholder || "Message input"
    }, void 0, false, {
        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/InputArea.tsx",
        lineNumber: 31,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/ChatInput/components/SendButton.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SendButton",
    ()=>SendButton
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$square$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Square$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/square.js [app-ssr] (ecmascript) <export default as Square>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/ChatInputContext.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
function SendButton() {
    const { busy, canSubmit, onSubmit, onStop, abortControllerRef } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatInput"])();
    if (busy && abortControllerRef.current) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
            type: "button",
            onClick: onStop,
            className: "absolute top-3 right-3 bottom-3 w-12 text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors focus:outline-none flex items-center justify-center",
            "data-testid": "stop-button",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$square$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Square$3e$__["Square"], {
                size: 14,
                fill: "currentColor"
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/SendButton.tsx",
                lineNumber: 17,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/SendButton.tsx",
            lineNumber: 11,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        type: "button",
        onClick: onSubmit,
        disabled: !canSubmit,
        className: "absolute top-3 right-3 bottom-3 w-12 text-lg font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 focus:outline-none flex items-center justify-center",
        "data-testid": "send-button",
        children: busy ? "•••" : "→"
    }, void 0, false, {
        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/SendButton.tsx",
        lineNumber: 23,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/ChatInput/components/Toolbar.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Toolbar",
    ()=>Toolbar
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
"use client";
;
function Toolbar({ children }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "absolute bottom-3 left-3 flex items-center gap-1",
        children: children
    }, void 0, false, {
        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/Toolbar.tsx",
        lineNumber: 10,
        columnNumber: 10
    }, this);
}
}),
"[project]/apps/web/features/chat/components/ChatInput/utils/file-validation.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createPreviewUrl",
    ()=>createPreviewUrl,
    "formatFileSize",
    ()=>formatFileSize,
    "getAttachmentType",
    ()=>getAttachmentType,
    "validateFile",
    ()=>validateFile
]);
const ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp"
];
const ALLOWED_DOCUMENT_TYPES = [
    "application/pdf",
    "text/plain",
    "text/markdown"
];
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
;
function validateFile(file, options = {}) {
    const maxSize = options.maxFileSize || DEFAULT_MAX_FILE_SIZE;
    const allowedTypes = options.allowedFileTypes || [
        ...ALLOWED_IMAGE_TYPES,
        ...ALLOWED_DOCUMENT_TYPES
    ];
    // Check file size
    if (file.size > maxSize) {
        return {
            valid: false,
            error: `File size exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`
        };
    }
    // Check file type
    if (!allowedTypes.includes(file.type)) {
        const fileExtension = file.name.split(".").pop()?.toUpperCase() || "Unknown";
        return {
            valid: false,
            error: `${fileExtension} files are not supported. Please upload images (JPG, PNG, GIF, WebP) or documents (PDF, TXT).`
        };
    }
    return {
        valid: true
    };
}
function getAttachmentType(file) {
    if (ALLOWED_IMAGE_TYPES.includes(file.type)) return "image";
    return "document";
}
function createPreviewUrl(file) {
    if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
        return URL.createObjectURL(file);
    }
    return undefined;
}
function formatFileSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = [
        "B",
        "KB",
        "MB",
        "GB"
    ];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}
}),
"[project]/apps/web/features/chat/components/ChatInput/hooks/useAttachments.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useAttachments",
    ()=>useAttachments
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$utils$2f$file$2d$validation$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/utils/file-validation.ts [app-ssr] (ecmascript)");
"use client";
;
;
function useAttachments(config) {
    const [attachments, setAttachments] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const addAttachment = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(async (file)=>{
        // Validate file
        const validation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$utils$2f$file$2d$validation$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["validateFile"])(file, {
            maxFileSize: config.maxFileSize,
            allowedFileTypes: config.allowedFileTypes
        });
        if (!validation.valid) {
            config.onMessage?.(validation.error || "Invalid file", "error");
            return;
        }
        // Check max attachments
        if (config.maxAttachments && attachments.length >= config.maxAttachments) {
            config.onMessage?.(`Maximum ${config.maxAttachments} attachments allowed`, "error");
            return;
        }
        // Create attachment
        const attachment = {
            id: crypto.randomUUID(),
            file,
            type: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$utils$2f$file$2d$validation$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getAttachmentType"])(file),
            preview: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$utils$2f$file$2d$validation$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createPreviewUrl"])(file),
            uploadProgress: 0
        };
        setAttachments((prev)=>[
                ...prev,
                attachment
            ]);
        // Simulate upload (replace with actual upload logic)
        if (config.onAttachmentUpload) {
            try {
                const _url = await config.onAttachmentUpload(file);
                setAttachments((prev)=>prev.map((a)=>a.id === attachment.id ? {
                            ...a,
                            uploadProgress: 100
                        } : a));
                config.onMessage?.(`Uploaded ${file.name}`, "success");
            } catch (error) {
                setAttachments((prev)=>prev.map((a)=>a.id === attachment.id ? {
                            ...a,
                            error: error instanceof Error ? error.message : "Upload failed"
                        } : a));
                config.onMessage?.(`Failed to upload ${file.name}`, "error");
            }
        } else {
            // No upload handler, mark as complete immediately
            setAttachments((prev)=>prev.map((a)=>a.id === attachment.id ? {
                        ...a,
                        uploadProgress: 100
                    } : a));
        }
    }, [
        attachments.length,
        config
    ]);
    const removeAttachment = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((id)=>{
        setAttachments((prev)=>{
            const attachment = prev.find((a)=>a.id === id);
            if (attachment?.preview) {
                URL.revokeObjectURL(attachment.preview);
            }
            return prev.filter((a)=>a.id !== id);
        });
    }, []);
    return {
        attachments,
        addAttachment,
        removeAttachment
    };
}
}),
"[project]/apps/web/features/chat/components/ChatInput/hooks/useImageCapture.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useImageCapture",
    ()=>useImageCapture
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
function useImageCapture(onCapture) {
    const [isCameraOpen, setIsCameraOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const openCamera = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        setIsCameraOpen(true);
    }, []);
    const closeCamera = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        setIsCameraOpen(false);
    }, []);
    const capturePhoto = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((blob)=>{
        onCapture(blob);
        closeCamera();
    }, [
        onCapture,
        closeCamera
    ]);
    return {
        isCameraOpen,
        openCamera,
        closeCamera,
        capturePhoto
    };
}
}),
"[project]/apps/web/features/chat/components/ChatInput/ChatInput.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ChatInput",
    ()=>ChatInput
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/ChatInputContext.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$AttachFileButton$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/components/AttachFileButton.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$Attachments$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/components/Attachments.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$CameraButton$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/components/CameraButton.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$CameraModal$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/components/CameraModal.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$ErrorMessage$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/components/ErrorMessage.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$InputArea$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/components/InputArea.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$SendButton$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/components/SendButton.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$Toolbar$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/components/Toolbar.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$hooks$2f$useAttachments$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/hooks/useAttachments.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$hooks$2f$useImageCapture$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/hooks/useImageCapture.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
;
;
;
;
;
;
;
;
function ChatInputRoot({ message, setMessage, busy, abortControllerRef, onSubmit, onStop, config: userConfig = {}, children }) {
    const [isDragging, setIsDragging] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])();
    // Merge with default config
    const config = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>({
            enableAttachments: true,
            enableCamera: false,
            maxAttachments: 10,
            maxFileSize: 10 * 1024 * 1024,
            placeholder: "Tell me what to change...",
            minHeight: "80px",
            maxHeight: "200px",
            onMessage: (msg, type)=>{
                if (type === "error") {
                    setError(msg);
                    setTimeout(()=>setError(undefined), 5000);
                }
            },
            ...userConfig
        }), [
        userConfig
    ]);
    // Hooks
    const { attachments, addAttachment, removeAttachment } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$hooks$2f$useAttachments$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAttachments"])(config);
    const handlePhotoCapture = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((blob)=>{
        const file = new File([
            blob
        ], `photo-${Date.now()}.jpg`, {
            type: "image/jpeg"
        });
        addAttachment(file);
    }, [
        addAttachment
    ]);
    const { isCameraOpen, openCamera, closeCamera, capturePhoto } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$hooks$2f$useImageCapture$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useImageCapture"])(handlePhotoCapture);
    // Validation
    const canSubmit = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        if (busy) return false;
        const hasMessage = message.trim().length > 0;
        const hasAttachments = attachments.length > 0;
        const attachmentsValid = attachments.every((a)=>!a.error && a.uploadProgress === 100);
        return (hasMessage || hasAttachments) && attachmentsValid;
    }, [
        busy,
        message,
        attachments
    ]);
    // Keyboard shortcuts
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const handleKeyDown = (e)=>{
            // Cmd/Ctrl + K to focus input
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                const textarea = document.querySelector('[data-testid="message-input"]');
                textarea?.focus();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return ()=>window.removeEventListener("keydown", handleKeyDown);
    }, []);
    // Context value
    const contextValue = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>({
            message,
            setMessage,
            attachments,
            addAttachment,
            removeAttachment,
            isCameraOpen,
            openCamera,
            closeCamera,
            capturePhoto,
            isDragging,
            setIsDragging,
            busy,
            abortControllerRef,
            canSubmit,
            error,
            onSubmit,
            onStop,
            config
        }), [
        message,
        setMessage,
        attachments,
        addAttachment,
        removeAttachment,
        isCameraOpen,
        openCamera,
        closeCamera,
        capturePhoto,
        isDragging,
        busy,
        abortControllerRef,
        canSubmit,
        error,
        onSubmit,
        onStop,
        config
    ]);
    // Drag & drop handlers
    const handleDragEnter = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((e)=>{
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);
    const handleDragLeave = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((e)=>{
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget === e.target) {
            setIsDragging(false);
        }
    }, []);
    const handleDragOver = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((e)=>{
        e.preventDefault();
        e.stopPropagation();
    }, []);
    const handleDrop = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((e)=>{
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        for (const file of files){
            addAttachment(file);
        }
    }, [
        addAttachment
    ]);
    // Paste handler for images
    const handlePaste = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((e)=>{
        const items = Array.from(e.clipboardData.items);
        for (const item of items){
            if (item.type.startsWith("image/")) {
                const file = item.getAsFile();
                if (file) {
                    addAttachment(file);
                }
            }
        }
    }, [
        addAttachment
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ChatInputProvider"], {
        value: contextValue,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
            className: "flex-shrink-0 p-4 safe-area-inset-bottom",
            "aria-label": "Chat input with file drop",
            onDragEnter: handleDragEnter,
            onDragLeave: handleDragLeave,
            onDragOver: handleDragOver,
            onDrop: handleDrop,
            onPaste: handlePaste,
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: `relative border ${isDragging ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" : "border-black/20 dark:border-white/20"} focus-within:border-black/40 dark:focus-within:border-white/40 transition-colors`,
                    children: [
                        isDragging && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-blue-500/10 backdrop-blur-sm rounded",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                        className: "w-8 h-8 text-blue-600 dark:text-blue-400",
                                        fill: "none",
                                        viewBox: "0 0 24 24",
                                        stroke: "currentColor",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                            strokeLinecap: "round",
                                            strokeLinejoin: "round",
                                            strokeWidth: 2,
                                            d: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInput.tsx",
                                            lineNumber: 207,
                                            columnNumber: 19
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInput.tsx",
                                        lineNumber: 201,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInput.tsx",
                                    lineNumber: 200,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-sm font-medium text-blue-600 dark:text-blue-400",
                                    children: "Drop files to attach"
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInput.tsx",
                                    lineNumber: 215,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-xs text-blue-500 dark:text-blue-500",
                                    children: "Images and documents supported"
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInput.tsx",
                                    lineNumber: 216,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInput.tsx",
                            lineNumber: 199,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$ErrorMessage$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ErrorMessage"], {}, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInput.tsx",
                            lineNumber: 221,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$Attachments$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Attachments"], {}, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInput.tsx",
                            lineNumber: 224,
                            columnNumber: 11
                        }, this),
                        children
                    ]
                }, void 0, true, {
                    fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInput.tsx",
                    lineNumber: 192,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$CameraModal$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CameraModal"], {}, void 0, false, {
                    fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInput.tsx",
                    lineNumber: 231,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInput.tsx",
            lineNumber: 183,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInput.tsx",
        lineNumber: 182,
        columnNumber: 5
    }, this);
}
const ChatInput = Object.assign(ChatInputRoot, {
    InputArea: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$InputArea$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["InputArea"],
    Toolbar: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$Toolbar$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Toolbar"],
    AttachFileButton: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$AttachFileButton$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["AttachFileButton"],
    CameraButton: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$CameraButton$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CameraButton"],
    Attachments: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$Attachments$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Attachments"],
    SendButton: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$SendButton$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SendButton"],
    ErrorMessage: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$ErrorMessage$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ErrorMessage"]
});
}),
"[project]/apps/web/features/chat/components/ChatInput/components/v2/AttachmentPills.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AttachmentPills",
    ()=>AttachmentPills
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-ssr] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/image.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/ChatInputContext.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
;
function AttachmentPills() {
    const { attachments, removeAttachment } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatInput"])();
    if (attachments.length === 0) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "-mx-2.5 -mt-2.5 mb-2.5 flex flex-col [grid-area:header]",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "w-full",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "no-scrollbar horizontal-scroll-fade-mask flex flex-nowrap gap-2 overflow-x-auto px-2.5 pt-2.5 pb-1.5 [--edge-fade-distance:1rem]",
                children: attachments.map((attachment)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "group text-token-text-primary relative inline-block text-sm",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "border-token-border-default bg-primary relative overflow-hidden border rounded-2xl",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "h-14.5 w-14.5",
                                    children: attachment.type === "image" && attachment.preview ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "relative w-full h-full bg-gray-500 dark:bg-gray-700",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                            src: attachment.preview,
                                            alt: attachment.file.name,
                                            fill: true,
                                            className: "object-cover"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/AttachmentPills.tsx",
                                            lineNumber: 27,
                                            columnNumber: 23
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/AttachmentPills.tsx",
                                        lineNumber: 26,
                                        columnNumber: 21
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center h-full w-full justify-center bg-gray-500 dark:bg-gray-700 text-white",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-xs font-medium",
                                            children: attachment.file.name.split(".").pop()?.toUpperCase()
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/AttachmentPills.tsx",
                                            lineNumber: 31,
                                            columnNumber: 23
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/AttachmentPills.tsx",
                                        lineNumber: 30,
                                        columnNumber: 21
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/AttachmentPills.tsx",
                                    lineNumber: 24,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/AttachmentPills.tsx",
                                lineNumber: 23,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "absolute end-1.5 top-1.5 inline-flex gap-1",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: ()=>removeAttachment(attachment.id),
                                    className: "transition-colors flex h-4 w-4 items-center justify-center rounded-full border-[rgba(0,0,0,0.1)] bg-black text-white dark:border-[rgba(255,255,255,0.1)] dark:bg-white dark:text-black hover:scale-110",
                                    "aria-label": "Remove file",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                        className: "size-3",
                                        strokeWidth: 3
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/AttachmentPills.tsx",
                                        lineNumber: 47,
                                        columnNumber: 19
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/AttachmentPills.tsx",
                                    lineNumber: 41,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/AttachmentPills.tsx",
                                lineNumber: 40,
                                columnNumber: 15
                            }, this),
                            attachment.uploadProgress !== undefined && attachment.uploadProgress < 100 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "absolute bottom-0 left-0 right-0 h-1 bg-black/10 dark:bg-white/10 rounded-b overflow-hidden",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300",
                                    style: {
                                        width: `${attachment.uploadProgress}%`
                                    }
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/AttachmentPills.tsx",
                                    lineNumber: 54,
                                    columnNumber: 19
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/AttachmentPills.tsx",
                                lineNumber: 53,
                                columnNumber: 17
                            }, this)
                        ]
                    }, attachment.id, true, {
                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/AttachmentPills.tsx",
                        lineNumber: 21,
                        columnNumber: 13
                    }, this))
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/AttachmentPills.tsx",
                lineNumber: 19,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/AttachmentPills.tsx",
            lineNumber: 18,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/AttachmentPills.tsx",
        lineNumber: 17,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/ChatInput/components/v2/ComposerGrid.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ComposerGrid",
    ()=>ComposerGrid
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
"use client";
;
function ComposerGrid({ children, isExpanded, isDragging }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "bg-token-bg-primary cursor-text overflow-clip bg-clip-padding p-2.5 contain-inline-size dark:bg-[#303030] grid grid-cols-[auto_1fr_auto] [grid-template-areas:'header_header_header'_'leading_primary_trailing'_'._footer_.'] group-data-[expanded]/composer:[grid-template-areas:'header_header_header'_'primary_primary_primary'_'leading_footer_trailing'] shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_2px_4px_rgba(0,0,0,0.3)] transition-shadow",
        style: {
            borderRadius: "28px"
        },
        "data-dragging": isDragging ? "" : undefined,
        children: [
            isDragging && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-blue-500/10 backdrop-blur-sm rounded-[28px]",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                            className: "w-8 h-8 text-blue-600 dark:text-blue-400",
                            fill: "none",
                            viewBox: "0 0 24 24",
                            stroke: "currentColor",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                strokeLinecap: "round",
                                strokeLinejoin: "round",
                                strokeWidth: 2,
                                d: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/ComposerGrid.tsx",
                                lineNumber: 44,
                                columnNumber: 15
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/ComposerGrid.tsx",
                            lineNumber: 38,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/ComposerGrid.tsx",
                        lineNumber: 37,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm font-medium text-blue-600 dark:text-blue-400",
                        children: "Drop files to attach"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/ComposerGrid.tsx",
                        lineNumber: 52,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-xs text-blue-500",
                        children: "Images and documents supported"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/ComposerGrid.tsx",
                        lineNumber: 53,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/ComposerGrid.tsx",
                lineNumber: 36,
                columnNumber: 9
            }, this),
            children
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/ComposerGrid.tsx",
        lineNumber: 27,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/ChatInput/components/v2/PlusMenu.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PlusMenu",
    ()=>PlusMenu
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dropdown$2d$menu$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@radix-ui/react-dropdown-menu/dist/index.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$camera$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Camera$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/camera.js [app-ssr] (ecmascript) <export default as Camera>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$paperclip$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Paperclip$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/paperclip.js [app-ssr] (ecmascript) <export default as Paperclip>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/plus.js [app-ssr] (ecmascript) <export default as Plus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/ChatInputContext.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
;
function PlusMenu({ fileInputRef }) {
    const { openCamera, config } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatInput"])();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "[grid-area:leading]",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            className: "flex",
            "data-state": "closed",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dropdown$2d$menu$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Root"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dropdown$2d$menu$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Trigger"], {
                        asChild: true,
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            className: "composer-btn flex items-center justify-center w-9 h-9 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white",
                            "data-testid": "composer-plus-btn",
                            "aria-label": "Add files and more",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                                className: "size-5",
                                strokeWidth: 2
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/PlusMenu.tsx",
                                lineNumber: 30,
                                columnNumber: 15
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/PlusMenu.tsx",
                            lineNumber: 24,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/PlusMenu.tsx",
                        lineNumber: 23,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dropdown$2d$menu$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Portal"], {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dropdown$2d$menu$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Content"], {
                            className: "min-w-[220px] bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-black/10 dark:border-white/10 p-1.5",
                            sideOffset: 8,
                            align: "start",
                            children: [
                                config.enableAttachments && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dropdown$2d$menu$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Item"], {
                                    className: "flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer outline-none text-sm text-black dark:text-white",
                                    onSelect: ()=>fileInputRef.current?.click(),
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$paperclip$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Paperclip$3e$__["Paperclip"], {
                                            className: "size-4"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/PlusMenu.tsx",
                                            lineNumber: 45,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Upload files"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/PlusMenu.tsx",
                                            lineNumber: 46,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/PlusMenu.tsx",
                                    lineNumber: 41,
                                    columnNumber: 17
                                }, this),
                                config.enableCamera && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dropdown$2d$menu$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Item"], {
                                    className: "flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer outline-none text-sm text-black dark:text-white",
                                    onSelect: openCamera,
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$camera$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Camera$3e$__["Camera"], {
                                            className: "size-4"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/PlusMenu.tsx",
                                            lineNumber: 55,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Take photo"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/PlusMenu.tsx",
                                            lineNumber: 56,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/PlusMenu.tsx",
                                    lineNumber: 51,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/PlusMenu.tsx",
                            lineNumber: 35,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/PlusMenu.tsx",
                        lineNumber: 34,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/PlusMenu.tsx",
                lineNumber: 22,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/PlusMenu.tsx",
            lineNumber: 21,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/PlusMenu.tsx",
        lineNumber: 20,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/ChatInput/components/v2/PrimaryInput.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PrimaryInput",
    ()=>PrimaryInput
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/ChatInputContext.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
function PrimaryInput() {
    const { message, setMessage, onSubmit, config } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatInput"])();
    const textareaRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    // Auto-resize
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            const newHeight = Math.min(textareaRef.current.scrollHeight, 240) // max 240px
            ;
            textareaRef.current.style.height = `${newHeight}px`;
        }
    }, [
        message
    ]);
    const handleKeyDown = (e)=>{
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "-my-2.5 flex min-h-14 items-center overflow-x-hidden px-1.5 [grid-area:primary] group-data-[expanded]/composer:mb-0 group-data-[expanded]/composer:px-2.5",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "_prosemirror-parent text-token-text-primary max-h-[max(30svh,5rem)] max-h-52 flex-1 overflow-auto [scrollbar-width:thin] vertical-scroll-fade-mask",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                ref: textareaRef,
                value: message,
                onChange: (e)=>setMessage(e.target.value),
                onKeyDown: handleKeyDown,
                placeholder: config.placeholder || "Ask anything",
                className: "w-full resize-none border-0 bg-transparent text-base font-normal focus:outline-none text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40",
                style: {
                    minHeight: config.minHeight || "56px",
                    maxHeight: config.maxHeight || "30svh"
                },
                "data-prompt-input": "true",
                "data-virtualkeyboard": "true",
                "aria-label": config.placeholder || "Message input"
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/PrimaryInput.tsx",
                lineNumber: 33,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/PrimaryInput.tsx",
            lineNumber: 32,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/PrimaryInput.tsx",
        lineNumber: 31,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/ChatInput/components/v2/SubmitButton.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SubmitButton",
    ()=>SubmitButton
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$up$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowUp$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/arrow-up.js [app-ssr] (ecmascript) <export default as ArrowUp>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$square$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Square$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/square.js [app-ssr] (ecmascript) <export default as Square>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/ChatInputContext.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
function SubmitButton() {
    const { busy, canSubmit, onSubmit, onStop, abortControllerRef } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatInput"])();
    if (busy && abortControllerRef.current) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
            type: "button",
            onClick: onStop,
            className: "composer-submit-btn flex h-9 w-9 items-center justify-center rounded-full bg-black dark:bg-white text-white dark:text-black hover:opacity-80 transition-opacity",
            "data-testid": "stop-button",
            "aria-label": "Stop generating",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$square$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Square$3e$__["Square"], {
                size: 18,
                fill: "currentColor"
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/SubmitButton.tsx",
                lineNumber: 22,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/SubmitButton.tsx",
            lineNumber: 15,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        type: "submit",
        onClick: (e)=>{
            e.preventDefault();
            if (canSubmit) onSubmit();
        },
        disabled: !canSubmit,
        className: "composer-submit-btn flex h-9 w-9 items-center justify-center rounded-full bg-black dark:bg-white text-white dark:text-black hover:opacity-80 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed",
        "data-testid": "send-button",
        "aria-label": "Send message",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$up$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowUp$3e$__["ArrowUp"], {
            size: 20,
            strokeWidth: 2.5
        }, void 0, false, {
            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/SubmitButton.tsx",
            lineNumber: 39,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/SubmitButton.tsx",
        lineNumber: 28,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/ChatInput/components/v2/TrailingActions.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "TrailingActions",
    ()=>TrailingActions
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mic$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Mic$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/mic.js [app-ssr] (ecmascript) <export default as Mic>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/ChatInputContext.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$v2$2f$SubmitButton$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/components/v2/SubmitButton.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
;
function TrailingActions() {
    const { busy, onStop, abortControllerRef } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatInput"])();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-testid": "composer-trailing-actions",
        className: "flex items-center gap-1.5 [grid-area:trailing]",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex items-center gap-1.5",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    "data-state": "closed",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        "aria-label": "Voice input",
                        className: "composer-btn flex items-center justify-center w-9 h-9 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mic$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Mic$3e$__["Mic"], {
                            className: "size-5"
                        }, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/TrailingActions.tsx",
                            lineNumber: 24,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/TrailingActions.tsx",
                        lineNumber: 19,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/TrailingActions.tsx",
                    lineNumber: 18,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$v2$2f$SubmitButton$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SubmitButton"], {}, void 0, false, {
                    fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/TrailingActions.tsx",
                    lineNumber: 29,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/TrailingActions.tsx",
            lineNumber: 16,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v2/TrailingActions.tsx",
        lineNumber: 15,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/ChatInput/ChatInputV2.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ChatInputV2",
    ()=>ChatInputV2
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/ChatInputContext.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$CameraModal$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/components/CameraModal.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$v2$2f$AttachmentPills$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/components/v2/AttachmentPills.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$v2$2f$ComposerGrid$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/components/v2/ComposerGrid.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$v2$2f$PlusMenu$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/components/v2/PlusMenu.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$v2$2f$PrimaryInput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/components/v2/PrimaryInput.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$v2$2f$TrailingActions$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/components/v2/TrailingActions.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$hooks$2f$useAttachments$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/hooks/useAttachments.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$hooks$2f$useImageCapture$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/hooks/useImageCapture.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
;
;
;
;
;
;
function ChatInputV2({ message, setMessage, busy, abortControllerRef, onSubmit, onStop, config: userConfig = {} }) {
    const [isDragging, setIsDragging] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])();
    const [isExpanded, setIsExpanded] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const fileInputRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    // Merge config
    const config = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>({
            enableAttachments: true,
            enableCamera: false,
            maxAttachments: 10,
            maxFileSize: 10 * 1024 * 1024,
            placeholder: "Ask anything",
            minHeight: "56px",
            maxHeight: "30svh",
            onMessage: (msg, type)=>{
                if (type === "error") {
                    setError(msg);
                    setTimeout(()=>setError(undefined), 5000);
                }
            },
            ...userConfig
        }), [
        userConfig
    ]);
    // Hooks
    const { attachments, addAttachment, removeAttachment } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$hooks$2f$useAttachments$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAttachments"])(config);
    const handlePhotoCapture = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((blob)=>{
        const file = new File([
            blob
        ], `photo-${Date.now()}.jpg`, {
            type: "image/jpeg"
        });
        addAttachment(file);
    }, [
        addAttachment
    ]);
    const { isCameraOpen, openCamera, closeCamera, capturePhoto } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$hooks$2f$useImageCapture$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useImageCapture"])(handlePhotoCapture);
    // Validation
    const canSubmit = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        if (busy) return false;
        const hasMessage = message.trim().length > 0;
        const hasAttachments = attachments.length > 0;
        const attachmentsValid = attachments.every((a)=>!a.error && a.uploadProgress === 100);
        return (hasMessage || hasAttachments) && attachmentsValid;
    }, [
        busy,
        message,
        attachments
    ]);
    // Auto-expand when attachments added
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (attachments.length > 0) {
            setIsExpanded(true);
        }
    }, [
        attachments.length
    ]);
    // Keyboard shortcuts
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const handleKeyDown = (e)=>{
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                const textarea = document.querySelector('[data-prompt-input="true"]');
                textarea?.focus();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return ()=>window.removeEventListener("keydown", handleKeyDown);
    }, []);
    // Context value
    const contextValue = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>({
            message,
            setMessage,
            attachments,
            addAttachment,
            removeAttachment,
            isCameraOpen,
            openCamera,
            closeCamera,
            capturePhoto,
            isDragging,
            setIsDragging,
            busy,
            abortControllerRef,
            canSubmit,
            error,
            onSubmit,
            onStop,
            config
        }), [
        message,
        setMessage,
        attachments,
        addAttachment,
        removeAttachment,
        isCameraOpen,
        openCamera,
        closeCamera,
        capturePhoto,
        isDragging,
        busy,
        abortControllerRef,
        canSubmit,
        error,
        onSubmit,
        onStop,
        config
    ]);
    // Drag & drop handlers
    const handleDragEnter = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((e)=>{
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);
    const handleDragLeave = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((e)=>{
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget === e.target) {
            setIsDragging(false);
        }
    }, []);
    const handleDragOver = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((e)=>{
        e.preventDefault();
        e.stopPropagation();
    }, []);
    const handleDrop = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((e)=>{
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        for (const file of files){
            addAttachment(file);
        }
    }, [
        addAttachment
    ]);
    const handlePaste = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((e)=>{
        const items = Array.from(e.clipboardData.items);
        for (const item of items){
            if (item.type.startsWith("image/")) {
                const file = item.getAsFile();
                if (file) {
                    addAttachment(file);
                }
            }
        }
    }, [
        addAttachment
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ChatInputProvider"], {
        value: contextValue,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                ref: fileInputRef,
                type: "file",
                multiple: true,
                accept: config.allowedFileTypes?.join(",") || "image/*,.pdf,.txt,.md",
                onChange: (e)=>{
                    const files = Array.from(e.target.files || []);
                    for (const file of files){
                        addAttachment(file);
                    }
                    if (fileInputRef.current) fileInputRef.current.value = "";
                },
                className: "sr-only",
                tabIndex: -1,
                "aria-hidden": "true",
                id: "composer-file-upload"
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInputV2.tsx",
                lineNumber: 198,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                className: "group/composer w-full",
                "data-expanded": isExpanded ? "" : undefined,
                "data-dragging": isDragging ? "" : undefined,
                onSubmit: (e)=>{
                    e.preventDefault();
                    if (canSubmit) onSubmit();
                },
                onDragEnter: handleDragEnter,
                onDragLeave: handleDragLeave,
                onDragOver: handleDragOver,
                onDrop: handleDrop,
                onPaste: handlePaste,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$v2$2f$ComposerGrid$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ComposerGrid"], {
                    isExpanded: isExpanded,
                    isDragging: isDragging,
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$v2$2f$AttachmentPills$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["AttachmentPills"], {}, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInputV2.tsx",
                            lineNumber: 233,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$v2$2f$PlusMenu$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["PlusMenu"], {
                            fileInputRef: fileInputRef
                        }, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInputV2.tsx",
                            lineNumber: 236,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$v2$2f$PrimaryInput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["PrimaryInput"], {}, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInputV2.tsx",
                            lineNumber: 239,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$v2$2f$TrailingActions$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TrailingActions"], {}, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInputV2.tsx",
                            lineNumber: 242,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "[grid-area:footer] flex items-center gap-1.5 px-2.5 pb-1.5"
                        }, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInputV2.tsx",
                            lineNumber: 245,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInputV2.tsx",
                    lineNumber: 231,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInputV2.tsx",
                lineNumber: 217,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$CameraModal$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CameraModal"], {}, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInputV2.tsx",
                lineNumber: 252,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInputV2.tsx",
        lineNumber: 196,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/ChatInput/components/v3/AttachmentsGrid.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AttachmentsGrid",
    ()=>AttachmentsGrid
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/file-text.js [app-ssr] (ecmascript) <export default as FileText>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-ssr] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/image.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/ChatInputContext.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
;
function AttachmentsGrid() {
    const { attachments, removeAttachment } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatInput"])();
    if (attachments.length === 0) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "px-3 pb-2 pt-3 flex flex-wrap gap-2",
        children: attachments.map((attachment)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "relative group flex items-center gap-2 px-3 py-2 rounded-lg border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]",
                children: [
                    attachment.type === "image" && attachment.preview ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "w-12 h-12 relative rounded overflow-hidden",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                            src: attachment.preview,
                            alt: attachment.file.name,
                            fill: true,
                            className: "object-cover"
                        }, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/AttachmentsGrid.tsx",
                            lineNumber: 24,
                            columnNumber: 15
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/AttachmentsGrid.tsx",
                        lineNumber: 23,
                        columnNumber: 13
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "w-12 h-12 flex items-center justify-center rounded bg-black/5 dark:bg-white/5",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__["FileText"], {
                            className: "size-6 text-black/40 dark:text-white/40"
                        }, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/AttachmentsGrid.tsx",
                            lineNumber: 28,
                            columnNumber: 15
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/AttachmentsGrid.tsx",
                        lineNumber: 27,
                        columnNumber: 13
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-col min-w-0",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-xs font-medium text-black dark:text-white truncate max-w-[150px]",
                                children: attachment.file.name
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/AttachmentsGrid.tsx",
                                lineNumber: 33,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-xs text-black/50 dark:text-white/50",
                                children: [
                                    (attachment.file.size / 1024).toFixed(1),
                                    " KB"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/AttachmentsGrid.tsx",
                                lineNumber: 36,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/AttachmentsGrid.tsx",
                        lineNumber: 32,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: ()=>removeAttachment(attachment.id),
                        className: "absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black dark:bg-white text-white dark:text-black opacity-0 group-hover:opacity-100 hover:scale-110 transition-all shadow-lg",
                        "aria-label": "Remove",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                            className: "size-3",
                            strokeWidth: 3
                        }, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/AttachmentsGrid.tsx",
                            lineNumber: 47,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/AttachmentsGrid.tsx",
                        lineNumber: 41,
                        columnNumber: 11
                    }, this),
                    attachment.uploadProgress !== undefined && attachment.uploadProgress < 100 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute bottom-0 left-0 right-0 h-1 bg-black/10 dark:bg-white/10 rounded-b overflow-hidden",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300",
                            style: {
                                width: `${attachment.uploadProgress}%`
                            }
                        }, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/AttachmentsGrid.tsx",
                            lineNumber: 52,
                            columnNumber: 15
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/AttachmentsGrid.tsx",
                        lineNumber: 51,
                        columnNumber: 13
                    }, this)
                ]
            }, attachment.id, true, {
                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/AttachmentsGrid.tsx",
                lineNumber: 18,
                columnNumber: 9
            }, this))
    }, void 0, false, {
        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/AttachmentsGrid.tsx",
        lineNumber: 16,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/ChatInput/components/v3/ErrorToast.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ErrorToast",
    ()=>ErrorToast
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-alert.js [app-ssr] (ecmascript) <export default as AlertCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-ssr] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/ChatInputContext.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
;
function ErrorToast() {
    const { error } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatInput"])();
    const [isVisible, setIsVisible] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [currentError, setCurrentError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (error) {
            setCurrentError(error);
            setIsVisible(true);
        } else {
            // Fade out animation
            const timeout = setTimeout(()=>{
                setIsVisible(false);
                setTimeout(()=>setCurrentError(undefined), 300); // Wait for fade out
            }, 100);
            return ()=>clearTimeout(timeout);
        }
    }, [
        error
    ]);
    if (!currentError) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `absolute top-3 left-3 right-3 z-10 transition-all duration-300 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}`,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex items-start gap-3 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 shadow-lg",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__["AlertCircle"], {
                    className: "size-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0"
                }, void 0, false, {
                    fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/ErrorToast.tsx",
                    lineNumber: 38,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex-1 min-w-0",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-sm font-medium text-red-900 dark:text-red-100",
                            children: "Invalid file"
                        }, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/ErrorToast.tsx",
                            lineNumber: 40,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-sm text-red-700 dark:text-red-300 mt-0.5",
                            children: currentError
                        }, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/ErrorToast.tsx",
                            lineNumber: 41,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/ErrorToast.tsx",
                    lineNumber: 39,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    type: "button",
                    onClick: ()=>setIsVisible(false),
                    className: "flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-colors",
                    "aria-label": "Dismiss",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                        className: "size-4"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/ErrorToast.tsx",
                        lineNumber: 49,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/ErrorToast.tsx",
                    lineNumber: 43,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/ErrorToast.tsx",
            lineNumber: 37,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/ErrorToast.tsx",
        lineNumber: 32,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/ChatInput/components/v3/InputGrid.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "InputGrid",
    ()=>InputGrid
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
"use client";
;
function InputGrid({ children, isDragging }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "relative border border-black/20 dark:border-white/20 focus-within:border-black/40 dark:focus-within:border-white/40 transition-colors",
        "data-dragging": isDragging ? "" : undefined,
        children: [
            isDragging && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-blue-500/10 backdrop-blur-sm",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                            className: "w-8 h-8 text-blue-600 dark:text-blue-400",
                            fill: "none",
                            viewBox: "0 0 24 24",
                            stroke: "currentColor",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                strokeLinecap: "round",
                                strokeLinejoin: "round",
                                strokeWidth: 2,
                                d: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/InputGrid.tsx",
                                lineNumber: 25,
                                columnNumber: 15
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/InputGrid.tsx",
                            lineNumber: 24,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/InputGrid.tsx",
                        lineNumber: 23,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm font-medium text-blue-600 dark:text-blue-400",
                        children: "Drop files to attach"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/InputGrid.tsx",
                        lineNumber: 28,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-xs text-blue-500",
                        children: "Images and documents"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/InputGrid.tsx",
                        lineNumber: 29,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/InputGrid.tsx",
                lineNumber: 22,
                columnNumber: 9
            }, this),
            children
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/InputGrid.tsx",
        lineNumber: 16,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/ChatInput/components/v3/InputArea.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "InputArea",
    ()=>InputArea
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/ChatInputContext.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
function InputArea() {
    const { message, setMessage, onSubmit, config } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatInput"])();
    const textareaRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [
        message
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
        ref: textareaRef,
        value: message,
        onChange: (e)=>setMessage(e.target.value),
        onKeyDown: (e)=>{
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
            }
        },
        placeholder: config.placeholder,
        className: "w-full resize-none border-0 bg-transparent text-base font-normal focus:outline-none p-3 pr-20 text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40",
        style: {
            minHeight: config.minHeight,
            maxHeight: config.maxHeight
        },
        "data-testid": "message-input",
        "aria-label": "Message input"
    }, void 0, false, {
        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/InputArea.tsx",
        lineNumber: 18,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/ChatInput/components/v3/Toolbar.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Toolbar",
    ()=>Toolbar
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$camera$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Camera$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/camera.js [app-ssr] (ecmascript) <export default as Camera>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$paperclip$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Paperclip$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/paperclip.js [app-ssr] (ecmascript) <export default as Paperclip>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/ChatInputContext.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
;
function Toolbar({ fileInputRef }) {
    const { config, openCamera } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatInput"])();
    const [isMobile, setIsMobile] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const checkMobile = ()=>{
            setIsMobile(window.innerWidth < 768); // md breakpoint
        };
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return ()=>window.removeEventListener("resize", checkMobile);
    }, []);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "absolute bottom-3 left-3 flex items-center gap-1",
        children: [
            config.enableAttachments && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: ()=>fileInputRef.current?.click(),
                className: "hidden flex items-center justify-center w-8 h-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors",
                "aria-label": "Attach file",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$paperclip$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Paperclip$3e$__["Paperclip"], {
                    className: "size-4"
                }, void 0, false, {
                    fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/Toolbar.tsx",
                    lineNumber: 33,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/Toolbar.tsx",
                lineNumber: 27,
                columnNumber: 9
            }, this),
            config.enableCamera && isMobile && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: openCamera,
                className: "flex items-center justify-center w-8 h-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors",
                "aria-label": "Take photo",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$camera$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Camera$3e$__["Camera"], {
                    className: "size-4"
                }, void 0, false, {
                    fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/Toolbar.tsx",
                    lineNumber: 45,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/Toolbar.tsx",
                lineNumber: 39,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/Toolbar.tsx",
        lineNumber: 25,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/ChatInput/components/v3/SendButton.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SendButton",
    ()=>SendButton
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$square$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Square$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/square.js [app-ssr] (ecmascript) <export default as Square>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/ChatInputContext.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
function SendButton() {
    const { busy, canSubmit, onSubmit, onStop, abortControllerRef } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatInput"])();
    if (busy && abortControllerRef.current) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
            type: "button",
            onClick: onStop,
            className: "absolute top-3 right-3 bottom-3 w-12 text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors focus:outline-none flex items-center justify-center",
            "data-testid": "stop-button",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$square$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Square$3e$__["Square"], {
                size: 14,
                fill: "currentColor"
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/SendButton.tsx",
                lineNumber: 17,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/SendButton.tsx",
            lineNumber: 11,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        type: "button",
        onClick: onSubmit,
        disabled: !canSubmit,
        className: "absolute top-3 right-3 bottom-3 w-12 text-lg font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 focus:outline-none flex items-center justify-center",
        "data-testid": "send-button",
        children: busy ? "•••" : "→"
    }, void 0, false, {
        fileName: "[project]/apps/web/features/chat/components/ChatInput/components/v3/SendButton.tsx",
        lineNumber: 23,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/ChatInput/ChatInputV3.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ChatInputV3",
    ()=>ChatInputV3
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/ChatInputContext.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$CameraModal$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/components/CameraModal.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$hooks$2f$useAttachments$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/hooks/useAttachments.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$hooks$2f$useImageCapture$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/hooks/useImageCapture.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$v3$2f$AttachmentsGrid$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/components/v3/AttachmentsGrid.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$v3$2f$ErrorToast$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/components/v3/ErrorToast.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$v3$2f$InputGrid$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/components/v3/InputGrid.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$v3$2f$InputArea$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/components/v3/InputArea.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$v3$2f$Toolbar$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/components/v3/Toolbar.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$v3$2f$SendButton$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/components/v3/SendButton.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
;
;
;
;
;
;
;
function ChatInputV3({ message, setMessage, busy, abortControllerRef, onSubmit, onStop, config: userConfig = {} }) {
    const [isDragging, setIsDragging] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])();
    const fileInputRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const config = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>({
            enableAttachments: true,
            enableCamera: false,
            maxAttachments: 10,
            maxFileSize: 10 * 1024 * 1024,
            placeholder: "Tell me what to change...",
            minHeight: "80px",
            maxHeight: "200px",
            onMessage: (msg, type)=>{
                if (type === "error") {
                    setError(msg);
                    setTimeout(()=>setError(undefined), 5000);
                }
            },
            ...userConfig
        }), [
        userConfig
    ]);
    const { attachments, addAttachment, removeAttachment } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$hooks$2f$useAttachments$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAttachments"])(config);
    const handlePhotoCapture = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((blob)=>{
        const file = new File([
            blob
        ], `photo-${Date.now()}.jpg`, {
            type: "image/jpeg"
        });
        addAttachment(file);
    }, [
        addAttachment
    ]);
    const { isCameraOpen, openCamera, closeCamera, capturePhoto } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$hooks$2f$useImageCapture$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useImageCapture"])(handlePhotoCapture);
    const canSubmit = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        if (busy) return false;
        const hasMessage = message.trim().length > 0;
        const hasAttachments = attachments.length > 0;
        const attachmentsValid = attachments.every((a)=>!a.error && a.uploadProgress === 100);
        return (hasMessage || hasAttachments) && attachmentsValid;
    }, [
        busy,
        message,
        attachments
    ]);
    // Keyboard shortcuts
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const handleKeyDown = (e)=>{
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                document.querySelector('[data-testid="message-input"]')?.focus();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return ()=>window.removeEventListener("keydown", handleKeyDown);
    }, []);
    const contextValue = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>({
            message,
            setMessage,
            attachments,
            addAttachment,
            removeAttachment,
            isCameraOpen,
            openCamera,
            closeCamera,
            capturePhoto,
            isDragging,
            setIsDragging,
            busy,
            abortControllerRef,
            canSubmit,
            error,
            onSubmit,
            onStop,
            config
        }), [
        message,
        setMessage,
        attachments,
        addAttachment,
        removeAttachment,
        isCameraOpen,
        openCamera,
        closeCamera,
        capturePhoto,
        isDragging,
        busy,
        abortControllerRef,
        canSubmit,
        error,
        onSubmit,
        onStop,
        config
    ]);
    // Drag & drop
    const handleDragEnter = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((e)=>{
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);
    const handleDragLeave = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((e)=>{
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget === e.target) setIsDragging(false);
    }, []);
    const handleDragOver = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((e)=>{
        e.preventDefault();
        e.stopPropagation();
    }, []);
    const handleDrop = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((e)=>{
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        for (const file of files)addAttachment(file);
    }, [
        addAttachment
    ]);
    const handlePaste = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((e)=>{
        const items = Array.from(e.clipboardData.items);
        for (const item of items){
            if (item.type.startsWith("image/")) {
                const file = item.getAsFile();
                if (file) addAttachment(file);
            }
        }
    }, [
        addAttachment
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ChatInputProvider"], {
        value: contextValue,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                ref: fileInputRef,
                type: "file",
                multiple: true,
                accept: config.allowedFileTypes?.join(",") || "image/*,.pdf,.txt,.md",
                onChange: (e)=>{
                    const files = Array.from(e.target.files || []);
                    for (const file of files)addAttachment(file);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                },
                className: "sr-only",
                tabIndex: -1,
                "aria-hidden": "true"
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInputV3.tsx",
                lineNumber: 178,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "flex-shrink-0 p-4 safe-area-inset-bottom",
                "aria-label": "Chat input",
                "data-dragging": isDragging ? "" : undefined,
                onDragEnter: handleDragEnter,
                onDragLeave: handleDragLeave,
                onDragOver: handleDragOver,
                onDrop: handleDrop,
                onPaste: handlePaste,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$v3$2f$InputGrid$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["InputGrid"], {
                    isDragging: isDragging,
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$v3$2f$ErrorToast$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ErrorToast"], {}, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInputV3.tsx",
                            lineNumber: 205,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$v3$2f$AttachmentsGrid$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["AttachmentsGrid"], {}, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInputV3.tsx",
                            lineNumber: 208,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$v3$2f$InputArea$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["InputArea"], {}, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInputV3.tsx",
                            lineNumber: 211,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$v3$2f$Toolbar$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Toolbar"], {
                            fileInputRef: fileInputRef
                        }, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInputV3.tsx",
                            lineNumber: 214,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$v3$2f$SendButton$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SendButton"], {}, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInputV3.tsx",
                            lineNumber: 217,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInputV3.tsx",
                    lineNumber: 203,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInputV3.tsx",
                lineNumber: 193,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$components$2f$CameraModal$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CameraModal"], {}, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInputV3.tsx",
                lineNumber: 221,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/features/chat/components/ChatInput/ChatInputV3.tsx",
        lineNumber: 176,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/ChatInput/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/ChatInput.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputV2$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/ChatInputV2.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputV3$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/ChatInputV3.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/ChatInputContext.tsx [app-ssr] (ecmascript)");
;
;
;
;
}),
"[project]/apps/web/lib/utils.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "cn",
    ()=>cn,
    "generateRequestId",
    ()=>generateRequestId,
    "truncateDeep",
    ()=>truncateDeep
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/clsx/dist/clsx.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/tailwind-merge/dist/bundle-mjs.mjs [app-ssr] (ecmascript)");
;
;
function cn(...inputs) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["twMerge"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["clsx"])(inputs));
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
"[project]/apps/web/features/chat/lib/dev-terminal-context.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DevTerminalProvider",
    ()=>DevTerminalProvider,
    "useDevTerminal",
    ()=>useDevTerminal
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
;
const DevTerminalContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createContext"])(undefined);
function DevTerminalProvider({ children }) {
    const [events, setEvents] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const addEvent = (event)=>{
        setEvents((prev)=>[
                ...prev,
                event
            ]);
    };
    const clearEvents = ()=>{
        setEvents([]);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(DevTerminalContext.Provider, {
        value: {
            events,
            addEvent,
            clearEvents
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/apps/web/features/chat/lib/dev-terminal-context.tsx",
        lineNumber: 37,
        columnNumber: 10
    }, this);
}
function useDevTerminal() {
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useContext"])(DevTerminalContext);
    if (!context) {
        throw new Error("useDevTerminal must be used within DevTerminalProvider");
    }
    return context;
}
}),
"[project]/apps/web/features/chat/components/DevTerminal.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DevTerminal",
    ()=>DevTerminal
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/utils.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$dev$2d$terminal$2d$context$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/lib/dev-terminal-context.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
;
function DevTerminal() {
    const { events, clearEvents } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$dev$2d$terminal$2d$context$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useDevTerminal"])();
    const [isMinimized, setIsMinimized] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [width, setWidth] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(768) // 2x wider: 768px (was 384px/w-96)
    ;
    const [isResizing, setIsResizing] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [collapsedMessages, setCollapsedMessages] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(new Set());
    const [copiedIndex, setCopiedIndex] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const scrollRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    // Auto-scroll to bottom when new events arrive
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (scrollRef.current && !isMinimized) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [
        events,
        isMinimized
    ]);
    // Handle resize dragging
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!isResizing) return;
        const handleMouseMove = (e)=>{
            const newWidth = window.innerWidth - e.clientX;
            // Clamp between 200px and 80% of screen width
            const clampedWidth = Math.max(200, Math.min(newWidth, window.innerWidth * 0.8));
            setWidth(clampedWidth);
        };
        const handleMouseUp = ()=>{
            setIsResizing(false);
        };
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        return ()=>{
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [
        isResizing
    ]);
    // Toggle message collapse
    const toggleMessageCollapse = (index)=>{
        setCollapsedMessages((prev)=>{
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };
    // Copy message to clipboard
    const copyMessage = async (content, index)=>{
        try {
            await navigator.clipboard.writeText(content);
            setCopiedIndex(index);
            setTimeout(()=>setCopiedIndex(null), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };
    // Copy all messages as array
    const [copiedAll, setCopiedAll] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const copyAllMessages = async ()=>{
        try {
            const allMessages = events.filter((devEvent)=>devEvent.eventName !== "ping").map((devEvent)=>{
                try {
                    // Try to return the parsed event object
                    return devEvent.event;
                } catch  {
                    // If parsing fails, return the raw SSE as a string
                    return devEvent.rawSSE;
                }
            });
            // Truncate all string values to 200 chars max to prevent clipboard overflow
            const truncatedMessages = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["truncateDeep"])(allMessages, 200);
            await navigator.clipboard.writeText(JSON.stringify(truncatedMessages, null, 2));
            setCopiedAll(true);
            setTimeout(()=>setCopiedAll(false), 2000);
        } catch (err) {
            console.error("Failed to copy all messages:", err);
        }
    };
    // Get color class for event name
    const getEventColor = (eventName)=>{
        // Handle specific event types
        if (eventName === "outgoing_request") return "text-orange-400 font-semibold";
        if (eventName === "client_error") return "text-red-400 font-semibold";
        if (eventName === "bridge_error") return "text-red-400 font-semibold";
        if (eventName === "bridge_interrupt") return "text-yellow-400 font-semibold";
        if (eventName === "bridge_complete") return "text-green-400 font-semibold";
        if (eventName.startsWith("bridge_")) return "text-cyan-400 font-semibold";
        if (eventName === "done") return "text-yellow-500 font-semibold";
        // Default for unknown types: treat as error
        return "text-red-400 font-semibold";
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `relative bg-black text-green-400 font-mono text-xs flex flex-col border-l border-green-700/30 ${isMinimized ? "w-12" : "h-full"} ${isResizing ? "select-none" : ""}`,
        style: !isMinimized ? {
            width: `${width}px`
        } : undefined,
        children: [
            !isMinimized && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-green-500/50 transition-colors z-10",
                onMouseDown: ()=>setIsResizing(true)
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/DevTerminal.tsx",
                lineNumber: 121,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center justify-between px-3 py-2 border-b border-green-700/30 bg-black/90",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-green-500 font-semibold",
                        children: isMinimized ? "SSE" : "SSE Events (Dev)"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/DevTerminal.tsx",
                        lineNumber: 128,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2",
                        children: [
                            !isMinimized && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: copyAllMessages,
                                        className: "text-green-600 hover:text-green-400 transition-colors text-xs px-2 py-1 border border-green-700/30 rounded",
                                        title: "Copy all messages as JSON array",
                                        children: copiedAll ? "✓ copied all" : "copy all"
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/features/chat/components/DevTerminal.tsx",
                                        lineNumber: 132,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: clearEvents,
                                        className: "text-green-600 hover:text-green-400 transition-colors text-xs px-2 py-1 border border-green-700/30 rounded",
                                        children: "clear"
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/features/chat/components/DevTerminal.tsx",
                                        lineNumber: 140,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                onClick: ()=>setIsMinimized(!isMinimized),
                                className: "text-green-600 hover:text-green-400 transition-colors",
                                children: isMinimized ? "+" : "−"
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/components/DevTerminal.tsx",
                                lineNumber: 149,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/web/features/chat/components/DevTerminal.tsx",
                        lineNumber: 129,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/features/chat/components/DevTerminal.tsx",
                lineNumber: 127,
                columnNumber: 7
            }, this),
            !isMinimized && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                ref: scrollRef,
                className: "flex-1 overflow-y-auto p-3 space-y-3",
                children: events.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "text-green-700",
                    children: "No events yet..."
                }, void 0, false, {
                    fileName: "[project]/apps/web/features/chat/components/DevTerminal.tsx",
                    lineNumber: 163,
                    columnNumber: 13
                }, this) : events.filter((devEvent)=>devEvent.eventName !== "ping").map((devEvent, index)=>{
                    // Try to beautify the parsed data
                    let displayContent;
                    try {
                        displayContent = JSON.stringify(devEvent.event, null, 2);
                    } catch  {
                        // Parsing failed, fall back to raw SSE
                        displayContent = devEvent.rawSSE;
                    }
                    const isCollapsed = collapsedMessages.has(index);
                    const isCopied = copiedIndex === index;
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-1 pb-3 border-b border-green-900/30",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center justify-between gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: ()=>toggleMessageCollapse(index),
                                        className: "flex items-center gap-2 flex-1 text-left hover:opacity-80 transition-opacity",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-green-700",
                                                children: [
                                                    "[",
                                                    new Date(devEvent.event.timestamp).toLocaleTimeString(),
                                                    "]"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/apps/web/features/chat/components/DevTerminal.tsx",
                                                lineNumber: 192,
                                                columnNumber: 25
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: getEventColor(devEvent.eventName),
                                                children: devEvent.eventName
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/features/chat/components/DevTerminal.tsx",
                                                lineNumber: 195,
                                                columnNumber: 25
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-green-700 text-[10px]",
                                                children: isCollapsed ? "▶" : "▼"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/features/chat/components/DevTerminal.tsx",
                                                lineNumber: 196,
                                                columnNumber: 25
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/apps/web/features/chat/components/DevTerminal.tsx",
                                        lineNumber: 187,
                                        columnNumber: 23
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: ()=>copyMessage(displayContent, index),
                                        className: "text-green-600 hover:text-green-400 transition-colors text-[10px] px-2 py-0.5",
                                        title: "Copy to clipboard",
                                        children: isCopied ? "✓ copied" : "copy"
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/features/chat/components/DevTerminal.tsx",
                                        lineNumber: 199,
                                        columnNumber: 23
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/apps/web/features/chat/components/DevTerminal.tsx",
                                lineNumber: 186,
                                columnNumber: 21
                            }, this),
                            !isCollapsed && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("pre", {
                                className: "text-green-500 whitespace-pre-wrap break-all leading-relaxed text-[10px]",
                                children: displayContent
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/components/DevTerminal.tsx",
                                lineNumber: 211,
                                columnNumber: 23
                            }, this)
                        ]
                    }, `${devEvent.event.requestId}-${index}`, true, {
                        fileName: "[project]/apps/web/features/chat/components/DevTerminal.tsx",
                        lineNumber: 181,
                        columnNumber: 19
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/DevTerminal.tsx",
                lineNumber: 161,
                columnNumber: 9
            }, this),
            !isMinimized && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "px-3 py-2 border-t border-green-700/30 bg-black/90 text-green-700 text-[10px]",
                children: (()=>{
                    const visibleCount = events.filter((e)=>e.eventName !== "ping").length;
                    return `${visibleCount} event${visibleCount !== 1 ? "s" : ""} • ${visibleCount > 0 ? "live data" : "waiting..."}`;
                })()
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/DevTerminal.tsx",
                lineNumber: 224,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/features/chat/components/DevTerminal.tsx",
        lineNumber: 113,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/SubdomainInitializer.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SubdomainInitializer",
    ()=>SubdomainInitializer
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
;
function SubdomainInitializer({ onInitialize, onInitialized, isInitialized, isMounted }) {
    const searchParams = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useSearchParams"])();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!isMounted || isInitialized) return;
        const slug = searchParams.get("slug");
        const autoStart = searchParams.get("autoStart") === "true";
        if (!slug || !autoStart) return;
        const initializeSubdomain = async ()=>{
            try {
                const metadataResponse = await fetch(`/api/sites/metadata?slug=${encodeURIComponent(slug)}`);
                if (!metadataResponse.ok) {
                    console.error("Failed to fetch site metadata");
                    return;
                }
                const data = await metadataResponse.json();
                const metadata = data.metadata;
                // Pre-fill message with site ideas
                const initialMessage = `I want to build a website with these ideas:\n\n${metadata.siteIdeas}\n\nCan you help me get started?`;
                onInitialize(initialMessage, metadata.workspace || "");
                onInitialized();
            } catch (error) {
                console.error("Failed to initialize subdomain context:", error);
            }
        };
        initializeSubdomain();
    }, [
        searchParams,
        isMounted,
        isInitialized,
        onInitialize,
        onInitialized
    ]);
    return null;
}
}),
"[project]/apps/web/lib/dev-mode-context.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DevModeProvider",
    ()=>DevModeProvider,
    "useDebugVisible",
    ()=>useDebugVisible,
    "useDevMode",
    ()=>useDevMode
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
;
const DevModeContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createContext"])(undefined);
function DevModeProvider({ children }) {
    const [showDevContent, setShowDevContent] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(true);
    const toggleDevContent = ()=>{
        setShowDevContent((prev)=>!prev);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(DevModeContext.Provider, {
        value: {
            showDevContent,
            toggleDevContent
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/apps/web/lib/dev-mode-context.tsx",
        lineNumber: 18,
        columnNumber: 10
    }, this);
}
function useDevMode() {
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useContext"])(DevModeContext);
    if (!context) {
        throw new Error("useDevMode must be used within DevModeProvider");
    }
    return context;
}
function useDebugVisible() {
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useContext"])(DevModeContext);
    return ("TURBOPACK compile-time value", "development") === "development" && (context?.showDevContent ?? true);
}
}),
"[externals]/tty [external] (tty, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("tty", () => require("tty"));

module.exports = mod;
}),
"[externals]/util [external] (util, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("util", () => require("util"));

module.exports = mod;
}),
"[externals]/os [external] (os, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("os", () => require("os"));

module.exports = mod;
}),
"[externals]/node:path [external] (node:path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:path", () => require("node:path"));

module.exports = mod;
}),
"[externals]/node:path [external] (node:path, cjs) <export default as minpath>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "minpath",
    ()=>__TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"]
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:path [external] (node:path, cjs)");
}),
"[externals]/node:process [external] (node:process, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:process", () => require("node:process"));

module.exports = mod;
}),
"[externals]/node:process [external] (node:process, cjs) <export default as minproc>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "minproc",
    ()=>__TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$process__$5b$external$5d$__$28$node$3a$process$2c$__cjs$29$__["default"]
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$process__$5b$external$5d$__$28$node$3a$process$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:process [external] (node:process, cjs)");
}),
"[externals]/node:url [external] (node:url, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:url", () => require("node:url"));

module.exports = mod;
}),
"[externals]/node:url [external] (node:url, cjs) <export fileURLToPath as urlToPath>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "urlToPath",
    ()=>__TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$url__$5b$external$5d$__$28$node$3a$url$2c$__cjs$29$__["fileURLToPath"]
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$url__$5b$external$5d$__$28$node$3a$url$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:url [external] (node:url, cjs)");
}),
"[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MarkdownDisplay",
    ()=>MarkdownDisplay
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$markdown$2f$lib$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__Markdown__as__default$3e$__ = __turbopack_context__.i("[project]/node_modules/react-markdown/lib/index.js [app-ssr] (ecmascript) <export Markdown as default>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$remark$2d$gfm$2f$lib$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/remark-gfm/lib/index.js [app-ssr] (ecmascript)");
"use client";
;
;
;
const components = {
    // Code blocks - wrap in styled container
    pre: ({ children, node })=>{
        const codeElement = node?.children?.[0];
        let language = null;
        if (codeElement?.type === "element" && codeElement.tagName === "code") {
            const className = codeElement.properties?.className?.join(" ") || "";
            const match = /language-(\w+)/.exec(className);
            language = match?.[1] || null;
        }
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "my-3 rounded-md bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 overflow-hidden",
            children: [
                language && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "px-3 py-1 text-[10px] text-black/40 dark:text-white/40 border-b border-black/10 dark:border-white/10 font-mono",
                    children: language
                }, void 0, false, {
                    fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
                    lineNumber: 27,
                    columnNumber: 11
                }, ("TURBOPACK compile-time value", void 0)),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("pre", {
                    className: "p-3 overflow-x-auto",
                    children: children
                }, void 0, false, {
                    fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
                    lineNumber: 31,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0))
            ]
        }, void 0, true, {
            fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
            lineNumber: 25,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0));
    },
    // Code - inline vs block determined by 'inline' prop from react-markdown
    code: (props)=>{
        const { children, inline } = props;
        if (inline) {
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("code", {
                className: "px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-[13px] font-mono text-black/80 dark:text-white/80",
                children: children
            }, void 0, false, {
                fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
                lineNumber: 42,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0));
        }
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("code", {
            className: "text-[13px] font-mono text-black/80 dark:text-white/80 leading-relaxed",
            children: children
        }, void 0, false, {
            fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
            lineNumber: 48,
            columnNumber: 12
        }, ("TURBOPACK compile-time value", void 0));
    },
    // Headings
    h1: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
            className: "text-2xl font-semibold mb-2 mt-4",
            children: children
        }, void 0, false, {
            fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
            lineNumber: 52,
            columnNumber: 25
        }, ("TURBOPACK compile-time value", void 0)),
    h2: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
            className: "text-xl font-semibold mb-2 mt-4",
            children: children
        }, void 0, false, {
            fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
            lineNumber: 53,
            columnNumber: 25
        }, ("TURBOPACK compile-time value", void 0)),
    h3: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
            className: "text-lg font-semibold mb-2 mt-4",
            children: children
        }, void 0, false, {
            fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
            lineNumber: 54,
            columnNumber: 25
        }, ("TURBOPACK compile-time value", void 0)),
    h4: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
            className: "text-base font-semibold mb-2 mt-3",
            children: children
        }, void 0, false, {
            fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
            lineNumber: 55,
            columnNumber: 25
        }, ("TURBOPACK compile-time value", void 0)),
    h5: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h5", {
            className: "text-sm font-semibold mb-2 mt-3",
            children: children
        }, void 0, false, {
            fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
            lineNumber: 56,
            columnNumber: 25
        }, ("TURBOPACK compile-time value", void 0)),
    h6: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h6", {
            className: "text-xs font-semibold mb-2 mt-3",
            children: children
        }, void 0, false, {
            fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
            lineNumber: 57,
            columnNumber: 25
        }, ("TURBOPACK compile-time value", void 0)),
    // Lists
    ul: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
            className: "list-disc ml-6 my-2",
            children: children
        }, void 0, false, {
            fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
            lineNumber: 60,
            columnNumber: 25
        }, ("TURBOPACK compile-time value", void 0)),
    ol: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("ol", {
            className: "list-decimal ml-6 my-2",
            children: children
        }, void 0, false, {
            fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
            lineNumber: 61,
            columnNumber: 25
        }, ("TURBOPACK compile-time value", void 0)),
    li: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
            className: "mb-1",
            children: children
        }, void 0, false, {
            fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
            lineNumber: 62,
            columnNumber: 25
        }, ("TURBOPACK compile-time value", void 0)),
    // Blockquotes
    blockquote: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("blockquote", {
            className: "border-l-4 border-black/20 dark:border-white/20 pl-4 my-2 italic text-black/70 dark:text-white/70",
            children: children
        }, void 0, false, {
            fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
            lineNumber: 66,
            columnNumber: 5
        }, ("TURBOPACK compile-time value", void 0)),
    // Links
    a: ({ href, children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
            href: href,
            target: "_blank",
            rel: "noopener noreferrer",
            className: "text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline",
            children: children
        }, void 0, false, {
            fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
            lineNumber: 73,
            columnNumber: 5
        }, ("TURBOPACK compile-time value", void 0)),
    // Paragraphs - avoid wrapping block elements in <p>
    p: ({ children, node })=>{
        const hasBlockChild = node?.children?.some((child)=>child.type === "element" && [
                "pre",
                "div",
                "blockquote",
                "ul",
                "ol",
                "table"
            ].includes(child.tagName));
        if (hasBlockChild) {
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                children: children
            }, void 0, false);
        }
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
            className: "mb-3",
            children: children
        }, void 0, false, {
            fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
            lineNumber: 94,
            columnNumber: 12
        }, ("TURBOPACK compile-time value", void 0));
    },
    // Emphasis
    strong: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
            className: "font-semibold",
            children: children
        }, void 0, false, {
            fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
            lineNumber: 98,
            columnNumber: 29
        }, ("TURBOPACK compile-time value", void 0)),
    em: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("em", {
            className: "italic",
            children: children
        }, void 0, false, {
            fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
            lineNumber: 99,
            columnNumber: 25
        }, ("TURBOPACK compile-time value", void 0)),
    // Horizontal rule
    hr: ()=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("hr", {
            className: "my-4 border-black/10 dark:border-white/10"
        }, void 0, false, {
            fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
            lineNumber: 102,
            columnNumber: 13
        }, ("TURBOPACK compile-time value", void 0)),
    // Tables (from remark-gfm)
    table: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "overflow-x-auto my-3",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                className: "min-w-full border-collapse border border-black/10 dark:border-white/10",
                children: children
            }, void 0, false, {
                fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
                lineNumber: 107,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0))
        }, void 0, false, {
            fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
            lineNumber: 106,
            columnNumber: 5
        }, ("TURBOPACK compile-time value", void 0)),
    thead: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
            className: "bg-black/5 dark:bg-white/5",
            children: children
        }, void 0, false, {
            fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
            lineNumber: 110,
            columnNumber: 28
        }, ("TURBOPACK compile-time value", void 0)),
    tbody: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
            children: children
        }, void 0, false, {
            fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
            lineNumber: 111,
            columnNumber: 28
        }, ("TURBOPACK compile-time value", void 0)),
    tr: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
            className: "border-b border-black/10 dark:border-white/10",
            children: children
        }, void 0, false, {
            fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
            lineNumber: 112,
            columnNumber: 25
        }, ("TURBOPACK compile-time value", void 0)),
    th: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
            className: "px-3 py-2 text-left text-xs font-semibold border border-black/10 dark:border-white/10",
            children: children
        }, void 0, false, {
            fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
            lineNumber: 114,
            columnNumber: 5
        }, ("TURBOPACK compile-time value", void 0)),
    td: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
            className: "px-3 py-2 text-sm border border-black/10 dark:border-white/10",
            children: children
        }, void 0, false, {
            fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
            lineNumber: 118,
            columnNumber: 25
        }, ("TURBOPACK compile-time value", void 0))
};
function MarkdownDisplay({ content, className = "" }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `text-black dark:text-white font-medium leading-relaxed ${className}`,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$markdown$2f$lib$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__Markdown__as__default$3e$__["default"], {
            remarkPlugins: [
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$remark$2d$gfm$2f$lib$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"]
            ],
            components: components,
            children: content
        }, void 0, false, {
            fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
            lineNumber: 127,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx",
        lineNumber: 126,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/MessageErrorBoundary.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MessageErrorBoundary",
    ()=>MessageErrorBoundary
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
;
class MessageErrorBoundary extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"].Component {
    constructor(props){
        super(props);
        this.state = {
            hasError: false
        };
    }
    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            error
        };
    }
    componentDidCatch(error, errorInfo) {
        console.error("Message render error:", {
            messageId: this.props.messageId,
            error,
            errorInfo,
            componentStack: errorInfo.componentStack
        });
    // TODO: Send to error tracking service (Sentry)
    }
    render() {
        if (this.state.hasError) {
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "border border-red-200 bg-red-50/50 p-3 rounded my-2",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-start gap-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                            className: "w-4 h-4 text-red-500 flex-shrink-0 mt-0.5",
                            fill: "none",
                            viewBox: "0 0 24 24",
                            stroke: "currentColor",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                strokeLinecap: "round",
                                strokeLinejoin: "round",
                                strokeWidth: 2,
                                d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/components/MessageErrorBoundary.tsx",
                                lineNumber: 46,
                                columnNumber: 15
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/MessageErrorBoundary.tsx",
                            lineNumber: 40,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-sm flex-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-red-900 font-medium mb-1",
                                    children: "Failed to render message"
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/features/chat/components/MessageErrorBoundary.tsx",
                                    lineNumber: 55,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-red-700 text-xs",
                                    children: "This message contains data that couldn't be displayed. The conversation will continue normally."
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/features/chat/components/MessageErrorBoundary.tsx",
                                    lineNumber: 56,
                                    columnNumber: 15
                                }, this),
                                ("TURBOPACK compile-time value", "development") === "development" && this.state.error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("details", {
                                    className: "mt-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("summary", {
                                            className: "text-xs text-red-600 cursor-pointer hover:text-red-800",
                                            children: "Error details (development only)"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/features/chat/components/MessageErrorBoundary.tsx",
                                            lineNumber: 62,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("pre", {
                                            className: "mt-1 text-xs bg-red-100 p-2 rounded overflow-auto max-h-32",
                                            children: [
                                                this.state.error.message,
                                                "\n\n",
                                                this.state.error.stack
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/apps/web/features/chat/components/MessageErrorBoundary.tsx",
                                            lineNumber: 65,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/apps/web/features/chat/components/MessageErrorBoundary.tsx",
                                    lineNumber: 61,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/apps/web/features/chat/components/MessageErrorBoundary.tsx",
                            lineNumber: 54,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/apps/web/features/chat/components/MessageErrorBoundary.tsx",
                    lineNumber: 39,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/MessageErrorBoundary.tsx",
                lineNumber: 38,
                columnNumber: 9
            }, this);
        }
        return this.props.children;
    }
}
}),
"[project]/apps/web/lib/tool-icons.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getToolIcon",
    ()=>getToolIcon
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$code$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Code$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/code.js [app-ssr] (ecmascript) <export default as Code>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$pen$2d$line$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Edit3$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/pen-line.js [app-ssr] (ecmascript) <export default as Edit3>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/file-text.js [app-ssr] (ecmascript) <export default as FileText>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$folder$2d$open$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__FolderOpen$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/folder-open.js [app-ssr] (ecmascript) <export default as FolderOpen>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/search.js [app-ssr] (ecmascript) <export default as Search>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$terminal$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Terminal$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/terminal.js [app-ssr] (ecmascript) <export default as Terminal>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$workflow$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Workflow$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/workflow.js [app-ssr] (ecmascript) <export default as Workflow>");
;
function getToolIcon(toolName) {
    const name = toolName.toLowerCase();
    if (name === "read") return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__["FileText"];
    if (name === "write" || name === "edit") return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$pen$2d$line$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Edit3$3e$__["Edit3"];
    if (name === "grep") return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__["Search"];
    if (name === "glob") return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$folder$2d$open$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__FolderOpen$3e$__["FolderOpen"];
    if (name === "bash") return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$terminal$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Terminal$3e$__["Terminal"];
    if (name === "task") return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$workflow$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Workflow$3e$__["Workflow"];
    // Fallback patterns for variations
    if (name.includes("read")) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__["FileText"];
    if (name.includes("write") || name.includes("edit")) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$pen$2d$line$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Edit3$3e$__["Edit3"];
    if (name.includes("grep") || name.includes("search")) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__["Search"];
    if (name.includes("glob") || name.includes("find")) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$folder$2d$open$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__FolderOpen$3e$__["FolderOpen"];
    if (name.includes("bash") || name.includes("task")) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$terminal$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Terminal$3e$__["Terminal"];
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$code$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Code$3e$__["Code"];
}
}),
"[project]/apps/web/lib/utils/markdown-utils.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Markdown detection and parsing utilities
 */ /**
 * Check if text contains markdown syntax
 */ __turbopack_context__.s([
    "extractCodeLanguage",
    ()=>extractCodeLanguage,
    "getMarkdownComplexity",
    ()=>getMarkdownComplexity,
    "hasCodeBlock",
    ()=>hasCodeBlock,
    "hasInlineCode",
    ()=>hasInlineCode,
    "hasMarkdown",
    ()=>hasMarkdown,
    "isPrimaryCodeBlock",
    ()=>isPrimaryCodeBlock
]);
const hasMarkdown = (text)=>{
    if (!text) return false;
    const patterns = [
        /^#{1,6}\s/m,
        /```[\s\S]*?```/,
        /`[^`]+`/,
        /\*\*[^*]+\*\*/,
        /__[^_]+__/,
        /\*[^*]+\*/,
        /_[^_]+_/,
        /^\s*[-*+]\s/m,
        /^\s*\d+\.\s/m,
        /\[.+?\]\(.+?\)/,
        /!\[.*?\]\(.+?\)/,
        /^>\s/m,
        /^\s*[-*_]{3,}\s*$/m,
        /~~[^~]+~~/
    ];
    return patterns.some((pattern)=>pattern.test(text));
};
const hasCodeBlock = (text)=>{
    return /```[\s\S]*?```/.test(text);
};
const isPrimaryCodeBlock = (text)=>{
    const codeBlockMatch = text.match(/```[\s\S]*?```/g);
    if (!codeBlockMatch) return false;
    const codeBlockLength = codeBlockMatch.join("").length;
    const totalLength = text.length;
    return codeBlockLength / totalLength > 0.7;
};
const extractCodeLanguage = (codeBlock)=>{
    const match = codeBlock.match(/```(\w+)/);
    return match ? match[1] : null;
};
const hasInlineCode = (text)=>{
    return /`[^`]+`/.test(text);
};
const getMarkdownComplexity = (text)=>{
    if (!hasMarkdown(text)) return "none";
    const complexPatterns = [
        /```[\s\S]*?```/,
        /^\s*[-*+]\s/m,
        /\[.+?\]\(.+?\)/,
        /!\[.*?\]\(.+?\)/,
        /^\|.*\|/m
    ];
    const hasComplexElements = complexPatterns.some((pattern)=>pattern.test(text));
    return hasComplexElements ? "complex" : "simple";
};
}),
"[project]/apps/web/types/guards/content.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isTextBlock",
    ()=>isTextBlock,
    "isToolUseBlock",
    ()=>isToolUseBlock
]);
function isTextBlock(item) {
    return typeof item === "object" && item !== null && item.type === "text";
}
function isToolUseBlock(item) {
    return typeof item === "object" && item !== null && item.type === "tool_use";
}
}),
"[project]/apps/web/features/chat/components/message-renderers/AssistantMessage.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AssistantMessage",
    ()=>AssistantMessage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$chat$2f$format$2f$MarkdownDisplay$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$dev$2d$mode$2d$context$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/dev-mode-context.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$tool$2d$icons$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/tool-icons.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$utils$2f$markdown$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/utils/markdown-utils.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$types$2f$guards$2f$content$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/types/guards/content.ts [app-ssr] (ecmascript)");
;
;
;
;
;
;
function AssistantMessage({ content }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "mb-6",
        children: content.message.content.map((item, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ToolUseItem, {
                item: item
            }, index, false, {
                fileName: "[project]/apps/web/features/chat/components/message-renderers/AssistantMessage.tsx",
                lineNumber: 17,
                columnNumber: 9
            }, this))
    }, void 0, false, {
        fileName: "[project]/apps/web/features/chat/components/message-renderers/AssistantMessage.tsx",
        lineNumber: 15,
        columnNumber: 5
    }, this);
}
function ToolUseItem({ item }) {
    const isDebugMode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$dev$2d$mode$2d$context$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useDebugVisible"])();
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$types$2f$guards$2f$content$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isTextBlock"])(item)) {
        const text = item.text;
        // Use MarkdownDisplay if the text contains markdown, otherwise render plain text
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$utils$2f$markdown$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["hasMarkdown"])(text)) {
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$chat$2f$format$2f$MarkdownDisplay$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MarkdownDisplay"], {
                content: text
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/message-renderers/AssistantMessage.tsx",
                lineNumber: 30,
                columnNumber: 14
            }, this);
        }
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "whitespace-pre-wrap text-black dark:text-white font-medium leading-relaxed",
            children: text
        }, void 0, false, {
            fileName: "[project]/apps/web/features/chat/components/message-renderers/AssistantMessage.tsx",
            lineNumber: 33,
            columnNumber: 12
        }, this);
    }
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$types$2f$guards$2f$content$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isToolUseBlock"])(item)) {
        const toolItem = item;
        const Icon = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$tool$2d$icons$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getToolIcon"])(toolItem.name);
        const getActionLabel = (toolName)=>{
            const friendlyLabel = (()=>{
                switch(toolName.toLowerCase()){
                    case "read":
                        return "reading";
                    case "edit":
                        return "editing";
                    case "write":
                        return "writing";
                    case "grep":
                        return "searching";
                    case "glob":
                        return "finding";
                    case "bash":
                        return "running";
                    case "task":
                        return "delegating";
                    default:
                        return toolName.toLowerCase();
                }
            })();
            // In debug mode, show both exact tool name and friendly label
            if (isDebugMode) {
                return `${toolName} (${friendlyLabel})`;
            }
            return friendlyLabel;
        };
        const getInlineDetail = (toolName, input)=>{
            const name = toolName.toLowerCase();
            if (name === "read" || name === "edit" || name === "write") {
                const filePath = input.file_path;
                if (filePath) {
                    const fileName = filePath.split("/").pop() || filePath;
                    return fileName;
                }
            }
            return null;
        };
        const inlineDetail = getInlineDetail(toolItem.name, toolItem.input);
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "my-1 text-xs font-normal text-black/35 dark:text-white/35 flex items-center gap-1.5",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Icon, {
                    size: 12,
                    className: "opacity-60"
                }, void 0, false, {
                    fileName: "[project]/apps/web/features/chat/components/message-renderers/AssistantMessage.tsx",
                    lineNumber: 86,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    children: getActionLabel(toolItem.name)
                }, void 0, false, {
                    fileName: "[project]/apps/web/features/chat/components/message-renderers/AssistantMessage.tsx",
                    lineNumber: 87,
                    columnNumber: 9
                }, this),
                inlineDetail && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "font-diatype-mono text-black/50 dark:text-white/50",
                    children: inlineDetail
                }, void 0, false, {
                    fileName: "[project]/apps/web/features/chat/components/message-renderers/AssistantMessage.tsx",
                    lineNumber: 88,
                    columnNumber: 26
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/apps/web/features/chat/components/message-renderers/AssistantMessage.tsx",
            lineNumber: 85,
            columnNumber: 7
        }, this);
    }
    // Unhandled content type
    const unhandledItem = item;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "text-xs text-red-600 dark:text-red-400",
        children: [
            "Unhandled content type: ",
            unhandledItem.type
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/features/chat/components/message-renderers/AssistantMessage.tsx",
        lineNumber: 95,
        columnNumber: 10
    }, this);
}
}),
"[project]/apps/web/features/chat/components/message-renderers/CompactBoundaryMessage.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CompactBoundaryMessage",
    ()=>CompactBoundaryMessage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$dev$2d$mode$2d$context$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/dev-mode-context.tsx [app-ssr] (ecmascript)");
;
;
function CompactBoundaryMessage({ data }) {
    const isDebugMode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$dev$2d$mode$2d$context$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useDebugVisible"])();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "py-3 mb-4 flex items-center justify-center",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex items-center gap-3 px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center gap-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                            className: "w-4 h-4 text-blue-600 dark:text-blue-400",
                            fill: "none",
                            stroke: "currentColor",
                            viewBox: "0 0 24 24",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                strokeLinecap: "round",
                                strokeLinejoin: "round",
                                strokeWidth: 2,
                                d: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/components/message-renderers/CompactBoundaryMessage.tsx",
                                lineNumber: 27,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/message-renderers/CompactBoundaryMessage.tsx",
                            lineNumber: 21,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-sm text-blue-800 dark:text-blue-200 font-medium",
                            children: "Context compacted"
                        }, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/message-renderers/CompactBoundaryMessage.tsx",
                            lineNumber: 34,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/apps/web/features/chat/components/message-renderers/CompactBoundaryMessage.tsx",
                    lineNumber: 20,
                    columnNumber: 9
                }, this),
                isDebugMode && data.compact_metadata && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "text-xs text-blue-600 dark:text-blue-400 font-mono",
                    children: [
                        data.compact_metadata.pre_tokens.toLocaleString(),
                        " tokens"
                    ]
                }, void 0, true, {
                    fileName: "[project]/apps/web/features/chat/components/message-renderers/CompactBoundaryMessage.tsx",
                    lineNumber: 37,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/apps/web/features/chat/components/message-renderers/CompactBoundaryMessage.tsx",
            lineNumber: 19,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/apps/web/features/chat/components/message-renderers/CompactBoundaryMessage.tsx",
        lineNumber: 18,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/message-renderers/CompleteMessage.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CompleteMessage",
    ()=>CompleteMessage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$dev$2d$mode$2d$context$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/dev-mode-context.tsx [app-ssr] (ecmascript)");
;
;
function CompleteMessage({ data }) {
    const isDebugMode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$dev$2d$mode$2d$context$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useDebugVisible"])();
    if (!isDebugMode) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "py-2 mb-4 text-center",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "text-sm font-medium text-black/60 dark:text-white/60 normal-case tracking-normal",
            children: [
                "Session complete",
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "ml-2 text-xs text-black/50 dark:text-white/50 font-normal",
                    children: [
                        data.totalMessages,
                        " messages • ",
                        (data.result.duration_ms / 1000).toFixed(1),
                        "s • $",
                        data.result.total_cost_usd.toFixed(4)
                    ]
                }, void 0, true, {
                    fileName: "[project]/apps/web/features/chat/components/message-renderers/CompleteMessage.tsx",
                    lineNumber: 22,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/apps/web/features/chat/components/message-renderers/CompleteMessage.tsx",
            lineNumber: 20,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/apps/web/features/chat/components/message-renderers/CompleteMessage.tsx",
        lineNumber: 19,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/lib/error-codes.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
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
"[project]/apps/web/features/chat/components/message-renderers/ErrorResultMessage.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ErrorResultMessage",
    ()=>ErrorResultMessage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/error-codes.ts [app-ssr] (ecmascript)");
;
;
function ErrorResultMessage({ content }) {
    const errorMessage = content.result;
    // Try to parse error as JSON (backend errors include structured info)
    let parsedError = null;
    try {
        parsedError = JSON.parse(errorMessage);
    } catch  {
    // Not JSON, use as plain string
    }
    const errorCode = parsedError?.error;
    const isWorkspace = errorCode ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isWorkspaceError"])(errorCode) : false;
    // Get friendly message based on error code
    const getFriendlyMessage = ()=>{
        if (errorCode && parsedError?.details) {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getErrorMessage"])(errorCode, parsedError.details);
        }
        if (parsedError?.message) {
            return parsedError.message;
        }
        // Better fallback messages for common HTTP errors
        if (errorMessage.includes("HTTP 401")) {
            return "Your session has expired. Please refresh the page and log in again.";
        }
        if (errorMessage.includes("HTTP 403")) {
            return "Access denied. Please check your permissions.";
        }
        if (errorMessage.includes("HTTP 500")) {
            return "Server error. Please try again in a moment.";
        }
        if (errorMessage.includes("HTTP 503")) {
            return "Service temporarily unavailable. Please try again in a moment.";
        }
        if (errorMessage.includes("Connection lost")) {
            return "Connection lost. Please check your internet connection and try again.";
        }
        if (errorMessage.includes("No response body")) {
            return "Server did not respond. Please try again.";
        }
        if (errorMessage.includes("closed connection without sending")) {
            return "Server closed the connection unexpectedly. Please try again.";
        }
        // Fallback for unparseable errors
        return errorMessage;
    };
    const getHelpText = ()=>{
        if (errorCode && parsedError?.details) {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getErrorHelp"])(errorCode, parsedError.details);
        }
        // Helpful context for common errors
        if (errorMessage.includes("HTTP 401") || errorMessage.includes("session has expired")) {
            return "You may need to refresh the page to restore your session.";
        }
        if (errorMessage.includes("Connection lost") || errorMessage.includes("closed connection")) {
            return "This can happen due to network issues or server maintenance. Your previous messages are safe.";
        }
        return null;
    };
    const details = parsedError?.details ?? null;
    const helpText = getHelpText();
    const friendlyMessage = getFriendlyMessage();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "py-3 mb-4",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "border border-red-200 bg-red-50/50 p-4 rounded",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-start gap-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex-shrink-0 mt-0.5",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                            className: "w-5 h-5 text-red-500",
                            fill: "none",
                            viewBox: "0 0 24 24",
                            stroke: "currentColor",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                strokeLinecap: "round",
                                strokeLinejoin: "round",
                                strokeWidth: 2,
                                d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/components/message-renderers/ErrorResultMessage.tsx",
                                lineNumber: 88,
                                columnNumber: 15
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/message-renderers/ErrorResultMessage.tsx",
                            lineNumber: 87,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/message-renderers/ErrorResultMessage.tsx",
                        lineNumber: 86,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                className: "text-sm font-medium text-red-900 mb-1",
                                children: isWorkspace ? "Workspace Error" : "Error"
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/components/message-renderers/ErrorResultMessage.tsx",
                                lineNumber: 97,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-sm text-red-700 leading-relaxed",
                                children: friendlyMessage
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/components/message-renderers/ErrorResultMessage.tsx",
                                lineNumber: 98,
                                columnNumber: 13
                            }, this),
                            helpText && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-xs text-red-600 mt-2 leading-relaxed",
                                children: helpText
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/components/message-renderers/ErrorResultMessage.tsx",
                                lineNumber: 100,
                                columnNumber: 26
                            }, this),
                            details && (details.expectedPath || details.fullPath) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "mt-3 p-2 bg-red-100/50 rounded text-xs font-mono text-red-800",
                                children: [
                                    details.expectedPath && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "font-semibold",
                                                children: "Expected:"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/features/chat/components/message-renderers/ErrorResultMessage.tsx",
                                                lineNumber: 106,
                                                columnNumber: 21
                                            }, this),
                                            " ",
                                            details.expectedPath
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/apps/web/features/chat/components/message-renderers/ErrorResultMessage.tsx",
                                        lineNumber: 105,
                                        columnNumber: 19
                                    }, this),
                                    details.fullPath && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "font-semibold",
                                                children: "Path:"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/features/chat/components/message-renderers/ErrorResultMessage.tsx",
                                                lineNumber: 111,
                                                columnNumber: 21
                                            }, this),
                                            " ",
                                            details.fullPath
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/apps/web/features/chat/components/message-renderers/ErrorResultMessage.tsx",
                                        lineNumber: 110,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/apps/web/features/chat/components/message-renderers/ErrorResultMessage.tsx",
                                lineNumber: 103,
                                columnNumber: 15
                            }, this),
                            errorCode && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "mt-2 text-xs text-red-500/70 font-mono",
                                children: [
                                    "Error code: ",
                                    errorCode
                                ]
                            }, void 0, true, {
                                fileName: "[project]/apps/web/features/chat/components/message-renderers/ErrorResultMessage.tsx",
                                lineNumber: 117,
                                columnNumber: 27
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/web/features/chat/components/message-renderers/ErrorResultMessage.tsx",
                        lineNumber: 96,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/features/chat/components/message-renderers/ErrorResultMessage.tsx",
                lineNumber: 85,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/apps/web/features/chat/components/message-renderers/ErrorResultMessage.tsx",
            lineNumber: 84,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/apps/web/features/chat/components/message-renderers/ErrorResultMessage.tsx",
        lineNumber: 83,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/message-renderers/InterruptMessage.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "InterruptMessage",
    ()=>InterruptMessage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
;
function InterruptMessage({ data }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "py-3 mb-4 flex items-center justify-center",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex items-center gap-3 px-4 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                        className: "w-4 h-4 text-amber-600 dark:text-amber-400",
                        fill: "none",
                        stroke: "currentColor",
                        viewBox: "0 0 24 24",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                            strokeLinecap: "round",
                            strokeLinejoin: "round",
                            strokeWidth: 2,
                            d: "M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        }, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/message-renderers/InterruptMessage.tsx",
                            lineNumber: 19,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/message-renderers/InterruptMessage.tsx",
                        lineNumber: 13,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-sm text-amber-800 dark:text-amber-200 font-medium",
                        children: data.message
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/message-renderers/InterruptMessage.tsx",
                        lineNumber: 26,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/features/chat/components/message-renderers/InterruptMessage.tsx",
                lineNumber: 12,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/apps/web/features/chat/components/message-renderers/InterruptMessage.tsx",
            lineNumber: 11,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/apps/web/features/chat/components/message-renderers/InterruptMessage.tsx",
        lineNumber: 10,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/message-renderers/ResultMessage.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ResultMessage",
    ()=>ResultMessage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$dev$2d$mode$2d$context$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/dev-mode-context.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/error-codes.ts [app-ssr] (ecmascript)");
;
;
;
function ResultMessage({ content }) {
    // MUST call hooks at top level before any returns
    const isDebugMode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$dev$2d$mode$2d$context$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useDebugVisible"])();
    // Map SDK subtype to error code
    const getErrorCode = ()=>{
        if (content.subtype === "error_max_turns") {
            return __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ErrorCodes"].ERROR_MAX_TURNS;
        }
        return null;
    };
    const errorCode = getErrorCode();
    const getDisplayMessage = ()=>{
        if (errorCode) {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getErrorMessage"])(errorCode);
        }
        return "An error occurred during execution";
    };
    const getDisplayHelp = ()=>{
        if (errorCode) {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getErrorHelp"])(errorCode);
        }
        return null;
    };
    if (content.is_error) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "py-3 mb-4",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/30 p-4 rounded",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-start gap-3",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex-shrink-0 mt-0.5",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                className: "w-5 h-5 text-red-500 dark:text-red-400",
                                fill: "none",
                                viewBox: "0 0 24 24",
                                stroke: "currentColor",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                    strokeLinecap: "round",
                                    strokeLinejoin: "round",
                                    strokeWidth: 2,
                                    d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/features/chat/components/message-renderers/ResultMessage.tsx",
                                    lineNumber: 49,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/components/message-renderers/ResultMessage.tsx",
                                lineNumber: 43,
                                columnNumber: 15
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/apps/web/features/chat/components/message-renderers/ResultMessage.tsx",
                            lineNumber: 42,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                    className: "text-sm font-medium text-red-900 dark:text-red-300 mb-1",
                                    children: "Execution Error"
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/features/chat/components/message-renderers/ResultMessage.tsx",
                                    lineNumber: 58,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-sm text-red-700 dark:text-red-400 leading-relaxed",
                                    children: getDisplayMessage()
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/features/chat/components/message-renderers/ResultMessage.tsx",
                                    lineNumber: 59,
                                    columnNumber: 15
                                }, this),
                                getDisplayHelp() && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-xs text-red-600 dark:text-red-500 mt-2 leading-relaxed",
                                    children: getDisplayHelp()
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/features/chat/components/message-renderers/ResultMessage.tsx",
                                    lineNumber: 61,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "mt-2 text-xs text-red-500/70 dark:text-red-400/70",
                                    children: [
                                        "Duration: ",
                                        (content.duration_ms / 1000).toFixed(1),
                                        "s • Cost: $",
                                        content.total_cost_usd.toFixed(4),
                                        errorCode && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "ml-2 font-mono",
                                            children: [
                                                "• ",
                                                errorCode
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/apps/web/features/chat/components/message-renderers/ResultMessage.tsx",
                                            lineNumber: 65,
                                            columnNumber: 31
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/apps/web/features/chat/components/message-renderers/ResultMessage.tsx",
                                    lineNumber: 63,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/apps/web/features/chat/components/message-renderers/ResultMessage.tsx",
                            lineNumber: 57,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/apps/web/features/chat/components/message-renderers/ResultMessage.tsx",
                    lineNumber: 41,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/message-renderers/ResultMessage.tsx",
                lineNumber: 40,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/apps/web/features/chat/components/message-renderers/ResultMessage.tsx",
            lineNumber: 39,
            columnNumber: 7
        }, this);
    }
    // Only show completion stats in debug mode
    if (!isDebugMode) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "py-2 mb-4",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "text-sm font-medium text-black/60 dark:text-white/60 normal-case tracking-normal",
            children: [
                "Completed",
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "ml-2 text-xs text-black/50 dark:text-white/50 font-normal",
                    children: [
                        (content.duration_ms / 1000).toFixed(1),
                        "s • $",
                        content.total_cost_usd.toFixed(4)
                    ]
                }, void 0, true, {
                    fileName: "[project]/apps/web/features/chat/components/message-renderers/ResultMessage.tsx",
                    lineNumber: 81,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/apps/web/features/chat/components/message-renderers/ResultMessage.tsx",
            lineNumber: 79,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/apps/web/features/chat/components/message-renderers/ResultMessage.tsx",
        lineNumber: 78,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/message-renderers/StartMessage.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "StartMessage",
    ()=>StartMessage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
;
function StartMessage({ data }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "py-2 mb-4 text-sm text-black/60 dark:text-white/60",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-1.5 font-medium normal-case tracking-normal underline",
                children: "Session Initialized"
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/message-renderers/StartMessage.tsx",
                lineNumber: 14,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-xs text-black/50 dark:text-white/50 font-normal normal-case tracking-normal",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "font-medium",
                        children: "Directory:"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/message-renderers/StartMessage.tsx",
                        lineNumber: 16,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "ml-1",
                        children: data.cwd
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/message-renderers/StartMessage.tsx",
                        lineNumber: 17,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/features/chat/components/message-renderers/StartMessage.tsx",
                lineNumber: 15,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/features/chat/components/message-renderers/StartMessage.tsx",
        lineNumber: 13,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/message-renderers/SystemMessage.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SystemMessage",
    ()=>SystemMessage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$dev$2d$mode$2d$context$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/dev-mode-context.tsx [app-ssr] (ecmascript)");
;
;
function SystemMessage({ content }) {
    const isDebugMode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$dev$2d$mode$2d$context$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useDebugVisible"])();
    if (!isDebugMode) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "py-2 mb-4 text-sm text-black/60 dark:text-white/60",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-1.5 font-medium normal-case tracking-normal",
                children: "System Initialized"
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/message-renderers/SystemMessage.tsx",
                lineNumber: 14,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-1 text-xs font-normal normal-case tracking-normal",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-medium",
                                children: "Model:"
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/components/message-renderers/SystemMessage.tsx",
                                lineNumber: 17,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "ml-1",
                                children: content.model
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/components/message-renderers/SystemMessage.tsx",
                                lineNumber: 18,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/web/features/chat/components/message-renderers/SystemMessage.tsx",
                        lineNumber: 16,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-medium",
                                children: "Directory:"
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/components/message-renderers/SystemMessage.tsx",
                                lineNumber: 21,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "ml-1",
                                children: content.cwd
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/components/message-renderers/SystemMessage.tsx",
                                lineNumber: 22,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/web/features/chat/components/message-renderers/SystemMessage.tsx",
                        lineNumber: 20,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-medium",
                                children: "Tools:"
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/components/message-renderers/SystemMessage.tsx",
                                lineNumber: 25,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "ml-1",
                                children: [
                                    content.tools?.length || 0,
                                    " available"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/apps/web/features/chat/components/message-renderers/SystemMessage.tsx",
                                lineNumber: 26,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/web/features/chat/components/message-renderers/SystemMessage.tsx",
                        lineNumber: 24,
                        columnNumber: 9
                    }, this),
                    content.claude_code_version && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-medium",
                                children: "Version:"
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/components/message-renderers/SystemMessage.tsx",
                                lineNumber: 30,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "ml-1",
                                children: content.claude_code_version
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/components/message-renderers/SystemMessage.tsx",
                                lineNumber: 31,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/web/features/chat/components/message-renderers/SystemMessage.tsx",
                        lineNumber: 29,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/features/chat/components/message-renderers/SystemMessage.tsx",
                lineNumber: 15,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/features/chat/components/message-renderers/SystemMessage.tsx",
        lineNumber: 13,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/components/ui/chat/tools/bash/BashOutput.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BashOutput",
    ()=>BashOutput
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
;
function BashOutput({ output, exitCode, killed, shellId }) {
    const getStatusText = ()=>{
        if (killed) return "killed (timeout)";
        return exitCode === 0 ? "completed" : `failed (${exitCode})`;
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-xs text-black/40 dark:text-white/40 font-thin",
                children: [
                    getStatusText(),
                    " ",
                    shellId && `• shell ${shellId}`
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/components/ui/chat/tools/bash/BashOutput.tsx",
                lineNumber: 16,
                columnNumber: 7
            }, this),
            output && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-xs text-black/80 dark:text-white/80 font-diatype-mono leading-relaxed whitespace-pre-wrap bg-black/[0.02] dark:bg-white/[0.02] p-3 border border-black/10 dark:border-white/10 max-h-80 overflow-auto",
                children: output
            }, void 0, false, {
                fileName: "[project]/apps/web/components/ui/chat/tools/bash/BashOutput.tsx",
                lineNumber: 20,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/components/ui/chat/tools/bash/BashOutput.tsx",
        lineNumber: 15,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/components/ui/chat/tools/edit/EditOutput.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "EditOutput",
    ()=>EditOutput
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
;
function EditOutput({ replacements, file_path, error }) {
    if (error) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "text-xs text-red-600 dark:text-red-400 font-normal p-2 bg-red-50/50 dark:bg-red-900/20 border border-red-200 dark:border-red-800",
            children: error
        }, void 0, false, {
            fileName: "[project]/apps/web/components/ui/chat/tools/edit/EditOutput.tsx",
            lineNumber: 10,
            columnNumber: 7
        }, this);
    }
    const fileName = file_path?.split("/").pop() || "file";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "text-xs text-green-700 dark:text-green-400 font-normal p-2 bg-green-50/30 dark:bg-green-900/20 border border-green-200 dark:border-green-800",
        children: [
            "✓ Made ",
            replacements || 0,
            " ",
            replacements === 1 ? "replacement" : "replacements",
            " in ",
            fileName
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/components/ui/chat/tools/edit/EditOutput.tsx",
        lineNumber: 19,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/components/ui/chat/tools/glob/GlobOutput.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GlobOutput",
    ()=>GlobOutput
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
;
function GlobOutput({ matches, count, search_path }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-xs text-black/40 dark:text-white/40 font-thin",
                children: [
                    count,
                    " matches in ",
                    search_path
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/components/ui/chat/tools/glob/GlobOutput.tsx",
                lineNumber: 10,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-1 max-h-80 overflow-auto",
                children: matches.map((match, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-xs text-black/60 dark:text-white/60 font-diatype-mono",
                        children: match
                    }, index, false, {
                        fileName: "[project]/apps/web/components/ui/chat/tools/glob/GlobOutput.tsx",
                        lineNumber: 15,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/apps/web/components/ui/chat/tools/glob/GlobOutput.tsx",
                lineNumber: 13,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/components/ui/chat/tools/glob/GlobOutput.tsx",
        lineNumber: 9,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/components/ui/chat/tools/grep/GrepOutput.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GrepOutput",
    ()=>GrepOutput
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
;
function GrepOutput(props) {
    // Content output (matching lines)
    if ("matches" in props && "total_matches" in props) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "space-y-2",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "text-xs text-black/40 dark:text-white/40 font-thin",
                    children: [
                        props.total_matches,
                        " matches"
                    ]
                }, void 0, true, {
                    fileName: "[project]/apps/web/components/ui/chat/tools/grep/GrepOutput.tsx",
                    lineNumber: 32,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-3 max-h-80 overflow-auto",
                    children: props.matches.map((match, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-xs text-black/50 dark:text-white/50 font-thin",
                                    children: [
                                        match.file.split("/").pop(),
                                        " ",
                                        match.line_number && `:${match.line_number}`
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/apps/web/components/ui/chat/tools/grep/GrepOutput.tsx",
                                    lineNumber: 36,
                                    columnNumber: 15
                                }, this),
                                match.before_context?.map((line, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "text-xs text-black/30 dark:text-white/30 font-diatype-mono pl-2",
                                        children: line
                                    }, `before-${i}`, false, {
                                        fileName: "[project]/apps/web/components/ui/chat/tools/grep/GrepOutput.tsx",
                                        lineNumber: 40,
                                        columnNumber: 17
                                    }, this)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-xs text-black/80 dark:text-white/80 font-diatype-mono pl-2 bg-yellow-50 dark:bg-yellow-900/30",
                                    children: match.line
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/components/ui/chat/tools/grep/GrepOutput.tsx",
                                    lineNumber: 44,
                                    columnNumber: 15
                                }, this),
                                match.after_context?.map((line, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "text-xs text-black/30 dark:text-white/30 font-diatype-mono pl-2",
                                        children: line
                                    }, `after-${i}`, false, {
                                        fileName: "[project]/apps/web/components/ui/chat/tools/grep/GrepOutput.tsx",
                                        lineNumber: 48,
                                        columnNumber: 17
                                    }, this))
                            ]
                        }, index, true, {
                            fileName: "[project]/apps/web/components/ui/chat/tools/grep/GrepOutput.tsx",
                            lineNumber: 35,
                            columnNumber: 13
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/apps/web/components/ui/chat/tools/grep/GrepOutput.tsx",
                    lineNumber: 33,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/apps/web/components/ui/chat/tools/grep/GrepOutput.tsx",
            lineNumber: 31,
            columnNumber: 7
        }, this);
    }
    // Files output (just file names)
    if ("files" in props && "count" in props) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "space-y-2",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "text-xs text-black/40 dark:text-white/40 font-thin",
                    children: [
                        props.count,
                        " files"
                    ]
                }, void 0, true, {
                    fileName: "[project]/apps/web/components/ui/chat/tools/grep/GrepOutput.tsx",
                    lineNumber: 63,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-1 max-h-80 overflow-auto",
                    children: props.files.map((file, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-xs text-black/60 dark:text-white/60 font-diatype-mono",
                            children: file
                        }, index, false, {
                            fileName: "[project]/apps/web/components/ui/chat/tools/grep/GrepOutput.tsx",
                            lineNumber: 66,
                            columnNumber: 13
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/apps/web/components/ui/chat/tools/grep/GrepOutput.tsx",
                    lineNumber: 64,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/apps/web/components/ui/chat/tools/grep/GrepOutput.tsx",
            lineNumber: 62,
            columnNumber: 7
        }, this);
    }
    // Count output (counts per file)
    if ("counts" in props && "total" in props) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "space-y-2",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "text-xs text-black/40 dark:text-white/40 font-thin",
                    children: [
                        props.total,
                        " total matches"
                    ]
                }, void 0, true, {
                    fileName: "[project]/apps/web/components/ui/chat/tools/grep/GrepOutput.tsx",
                    lineNumber: 79,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-1 max-h-80 overflow-auto",
                    children: props.counts.map((count, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-xs text-black/60 dark:text-white/60 font-diatype-mono flex justify-between",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    children: count.file
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/components/ui/chat/tools/grep/GrepOutput.tsx",
                                    lineNumber: 86,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-black/40 dark:text-white/40",
                                    children: count.count
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/components/ui/chat/tools/grep/GrepOutput.tsx",
                                    lineNumber: 87,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, index, true, {
                            fileName: "[project]/apps/web/components/ui/chat/tools/grep/GrepOutput.tsx",
                            lineNumber: 82,
                            columnNumber: 13
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/apps/web/components/ui/chat/tools/grep/GrepOutput.tsx",
                    lineNumber: 80,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/apps/web/components/ui/chat/tools/grep/GrepOutput.tsx",
            lineNumber: 78,
            columnNumber: 7
        }, this);
    }
    return null;
}
}),
"[project]/apps/web/components/ui/chat/tools/read/ReadOutput.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ReadOutput",
    ()=>ReadOutput
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
;
function ReadOutput(props) {
    // Text file
    if ("content" in props && "total_lines" in props) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "text-xs text-black/40 dark:text-white/40 font-normal",
            children: [
                props.lines_returned,
                " of ",
                props.total_lines,
                " lines"
            ]
        }, void 0, true, {
            fileName: "[project]/apps/web/components/ui/chat/tools/read/ReadOutput.tsx",
            lineNumber: 41,
            columnNumber: 7
        }, this);
    }
    // Image file
    if ("image" in props && "file_size" in props) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "text-xs text-black/40 dark:text-white/40 font-normal",
            children: [
                "image • ",
                Math.round(props.file_size / 1024),
                "KB"
            ]
        }, void 0, true, {
            fileName: "[project]/apps/web/components/ui/chat/tools/read/ReadOutput.tsx",
            lineNumber: 50,
            columnNumber: 7
        }, this);
    }
    // PDF file
    if ("pages" in props && "total_pages" in props) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "text-xs text-black/40 dark:text-white/40 font-normal",
            children: [
                "pdf • ",
                props.total_pages,
                " pages"
            ]
        }, void 0, true, {
            fileName: "[project]/apps/web/components/ui/chat/tools/read/ReadOutput.tsx",
            lineNumber: 58,
            columnNumber: 12
        }, this);
    }
    // Notebook file
    if ("cells" in props) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "text-xs text-black/40 dark:text-white/40 font-normal",
            children: [
                "notebook • ",
                props.cells.length,
                " cells"
            ]
        }, void 0, true, {
            fileName: "[project]/apps/web/components/ui/chat/tools/read/ReadOutput.tsx",
            lineNumber: 64,
            columnNumber: 7
        }, this);
    }
    return null;
}
}),
"[project]/apps/web/components/ui/chat/tools/task/TaskOutput.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "TaskOutput",
    ()=>TaskOutput
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$chat$2f$format$2f$MarkdownDisplay$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$utils$2f$markdown$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/utils/markdown-utils.ts [app-ssr] (ecmascript)");
;
;
;
function TaskOutput({ result, usage, total_cost_usd, duration_ms }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-2",
        children: [
            (usage || total_cost_usd || duration_ms) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-xs text-black/40 dark:text-white/40 font-thin",
                children: [
                    duration_ms && `${duration_ms}ms`,
                    total_cost_usd && ` • $${total_cost_usd.toFixed(4)}`,
                    usage && ` • ${usage.input_tokens + usage.output_tokens} tokens`
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/components/ui/chat/tools/task/TaskOutput.tsx",
                lineNumber: 20,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-xs bg-black/[0.02] dark:bg-white/[0.02] p-3 border border-black/10 dark:border-white/10 max-h-80 overflow-auto",
                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$utils$2f$markdown$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["hasMarkdown"])(result) ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$chat$2f$format$2f$MarkdownDisplay$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MarkdownDisplay"], {
                    content: result,
                    className: "text-black/80 dark:text-white/80"
                }, void 0, false, {
                    fileName: "[project]/apps/web/components/ui/chat/tools/task/TaskOutput.tsx",
                    lineNumber: 28,
                    columnNumber: 11
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "text-black/80 dark:text-white/80 font-thin leading-relaxed whitespace-pre-wrap",
                    children: result
                }, void 0, false, {
                    fileName: "[project]/apps/web/components/ui/chat/tools/task/TaskOutput.tsx",
                    lineNumber: 30,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/apps/web/components/ui/chat/tools/task/TaskOutput.tsx",
                lineNumber: 26,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/components/ui/chat/tools/task/TaskOutput.tsx",
        lineNumber: 18,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/components/ui/chat/tools/write/WriteOutput.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "WriteOutput",
    ()=>WriteOutput
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
;
function WriteOutput({ bytes_written, file_path, error }) {
    if (error) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "text-xs text-red-600 dark:text-red-400 font-normal p-2 bg-red-50/50 dark:bg-red-900/20 border border-red-200 dark:border-red-800",
            children: error
        }, void 0, false, {
            fileName: "[project]/apps/web/components/ui/chat/tools/write/WriteOutput.tsx",
            lineNumber: 10,
            columnNumber: 7
        }, this);
    }
    const fileName = file_path?.split("/").pop() || "file";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "text-xs text-blue-700 dark:text-blue-400 font-normal p-2 bg-blue-50/30 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800",
        children: [
            "✓ Wrote ",
            bytes_written || 0,
            " bytes to ",
            fileName
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/components/ui/chat/tools/write/WriteOutput.tsx",
        lineNumber: 19,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/components/ui/chat/tools/ToolOutputRouter.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ToolOutputRouter",
    ()=>ToolOutputRouter
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$chat$2f$tools$2f$bash$2f$BashOutput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/components/ui/chat/tools/bash/BashOutput.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$chat$2f$tools$2f$edit$2f$EditOutput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/components/ui/chat/tools/edit/EditOutput.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$chat$2f$tools$2f$glob$2f$GlobOutput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/components/ui/chat/tools/glob/GlobOutput.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$chat$2f$tools$2f$grep$2f$GrepOutput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/components/ui/chat/tools/grep/GrepOutput.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$chat$2f$tools$2f$read$2f$ReadOutput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/components/ui/chat/tools/read/ReadOutput.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$chat$2f$tools$2f$task$2f$TaskOutput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/components/ui/chat/tools/task/TaskOutput.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$chat$2f$tools$2f$write$2f$WriteOutput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/components/ui/chat/tools/write/WriteOutput.tsx [app-ssr] (ecmascript)");
;
;
;
;
;
;
;
;
function ToolOutputRouter({ toolName, content }) {
    const tool = toolName.toLowerCase();
    switch(tool){
        case "bash":
            if (content.output !== undefined && content.exitCode !== undefined) {
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$chat$2f$tools$2f$bash$2f$BashOutput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["BashOutput"], {
                    ...content
                }, void 0, false, {
                    fileName: "[project]/apps/web/components/ui/chat/tools/ToolOutputRouter.tsx",
                    lineNumber: 20,
                    columnNumber: 16
                }, this);
            }
            break;
        case "read":
            // TextFileOutput
            if (content.total_lines !== undefined && content.content) {
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$chat$2f$tools$2f$read$2f$ReadOutput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ReadOutput"], {
                    ...content
                }, void 0, false, {
                    fileName: "[project]/apps/web/components/ui/chat/tools/ToolOutputRouter.tsx",
                    lineNumber: 27,
                    columnNumber: 16
                }, this);
            }
            // ImageFileOutput
            if (content.image && content.file_size !== undefined) {
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$chat$2f$tools$2f$read$2f$ReadOutput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ReadOutput"], {
                    ...content
                }, void 0, false, {
                    fileName: "[project]/apps/web/components/ui/chat/tools/ToolOutputRouter.tsx",
                    lineNumber: 31,
                    columnNumber: 16
                }, this);
            }
            // PDFFileOutput
            if (content.pages && content.total_pages !== undefined) {
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$chat$2f$tools$2f$read$2f$ReadOutput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ReadOutput"], {
                    ...content
                }, void 0, false, {
                    fileName: "[project]/apps/web/components/ui/chat/tools/ToolOutputRouter.tsx",
                    lineNumber: 35,
                    columnNumber: 16
                }, this);
            }
            // NotebookFileOutput
            if (content.cells) {
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$chat$2f$tools$2f$read$2f$ReadOutput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ReadOutput"], {
                    ...content
                }, void 0, false, {
                    fileName: "[project]/apps/web/components/ui/chat/tools/ToolOutputRouter.tsx",
                    lineNumber: 39,
                    columnNumber: 16
                }, this);
            }
            break;
        case "edit":
            if (content.replacements !== undefined) {
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$chat$2f$tools$2f$edit$2f$EditOutput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["EditOutput"], {
                    ...content
                }, void 0, false, {
                    fileName: "[project]/apps/web/components/ui/chat/tools/ToolOutputRouter.tsx",
                    lineNumber: 45,
                    columnNumber: 16
                }, this);
            }
            break;
        case "write":
            if (content.bytes_written !== undefined) {
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$chat$2f$tools$2f$write$2f$WriteOutput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["WriteOutput"], {
                    ...content
                }, void 0, false, {
                    fileName: "[project]/apps/web/components/ui/chat/tools/ToolOutputRouter.tsx",
                    lineNumber: 51,
                    columnNumber: 16
                }, this);
            }
            break;
        case "grep":
            // GrepFilesOutput
            if (content.files && content.count !== undefined) {
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$chat$2f$tools$2f$grep$2f$GrepOutput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["GrepOutput"], {
                    ...content
                }, void 0, false, {
                    fileName: "[project]/apps/web/components/ui/chat/tools/ToolOutputRouter.tsx",
                    lineNumber: 58,
                    columnNumber: 16
                }, this);
            }
            // GrepContentOutput
            if (content.matches && content.total_matches !== undefined) {
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$chat$2f$tools$2f$grep$2f$GrepOutput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["GrepOutput"], {
                    ...content
                }, void 0, false, {
                    fileName: "[project]/apps/web/components/ui/chat/tools/ToolOutputRouter.tsx",
                    lineNumber: 62,
                    columnNumber: 16
                }, this);
            }
            // GrepCountOutput
            if (content.counts && content.total !== undefined) {
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$chat$2f$tools$2f$grep$2f$GrepOutput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["GrepOutput"], {
                    ...content
                }, void 0, false, {
                    fileName: "[project]/apps/web/components/ui/chat/tools/ToolOutputRouter.tsx",
                    lineNumber: 66,
                    columnNumber: 16
                }, this);
            }
            break;
        case "glob":
            if (content.matches && content.count !== undefined) {
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$chat$2f$tools$2f$glob$2f$GlobOutput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["GlobOutput"], {
                    ...content
                }, void 0, false, {
                    fileName: "[project]/apps/web/components/ui/chat/tools/ToolOutputRouter.tsx",
                    lineNumber: 72,
                    columnNumber: 16
                }, this);
            }
            break;
        case "task":
            if (content.result) {
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$chat$2f$tools$2f$task$2f$TaskOutput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TaskOutput"], {
                    ...content
                }, void 0, false, {
                    fileName: "[project]/apps/web/components/ui/chat/tools/ToolOutputRouter.tsx",
                    lineNumber: 78,
                    columnNumber: 16
                }, this);
            }
            break;
        // Add other tools as needed
        default:
            // Fallback to JSON for unknown tools
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("pre", {
                className: "text-xs text-black/60 dark:text-white/60 font-diatype-mono leading-relaxed overflow-auto max-h-80 p-3 bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10",
                children: typeof content === "string" ? content : JSON.stringify(content, null, 2)
            }, void 0, false, {
                fileName: "[project]/apps/web/components/ui/chat/tools/ToolOutputRouter.tsx",
                lineNumber: 86,
                columnNumber: 9
            }, this);
    }
    // Fallback if tool is recognized but content doesn't match expected schema
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("pre", {
        className: "text-xs text-black/60 dark:text-white/60 font-diatype-mono leading-relaxed overflow-auto max-h-80 p-3 bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10",
        children: typeof content === "string" ? content : JSON.stringify(content, null, 2)
    }, void 0, false, {
        fileName: "[project]/apps/web/components/ui/chat/tools/ToolOutputRouter.tsx",
        lineNumber: 94,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/message-renderers/ToolResultMessage.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ToolResultMessage",
    ()=>ToolResultMessage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$chat$2f$tools$2f$ToolOutputRouter$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/components/ui/chat/tools/ToolOutputRouter.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$dev$2d$mode$2d$context$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/dev-mode-context.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$tool$2d$icons$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/tool-icons.tsx [app-ssr] (ecmascript)");
;
;
;
;
;
// Type guard to check if a content block is a tool result
function isToolResult(content) {
    return content && content.type === "tool_result";
}
function ToolResultMessage({ content }) {
    const messageContent = content.message.content;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "mb-6",
        children: Array.isArray(messageContent) && messageContent.map((result, index)=>{
            if (isToolResult(result)) {
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ToolResult, {
                    result: result
                }, index, false, {
                    fileName: "[project]/apps/web/features/chat/components/message-renderers/ToolResultMessage.tsx",
                    lineNumber: 33,
                    columnNumber: 20
                }, this);
            }
            return null;
        })
    }, void 0, false, {
        fileName: "[project]/apps/web/features/chat/components/message-renderers/ToolResultMessage.tsx",
        lineNumber: 29,
        columnNumber: 5
    }, this);
}
function ToolResult({ result }) {
    const [isExpanded, setIsExpanded] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const isDebugMode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$dev$2d$mode$2d$context$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useDebugVisible"])();
    // Use the tool name that was attached by the message parser
    const toolName = result.tool_name || "Tool Result";
    const Icon = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$tool$2d$icons$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getToolIcon"])(toolName);
    // Parse the content to get structured tool output if it's JSON
    const getDisplayContent = ()=>{
        if (typeof result.content === "string") {
            try {
                return JSON.parse(result.content);
            } catch  {
                return result.content;
            }
        }
        return result.content;
    };
    const displayContent = getDisplayContent();
    // Format tool output preview (collapsed state)
    const formatToolOutputPreview = (toolName, content)=>{
        const tool = toolName.toLowerCase();
        let preview = "";
        try {
            switch(tool){
                case "read":
                    if (content.total_lines) preview = `read ${content.lines_returned || content.total_lines} lines`;
                    else if (content.file_size) preview = "read image";
                    else if (content.total_pages) preview = "read pdf";
                    else if (content.cells) preview = "read notebook";
                    break;
                case "write":
                    if (content.bytes_written) preview = "wrote file";
                    break;
                case "edit":
                    if (content.replacements !== undefined) preview = `made ${content.replacements} changes`;
                    break;
                case "grep":
                    if (content.count !== undefined) preview = `found ${content.count} files`;
                    else if (content.total_matches !== undefined) preview = `found ${content.total_matches} matches`;
                    else if (content.total !== undefined) preview = `found ${content.total} matches`;
                    break;
                case "glob":
                    if (content.count !== undefined) preview = `found ${content.count} files`;
                    break;
                case "bash":
                    if (content.exitCode !== undefined) preview = content.exitCode === 0 ? "completed" : `failed (${content.exitCode})`;
                    break;
                case "task":
                    preview = "completed";
                    break;
            }
        } catch (_e) {
        // Fall through
        }
        if (!preview) {
            preview = toolName.toLowerCase();
        }
        // In debug mode, show both exact tool name and preview
        if (isDebugMode) {
            return `${toolName}: ${preview}`;
        }
        return preview;
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "my-1",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: ()=>setIsExpanded(!isExpanded),
                className: `text-xs font-normal transition-colors flex items-center gap-1.5 ${result.is_error ? "text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300" : "text-black/35 dark:text-white/35 hover:text-black/50 dark:hover:text-white/50"}`,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Icon, {
                        size: 12,
                        className: "opacity-60"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/message-renderers/ToolResultMessage.tsx",
                        lineNumber: 125,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: [
                            formatToolOutputPreview(toolName, displayContent),
                            result.is_error && " error"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/web/features/chat/components/message-renderers/ToolResultMessage.tsx",
                        lineNumber: 126,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/features/chat/components/message-renderers/ToolResultMessage.tsx",
                lineNumber: 116,
                columnNumber: 7
            }, this),
            isExpanded && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-1 max-w-full overflow-hidden",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$chat$2f$tools$2f$ToolOutputRouter$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ToolOutputRouter"], {
                    toolName: toolName,
                    content: displayContent
                }, void 0, false, {
                    fileName: "[project]/apps/web/features/chat/components/message-renderers/ToolResultMessage.tsx",
                    lineNumber: 133,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/message-renderers/ToolResultMessage.tsx",
                lineNumber: 132,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/features/chat/components/message-renderers/ToolResultMessage.tsx",
        lineNumber: 115,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/types/sdk.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "extractSessionId",
    ()=>extractSessionId,
    "getMessageStreamData",
    ()=>getMessageStreamData,
    "isErrorResultMessage",
    ()=>isErrorResultMessage,
    "isSDKAssistantMessage",
    ()=>isSDKAssistantMessage,
    "isSDKResultMessage",
    ()=>isSDKResultMessage,
    "isSDKSystemMessage",
    ()=>isSDKSystemMessage,
    "isSDKUserMessage",
    ()=>isSDKUserMessage
]);
function isSDKSystemMessage(msg) {
    return msg.type === "system" && "subtype" in msg && msg.subtype === "init" && "session_id" in msg && "uuid" in msg;
}
function isSDKAssistantMessage(msg) {
    return msg.type === "assistant" && "message" in msg;
}
function isSDKUserMessage(msg) {
    return msg.type === "user" && "message" in msg;
}
function isSDKResultMessage(msg) {
    return msg.type === "result" && "is_error" in msg && "duration_ms" in msg;
}
function isErrorResultMessage(msg) {
    return msg?.type === "result" && msg?.is_error === true && typeof msg?.result === "string";
}
function extractSessionId(msg) {
    if (isSDKSystemMessage(msg) && msg.subtype === "init") {
        return msg.session_id;
    }
    return null;
}
function getMessageStreamData(msg) {
    return {
        messageType: msg.type,
        content: msg
    };
}
}),
"[project]/apps/web/features/chat/types/sdk-types.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
// Re-export guards and helpers from new location
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$types$2f$sdk$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/types/sdk.ts [app-ssr] (ecmascript)");
;
}),
"[project]/apps/web/features/chat/types/stream.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isCompleteEvent",
    ()=>isCompleteEvent,
    "isDoneEvent",
    ()=>isDoneEvent,
    "isErrorEvent",
    ()=>isErrorEvent,
    "isInterruptEvent",
    ()=>isInterruptEvent,
    "isMessageEvent",
    ()=>isMessageEvent,
    "isPingEvent",
    ()=>isPingEvent,
    "isResultEvent",
    ()=>isResultEvent,
    "isSessionEvent",
    ()=>isSessionEvent,
    "isStartEvent",
    ()=>isStartEvent
]);
function isStartEvent(event) {
    return event.type === "start" && "cwd" in event.data;
}
function isSessionEvent(event) {
    return event.type === "session" && "sessionId" in event.data;
}
function isMessageEvent(event) {
    return event.type === "message" && "messageType" in event.data && "content" in event.data;
}
function isResultEvent(event) {
    return event.type === "result" && "subtype" in event.data;
}
function isCompleteEvent(event) {
    return event.type === "complete" && "totalMessages" in event.data;
}
function isErrorEvent(event) {
    return event.type === "error" && "error" in event.data && "message" in event.data;
}
function isPingEvent(event) {
    return event.type === "ping";
}
function isDoneEvent(event) {
    return event.type === "done";
}
function isInterruptEvent(event) {
    return event.type === "interrupt" && "message" in event.data && "source" in event.data;
}
}),
"[project]/apps/web/features/chat/lib/message-parser.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getMessageComponentType",
    ()=>getMessageComponentType,
    "parseStreamEvent",
    ()=>parseStreamEvent
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$types$2f$sdk$2d$types$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/features/chat/types/sdk-types.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$types$2f$sdk$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/types/sdk.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$types$2f$stream$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/types/stream.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/error-codes.ts [app-ssr] (ecmascript)");
;
;
;
// Global store for tool_use_id to tool name mapping
const toolUseMap = new Map();
function parseStreamEvent(event) {
    const baseMessage = {
        timestamp: new Date(event.timestamp)
    };
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$types$2f$stream$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isStartEvent"])(event)) {
        return {
            id: `${event.requestId}-start`,
            type: "start",
            content: event.data,
            ...baseMessage
        };
    }
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$types$2f$stream$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isSessionEvent"])(event)) {
        // Session events are internal - don't create UI messages for them
        return null;
    }
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$types$2f$stream$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isMessageEvent"])(event)) {
        const content = event.data.content;
        // Handle system messages with special subtypes (e.g., compact_boundary)
        // See: apps/web/features/chat/lib/unknown-message-types.json for documentation
        if (content.type === "system" && content.subtype === "compact_boundary") {
            // This is an internal SDK message about context compaction - show visual indicator
            console.log(`[MessageParser] Context compaction triggered at ${content.compact_metadata?.pre_tokens || "unknown"} tokens`);
            return {
                id: `${event.requestId}-compact-${content.uuid}`,
                type: "compact_boundary",
                content: content,
                ...baseMessage
            };
        }
        // If this is an assistant message with tool_use, store the mapping
        if (content.type === "assistant" && content.message?.content && Array.isArray(content.message.content)) {
            content.message.content.forEach((item)=>{
                if (item.type === "tool_use" && item.id && item.name) {
                    toolUseMap.set(item.id, item.name);
                }
            });
        }
        // If this is a user message with tool_result, attach tool names
        if (content.type === "user" && content.message?.content && Array.isArray(content.message.content)) {
            content.message.content.forEach((item)=>{
                if (item.type === "tool_result" && item.tool_use_id) {
                    item.tool_name = toolUseMap.get(item.tool_use_id) || "Tool";
                }
            });
        }
        return {
            id: `${event.requestId}-${event.data.messageCount}`,
            type: "sdk_message",
            content: content,
            ...baseMessage
        };
    }
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$types$2f$stream$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isResultEvent"])(event)) {
        return {
            id: `${event.requestId}-result`,
            type: "result",
            content: event.data,
            ...baseMessage
        };
    }
    if (event.type === "complete") {
        return {
            id: `${event.requestId}-complete`,
            type: "complete",
            content: event.data,
            ...baseMessage
        };
    }
    if (event.type === "error") {
        const errorData = event.data;
        const errorCode = errorData.code || errorData.error;
        // Use error registry for user-friendly messages
        const details = typeof errorData.details === "object" ? errorData.details : undefined;
        const userMessage = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getErrorMessage"])(errorCode, details) || errorData.message;
        const helpText = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getErrorHelp"])(errorCode, details);
        // Format details if it's an object
        let detailsText = "";
        if (errorData.details && typeof errorData.details === "object") {
            detailsText = JSON.stringify(errorData.details, null, 2);
        } else if (errorData.details) {
            detailsText = String(errorData.details);
        }
        // Build full error message with help text if available
        let fullMessage = userMessage;
        if (helpText) {
            fullMessage += `\n\n${helpText}`;
        }
        if (detailsText && ("TURBOPACK compile-time value", "development") === "development") {
            fullMessage += `\n\nDetails: ${detailsText}`;
        }
        return {
            id: `${event.requestId}-error`,
            type: "sdk_message",
            content: {
                type: "result",
                is_error: true,
                result: fullMessage,
                error_code: errorCode
            },
            ...baseMessage
        };
    }
    if (event.type === "ping") {
        // Don't create UI messages for ping events - they're just keepalive
        return null;
    }
    if (event.type === "done") {
        // Optional: create a subtle completion indicator
        return {
            id: `${event.requestId}-done`,
            type: "complete",
            content: {
                message: "Stream completed"
            },
            ...baseMessage
        };
    }
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$types$2f$stream$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isInterruptEvent"])(event)) {
        return {
            id: `${event.requestId}-interrupt`,
            type: "interrupt",
            content: event.data,
            ...baseMessage
        };
    }
    return null;
}
;
function getMessageComponentType(message) {
    if (message.type === "user") return "user";
    if (message.type === "start") return "start";
    if (message.type === "session") return "session";
    if (message.type === "complete") return "complete";
    if (message.type === "compact_boundary") return "compact_boundary";
    if (message.type === "interrupt") return "interrupt";
    if (message.type === "sdk_message") {
        const sdkMsg = message.content;
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$types$2f$sdk$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isSDKSystemMessage"])(sdkMsg)) return "system";
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$types$2f$sdk$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isSDKAssistantMessage"])(sdkMsg)) return "assistant";
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$types$2f$sdk$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isSDKUserMessage"])(sdkMsg)) return "tool_result";
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$types$2f$sdk$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isSDKResultMessage"])(sdkMsg)) return "result";
    }
    if (message.type === "result") return "result";
    return "unknown";
}
}),
"[project]/apps/web/features/chat/lib/message-renderer.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "renderMessage",
    ()=>renderMessage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$chat$2f$format$2f$MarkdownDisplay$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/components/ui/chat/format/MarkdownDisplay.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$MessageErrorBoundary$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/MessageErrorBoundary.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$message$2d$renderers$2f$AssistantMessage$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/message-renderers/AssistantMessage.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$message$2d$renderers$2f$CompactBoundaryMessage$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/message-renderers/CompactBoundaryMessage.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$message$2d$renderers$2f$CompleteMessage$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/message-renderers/CompleteMessage.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$message$2d$renderers$2f$ErrorResultMessage$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/message-renderers/ErrorResultMessage.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$message$2d$renderers$2f$InterruptMessage$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/message-renderers/InterruptMessage.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$message$2d$renderers$2f$ResultMessage$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/message-renderers/ResultMessage.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$message$2d$renderers$2f$StartMessage$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/message-renderers/StartMessage.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$message$2d$renderers$2f$SystemMessage$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/message-renderers/SystemMessage.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$message$2d$renderers$2f$ToolResultMessage$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/message-renderers/ToolResultMessage.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$utils$2f$markdown$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/utils/markdown-utils.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$message$2d$parser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/features/chat/lib/message-parser.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$types$2f$sdk$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/types/sdk.ts [app-ssr] (ecmascript)");
;
;
;
;
;
;
;
;
;
;
;
;
;
;
function renderMessage(message) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$MessageErrorBoundary$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MessageErrorBoundary"], {
        messageId: message.id,
        children: renderMessageContent(message)
    }, void 0, false, {
        fileName: "[project]/apps/web/features/chat/lib/message-renderer.tsx",
        lineNumber: 22,
        columnNumber: 10
    }, this);
}
function renderMessageContent(message) {
    // Check for error result messages first (before component type routing)
    if (message.type === "sdk_message" && (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$types$2f$sdk$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isErrorResultMessage"])(message.content)) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$message$2d$renderers$2f$ErrorResultMessage$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ErrorResultMessage"], {
            content: message.content
        }, void 0, false, {
            fileName: "[project]/apps/web/features/chat/lib/message-renderer.tsx",
            lineNumber: 28,
            columnNumber: 12
        }, this);
    }
    const componentType = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$message$2d$parser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getMessageComponentType"])(message);
    switch(componentType){
        case "user":
            {
                const userContent = typeof message.content === "string" ? message.content : JSON.stringify(message.content);
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex justify-end mb-6",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "max-w-2xl",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-black/60 dark:text-white/60 text-xs mb-2 text-right font-thin",
                                children: "you"
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/lib/message-renderer.tsx",
                                lineNumber: 39,
                                columnNumber: 13
                            }, this),
                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$utils$2f$markdown$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["hasMarkdown"])(userContent) ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$chat$2f$format$2f$MarkdownDisplay$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MarkdownDisplay"], {
                                content: userContent
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/lib/message-renderer.tsx",
                                lineNumber: 41,
                                columnNumber: 15
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "whitespace-pre-wrap text-black dark:text-white font-thin leading-relaxed",
                                children: userContent
                            }, void 0, false, {
                                fileName: "[project]/apps/web/features/chat/lib/message-renderer.tsx",
                                lineNumber: 43,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/web/features/chat/lib/message-renderer.tsx",
                        lineNumber: 38,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/apps/web/features/chat/lib/message-renderer.tsx",
                    lineNumber: 37,
                    columnNumber: 9
                }, this);
            }
        case "start":
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$message$2d$renderers$2f$StartMessage$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["StartMessage"], {
                data: message.content,
                timestamp: message.timestamp.toISOString()
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/lib/message-renderer.tsx",
                lineNumber: 53,
                columnNumber: 14
            }, this);
        case "system":
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$message$2d$renderers$2f$SystemMessage$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SystemMessage"], {
                content: message.content
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/lib/message-renderer.tsx",
                lineNumber: 56,
                columnNumber: 14
            }, this);
        case "assistant":
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$message$2d$renderers$2f$AssistantMessage$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["AssistantMessage"], {
                content: message.content
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/lib/message-renderer.tsx",
                lineNumber: 59,
                columnNumber: 14
            }, this);
        case "tool_result":
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$message$2d$renderers$2f$ToolResultMessage$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ToolResultMessage"], {
                content: message.content
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/lib/message-renderer.tsx",
                lineNumber: 62,
                columnNumber: 14
            }, this);
        case "result":
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$message$2d$renderers$2f$ResultMessage$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ResultMessage"], {
                content: message.content
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/lib/message-renderer.tsx",
                lineNumber: 65,
                columnNumber: 14
            }, this);
        case "complete":
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$message$2d$renderers$2f$CompleteMessage$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CompleteMessage"], {
                data: message.content
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/lib/message-renderer.tsx",
                lineNumber: 68,
                columnNumber: 14
            }, this);
        case "compact_boundary":
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$message$2d$renderers$2f$CompactBoundaryMessage$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CompactBoundaryMessage"], {
                data: message.content
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/lib/message-renderer.tsx",
                lineNumber: 71,
                columnNumber: 14
            }, this);
        case "interrupt":
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$message$2d$renderers$2f$InterruptMessage$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["InterruptMessage"], {
                data: message.content
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/lib/message-renderer.tsx",
                lineNumber: 74,
                columnNumber: 14
            }, this);
        default:
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-2 rounded",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "font-medium mb-1",
                        children: "Unknown Message Type"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/lib/message-renderer.tsx",
                        lineNumber: 79,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("pre", {
                        className: "text-xs",
                        children: JSON.stringify(message.content, null, 2)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/lib/message-renderer.tsx",
                        lineNumber: 80,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/features/chat/lib/message-renderer.tsx",
                lineNumber: 78,
                columnNumber: 9
            }, this);
    }
}
}),
"[project]/apps/web/features/chat/components/ThinkingSpinner.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ThinkingSpinner",
    ()=>ThinkingSpinner
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
;
function ThinkingSpinner() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "font-mono inline-block overflow-hidden text-center align-middle relative text-black/35 dark:text-white/35",
        "aria-hidden": "true",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "invisible",
                children: "✽"
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/ThinkingSpinner.tsx",
                lineNumber: 7,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "block absolute left-0 right-0 select-none thinking-spinner-animate",
                style: {
                    top: "-0.35em"
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "block",
                        style: {
                            lineHeight: "2em"
                        },
                        children: "·"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ThinkingSpinner.tsx",
                        lineNumber: 9,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "block",
                        style: {
                            lineHeight: "2em"
                        },
                        children: "✢"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ThinkingSpinner.tsx",
                        lineNumber: 12,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "block",
                        style: {
                            lineHeight: "2em"
                        },
                        children: "✶"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ThinkingSpinner.tsx",
                        lineNumber: 15,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "block",
                        style: {
                            lineHeight: "2em"
                        },
                        children: "✻"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ThinkingSpinner.tsx",
                        lineNumber: 18,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "block",
                        style: {
                            lineHeight: "2em"
                        },
                        children: "✽"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ThinkingSpinner.tsx",
                        lineNumber: 21,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/features/chat/components/ThinkingSpinner.tsx",
                lineNumber: 8,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/features/chat/components/ThinkingSpinner.tsx",
        lineNumber: 3,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/components/ThinkingGroup.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ThinkingGroup",
    ()=>ThinkingGroup
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$dev$2d$mode$2d$context$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/dev-mode-context.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$message$2d$renderer$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/lib/message-renderer.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ThinkingSpinner$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ThinkingSpinner.tsx [app-ssr] (ecmascript)");
;
;
;
;
;
function ThinkingGroup({ messages, isComplete }) {
    const [isExpanded, setIsExpanded] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const isDebugMode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$dev$2d$mode$2d$context$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useDebugVisible"])();
    // If complete and not showing debug wrapper, render messages directly (no "doing some work")
    if (isComplete && !isDebugMode) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
            children: messages.map((message)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$message$2d$renderer$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["renderMessage"])(message)
                }, message.id, false, {
                    fileName: "[project]/apps/web/features/chat/components/ThinkingGroup.tsx",
                    lineNumber: 21,
                    columnNumber: 11
                }, this))
        }, void 0, false);
    }
    // In progress or showing debug: show with wrapper
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "my-4",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: ()=>setIsExpanded(!isExpanded),
                className: "text-xs font-normal text-black/35 dark:text-white/35 hover:text-black/50 dark:hover:text-white/50 transition-colors flex items-center gap-1",
                children: [
                    !isComplete && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ThinkingSpinner$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ThinkingSpinner"], {}, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ThinkingGroup.tsx",
                        lineNumber: 35,
                        columnNumber: 25
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: isComplete ? "doing some work" : "thinking"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/features/chat/components/ThinkingGroup.tsx",
                        lineNumber: 36,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/features/chat/components/ThinkingGroup.tsx",
                lineNumber: 30,
                columnNumber: 7
            }, this),
            isExpanded && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-2 space-y-1.5 pl-4 border-l-2 border-black/10 dark:border-white/10",
                children: messages.map((message)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-sm",
                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$message$2d$renderer$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["renderMessage"])(message)
                    }, message.id, false, {
                        fileName: "[project]/apps/web/features/chat/components/ThinkingGroup.tsx",
                        lineNumber: 42,
                        columnNumber: 13
                    }, this))
            }, void 0, false, {
                fileName: "[project]/apps/web/features/chat/components/ThinkingGroup.tsx",
                lineNumber: 40,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/features/chat/components/ThinkingGroup.tsx",
        lineNumber: 29,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/features/chat/lib/dev-client-error.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "sendClientError",
    ()=>sendClientError
]);
function sendClientError(params) {
    // Only log in development
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    const { conversationId, errorType, data, addDevEvent } = params;
    const errorData = {
        errorType,
        ...data
    };
    addDevEvent({
        eventName: "client_error",
        event: {
            type: "error",
            requestId: conversationId,
            timestamp: new Date().toISOString(),
            data: errorData
        },
        rawSSE: `event: client_error\ndata: ${JSON.stringify(errorData)}\n\n`
    });
}
}),
"[project]/apps/web/types/guards/ui.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isCompletionMessage",
    ()=>isCompletionMessage,
    "isTextMessage",
    ()=>isTextMessage
]);
function isTextMessage(message) {
    // User messages are always text
    if (message.type === "user") return true;
    // Assistant messages with only text content (no tools)
    if (message.type === "sdk_message" && message.content?.type === "assistant") {
        const content = message.content.message?.content || [];
        return content.length === 1 && content[0]?.type === "text";
    }
    return false;
}
function isCompletionMessage(message) {
    return message.type === "complete" || message.type === "result";
}
}),
"[project]/apps/web/features/chat/lib/message-grouper.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "groupMessages",
    ()=>groupMessages
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$types$2f$guards$2f$ui$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/types/guards/ui.ts [app-ssr] (ecmascript)");
;
function groupMessages(messages) {
    const groups = [];
    let currentThinkingGroup = [];
    const flushThinkingGroup = (isComplete = false)=>{
        if (currentThinkingGroup.length > 0) {
            groups.push({
                type: "thinking",
                messages: [
                    ...currentThinkingGroup
                ],
                isComplete
            });
            currentThinkingGroup = [];
        }
    };
    for(let i = 0; i < messages.length; i++){
        const message = messages[i];
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$types$2f$guards$2f$ui$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isTextMessage"])(message)) {
            // Flush any pending thinking group as complete (thinking finished)
            flushThinkingGroup(true);
            // Add text message as standalone
            groups.push({
                type: "text",
                messages: [
                    message
                ],
                isComplete: true
            });
        } else {
            // Add to thinking group
            currentThinkingGroup.push(message);
            // If this is a completion message, flush the group as complete
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$types$2f$guards$2f$ui$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isCompletionMessage"])(message)) {
                flushThinkingGroup(true);
            }
        }
    }
    // Flush any remaining thinking group as incomplete
    flushThinkingGroup(false);
    return groups;
}
}),
"[project]/apps/web/features/workspace/types/workspace.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
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
"[project]/apps/web/app/chat/page.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>ChatPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$external$2d$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ExternalLink$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/external-link.js [app-ssr] (ecmascript) <export default as ExternalLink>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$eye$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Eye$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/eye.js [app-ssr] (ecmascript) <export default as Eye>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$eye$2d$off$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__EyeOff$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/eye-off.js [app-ssr] (ecmascript) <export default as EyeOff>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Image$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/image.js [app-ssr] (ecmascript) <export default as Image>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$SettingsDropdown$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/components/ui/SettingsDropdown.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputV3$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ChatInput/ChatInputV3.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$DevTerminal$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/DevTerminal.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$SubdomainInitializer$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/SubdomainInitializer.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ThinkingGroup$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ThinkingGroup.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ThinkingSpinner$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/components/ThinkingSpinner.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$dev$2d$client$2d$error$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/lib/dev-client-error.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$dev$2d$terminal$2d$context$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/lib/dev-terminal-context.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$message$2d$grouper$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/lib/message-grouper.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$message$2d$parser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/features/chat/lib/message-parser.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$message$2d$renderer$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/chat/lib/message-renderer.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$workspace$2f$types$2f$workspace$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/features/workspace/types/workspace.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$dev$2d$mode$2d$context$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/dev-mode-context.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/error-codes.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
function ChatPageContent() {
    const [msg, setMsg] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [workspace, setWorkspace] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [messages, setMessages] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [busy, setBusy] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [useStreaming, _setUseStreaming] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(true);
    const [isTerminal, setIsTerminal] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [mounted, setMounted] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [conversationId, setConversationId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(()=>crypto.randomUUID());
    const [shouldForceScroll, setShouldForceScroll] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [userHasManuallyScrolled, setUserHasManuallyScrolled] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [subdomainInitialized, setSubdomainInitialized] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const messagesEndRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const isAutoScrolling = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(false);
    const abortControllerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const isSubmitting = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(false);
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRouter"])();
    const { showDevContent, toggleDevContent } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$dev$2d$mode$2d$context$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useDevMode"])();
    const { addEvent: addDevEvent } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$dev$2d$terminal$2d$context$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useDevTerminal"])();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        setMounted(true);
        setIsTerminal((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$workspace$2f$types$2f$workspace$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isTerminalMode"])(window.location.hostname));
    }, []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (isTerminal) {
            const savedWorkspace = sessionStorage.getItem("workspace");
            if (savedWorkspace) {
                setWorkspace(savedWorkspace);
            } else {
                // Redirect to login instead of workspace setup
                router.push("/");
                return;
            }
        }
    }, [
        isTerminal,
        router
    ]);
    // Track manual scrolling
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const messagesContainer = messagesEndRef.current?.parentElement;
        if (!messagesContainer) return;
        const handleScroll = ()=>{
            if (!isAutoScrolling.current) {
                setUserHasManuallyScrolled(true);
            }
        };
        messagesContainer.addEventListener("scroll", handleScroll);
        return ()=>messagesContainer.removeEventListener("scroll", handleScroll);
    }, [
        mounted
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const messagesContainer = messagesEndRef.current?.parentElement;
        if (messagesContainer) {
            // Force scroll if we just sent a message
            if (shouldForceScroll) {
                isAutoScrolling.current = true;
                messagesEndRef.current?.scrollIntoView({
                    behavior: "auto"
                });
                setShouldForceScroll(false);
                setUserHasManuallyScrolled(false);
                setTimeout(()=>{
                    isAutoScrolling.current = false;
                }, 300);
            } else if (!userHasManuallyScrolled) {
                isAutoScrolling.current = true;
                messagesEndRef.current?.scrollIntoView({
                    behavior: "auto"
                });
                setTimeout(()=>{
                    isAutoScrolling.current = false;
                }, 300);
            } else {
                const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
                const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
                if (isNearBottom) {
                    isAutoScrolling.current = true;
                    messagesEndRef.current?.scrollIntoView({
                        behavior: "auto"
                    });
                    setTimeout(()=>{
                        isAutoScrolling.current = false;
                    }, 300);
                }
            }
        }
    }, [
        messages,
        shouldForceScroll,
        userHasManuallyScrolled
    ]);
    const handleSubdomainInitialize = (initialMessage, initialWorkspace)=>{
        setMsg(initialMessage);
        if (initialWorkspace) {
            setWorkspace(initialWorkspace);
        }
    };
    const handleSubdomainInitialized = ()=>{
        setSubdomainInitialized(true);
    };
    async function sendMessage() {
        // Simple: Block if already submitting or no message
        if (isSubmitting.current || busy || !msg.trim()) return;
        // Lock submission immediately
        isSubmitting.current = true;
        setBusy(true);
        // Add user message
        const userMessage = {
            id: Date.now().toString(),
            type: "user",
            content: msg,
            timestamp: new Date()
        };
        setMessages((prev)=>[
                ...prev,
                userMessage
            ]);
        setMsg("");
        setShouldForceScroll(true);
        try {
            if (useStreaming) {
                await sendStreaming(userMessage);
            } else {
                await sendRegular(userMessage);
            }
        } finally{
            setBusy(false);
            isSubmitting.current = false;
        }
    }
    async function sendStreaming(userMessage) {
        let receivedAnyMessage = false;
        let timeoutId = null;
        try {
            const requestBody = isTerminal ? {
                message: userMessage.content,
                workspace,
                conversationId
            } : {
                message: userMessage.content,
                conversationId
            };
            // Create AbortController for this request
            const abortController = new AbortController();
            abortControllerRef.current = abortController;
            // Set a timeout to detect hanging requests (60 seconds)
            timeoutId = setTimeout(()=>{
                if (!receivedAnyMessage) {
                    console.error("[Chat] Request timeout - no response received in 60s");
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$dev$2d$client$2d$error$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["sendClientError"])({
                        conversationId,
                        errorType: "timeout_error",
                        data: {
                            message: "Request timeout - no response received in 60s",
                            timeoutSeconds: 60
                        },
                        addDevEvent
                    });
                    abortController.abort();
                }
            }, 60000);
            // Log outgoing request to dev terminal (dev mode only)
            if ("TURBOPACK compile-time truthy", 1) {
                addDevEvent({
                    eventName: "outgoing_request",
                    event: {
                        type: "start",
                        requestId: conversationId,
                        timestamp: new Date().toISOString(),
                        data: {
                            endpoint: "/api/claude/stream",
                            method: "POST",
                            body: requestBody
                        }
                    },
                    rawSSE: `event: outgoing_request\ndata: ${JSON.stringify({
                        endpoint: "/api/claude/stream",
                        method: "POST",
                        body: requestBody
                    })}\n\n`
                });
            }
            const response = await fetch("/api/claude/stream", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestBody),
                signal: abortController.signal
            });
            if (!response.ok) {
                // Try to read the JSON error response from backend
                let errorData = null;
                try {
                    errorData = await response.json();
                } catch  {
                    errorData = null;
                }
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$dev$2d$client$2d$error$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["sendClientError"])({
                    conversationId,
                    errorType: "http_error",
                    data: {
                        status: response.status,
                        statusText: response.statusText,
                        errorData: errorData
                    },
                    addDevEvent
                });
                // If we got structured error data, use error registry for user-friendly message
                if (errorData?.error) {
                    const userMessage = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getErrorMessage"])(errorData.error, errorData.details) || errorData.message;
                    const helpText = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getErrorHelp"])(errorData.error, errorData.details);
                    let fullMessage = userMessage;
                    if (helpText) {
                        fullMessage += `\n\n${helpText}`;
                    }
                    // Show details in development only
                    if (errorData.details && ("TURBOPACK compile-time value", "development") === "development") {
                        fullMessage += `\n\nDetails: ${JSON.stringify(errorData.details, null, 2)}`;
                    }
                    throw new Error(fullMessage);
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            if (!response.body) {
                throw new Error("No response body received from server");
            }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            // Track parse errors to detect stream corruption
            let consecutiveParseErrors = 0;
            const MAX_CONSECUTIVE_PARSE_ERRORS = 3;
            try {
                while(true){
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value);
                    const lines = chunk.split("\n");
                    let currentEvent = "";
                    let currentEventData = "";
                    for (const line of lines){
                        if (line.startsWith("event: ")) {
                            currentEvent = line.slice(7).trim();
                            currentEventData = line;
                        } else if (line.startsWith("data: ")) {
                            const dataLine = line.slice(6);
                            currentEventData += `\n${line}\n\n`;
                            // Parse JSON once
                            try {
                                const rawData = JSON.parse(dataLine);
                                // Capture to dev terminal (dev mode only)
                                if ("TURBOPACK compile-time truthy", 1) {
                                    if (currentEvent.startsWith("bridge_") && rawData.requestId && rawData.timestamp && rawData.type) {
                                        addDevEvent({
                                            eventName: currentEvent,
                                            event: rawData,
                                            rawSSE: currentEventData
                                        });
                                    } else if (currentEvent === "done") {
                                        // Capture done event, skip ping (filtered in DevTerminal)
                                        addDevEvent({
                                            eventName: currentEvent,
                                            event: {
                                                type: currentEvent,
                                                requestId: "n/a",
                                                timestamp: new Date().toISOString(),
                                                data: rawData
                                            },
                                            rawSSE: currentEventData
                                        });
                                    }
                                // Skip ping events entirely - not displayed in terminal
                                }
                                // Process bridge events for UI
                                if (currentEvent.startsWith("bridge_")) {
                                    if (rawData.requestId && rawData.timestamp && rawData.type) {
                                        const eventData = rawData;
                                        receivedAnyMessage = true;
                                        const message = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$message$2d$parser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["parseStreamEvent"])(eventData);
                                        if (message) {
                                            setMessages((prev)=>[
                                                    ...prev,
                                                    message
                                                ]);
                                        }
                                        consecutiveParseErrors = 0;
                                    } else {
                                        console.error("[Chat] Invalid SSE event structure:", rawData);
                                        consecutiveParseErrors++;
                                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$dev$2d$client$2d$error$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["sendClientError"])({
                                            conversationId,
                                            errorType: "invalid_event_structure",
                                            data: {
                                                eventName: currentEvent,
                                                rawData: rawData,
                                                consecutiveErrors: consecutiveParseErrors
                                            },
                                            addDevEvent
                                        });
                                    }
                                }
                            } catch (parseError) {
                                console.error("[Chat] Failed to parse SSE data:", {
                                    line: dataLine.slice(0, 200),
                                    error: parseError
                                });
                                consecutiveParseErrors++;
                                (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$dev$2d$client$2d$error$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["sendClientError"])({
                                    conversationId,
                                    errorType: "parse_error",
                                    data: {
                                        consecutiveErrors: consecutiveParseErrors,
                                        line: dataLine.slice(0, 200),
                                        error: parseError instanceof Error ? parseError.message : String(parseError)
                                    },
                                    addDevEvent
                                });
                                if (consecutiveParseErrors >= MAX_CONSECUTIVE_PARSE_ERRORS) {
                                    console.error("[Chat] Too many consecutive parse errors, stopping stream", consecutiveParseErrors);
                                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$dev$2d$client$2d$error$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["sendClientError"])({
                                        conversationId,
                                        errorType: "critical_parse_error",
                                        data: {
                                            consecutiveErrors: consecutiveParseErrors,
                                            message: "Too many consecutive parse errors, stopping stream"
                                        },
                                        addDevEvent
                                    });
                                    setMessages((prev)=>[
                                            ...prev,
                                            {
                                                id: Date.now().toString(),
                                                type: "sdk_message",
                                                content: {
                                                    type: "result",
                                                    is_error: true,
                                                    result: "Connection unstable: Multiple parse errors detected. Please try again or refresh the page."
                                                },
                                                timestamp: new Date()
                                            }
                                        ]);
                                    reader.cancel();
                                    break;
                                }
                            }
                            // Silently ignore all other events (raw Claude SDK events)
                            currentEvent = ""; // Reset after processing
                        }
                    }
                }
            } catch (readerError) {
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$dev$2d$client$2d$error$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["sendClientError"])({
                    conversationId,
                    errorType: "reader_error",
                    data: {
                        receivedMessages: receivedAnyMessage,
                        error: readerError instanceof Error ? readerError.message : String(readerError)
                    },
                    addDevEvent
                });
                // Connection interrupted while reading stream
                if (!receivedAnyMessage) {
                    throw new Error("Connection lost before receiving any response");
                }
                // If we got some messages, just log it and continue
                console.warn("[Chat] Stream interrupted after receiving some messages:", readerError);
            }
            // Check if we received any response at all
            if (!receivedAnyMessage) {
                throw new Error("Server closed connection without sending any response");
            }
        } catch (error) {
            // Log error to dev terminal (dev mode only)
            if (error instanceof Error && error.name !== "AbortError") {
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$dev$2d$client$2d$error$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["sendClientError"])({
                    conversationId,
                    errorType: "general_error",
                    data: {
                        errorName: error.name,
                        message: error.message,
                        stack: error.stack
                    },
                    addDevEvent
                });
            }
            // Only show error if not aborted by user
            if (error instanceof Error && error.name !== "AbortError") {
                const errorMessage = {
                    id: Date.now().toString(),
                    type: "sdk_message",
                    content: {
                        type: "result",
                        is_error: true,
                        result: error.message
                    },
                    timestamp: new Date()
                };
                setMessages((prev)=>[
                        ...prev,
                        errorMessage
                    ]);
            }
        } finally{
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            abortControllerRef.current = null;
        }
    }
    async function sendRegular(userMessage) {
        try {
            const requestBody = isTerminal ? {
                message: userMessage.content,
                workspace,
                conversationId
            } : {
                message: userMessage.content,
                conversationId
            };
            const r = await fetch("/api/claude", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestBody)
            });
            // Check for HTTP errors
            if (!r.ok) {
                let errorData = null;
                try {
                    errorData = await r.json();
                } catch  {
                    errorData = null;
                }
                if (errorData?.error) {
                    const userMessage = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getErrorMessage"])(errorData.error, errorData.details) || errorData.message;
                    const helpText = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$error$2d$codes$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getErrorHelp"])(errorData.error, errorData.details);
                    let fullMessage = userMessage;
                    if (helpText) {
                        fullMessage += `\n\n${helpText}`;
                    }
                    throw new Error(fullMessage);
                }
                throw new Error(`HTTP ${r.status}: ${r.statusText}`);
            }
            const response = await r.json();
            // Add assistant message
            const assistantMessage = {
                id: (Date.now() + 1).toString(),
                type: "sdk_message",
                content: response,
                timestamp: new Date()
            };
            setMessages((prev)=>[
                    ...prev,
                    assistantMessage
                ]);
        } catch (error) {
            const errorMessage = {
                id: (Date.now() + 1).toString(),
                type: "sdk_message",
                content: {
                    type: "result",
                    is_error: true,
                    result: error instanceof Error ? error.message : "Unknown error"
                },
                timestamp: new Date()
            };
            setMessages((prev)=>[
                    ...prev,
                    errorMessage
                ]);
        }
    }
    function startNewConversation() {
        setConversationId(crypto.randomUUID());
        setMessages([]);
    }
    function stopStreaming() {
        // Log interrupt to dev terminal before aborting (dev mode only)
        if ("TURBOPACK compile-time truthy", 1) {
            addDevEvent({
                eventName: "bridge_interrupt",
                event: {
                    type: "interrupt",
                    requestId: conversationId,
                    timestamp: new Date().toISOString(),
                    data: {
                        message: "Response interrupted by user",
                        source: "client_stop_button"
                    }
                },
                rawSSE: `event: bridge_interrupt\ndata: ${JSON.stringify({
                    type: "interrupt",
                    requestId: conversationId,
                    timestamp: new Date().toISOString(),
                    data: {
                        message: "Response interrupted by user",
                        source: "client_stop_button"
                    }
                })}\n\n`
            });
        }
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        // Reset state - request is truly stopped
        setBusy(false);
        isSubmitting.current = false;
    }
    const showTerminal = ("TURBOPACK compile-time value", "development") === "development" && showDevContent;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "h-[100dvh] flex flex-row overflow-hidden dark:bg-[#1a1a1a] dark:text-white",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: `flex-1 flex flex-col mx-auto overflow-hidden transition-all ${showTerminal ? "" : "max-w-4xl"}`,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Suspense"], {
                        fallback: null,
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$SubdomainInitializer$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SubdomainInitializer"], {
                            onInitialize: handleSubdomainInitialize,
                            onInitialized: handleSubdomainInitialized,
                            isInitialized: subdomainInitialized,
                            isMounted: mounted
                        }, void 0, false, {
                            fileName: "[project]/apps/web/app/chat/page.tsx",
                            lineNumber: 561,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/app/chat/page.tsx",
                        lineNumber: 560,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex-1 min-h-0 flex flex-col",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-black/10 dark:border-white/10",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                        className: "text-lg font-medium text-black dark:text-white",
                                        children: mounted && isTerminal ? "Chat" : "Chat"
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/app/chat/page.tsx",
                                        lineNumber: 571,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center gap-2",
                                        children: [
                                            ("TURBOPACK compile-time value", "development") === "development" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                onClick: toggleDevContent,
                                                className: "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border transition-colors text-black/60 hover:text-black/80 border-black/20 hover:border-black/40 dark:text-white/60 dark:hover:text-white/80 dark:border-white/20 dark:hover:border-white/40",
                                                title: showDevContent ? "Hide dev info (production view)" : "Show dev info (development view)",
                                                children: [
                                                    showDevContent ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$eye$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Eye$3e$__["Eye"], {
                                                        size: 14
                                                    }, void 0, false, {
                                                        fileName: "[project]/apps/web/app/chat/page.tsx",
                                                        lineNumber: 582,
                                                        columnNumber: 37
                                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$eye$2d$off$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__EyeOff$3e$__["EyeOff"], {
                                                        size: 14
                                                    }, void 0, false, {
                                                        fileName: "[project]/apps/web/app/chat/page.tsx",
                                                        lineNumber: 582,
                                                        columnNumber: 57
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        children: showDevContent ? "Dev" : "Prod"
                                                    }, void 0, false, {
                                                        fileName: "[project]/apps/web/app/chat/page.tsx",
                                                        lineNumber: 583,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/apps/web/app/chat/page.tsx",
                                                lineNumber: 576,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                onClick: ()=>router.push("/photobook"),
                                                className: "inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-black dark:text-white border border-black/20 dark:border-white/20 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors",
                                                "aria-label": "Photos",
                                                title: "Photos",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Image$3e$__["Image"], {
                                                    size: 14
                                                }, void 0, false, {
                                                    fileName: "[project]/apps/web/app/chat/page.tsx",
                                                    lineNumber: 593,
                                                    columnNumber: 17
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/app/chat/page.tsx",
                                                lineNumber: 586,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$components$2f$ui$2f$SettingsDropdown$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SettingsDropdown"], {
                                                onNewChat: startNewConversation
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/app/chat/page.tsx",
                                                lineNumber: 595,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/apps/web/app/chat/page.tsx",
                                        lineNumber: 574,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/apps/web/app/chat/page.tsx",
                                lineNumber: 570,
                                columnNumber: 11
                            }, this),
                            mounted && isTerminal && workspace && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex-shrink-0 px-6 py-3 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center text-xs",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-black/50 dark:text-white/50 font-medium",
                                            children: "site"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/app/chat/page.tsx",
                                            lineNumber: 602,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                            href: `https://${workspace}`,
                                            target: "_blank",
                                            rel: "noopener noreferrer",
                                            className: "ml-3 font-diatype-mono text-black/80 dark:text-white/80 font-medium hover:text-black dark:hover:text-white underline decoration-black/30 dark:decoration-white/30 hover:decoration-black dark:hover:decoration-white flex items-center gap-1.5 transition-colors",
                                            children: [
                                                workspace,
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$external$2d$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ExternalLink$3e$__["ExternalLink"], {
                                                    size: 12,
                                                    className: "opacity-60"
                                                }, void 0, false, {
                                                    fileName: "[project]/apps/web/app/chat/page.tsx",
                                                    lineNumber: 610,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/apps/web/app/chat/page.tsx",
                                            lineNumber: 603,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/apps/web/app/chat/page.tsx",
                                    lineNumber: 601,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/apps/web/app/chat/page.tsx",
                                lineNumber: 600,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex-1 min-h-0 overflow-y-auto p-4 space-y-2",
                                children: [
                                    messages.length === 0 && !busy && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center justify-center h-full",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "max-w-md text-center space-y-4 pb-20",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-base text-black/80 dark:text-white/80 font-medium",
                                                    children: "Tell me what to build and I'll update your site"
                                                }, void 0, false, {
                                                    fileName: "[project]/apps/web/app/chat/page.tsx",
                                                    lineNumber: 622,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "text-sm text-black/50 dark:text-white/50 font-normal space-y-1.5",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            children: '"Add a contact form"'
                                                        }, void 0, false, {
                                                            fileName: "[project]/apps/web/app/chat/page.tsx",
                                                            lineNumber: 626,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            children: '"Change the background to blue"'
                                                        }, void 0, false, {
                                                            fileName: "[project]/apps/web/app/chat/page.tsx",
                                                            lineNumber: 627,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            children: '"Make the text bigger"'
                                                        }, void 0, false, {
                                                            fileName: "[project]/apps/web/app/chat/page.tsx",
                                                            lineNumber: 628,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/apps/web/app/chat/page.tsx",
                                                    lineNumber: 625,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/apps/web/app/chat/page.tsx",
                                            lineNumber: 621,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/app/chat/page.tsx",
                                        lineNumber: 620,
                                        columnNumber: 15
                                    }, this),
                                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$message$2d$grouper$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["groupMessages"])(messages).map((group, index)=>{
                                        if (group.type === "text") {
                                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: group.messages.map((message)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$message$2d$renderer$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["renderMessage"])(message)
                                                    }, message.id, false, {
                                                        fileName: "[project]/apps/web/app/chat/page.tsx",
                                                        lineNumber: 639,
                                                        columnNumber: 23
                                                    }, this))
                                            }, `group-${index}`, false, {
                                                fileName: "[project]/apps/web/app/chat/page.tsx",
                                                lineNumber: 637,
                                                columnNumber: 19
                                            }, this);
                                        }
                                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ThinkingGroup$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ThinkingGroup"], {
                                            messages: group.messages,
                                            isComplete: group.isComplete
                                        }, `group-${index}`, false, {
                                            fileName: "[project]/apps/web/app/chat/page.tsx",
                                            lineNumber: 644,
                                            columnNumber: 22
                                        }, this);
                                    }),
                                    busy && messages.length > 0 && messages[messages.length - 1]?.type === "user" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "my-4",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-xs font-normal text-black/35 dark:text-white/35 flex items-center gap-1",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ThinkingSpinner$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ThinkingSpinner"], {}, void 0, false, {
                                                    fileName: "[project]/apps/web/app/chat/page.tsx",
                                                    lineNumber: 650,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    children: "thinking"
                                                }, void 0, false, {
                                                    fileName: "[project]/apps/web/app/chat/page.tsx",
                                                    lineNumber: 651,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/apps/web/app/chat/page.tsx",
                                            lineNumber: 649,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/app/chat/page.tsx",
                                        lineNumber: 648,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        ref: messagesEndRef
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/app/chat/page.tsx",
                                        lineNumber: 655,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/apps/web/app/chat/page.tsx",
                                lineNumber: 617,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$ChatInput$2f$ChatInputV3$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ChatInputV3"], {
                                message: msg,
                                setMessage: setMsg,
                                busy: busy,
                                abortControllerRef: abortControllerRef,
                                onSubmit: sendMessage,
                                onStop: stopStreaming,
                                config: {
                                    enableAttachments: true,
                                    enableCamera: true,
                                    maxAttachments: 5,
                                    maxFileSize: 20 * 1024 * 1024,
                                    placeholder: "Tell me what to change..."
                                }
                            }, void 0, false, {
                                fileName: "[project]/apps/web/app/chat/page.tsx",
                                lineNumber: 659,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/web/app/chat/page.tsx",
                        lineNumber: 568,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/app/chat/page.tsx",
                lineNumber: 559,
                columnNumber: 7
            }, this),
            showTerminal && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$components$2f$DevTerminal$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DevTerminal"], {}, void 0, false, {
                fileName: "[project]/apps/web/app/chat/page.tsx",
                lineNumber: 678,
                columnNumber: 24
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/app/chat/page.tsx",
        lineNumber: 558,
        columnNumber: 5
    }, this);
}
function ChatPage() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$dev$2d$mode$2d$context$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DevModeProvider"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$features$2f$chat$2f$lib$2f$dev$2d$terminal$2d$context$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DevTerminalProvider"], {
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ChatPageContent, {}, void 0, false, {
                fileName: "[project]/apps/web/app/chat/page.tsx",
                lineNumber: 687,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/apps/web/app/chat/page.tsx",
            lineNumber: 686,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/apps/web/app/chat/page.tsx",
        lineNumber: 685,
        columnNumber: 5
    }, this);
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__48408150._.js.map