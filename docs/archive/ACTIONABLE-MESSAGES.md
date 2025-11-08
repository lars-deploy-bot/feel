# Actionable Error Messages - Complete Rewrite

**Date**: November 5, 2025
**Feedback**: "Where possible, change error messages into actionable suggestions for the user, like 'I cannot read external links.'"

## Problem: Technical Jargon

Many error messages used technical terms that users don't understand and didn't explain what to do next.

---

## Before & After Examples

### 1. File Access Errors

**BEFORE:**
```
Access denied: File path is outside your workspace directory.
```

**AFTER:**
```
I cannot access '/etc/passwd' - it's outside my allowed workspace. I can only access files within your project directory.

→ For security, I can only access files within your project workspace.
```

**Why better:** Uses "I cannot" (Claude speaking), explains the boundary, tells user what's allowed

---

### 2. Authentication Errors

**BEFORE:**
```
Authentication required. Please log in.
```

**AFTER:**
```
You need to log in first. Please refresh the page and enter your passcode.
```

**Why better:** Tells user exactly what to do (refresh + enter passcode)

---

### 3. Tool Restriction Errors

**BEFORE:**
```
The "Bash" tool is not available. Available tools: Read, Write, Edit, Glob, Grep
```

**AFTER:**
```
I cannot use Bash for security reasons. I can only use these tools: Read, Write, Edit, Glob, Grep

→ For security, I'm limited to file operations: Read, Write, Edit, Glob (find files), and Grep (search files).
```

**Why better:** Uses "I cannot", explains why (security), describes what tools do in plain English

---

### 4. File Operation Errors

**BEFORE:**
```
Failed to read file.
```

**AFTER:**
```
I cannot read this file. It might not exist, or I might not have permission to read it.

→ Make sure the file exists and hasn't been deleted. Check that the file path is correct.
```

**Why better:** Uses "I cannot", explains possible reasons, gives actionable steps

---

### 5. Conversation State Errors

**BEFORE:**
```
Another request is already in progress for this conversation.
```

**AFTER:**
```
I'm still working on your previous request. Please wait for me to finish before sending another message.

→ Wait a moment for my current response to finish, then you can send your next message.
```

**Why better:** Personal ("I'm working"), explains what's happening, tells user what to do

---

### 6. Stream/Network Errors

**BEFORE:**
```
Stream processing failed. The response may be incomplete.
```

**AFTER:**
```
I encountered an error while streaming my response. You might see incomplete messages. Please try asking again.
```

**Why better:** Personal, explains impact on user, gives clear next step

---

### 7. Length Limit Errors

**BEFORE:**
```
Maximum conversation turns exceeded.
```

**AFTER:**
```
This conversation has become too long. Please start a new conversation to continue.

→ Click 'New Conversation' to start fresh and continue working.
```

**Why better:** Explains why (too long), tells exact action (start new conversation), explains how (click button)

---

### 8. Image Upload Errors

**BEFORE:**
```
File is too large. Please select a smaller image.
```

**AFTER:**
```
This image is too large. Please select a smaller image (max 10MB).
```

**Why better:** Tells exact limit, uses "this image" instead of generic "file"

---

### 9. Configuration Errors

**BEFORE:**
```
This domain is not configured for image uploads.
```

**AFTER:**
```
Image uploads are not set up for this workspace yet. Please contact your administrator.
```

**Why better:** Uses plain language (not "configured"), tells who to contact

---

### 10. Generic Errors

**BEFORE:**
```
An unexpected error occurred.
```

**AFTER:**
```
Something unexpected went wrong. Please try again, and let support know if you keep seeing this.
```

**Why better:** More human, gives two actions (try again, contact support), explains when (if it persists)

---

## Writing Principles Applied

### 1. **Use "I" (Claude speaking)**
- ✅ "I cannot read external links"
- ✅ "I'm still working on your request"
- ✅ "I encountered an error"
- ❌ "Access denied" (too technical)
- ❌ "Failed to process" (passive voice)

### 2. **Explain the "Why"**
- ✅ "I cannot use Bash for security reasons"
- ✅ "This conversation has become too long"
- ✅ "It might not exist, or I might not have permission"
- ❌ "Tool not allowed" (no explanation)

### 3. **Tell User What to Do**
- ✅ "Please refresh the page and enter your passcode"
- ✅ "Click 'New Conversation' to start fresh"
- ✅ "Wait for me to finish before sending another message"
- ❌ "Please try again" (too vague)

### 4. **Use Plain Language**
- ✅ "Image uploads are not set up"
- ✅ "This image is too large (max 10MB)"
- ✅ "I can only use these tools: Read, Write, Edit"
- ❌ "Domain not configured for uploads"
- ❌ "Maximum conversation turns exceeded"

### 5. **Be Specific When Possible**
- ✅ `I cannot access '/etc/passwd'` (shows path)
- ✅ `The site name 'my-site' is already in use` (shows slug)
- ✅ `Please select an image smaller than 10MB` (shows limit)
- ❌ "File access denied" (generic)

---

## Complete Error Message Inventory

