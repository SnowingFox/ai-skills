export type HelpExampleGroup = {
  title: string;
  examples: [command: string, description: string][];
};

export type HelpOptionGroup = {
  title: string;
  options: [rawName: string, description: string][];
};

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
