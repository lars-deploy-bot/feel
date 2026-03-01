/**
 * Skill frontmatter parser for SKILL.md files.
 *
 * SKILL.md format (Claude Agent SDK standard):
 * ```
 * ---
 * name: skill-name
 * description: Short description for UI
 * ---
 *
 * # Skill Title
 *
 * Full prompt content...
 * ```
 */

/**
 * Skill frontmatter structure parsed from YAML header
 */
export interface SkillFrontmatter {
  name: string
  description: string
}

/**
 * Partial frontmatter for parsing (fields optional during parse)
 */
export interface PartialSkillFrontmatter {
  name?: string
  description?: string
}

/**
 * Complete parsed skill with frontmatter and body content
 */
export interface ParsedSkill {
  frontmatter: SkillFrontmatter
  /** Full markdown body (everything after frontmatter) - the actual prompt */
  body: string
}

interface SkillParseError {
  error: string
}

interface SkillFrontmatterSection {
  body: string
  lines: string[]
}

interface SkillParseSuccess {
  parsed: ParsedSkill
}

interface FrontmatterParseSuccess {
  frontmatter: PartialSkillFrontmatter
}

/**
 * Parse YAML frontmatter and body from a SKILL.md file.
 * Returns null if no valid frontmatter found or required fields missing.
 *
 * @param content - Raw markdown content with YAML frontmatter
 * @returns Parsed skill with frontmatter and body, or null if invalid
 */
export function parseSkillContent(content: string): ParsedSkill | null {
  const result = parseSkillContentInternal(content)
  if ("error" in result) {
    return null
  }
  return result.parsed
}

/**
 * Validate SKILL.md content and return user-friendly error text for invalid frontmatter.
 *
 * @param content - Raw markdown content with YAML frontmatter
 * @returns Null when valid, otherwise a descriptive error
 */
export function validateSkillContent(content: string): string | null {
  const result = parseSkillContentInternal(content)
  return "error" in result ? result.error : null
}

function parseSkillContentInternal(content: string): SkillParseSuccess | SkillParseError {
  const section = extractFrontmatterSection(content)
  if ("error" in section) {
    return section
  }

  const frontmatterResult = parseFrontmatter(section.lines)
  if ("error" in frontmatterResult) {
    return frontmatterResult
  }
  const frontmatter = frontmatterResult.frontmatter

  if (!frontmatter.name) {
    return { error: 'missing required field "name" in frontmatter' }
  }

  // Name must be lowercase a-z/0-9 with optional hyphens between, no spaces or uppercase
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(frontmatter.name)) {
    return {
      error: `invalid name "${frontmatter.name}" — must be lowercase, no spaces, only a-z, 0-9, and hyphens (e.g. "my-skill")`,
    }
  }

  if (!frontmatter.description) {
    return { error: 'missing required field "description" in frontmatter' }
  }

  return {
    parsed: {
      frontmatter: {
        name: frontmatter.name,
        description: frontmatter.description,
      },
      body: section.body,
    },
  }
}

/**
 * Extract frontmatter lines and markdown body from SKILL.md content.
 */
function extractFrontmatterSection(content: string): SkillFrontmatterSection | SkillParseError {
  const lines = content.split(/\r?\n/)
  if (lines[0]?.trim() !== "---") {
    return { error: "missing YAML frontmatter (must start with ---)" }
  }

  let closingIndex = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      closingIndex = i
      break
    }
  }

  if (closingIndex === -1) {
    return { error: "missing closing --- for YAML frontmatter" }
  }

  return {
    lines: lines.slice(1, closingIndex),
    body: lines
      .slice(closingIndex + 1)
      .join("\n")
      .trim(),
  }
}

/**
 * Parse frontmatter lines into key-value pairs.
 *
 * @param frontmatterLines - YAML lines without --- delimiters
 * @returns Partial frontmatter object
 */
function parseFrontmatter(frontmatterLines: string[]): FrontmatterParseSuccess | SkillParseError {
  const result: PartialSkillFrontmatter = {}

  for (const [index, line] of frontmatterLines.entries()) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) {
      continue
    }

    const colonIndex = line.indexOf(":")
    if (colonIndex === -1) {
      continue
    }

    const key = line.slice(0, colonIndex).trim()
    const rawValue = line.slice(colonIndex + 1).trim()
    const parsedValue = parseYamlScalar(rawValue, line, colonIndex, index + 1)
    if (!parsedValue) {
      continue
    }
    if (typeof parsedValue === "object" && "error" in parsedValue) {
      return parsedValue
    }
    const value = parsedValue

    switch (key) {
      case "name":
      case "description":
        result[key] = value
        break
    }
  }

  return { frontmatter: result }
}

function parseYamlScalar(
  rawValue: string,
  fullLine: string,
  keyColonIndex: number,
  lineNumber: number,
): string | SkillParseError | null {
  if (!rawValue) {
    return null
  }

  const quote = rawValue[0]
  if (quote === `"` || quote === `'`) {
    if (!rawValue.endsWith(quote) || rawValue.length < 2) {
      return null
    }
    return rawValue.slice(1, -1)
  }

  // In plain scalars, ": " indicates a nested mapping and must be quoted for our single-line fields.
  const nestedColonMatch = /:\s/.exec(rawValue)
  if (nestedColonMatch?.index !== undefined) {
    const valueStart = fullLine.indexOf(rawValue, keyColonIndex + 1)
    const column = valueStart + nestedColonMatch.index + 1
    return {
      error: `invalid YAML: unquoted ":" in value at line ${lineNumber} column ${column} (wrap the value in quotes)`,
    }
  }

  return rawValue
}

/**
 * Convert skill ID (directory name) to display name.
 * Example: "revise-code" -> "Revise Code"
 *
 * @param id - Skill ID (kebab-case directory name)
 * @returns Human-readable display name
 */
export function skillIdToDisplayName(id: string): string {
  return id
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}
