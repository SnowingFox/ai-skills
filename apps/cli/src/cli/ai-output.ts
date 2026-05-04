import pc from 'picocolors';

export const renderAiStep = (message: string): string =>
  `${pc.gray('│')}\n${pc.green('◇')}  ${message}\n`;

export const renderAiDone = (message: string): string =>
  `${pc.gray('│')}\n${pc.green('◆')}  ${message}\n`;
