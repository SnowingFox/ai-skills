import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { canPrompt } from '../../cli/ai-mode';
import { SilentError } from '../../errors';
import { normalizeList } from '../../install-command';
import { initPlugin, INIT_AGENTS, INIT_COMPONENTS } from '../../plugins/init';
import type { PluginsInitOptions } from './types';

/**
 * Run `ai-pkgs plugins init` with interactive prompts, overwrite
 * protection, and intro/outro framing.
 */
export const runPluginsInitCommand = async (
  nameArg: string | undefined,
  options: PluginsInitOptions
): Promise<number> => {
  const promptAllowed = canPrompt(options);

  if (!options.ai && process.stdin.isTTY === true) {
    p.intro(pc.bold('Plugin init'));
  }

  let name = nameArg;
  if (!name) {
    if (!promptAllowed) {
      throw new SilentError('Plugin name is required in non-interactive mode');
    }
    const result = await p.text({
      message: 'Plugin name?',
      placeholder: 'my-plugin',
      validate: (value = '') =>
        value.trim().length === 0 ? 'Name is required' : undefined,
    });
    if (p.isCancel(result)) {
      throw new SilentError('Plugin init cancelled');
    }
    name = result;
  }

  let directory: string;
  if (promptAllowed && options.yes !== true) {
    const dirResult = await p.text({
      message: 'Where to create?',
      placeholder: `./${name}`,
      defaultValue: `./${name}`,
    });
    if (p.isCancel(dirResult)) {
      throw new SilentError('Plugin init cancelled');
    }
    directory = resolve(dirResult);
  } else {
    directory = resolve(`./${name}`);
  }

  if (existsSync(directory) && !isEmptyDir(directory)) {
    if (options.force === true) {
      // --force: proceed without prompt
    } else if (promptAllowed) {
      const overwrite = await p.confirm({
        message: `Directory ${directory} already exists with content. Overwrite?`,
        initialValue: false,
      });
      if (p.isCancel(overwrite) || overwrite !== true) {
        throw new SilentError('Plugin init cancelled');
      }
    } else {
      throw new SilentError(
        `Directory ${directory} already exists. Pass --force to overwrite.`
      );
    }
  }

  let agents: string[];
  const agentFlag = normalizeList(options.agent);
  if (agentFlag.length > 0) {
    agents = agentFlag;
  } else if (promptAllowed && options.yes !== true) {
    const selected = await p.multiselect({
      message: 'Target agents?',
      options: INIT_AGENTS.map((a) => ({
        label: a.name,
        value: a.id,
      })),
      initialValues: INIT_AGENTS.map((a) => a.id),
      required: true,
    });
    if (p.isCancel(selected)) {
      throw new SilentError('Plugin init cancelled');
    }
    agents = selected;
  } else {
    agents = INIT_AGENTS.map((a) => a.id);
  }

  let components: string[];
  if (promptAllowed && options.yes !== true) {
    const selected = await p.multiselect({
      message: 'Components to include?',
      options: INIT_COMPONENTS.map((c) => ({
        label: c,
        value: c,
      })),
      initialValues: [...INIT_COMPONENTS],
      required: true,
    });
    if (p.isCancel(selected)) {
      throw new SilentError('Plugin init cancelled');
    }
    components = selected;
  } else {
    components = [...INIT_COMPONENTS];
  }

  const pluginDir = await initPlugin({
    name,
    directory,
    agents,
    components,
  });

  if (!options.ai && process.stdin.isTTY === true) {
    p.log.success(`Plugin scaffolded at ${pluginDir}`);
    p.outro(pc.green('Done.'));
  } else {
    p.log.success(`Plugin scaffolded at ${pluginDir}`);
  }
  return 0;
};

const isEmptyDir = (dir: string): boolean => {
  try {
    return readdirSync(dir).length === 0;
  } catch {
    return true;
  }
};