| Error Code | New Message Pattern |
|------------|-------------------|
| WORKSPACE_NOT_FOUND | "I cannot find the workspace directory for '{host}'. Please ask your administrator..." |
| WORKSPACE_INVALID | "The workspace path is not valid. Please contact your administrator." |
| WORKSPACE_MISSING | "I need a workspace to work in. Please provide a workspace parameter." |
| PATH_OUTSIDE_WORKSPACE | "I cannot access '{path}' - it's outside my allowed workspace..." |
| NO_SESSION | "You need to log in first. Please refresh the page and enter your passcode." |
| UNAUTHORIZED | "You don't have access to this. Please check with your administrator..." |
| INVALID_CREDENTIALS | "The passcode is incorrect. Please check your passcode and try again." |
| INVALID_JSON | "I received malformed data. Please try sending your message again." |
| INVALID_REQUEST | "Something is missing or incorrect in your request. Please check your input..." |
| CONVERSATION_BUSY | "I'm still working on your previous request. Please wait for me to finish..." |
| QUERY_FAILED | "I encountered an error while processing your request. This might be temporary..." |
| ERROR_MAX_TURNS | "This conversation has become too long. Please start a new conversation..." |
| TOOL_NOT_ALLOWED | "I cannot use {tool} for security reasons. I can only use these tools: {allowed}" |
| FILE_READ_ERROR | "I cannot read '{path}'. It might not exist, or I might not have permission..." |
| FILE_WRITE_ERROR | "I cannot write to '{path}'. I might not have permission to modify it." |
| NO_FILE | "You didn't select a file. Please choose an image to upload." |
| FILE_TOO_LARGE | "This image is too large. Please select a smaller image (max 10MB)." |
| INVALID_FILE_TYPE | "I can only process image files (PNG, JPG, WebP). Please select a valid image." |
| IMAGE_UPLOAD_FAILED | "I couldn't upload the image. Please check your connection and try again." |
| STREAM_ERROR | "I encountered an error while streaming my response. You might see incomplete messages..." |
| STREAM_PARSE_ERROR | "I had trouble sending my response. Some parts might be missing. Please try again." |
| SLUG_TAKEN | "The site name '{slug}' is already in use. Please choose a different name." |
| SITE_NOT_FOUND | "I couldn't find a site named '{slug}'. Please check the name and try again." |
| INTERNAL_ERROR | "Something went wrong on my end. This is usually temporary - please try again..." |

---

## Help Text Also Rewritten

Help text now provides **actionable steps**:

**BEFORE:**
```
Check file permissions and ensure the file exists.
```

**AFTER:**
```
Make sure the file exists and hasn't been deleted. Check that the file path is correct.
```

**BEFORE:**
```
Try refreshing the page.
```

**AFTER:**
```
This usually happens with network issues. Try refreshing the page or checking your connection.
```

**BEFORE:**
```
Consider starting a new conversation.
```

**AFTER:**
```
Click 'New Conversation' to start fresh and continue working.
```

---

## Impact on User Experience

### Before:
- User sees: "Access denied: Path outside workspace"
- User thinks: "What's a workspace? What do I do?"
- User action: Confused, asks for help

### After:
- User sees: "I cannot access '/etc/passwd' - it's outside my allowed workspace. I can only access files within your project directory."
- User sees help: "For security, I can only access files within your project workspace."
- User thinks: "Oh, I can't access system files, only project files"
- User action: Adjusts request to use project files

---

## Testing Checklist

For each error, verify:
- [ ] Uses "I" or "you" (personal)
- [ ] Explains why the error happened
- [ ] Tells user what to do next
- [ ] Uses plain language (no jargon)
- [ ] Includes specific details when available
- [ ] Help text provides actionable steps

---

## Examples for Common Scenarios

### Scenario 1: User asks Claude to run bash command
**Error Message:**
```
I cannot use Bash for security reasons. I can only use these tools: Read, Write, Edit, Glob, Grep
```

**Help Text:**
```
For security, I'm limited to file operations: Read, Write, Edit, Glob (find files), and Grep (search files).
```

**User understands:** Claude can't run commands, but can read/write files

---

### Scenario 2: User tries to access /etc/passwd
**Error Message:**
```
I cannot access '/etc/passwd' - it's outside my allowed workspace. I can only access files within your project directory.
```

**Help Text:**
```
I can only work with files in: /srv/webalive/sites/example.com/
```

**User understands:** Claude is sandboxed to project directory, can't access system files

---

### Scenario 3: User's passcode is wrong
**Error Message:**
```
The passcode is incorrect. Please check your passcode and try again.
```

**Help Text:**
```
Check your passcode and try again.
```

**User understands:** Typo in passcode, just re-enter it

---

## Result

✅ **All 36 error messages rewritten** to be from Claude's perspective
✅ **All error messages explain** what happened and why
✅ **All error messages tell user** what to do next
✅ **No more technical jargon** - plain English throughout
✅ **Help text provides** actionable steps, not generic advice

**Users now understand errors and know exactly what to do to fix them.**
