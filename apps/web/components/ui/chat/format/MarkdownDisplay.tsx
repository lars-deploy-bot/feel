'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface MarkdownDisplayProps {
  content: string;
  className?: string;
}

const components: Components = {
  // Code blocks
  pre: ({ children }) => (
    <div className="my-3 rounded-md bg-black/5 border border-black/10 overflow-hidden">
      {children}
    </div>
  ),
  code: (props) => {
    const { children, className, node } = props;
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : null;
    const isInline = !node?.position;

    if (!isInline && language) {
      return (
        <>
          <div className="px-3 py-1 text-[10px] text-black/40 border-b border-black/10 font-mono">
            {language}
          </div>
          <pre className="p-3 overflow-x-auto">
            <code className="text-[13px] font-mono text-black/80 leading-relaxed">
              {children}
            </code>
          </pre>
        </>
      );
    }

    if (!isInline) {
      return (
        <pre className="p-3 overflow-x-auto">
          <code className="text-[13px] font-mono text-black/80 leading-relaxed">
            {children}
          </code>
        </pre>
      );
    }

    return (
      <code className="px-1.5 py-0.5 rounded bg-black/5 text-[13px] font-mono text-black/80">
        {children}
      </code>
    );
  },

  // Headings
  h1: ({ children }) => <h1 className="text-2xl font-semibold mb-2 mt-4">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xl font-semibold mb-2 mt-4">{children}</h2>,
  h3: ({ children }) => <h3 className="text-lg font-semibold mb-2 mt-4">{children}</h3>,
  h4: ({ children }) => <h4 className="text-base font-semibold mb-2 mt-3">{children}</h4>,
  h5: ({ children }) => <h5 className="text-sm font-semibold mb-2 mt-3">{children}</h5>,
  h6: ({ children }) => <h6 className="text-xs font-semibold mb-2 mt-3">{children}</h6>,

  // Lists
  ul: ({ children }) => <ul className="list-disc ml-6 my-2">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal ml-6 my-2">{children}</ol>,
  li: ({ children }) => <li className="mb-1">{children}</li>,

  // Blockquotes
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-black/20 pl-4 my-2 italic text-black/70">
      {children}
    </blockquote>
  ),

  // Links
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:text-blue-800 underline"
    >
      {children}
    </a>
  ),

  // Paragraphs
  p: ({ children }) => <p className="mb-3">{children}</p>,

  // Emphasis
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,

  // Horizontal rule
  hr: () => <hr className="my-4 border-black/10" />,

  // Tables (from remark-gfm)
  table: ({ children }) => (
    <div className="overflow-x-auto my-3">
      <table className="min-w-full border-collapse border border-black/10">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-black/5">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-black/10">{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-xs font-semibold border border-black/10">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-sm border border-black/10">{children}</td>
  ),
};

/**
 * MarkdownDisplay component - renders markdown text using react-markdown
 */
export function MarkdownDisplay({ content, className = '' }: MarkdownDisplayProps) {
  return (
    <div className={`text-black font-thin leading-relaxed ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
