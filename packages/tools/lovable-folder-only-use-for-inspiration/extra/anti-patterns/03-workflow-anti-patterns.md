# Workflow Anti-Patterns

## Process Mistakes to Avoid

---

## 1. Changing Unrelated Code
**Problem:** User asks for button color change, AI refactors entire app
**Solution:** Make minimal changes - only what's requested

---

## 2. Over-Engineering
**Problem:** Adding features user didn't ask for "just in case"
**Solution:** Build exactly what's requested, nothing more

---

## 3. Not Using Existing Context
**Problem:** Re-reading files already in useful-context
**Solution:** Always check context first

---

## 4. Sequential Tool Calls
**Problem:** Calling tools one by one when they could be parallel
**Solution:** Batch all independent operations

---

## 5. Assuming Requirements
**Problem:** Guessing what user wants instead of asking
**Solution:** Ask clarifying questions when unclear
