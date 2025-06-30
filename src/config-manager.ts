import fs from 'fs/promises';
import path from 'path';
import { Config } from './types';

export class ConfigManager {
  private configPath: string;
  private globalConfigPath: string;

  constructor() {
    this.configPath = path.join(process.cwd(), '.git-commit-ai.json');
    this.globalConfigPath = path.join(require('os').homedir(), '.git-commit-ai.json');
  }

  async loadConfig(): Promise<Config> {
    const defaultConfig: Config = {
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      conventionalCommits: true,
      maxLength: 72,
      includeBody: false
    };

    try {
      // Try local config first
      const localConfig = await this.loadConfigFile(this.configPath);
      if (localConfig) {
        return { ...defaultConfig, ...localConfig };
      }

      // Fall back to global config
      const globalConfig = await this.loadConfigFile(this.globalConfigPath);
      if (globalConfig) {
        return { ...defaultConfig, ...globalConfig };
      }
    } catch (error) {
      // Config files don't exist or are invalid, use defaults
    }

    return defaultConfig;
  }

  async saveConfig(config: Partial<Config>, global: boolean = false): Promise<void> {
    const configPath = global ? this.globalConfigPath : this.configPath;
    
    try {
      const existingConfig = await this.loadConfigFile(configPath) || {};
      const newConfig = { ...existingConfig, ...config };
      
      await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2));
    } catch (error) {
      throw new Error(`Failed to save config: ${error}`);
    }
  }

  private async loadConfigFile(filePath: string): Promise<Partial<Config> | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  async initConfig(): Promise<void> {
    const inquirer = await import('inquirer');
    
    console.log('🚀 Setting up git-commit-ai configuration...\n');

    const answers = await inquirer.default.prompt([
      {
        type: 'input',
        name: 'geminiApiKey',
        message: 'Enter your Google Gemini API key:',
        validate: (input: string) => input.length > 0 || 'API key is required'
      },
      {
        type: 'confirm',
        name: 'conventionalCommits',
        message: 'Use Conventional Commits format?',
        default: true
      },
      {
        type: 'number',
        name: 'maxLength',
        message: 'Maximum commit message length:',
        default: 72
      },
      {
        type: 'confirm',
        name: 'includeBody',
        message: 'Include commit body for complex changes?',
        default: false
      },
      {
        type: 'confirm',
        name: 'global',
        message: 'Save configuration globally?',
        default: true
      }
    ]);

    const { global, ...config } = answers;
    await this.saveConfig(config, global);

    console.log(`✅ Configuration saved ${global ? 'globally' : 'locally'}!`);
  }
}