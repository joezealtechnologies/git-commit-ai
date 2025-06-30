export interface GitDiff {
  file: string;
  additions: number;
  deletions: number;
  changes: string[];
  status: 'added' | 'modified' | 'deleted' | 'renamed';
}

export interface CommitAnalysis {
  type: 'feat' | 'fix' | 'docs' | 'style' | 'refactor' | 'test' | 'chore';
  scope?: string;
  description: string;
  body?: string;
  breakingChange?: boolean;
}

export interface CommitSuggestion {
  message: string;
  confidence: number;
  reasoning: string;
}

export interface Config {
  geminiApiKey: string;
  conventionalCommits: boolean;
  maxLength: number;
  includeBody: boolean;
  customPrompt?: string;
}