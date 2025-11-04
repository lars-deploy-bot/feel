# Persona Maker Skill

Generates real famous person personas who excel at exactly what you need - whether it's design, critical thinking, planning, innovation, or any other excellence.

## What It Does

When someone needs guidance on how to approach something well, this skill:
- Identifies the specific qualities or excellence needed
- Finds the RIGHT famous person known for excelling at that
- Returns specific insights: their qualities, approach, values, intuition, and standards
- Helps you think like that person would

## The Insight

"Lovable" can come from any discipline. The tool generates whoever fits your specific task and values - not biased towards any particular person or field. Could be designers, engineers, artists, scientists, writers, leaders, craftspeople, or anyone known for excellence.

## How It Works

1. **Detection**: Watches for requests about doing something excellently
2. **Suggestion**: Proposes generating a famous person persona
3. **Gathering**: Collects query, desired qualities, and context
4. **Generation**: Uses `mcp__tools__generate_persona` to create persona
5. **Output**: Real person with actionable insights

## Tool Details

**Tool Name**: `mcp__tools__generate_persona`

**Parameters**:
- `query` (required): What would the best person in this world do?
- `style_preferences` (required): What makes it lovable? What qualities?
- `extra_things_to_know` (optional): Project context

**Generated Profile Includes**:
- Famous person name
- Why they're perfect for this task
- **Qualities & Skills** - what matters for this task
- **How They Approach Problems** - their thinking method
- **What Makes Them Different** - their competitive advantage
- **What They're Good At** - specific excellences
- **How They Feel About Things** - their intuition
- **What They Value** - core principles
- **How They Check Their Work**:
  - Standards they hold
  - Their evaluation process
  - Red flags (what they'd reject)

## What You Get

Each persona includes:
- **Famous person name** - whoever best fits your task
- **Qualities & Skills** - what matters for YOUR specific task
- **How They Approach Problems** - their thinking method
- **What Makes Them Different** - their edge or unique perspective
- **What They're Good At** - specific areas of excellence
- **How They Feel About Things** - their intuition
- **What They Value** - their core principles
- **How They Check Their Work** - their standards and what they'd reject

The person chosen depends entirely on your task and values, not biased towards any field or person.

## Use Cases

- **"How would this person approach this task?"**
- **"What would this person focus on?"**
- **"What are their non-negotiables?"**
- **"How would this person evaluate quality?"**
- **"What would this person immediately reject?"**

## Files

- `index.md` - Skill prompt and usage guidelines
- `README.md` - This documentation

## Related Tools

- `mcp__tools__generate_persona` - Generates famous person personas for specific tasks
