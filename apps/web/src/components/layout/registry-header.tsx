import Link from 'next/link';

/**
 * Minimal site-wide header for the public surface: logo, About link, and a
 * GitHub icon. Replaces the old SiteHeader (which carried pricing/login/signup
 * actions we removed) and is shared between the marketing layout and the
 * registry route group so the chrome stays consistent across surfaces.
 */
export function RegistryHeader() {
  return (
    <header className="sticky top-0 z-50 border-border/60 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="AI Skills home"
          className="flex items-center gap-2 rounded outline-none focus-visible:outline-focus"
        >
          <svg
            aria-hidden="true"
            height="18"
            viewBox="0 0 16 16"
            width="18"
            className="fill-current"
          >
            <path fillRule="evenodd" clipRule="evenodd" d="M8 1L16 15H0L8 1Z" />
          </svg>
          <span className="font-medium text-lg tracking-tight">Skills</span>
        </Link>

        <nav aria-label="Primary" className="flex items-center gap-5">
          <Link
            href="/about"
            className="text-muted-foreground text-sm transition-colors hover:text-foreground"
          >
            About
          </Link>
          <a
            href="https://github.com/SnowingFox/ai-skills"
            target="_blank"
            rel="noreferrer"
            className="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-4"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            <span className="sr-only">GitHub repository</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
