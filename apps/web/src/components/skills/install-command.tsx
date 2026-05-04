'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import { useCallback, useState } from 'react';

export function InstallCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [command]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy to clipboard"
      className="flex min-w-0 max-w-full cursor-pointer items-center gap-2 rounded-md bg-muted px-3 py-2 font-mono text-muted-foreground text-sm transition-colors hover:text-foreground"
    >
      <code className="truncate">
        <span className="opacity-50">$</span> {command}
      </code>
      {copied ? (
        <CheckIcon className="h-3.5 w-3.5 shrink-0 text-green-500" />
      ) : (
        <CopyIcon className="h-3.5 w-3.5 shrink-0" />
      )}
    </button>
  );
}
