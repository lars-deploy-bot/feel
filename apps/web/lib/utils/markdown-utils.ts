/**
 * Markdown detection and parsing utilities
 */

/**
 * Check if text contains markdown syntax
 */
export const hasMarkdown = (text: string): boolean => {
  if (!text) return false;

  const patterns = [
    /^#{1,6}\s/m,              // Headers
    /```[\s\S]*?```/,          // Code blocks
    /`[^`]+`/,                 // Inline code
    /\*\*[^*]+\*\*/,           // Bold
    /__[^_]+__/,               // Bold (alt)
    /\*[^*]+\*/,               // Italic
    /_[^_]+_/,                 // Italic (alt)
    /^\s*[-*+]\s/m,            // Unordered lists
    /^\s*\d+\.\s/m,            // Ordered lists
    /\[.+?\]\(.+?\)/,          // Links
    /!\[.*?\]\(.+?\)/,         // Images
    /^>\s/m,                   // Blockquotes
    /^\s*[-*_]{3,}\s*$/m,      // Horizontal rules
    /~~[^~]+~~/,               // Strikethrough
  ];

  return patterns.some(pattern => pattern.test(text));
};

/**
 * Check if text contains code blocks
 */
export const hasCodeBlock = (text: string): boolean => {
  return /```[\s\S]*?```/.test(text);
};

/**
 * Check if text is primarily a code block
 */
export const isPrimaryCodeBlock = (text: string): boolean => {
  const codeBlockMatch = text.match(/```[\s\S]*?```/g);
  if (!codeBlockMatch) return false;

  const codeBlockLength = codeBlockMatch.join('').length;
  const totalLength = text.length;

  return codeBlockLength / totalLength > 0.7;
};

/**
 * Extract language from code block
 */
export const extractCodeLanguage = (codeBlock: string): string | null => {
  const match = codeBlock.match(/```(\w+)/);
  return match ? match[1] : null;
};

/**
 * Check if text contains inline code
 */
export const hasInlineCode = (text: string): boolean => {
  return /`[^`]+`/.test(text);
};

/**
 * Detect markdown complexity level
 */
export const getMarkdownComplexity = (text: string): 'none' | 'simple' | 'complex' => {
  if (!hasMarkdown(text)) return 'none';

  const complexPatterns = [
    /```[\s\S]*?```/,          // Code blocks
    /^\s*[-*+]\s/m,            // Lists
    /\[.+?\]\(.+?\)/,          // Links
    /!\[.*?\]\(.+?\)/,         // Images
    /^\|.*\|/m,                // Tables
  ];

  const hasComplexElements = complexPatterns.some(pattern => pattern.test(text));
  return hasComplexElements ? 'complex' : 'simple';
};
