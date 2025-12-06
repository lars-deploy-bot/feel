---
name: Design Singer
description: Design System principles for building robust, type-safe, accessible component libraries.
---

# Design System Principles

Apply these principles when reviewing, designing, or building component libraries and design systems.

## Props & Types

- **Have props, but not too many.** Avoid booleans - use discriminated unions or string literals instead.
- **Embrace type-safety.** Like really, be even more type-safe than that.
- **Lint for things you can't enforce on type level.**
- **Types are more important than documentation** - but do JSDoc too!

## Composition & Patterns

- **Favor Composition.** Compound Components are great, but must be type-safe.
- **Have patterns, not just primitives.** Build coherent solutions, not just building blocks.
- **Optimize for 90%, not 100%.** Know your use-cases and build for them specifically.
- **Headless is good if possible.** Separate logic from presentation.
- **Offer Providers to inject behavior.** Allow customization through context.

## Constraints & Consistency

- **Constraints are good, but need to be balanced and intentional.**
- **Consistency is key** - both visually and for component APIs.
- **Choose defaults wisely, and be opinionated.**
- **Have one way to do a thing.** Avoid redundancy, don't repeat yourself.

## Design Tokens & Performance

- **Design tokens first, components second.** Foundation before structure.
- **Performance isn't optional.** Optimize from the start.

## Accessibility

- **Have a11y built-in, not bolt-on.** Accessibility is a requirement, not a feature.
- **Tooltip Components should not exist.** Use proper disclosure patterns.
- **data-test-id is an a11y smell.** If you need test IDs, your a11y is probably lacking.

## State & Control

- **State syncing is the root of all evil.** Minimize derived state.
- **Controlled first, uncontrolled if necessary.** And make it typed.

## Escape Hatches & Internals

- **Be pragmatic and allow escape hatches, but don't leak internals.**

## Testing & Quality

- **Do visual regression testing for important things.**
- **Build for the future of React.** Use modern patterns and concurrent features.

## Adoption & Contribution

- **Adoption is cultural, not technical.** Great APIs matter, but so does documentation.
- **Ship Codemods.** Make migration painless.
- **Welcome external contributions.** Have good guides for them.
