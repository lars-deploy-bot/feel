# Persona Maker Skill

Generates real famous person personas who excel at exactly what you need - whether it's design, planning, innovation, or any other excellence.

## Overview

This skill identifies when a user needs guidance on how an excellent person would approach a task, then generates a detailed persona of a real famous person who excels at exactly that.

The tool isn't biased towards any person or field - it picks whoever best matches the task and desired qualities.

## How It Works

1. **Detection**: Watches for requests about doing something excellently
2. **Suggestion**: Proposes generating a famous person persona
3. **Gathering**: Collects task query, desired qualities, and context
4. **Generation**: Uses `mcp__tools__generate_persona` to create persona
5. **Output**: Real person with actionable insights

## Tool Details

**Tool Name**: `mcp__tools__generate_persona`

**Input Parameters**:
- `query` (required): What would the best person in this world do?
- `style_preferences` (required): What makes it lovable? What qualities?
- `extra_things_to_know` (optional): Project context

**Output Profile**:
- Famous person name and why they're perfect for this task
- Qualities & Skills relevant to this task
- How They Approach Problems
- What Makes Them Different
- What They're Good At
- How They Feel About Things (intuition)
- What They Value (core principles)
- How They Check Their Work:
  - Standards they hold
  - Their evaluation process
  - Red flags (what they'd reject)

## Questions to Ask

- How would this person approach this task?
- What would this person focus on?
- What are their non-negotiables?
- How would this person evaluate quality?
- What would this person immediately reject?
