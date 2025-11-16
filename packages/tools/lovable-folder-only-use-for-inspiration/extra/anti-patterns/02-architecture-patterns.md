# Architecture Anti-Patterns

## System Design Mistakes to Avoid

---

## 1. God Components
**Problem:** One component does everything
**Solution:** Single Responsibility Principle - split into focused components

---

## 2. Tight Coupling
**Problem:** Components directly depend on each other's internals
**Solution:** Use props, context, or events for communication

---

## 3. No Separation of Concerns
**Problem:** UI logic mixed with business logic
**Solution:** Extract hooks for business logic

---

## 4. Circular Dependencies
**Problem:** File A imports B, B imports A
**Solution:** Extract shared code to separate file

---

## 5. Hardcoded Configuration
**Problem:** API URLs, keys in components
**Solution:** Environment variables and configuration files
