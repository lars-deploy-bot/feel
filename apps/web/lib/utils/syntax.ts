/**
 * Syntax highlighting tokenizer
 *
 * Each language defines its own ordered matcher list.
 * Unknown languages fall back to DEFAULT_MATCHERS.
 */

export type TokenType =
  | "keyword"
  | "string"
  | "comment"
  | "number"
  | "operator"
  | "function"
  | "property"
  | "tag"
  | "default"

export interface Token {
  type: TokenType
  value: string
}

export const TOKEN_COLORS: Record<TokenType, string> = {
  keyword: "text-purple-600 dark:text-purple-400",
  string: "text-emerald-600 dark:text-emerald-400",
  comment: "text-neutral-400 dark:text-neutral-600",
  number: "text-amber-600 dark:text-amber-400",
  operator: "text-sky-600 dark:text-sky-300",
  function: "text-sky-700 dark:text-sky-400",
  property: "text-neutral-700 dark:text-neutral-300",
  tag: "text-rose-600 dark:text-rose-400",
  default: "text-neutral-600 dark:text-neutral-400",
}

interface Matcher {
  type: TokenType
  pattern: RegExp
}

// --- Shared building blocks ---

const COMMENT_C: Matcher = { type: "comment", pattern: /^(\/\/.*|\/\*[\s\S]*?\*\/|{\/\*[\s\S]*?\*\/}|<!--[\s\S]*?-->)/ }
const COMMENT_HASH: Matcher = { type: "comment", pattern: /^(#.*)/ }
const STRINGS: Matcher = { type: "string", pattern: /^("[^"]*"|'[^']*'|`[^`]*`)/ }
const NUMBERS: Matcher = { type: "number", pattern: /^(\d+\.?\d*)/ }
const OPERATORS: Matcher = { type: "operator", pattern: /^([=+\-*/<>!&|?:]+|=>)/ }
const FUNCTION_CALL: Matcher = { type: "function", pattern: /^([\w$]+)(?=\s*\()/ }
const IDENTIFIER: Matcher = { type: "property", pattern: /^([\w$]+)/ }

function keywords(pattern: RegExp): Matcher {
  return { type: "keyword", pattern }
}

// --- Language-specific matcher lists ---

const JS_TS_KEYWORDS = keywords(
  /^(import|export|from|const|let|var|function|return|if|else|for|while|class|extends|new|this|async|await|try|catch|throw|typeof|instanceof|default|switch|case|break|continue|interface|type|enum|implements|public|private|protected|static|readonly|as|is)\b/,
)

const JS_TS: Matcher[] = [COMMENT_C, STRINGS, JS_TS_KEYWORDS, NUMBERS, OPERATORS, FUNCTION_CALL, IDENTIFIER]

const PYTHON: Matcher[] = [
  COMMENT_HASH,
  STRINGS,
  keywords(
    /^(def|class|import|from|return|if|elif|else|for|while|try|except|finally|with|as|in|not|and|or|is|None|True|False|yield|lambda|raise|pass|break|continue|global|nonlocal|assert|del)\b/,
  ),
  NUMBERS,
  OPERATORS,
  FUNCTION_CALL,
  IDENTIFIER,
]

const GO: Matcher[] = [
  COMMENT_C,
  STRINGS,
  keywords(
    /^(func|package|import|return|if|else|for|range|switch|case|default|break|continue|go|defer|select|chan|map|struct|interface|type|var|const|nil|true|false|make|len|append|error)\b/,
  ),
  NUMBERS,
  OPERATORS,
  FUNCTION_CALL,
  IDENTIFIER,
]

const RUST: Matcher[] = [
  COMMENT_C,
  STRINGS,
  keywords(
    /^(fn|let|mut|pub|use|mod|struct|enum|impl|trait|where|match|if|else|for|while|loop|return|break|continue|self|Self|super|crate|as|in|ref|move|async|await|dyn|type|const|static|unsafe|extern)\b/,
  ),
  NUMBERS,
  OPERATORS,
  FUNCTION_CALL,
  IDENTIFIER,
]

const SQL: Matcher[] = [
  { type: "comment", pattern: /^(--.*)/ },
  STRINGS,
  keywords(
    /^(SELECT|FROM|WHERE|INSERT|INTO|UPDATE|SET|DELETE|CREATE|ALTER|DROP|TABLE|INDEX|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|NULL|IS|IN|EXISTS|BETWEEN|LIKE|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|AS|DISTINCT|UNION|ALL|VALUES|SET|BEGIN|COMMIT|ROLLBACK|PRIMARY|KEY|FOREIGN|REFERENCES|CASCADE|CONSTRAINT|DEFAULT|CHECK|UNIQUE)\b/i,
  ),
  NUMBERS,
  OPERATORS,
  FUNCTION_CALL,
  IDENTIFIER,
]

const BASH: Matcher[] = [
  COMMENT_HASH,
  STRINGS,
  keywords(
    /^(if|then|else|elif|fi|for|do|done|while|until|case|esac|function|return|local|export|source|exit|echo|read|set|unset|shift|trap|eval|exec)\b/,
  ),
  { type: "property", pattern: /^(\$[\w{]+}?)/ },
  NUMBERS,
  OPERATORS,
  FUNCTION_CALL,
  IDENTIFIER,
]

const HTML: Matcher[] = [
  COMMENT_C,
  STRINGS,
  { type: "tag", pattern: /^(<\/?[\w-]+|>|\/>)/ },
  JS_TS_KEYWORDS,
  NUMBERS,
  OPERATORS,
  FUNCTION_CALL,
  IDENTIFIER,
]

const CSS: Matcher[] = [
  COMMENT_C,
  STRINGS,
  { type: "string", pattern: /^(#[0-9a-fA-F]{3,8})\b/ },
  { type: "property", pattern: /^([\w-]+)(?=\s*:)/ },
  NUMBERS,
  OPERATORS,
  IDENTIFIER,
]

const YAML: Matcher[] = [
  COMMENT_HASH,
  STRINGS,
  { type: "property", pattern: /^([\w.-]+)(?=\s*:)/ },
  keywords(/^(true|false|null|yes|no)\b/i),
  NUMBERS,
  IDENTIFIER,
]

const LATEX: Matcher[] = [
  { type: "comment", pattern: /^(%.*$)/ },
  { type: "keyword", pattern: /^(\\[a-zA-Z@]+\*?)/ },
  { type: "operator", pattern: /^(\\[\\$%&#_{}\s])/ },
  { type: "operator", pattern: /^(\$\$?|\\\[|\\\]|\\\(|\\\))/ },
  { type: "operator", pattern: /^([{}[\]])/ },
  { type: "default", pattern: /^([^\s\\%${}[\]]+|\s+)/ },
]

// Default: JS/TS-like highlighting (reasonable for unknown languages)
const DEFAULT_MATCHERS: Matcher[] = JS_TS

const LANGUAGE_MATCHERS: Record<string, Matcher[]> = {
  typescript: JS_TS,
  javascript: JS_TS,
  json: [STRINGS, NUMBERS, OPERATORS, IDENTIFIER],
  python: PYTHON,
  go: GO,
  rust: RUST,
  sql: SQL,
  bash: BASH,
  html: HTML,
  vue: HTML,
  svelte: HTML,
  css: CSS,
  scss: CSS,
  yaml: YAML,
  latex: LATEX,
  graphql: [
    COMMENT_HASH,
    STRINGS,
    keywords(
      /^(query|mutation|subscription|fragment|on|type|input|enum|scalar|interface|union|extend|schema|directive)\b/,
    ),
    NUMBERS,
    OPERATORS,
    FUNCTION_CALL,
    IDENTIFIER,
  ],
}

export function tokenizeLine(line: string, language: string): Token[] {
  if (!line.trim()) {
    return [{ type: "default", value: line || " " }]
  }

  const matchers = LANGUAGE_MATCHERS[language] ?? DEFAULT_MATCHERS
  const tokens: Token[] = []
  let remaining = line

  while (remaining.length > 0) {
    let matched = false

    for (const matcher of matchers) {
      const match = remaining.match(matcher.pattern)
      if (match) {
        tokens.push({ type: matcher.type, value: match[0] })
        remaining = remaining.slice(match[0].length)
        matched = true
        break
      }
    }

    if (!matched) {
      tokens.push({ type: "default", value: remaining[0] })
      remaining = remaining.slice(1)
    }
  }

  return tokens
}
