import fs from 'fs/promises';
import path from 'path';

const COMMAND_DIR = path.resolve(process.cwd(), 'src', 'command');

export async function loadCommandText(fileName: string): Promise<string> {
  const filePath = path.join(COMMAND_DIR, fileName);
  return fs.readFile(filePath, 'utf8');
}

export async function loadRankerPrompts(): Promise<{
  systemPrompt: string;
  taskPrompt: string;
  contextRules: string;
  outputFormat: string;
}> {
  const [systemPrompt, taskPrompt, contextRules, outputFormat] = await Promise.all([
    loadCommandText('system.md'),
    loadCommandText('ranker.md'),
    loadCommandText('context-rules.md'),
    loadCommandText('output-format.md'),
  ]);

  return {
    systemPrompt,
    taskPrompt,
    contextRules,
    outputFormat,
  };
}
