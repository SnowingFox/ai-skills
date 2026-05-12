/** A titled group of example command strings with descriptions for help output. */
export type HelpExampleGroup = {
  title: string;
  examples: [command: string, description: string][];
};

/** A titled group of flag/option rows for help output. */
export type HelpOptionGroup = {
  title: string;
  options: [rawName: string, description: string][];
};

/**
 * Full help payload for one CLI command. Used by the custom help renderer
 * to produce rich, scenario-based help text with grouped flags and examples.
 */
export type HelpCommand = {
  name: string;
  description: string;
  usageText?: string;
  subcommands?: [usage: string, description: string][];
  exampleGroups?: HelpExampleGroup[];
  notes?: string[];
  optionGroups?: HelpOptionGroup[];
  options: [rawName: string, description: string][];
};
