import simpleGit, { SimpleGit, DiffResultTextFile } from 'simple-git';
import { GitDiff } from './types';

export class GitAnalyzer {
  private git: SimpleGit;

  constructor() {
    this.git = simpleGit();
  }

  async getStagedChanges(): Promise<GitDiff[]> {
    try {
      // Check if we're in a git repository
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        throw new Error('Not a git repository');
      }

      // Get staged files
      const status = await this.git.status();
      const stagedFiles = [
        ...status.staged,
        ...status.created,
        ...status.modified.filter(file => status.staged.includes(file))
      ];

      if (stagedFiles.length === 0) {
        throw new Error('No staged changes found. Use "git add" to stage your changes first.');
      }

      const diffs: GitDiff[] = [];

      for (const file of stagedFiles) {
        try {
          // Get diff for each staged file
          const diff = await this.git.diff(['--staged', '--', file]);
          const diffSummary = await this.git.diffSummary(['--staged', '--', file]);
          
          // Type guard to check if it's a text file
          const fileSummary = diffSummary.files.find(f => f.file === file) as DiffResultTextFile | undefined;
          
          diffs.push({
            file,
            additions: (fileSummary && 'insertions' in fileSummary) ? fileSummary.insertions : 0,
            deletions: (fileSummary && 'deletions' in fileSummary) ? fileSummary.deletions : 0,
            changes: this.parseDiffChanges(diff),
            status: this.getFileStatus(file, status)
          });
        } catch (error) {
          console.warn(`Could not analyze ${file}:`, error);
        }
      }

      return diffs;
    } catch (error) {
      throw new Error(`Git analysis failed: ${error}`);
    }
  }

  async getRecentCommits(count: number = 10): Promise<string[]> {
    try {
      const log = await this.git.log({ maxCount: count });
      return log.all.map(commit => commit.message);
    } catch (error) {
      return [];
    }
  }

  async getBranchName(): Promise<string> {
    try {
      const branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
      return branch.trim();
    } catch (error) {
      return 'main';
    }
  }

  private parseDiffChanges(diff: string): string[] {
    const lines = diff.split('\n');
    const changes: string[] = [];

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        changes.push(`Added: ${line.substring(1).trim()}`);
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        changes.push(`Removed: ${line.substring(1).trim()}`);
      }
    }

    return changes.slice(0, 10); // Limit to first 10 changes
  }

  private getFileStatus(file: string, status: any): GitDiff['status'] {
    if (status.created.includes(file)) return 'added';
    if (status.deleted.includes(file)) return 'deleted';
    if (status.renamed.some((r: any) => r.to === file)) return 'renamed';
    return 'modified';
  }
}