# Code Anti-Patterns to Avoid

## Common Mistakes and Their Solutions

---

## 1. Inline Styles Instead of Design System
```typescript
// ❌ ANTI-PATTERN
<button className="bg-blue-500 text-white">Click</button>

// ✅ CORRECT
<button className="bg-primary text-primary-foreground">Click</button>
```

---

## 2. Duplicated Code
```typescript
// ❌ ANTI-PATTERN: Copy-paste components
// ✅ CORRECT: Extract reusable component
```

---

## 3. Missing Error Handling
```typescript
// ❌ ANTI-PATTERN
const data = await fetchData();

// ✅ CORRECT
try {
  const data = await fetchData();
} catch (error) {
  console.error(error);
  toast.error('Failed to load data');
}
```

---

## 4. Prop Drilling
```typescript
// ❌ ANTI-PATTERN: Passing props through 5+ levels
// ✅ CORRECT: Use Context or state management
```

---

## 5. Massive Components
```typescript
// ❌ ANTI-PATTERN: 500+ line components
// ✅ CORRECT: Split into focused sub-components
```
