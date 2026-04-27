import { cn } from '@/lib/utils';
import Link from 'next/link';
import type { ComponentPropsWithoutRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SkillMarkdownProps {
  content: string;
}

function MarkdownLink({
  href,
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<'a'>) {
  const safeHref = href ?? '#';
  const isExternal = /^https?:\/\//.test(safeHref);

  if (!isExternal && safeHref.startsWith('/')) {
    return (
      <Link
        href={safeHref}
        className={cn(
          'font-medium text-foreground underline underline-offset-4',
          className
        )}
      >
        {children}
      </Link>
    );
  }

  return (
    <a
      href={safeHref}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noreferrer' : undefined}
      className={cn(
        'font-medium text-foreground underline underline-offset-4',
        className
      )}
      {...props}
    >
      {children}
    </a>
  );
}

export function SkillMarkdown({ content }: SkillMarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ className, ...props }) => (
          <h1
            className={cn(
              'text-3xl font-semibold tracking-tight text-foreground',
              className
            )}
            {...props}
          />
        ),
        h2: ({ className, ...props }) => (
          <h2
            className={cn(
              'mt-8 text-2xl font-semibold tracking-tight text-foreground',
              className
            )}
            {...props}
          />
        ),
        h3: ({ className, ...props }) => (
          <h3
            className={cn(
              'mt-6 text-lg font-semibold tracking-tight text-foreground',
              className
            )}
            {...props}
          />
        ),
        h4: ({ className, ...props }) => (
          <h4
            className={cn(
              'mt-4 text-base font-semibold tracking-tight text-foreground',
              className
            )}
            {...props}
          />
        ),
        p: ({ className, ...props }) => (
          <p
            className={cn('leading-7 text-muted-foreground', className)}
            {...props}
          />
        ),
        a: MarkdownLink,
        ul: ({ className, ...props }) => (
          <ul
            className={cn(
              'ml-5 list-disc text-muted-foreground [&>li]:mt-1',
              className
            )}
            {...props}
          />
        ),
        ol: ({ className, ...props }) => (
          <ol
            className={cn(
              'ml-5 list-decimal text-muted-foreground [&>li]:mt-1',
              className
            )}
            {...props}
          />
        ),
        li: ({ className, ...props }) => (
          <li className={cn('pl-1 leading-7', className)} {...props} />
        ),
        blockquote: ({ className, ...props }) => (
          <blockquote
            className={cn(
              'border-l pl-4 text-muted-foreground italic',
              className
            )}
            {...props}
          />
        ),
        code: ({ className, children, ...props }) => (
          <code
            className={cn(
              'rounded bg-muted px-1 py-0.5 font-mono text-foreground text-[0.9em]',
              className
            )}
            {...props}
          >
            {children}
          </code>
        ),
        pre: ({ className, ...props }) => (
          <pre
            className={cn(
              'overflow-x-auto rounded-md border bg-muted p-4 text-sm',
              className
            )}
            {...props}
          />
        ),
        table: ({ className, ...props }) => (
          <div className="overflow-x-auto">
            <table
              className={cn('w-full border-collapse text-sm', className)}
              {...props}
            />
          </div>
        ),
        th: ({ className, ...props }) => (
          <th
            className={cn(
              'border px-3 py-2 text-left font-medium text-foreground',
              className
            )}
            {...props}
          />
        ),
        td: ({ className, ...props }) => (
          <td
            className={cn('border px-3 py-2 text-muted-foreground', className)}
            {...props}
          />
        ),
        hr: ({ className, ...props }) => (
          <hr className={cn('border-border', className)} {...props} />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
