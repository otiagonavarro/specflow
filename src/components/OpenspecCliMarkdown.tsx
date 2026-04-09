import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface OpenspecCliMarkdownProps {
  source: string;
  className?: string;
}

/**
 * Renders OpenSpec CLI stdout (markdown + GFM) as HTML.
 */
export default function OpenspecCliMarkdown({ source, className = '' }: OpenspecCliMarkdownProps) {
  return (
    <div className={`openspec-cli-md text-[10px] ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  );
}
