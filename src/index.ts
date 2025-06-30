// Main export file for the package
export { GitAnalyzer } from './git-analyzer';
export { GeminiClient } from './gemini-client';
export { ConfigManager } from './config-manager';
export * from './types';

// For programmatic usage
import { GitAnalyzer } from './git-analyzer';
import { GeminiClient } from './gemini-client';
import { ConfigManager } from './config-manager';

export class GitCommitAI {
  private gitAnalyzer: GitAnalyzer;
  private geminiClient?: GeminiClient;
  private configManager: ConfigManager;

  constructor(apiKey?: string) {
    this.gitAnalyzer = new GitAnalyzer();
    this.configManager = new ConfigManager();
    
    if (apiKey) {
      this.geminiClient = new GeminiClient(apiKey);
    }
  }

  async generateCommitMessage(options?: {
    conventionalCommits?: boolean;
    maxLength?: number;
    includeBody?: boolean;
  }) {
    if (!this.geminiClient) {
      const config = await this.configManager.loadConfig();
      if (!config.geminiApiKey) {
        throw new Error('Gemini API key not configured');
      }
      this.geminiClient = new GeminiClient(config.geminiApiKey);
    }

    const config = await this.configManager.loadConfig();
    const mergedConfig = { ...config, ...options };

    const diffs = await this.gitAnalyzer.getStagedChanges();
    const recentCommits = await this.gitAnalyzer.getRecentCommits(5);
    const branchName = await this.gitAnalyzer.getBranchName();

    return await this.geminiClient.generateCommitMessage(
      diffs,
      mergedConfig,
      recentCommits,
      branchName
    );
  }
}