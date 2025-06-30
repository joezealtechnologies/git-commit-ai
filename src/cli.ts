#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { GitAnalyzer } from './git-analyzer';
import { GeminiClient } from './gemini-client';
import { ConfigManager } from './config-manager';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('gemini-commit-ai')
  .description('AI-powered git commit message generator using Google Gemini')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize configuration')
  .action(async () => {
    try {
      const configManager = new ConfigManager();
      await configManager.initConfig();
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error}`));
      process.exit(1);
    }
  });

program
  .command('generate')
  .alias('gen')
  .description('Generate commit message for staged changes')
  .option('-c, --commit', 'Automatically commit with selected message')
  .option('-p, --push', 'Push after committing')
  .option('--no-interactive', 'Use the best suggestion without prompting')
  .action(async (options) => {
    try {
      const spinner = ora('Analyzing staged changes...').start();
      
      // Load configuration
      const configManager = new ConfigManager();
      const config = await configManager.loadConfig();
      
      if (!config.geminiApiKey) {
        spinner.fail();
        console.log(chalk.red('❌ Gemini API key not found!'));
        console.log(chalk.yellow('Run "git-commit-ai init" to set up your configuration.'));
        console.log(chalk.gray('Or set GEMINI_API_KEY environment variable.'));
        process.exit(1);
      }

      // Analyze git changes
      const gitAnalyzer = new GitAnalyzer();
      const diffs = await gitAnalyzer.getStagedChanges();
      const recentCommits = await gitAnalyzer.getRecentCommits(5);
      const branchName = await gitAnalyzer.getBranchName();

      spinner.text = 'Generating commit messages with AI...';

      // Generate suggestions with Gemini
      const geminiClient = new GeminiClient(config.geminiApiKey);
      const suggestions = await geminiClient.generateCommitMessage(
        diffs,
        config,
        recentCommits,
        branchName
      );

      spinner.succeed('Generated commit message suggestions!');

      if (suggestions.length === 0) {
        console.log(chalk.red('❌ Could not generate commit messages. Please try again.'));
        process.exit(1);
      }

      // Display suggestions
      console.log(chalk.blue('\n📝 Suggested commit messages:\n'));
      
      suggestions.forEach((suggestion, index) => {
        const confidence = getConfidenceColor(suggestion.confidence);
        console.log(`${chalk.bold(`${index + 1}.`)} ${suggestion.message}`);
        console.log(`   ${confidence} ${suggestion.confidence}% confidence`);
        console.log(`   ${chalk.gray(suggestion.reasoning)}\n`);
      });

      let selectedMessage: string;

      if (options.interactive === false) {
        // Use the best suggestion automatically
        selectedMessage = suggestions[0].message;
        console.log(chalk.green(`✨ Using: ${selectedMessage}`));
      } else {
        // Interactive selection
        const choices = [
          ...suggestions.map((suggestion) => ({
            name: `${suggestion.message} (${suggestion.confidence}%)`,
            value: suggestion.message,
            short: suggestion.message
          })),
          {
            name: chalk.yellow('✏️  Write custom message'),
            value: 'custom',
            short: 'Custom'
          },
          {
            name: chalk.red('❌ Cancel'),
            value: 'cancel',
            short: 'Cancel'
          }
        ];

        const { selected } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selected',
            message: 'Choose a commit message:',
            choices,
            pageSize: 10
          }
        ]);

        if (selected === 'cancel') {
          console.log(chalk.yellow('Operation cancelled.'));
          process.exit(0);
        }

        if (selected === 'custom') {
          const { customMessage } = await inquirer.prompt([
            {
              type: 'input',
              name: 'customMessage',
              message: 'Enter your commit message:',
              validate: (input: string) => input.trim().length > 0 || 'Message cannot be empty'
            }
          ]);
          selectedMessage = customMessage;
        } else {
          selectedMessage = selected;
        }
      }

      // Show what will be committed
      console.log(chalk.blue('\n📋 Files to be committed:'));
      diffs.forEach(diff => {
        const statusIcon = getStatusIcon(diff.status);
        const stats = chalk.gray(`(+${diff.additions}/-${diff.deletions})`);
        console.log(`   ${statusIcon} ${diff.file} ${stats}`);
      });

      console.log(chalk.blue(`\n💬 Commit message: ${chalk.white(selectedMessage)}`));

      // Commit if requested
      if (options.commit) {
        const commitSpinner = ora('Committing changes...').start();
        
        try {
          // Escape quotes properly for different platforms
          const escapedMessage = selectedMessage.replace(/"/g, process.platform === 'win32' ? '""' : '\\"');
          const commitCommand = `git commit -m "${escapedMessage}"`;
          
          execSync(commitCommand, { 
            stdio: 'pipe',
            encoding: 'utf8'
          });
          commitSpinner.succeed('Changes committed successfully!');

          // Push if requested
          if (options.push) {
            const pushSpinner = ora('Pushing to remote...').start();
            try {
              execSync('git push', { 
                stdio: 'pipe',
                encoding: 'utf8'
              });
              pushSpinner.succeed('Changes pushed to remote!');
            } catch (error) {
              pushSpinner.fail('Failed to push changes');
              console.log(chalk.red(`Push error: ${error}`));
            }
          }
        } catch (error) {
          commitSpinner.fail('Failed to commit changes');
          console.log(chalk.red(`Commit error: ${error}`));
          process.exit(1);
        }
      } else {
        console.log(chalk.yellow('\n💡 To commit with this message, run:'));
        console.log(chalk.cyan(`git commit -m "${selectedMessage}"`));
      }

    } catch (error) {
      console.log(chalk.red(`\n❌ Error: ${error}`));
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Manage configuration')
  .option('-g, --global', 'Use global configuration')
  .option('-l, --list', 'List current configuration')
  .option('-s, --set <key=value>', 'Set configuration value')
  .action(async (options) => {
    const configManager = new ConfigManager();

    if (options.list) {
      const config = await configManager.loadConfig();
      console.log(chalk.blue('📋 Current configuration:'));
      console.log(JSON.stringify({
        ...config,
        geminiApiKey: config.geminiApiKey ? '***hidden***' : 'not set'
      }, null, 2));
      return;
    }

    if (options.set) {
      const [key, value] = options.set.split('=');
      if (!key || value === undefined) {
        console.log(chalk.red('❌ Invalid format. Use: --set key=value'));
        process.exit(1);
      }

      const configUpdate: any = {};
      
      // Parse value based on key
      if (key === 'conventionalCommits' || key === 'includeBody') {
        configUpdate[key] = value.toLowerCase() === 'true';
      } else if (key === 'maxLength') {
        configUpdate[key] = parseInt(value, 10);
      } else {
        configUpdate[key] = value;
      }

      await configManager.saveConfig(configUpdate, options.global);
      console.log(chalk.green(`✅ Configuration updated: ${key} = ${value}`));
      return;
    }

    // Interactive config update
    await configManager.initConfig();
  });

program
  .command('status')
  .description('Show git status and staged changes')
  .action(async () => {
    try {
      const gitAnalyzer = new GitAnalyzer();
      const diffs = await gitAnalyzer.getStagedChanges();
      const branchName = await gitAnalyzer.getBranchName();

      console.log(chalk.blue(`📍 Current branch: ${chalk.white(branchName)}`));
      console.log(chalk.blue('\n📋 Staged changes:'));

      if (diffs.length === 0) {
        console.log(chalk.yellow('   No staged changes found.'));
        console.log(chalk.gray('   Use "git add <files>" to stage changes.'));
        return;
      }

      diffs.forEach(diff => {
        const statusIcon = getStatusIcon(diff.status);
        const stats = chalk.gray(`(+${diff.additions}/-${diff.deletions})`);
        console.log(`   ${statusIcon} ${diff.file} ${stats}`);
        
        if (diff.changes.length > 0) {
          console.log(chalk.gray('     Key changes:'));
          diff.changes.slice(0, 3).forEach(change => {
            console.log(chalk.gray(`       ${change}`));
          });
        }
      });

      const totalAdditions = diffs.reduce((sum, diff) => sum + diff.additions, 0);
      const totalDeletions = diffs.reduce((sum, diff) => sum + diff.deletions, 0);
      
      console.log(chalk.blue(`\n📊 Total: ${chalk.green(`+${totalAdditions}`)} ${chalk.red(`-${totalDeletions}`)} across ${diffs.length} files`));
    } catch (error) {
      console.log(chalk.red(`❌ Error: ${error}`));
    }
  });

// Helper functions
function getConfidenceColor(confidence: number): string {
  if (confidence >= 90) return chalk.green(`🟢`);
  if (confidence >= 70) return chalk.yellow(`🟡`);
  return chalk.red(`🔴`);
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'added': return chalk.green('✨');
    case 'modified': return chalk.blue('📝');
    case 'deleted': return chalk.red('🗑️');
    case 'renamed': return chalk.magenta('📋'); // Fixed: changed from purple to magenta
    default: return chalk.gray('📄');
  }
}

// Default command - if no command specified, run generate
program
  .action(async () => {
    // Parse remaining args for generate command
    const args = process.argv.slice(2);
    program.parse(['node', 'git-commit-ai', 'generate', ...args]);
  });

program.parse();
