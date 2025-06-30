import { GoogleGenerativeAI } from '@google/generative-ai';
import { GitDiff, CommitSuggestion, Config } from './types';

export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
  }

  async generateCommitMessage(
    diffs: GitDiff[],
    config: Config,
    recentCommits: string[] = [],
    branchName: string = 'main'
  ): Promise<CommitSuggestion[]> {
    const prompt = this.buildPrompt(diffs, config, recentCommits, branchName);

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return this.parseResponse(text);
    } catch (error) {
      throw new Error(`Gemini API error: ${error}`);
    }
  }

  private buildPrompt(
    diffs: GitDiff[],
    config: Config,
    recentCommits: string[],
    branchName: string
  ): string {
    const changesDescription = diffs.map(diff => {
      const changeType = diff.status;
      const stats = `(+${diff.additions}/-${diff.deletions})`;
      const changes = diff.changes.slice(0, 5).join('\n  ');
      
      return `File: ${diff.file} ${stats}
Status: ${changeType}
Key changes:
  ${changes}`;
    }).join('\n\n');

    const recentCommitsContext = recentCommits.length > 0 
      ? `Recent commits for context:\n${recentCommits.slice(0, 5).map(c => `- ${c}`).join('\n')}\n\n`
      : '';

    return `You are an expert developer assistant that generates high-quality git commit messages.

CONTEXT:
Branch: ${branchName}
${recentCommitsContext}

CHANGES TO COMMIT:
${changesDescription}

REQUIREMENTS:
${config.conventionalCommits ? '- Use Conventional Commits format (type(scope): description)' : '- Use clear, descriptive commit messages'}
- Maximum length: ${config.maxLength} characters
- Be specific about what changed and why
- Use present tense ("add" not "added")
- Start with lowercase unless it's a proper noun
${config.includeBody ? '- Include a body if the change is complex' : '- Keep it concise, no body needed'}

COMMIT TYPES (if using conventional commits):
- feat: new feature
- fix: bug fix
- docs: documentation changes
- style: formatting, missing semicolons, etc.
- refactor: code restructuring without changing functionality
- test: adding or updating tests
- chore: maintenance tasks, dependencies, build process

Generate 3 different commit message suggestions, ranked by quality.
Format your response as JSON:

{
  "suggestions": [
    {
      "message": "commit message here",
      "confidence": 95,
      "reasoning": "why this message is good"
    },
    {
      "message": "alternative message",
      "confidence": 85,
      "reasoning": "explanation for this option"
    },
    {
      "message": "third option",
      "confidence": 75,
      "reasoning": "why this could work"
    }
  ]
}

${config.customPrompt ? `\nADDITIONAL INSTRUCTIONS:\n${config.customPrompt}` : ''}`;
  }

  private parseResponse(response: string): CommitSuggestion[] {
    try {
      // Clean up the response - remove markdown code blocks if present
      const cleanResponse = response
        .replace(/\n?/g, '')
        .replace(/\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleanResponse);
      
      if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
        return parsed.suggestions.map((suggestion: any) => ({
          message: suggestion.message || '',
          confidence: suggestion.confidence || 50,
          reasoning: suggestion.reasoning || 'No reasoning provided'
        }));
      }
    } catch (error) {
      console.warn('Failed to parse AI response, falling back to simple parsing');
    }

    // Fallback: try to extract commit messages from the response
    const lines = response.split('\n').filter(line => line.trim());
    const suggestions: CommitSuggestion[] = [];

    for (const line of lines) {
      if (line.includes(':') && !line.startsWith('{') && !line.startsWith('}')) {
        suggestions.push({
          message: line.trim(),
          confidence: 70,
          reasoning: 'Extracted from AI response'
        });
      }
    }

    return suggestions.slice(0, 3);
  }
}