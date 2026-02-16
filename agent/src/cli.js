/**
 * CLI Setup - Interactive first-time configuration
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import os from 'os';

export async function setupCLI(config) {
  console.log(chalk.cyan('  ── Agent Setup ──\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'serverUrl',
      message: 'NetConfig server URL:',
      default: config.get('serverUrl') || 'https://your-app.vercel.app',
      validate: (input) => {
        if (!input.startsWith('http://') && !input.startsWith('https://')) {
          return 'URL must start with http:// or https://';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'agentName',
      message: 'Agent name (for identification):',
      default: config.get('agentName') || `Agent-${os.hostname()}`
    },
    {
      type: 'input',
      name: 'agentToken',
      message: 'Agent token (from web app Settings):',
      default: config.get('agentToken') || '',
      validate: (input) => {
        if (!input || input.length < 10) {
          return 'Please enter a valid agent token from the web app';
        }
        return true;
      }
    }
  ]);

  config.set('serverUrl', answers.serverUrl.replace(/\/$/, '')); // Remove trailing slash
  config.set('agentName', answers.agentName);
  config.set('agentToken', answers.agentToken);

  // ── Ollama Configuration ──
  console.log('');
  console.log(chalk.cyan('  ── Ollama AI Setup ──\n'));

  // Check if Ollama is available
  let ollamaAvailable = false;
  let ollamaModels = [];
  
  try {
    const healthResponse = await fetch('http://localhost:11434/api/version');
    if (healthResponse.ok) {
      ollamaAvailable = true;
      const tagsResponse = await fetch('http://localhost:11434/api/tags');
      if (tagsResponse.ok) {
        const tagsData = await tagsResponse.json();
        ollamaModels = (tagsData.models || []).map(m => m.name);
      }
    }
  } catch {
    // Ollama not running
  }

  if (ollamaAvailable && ollamaModels.length > 0) {
    console.log(chalk.green('  ✓ Ollama is running'));
    console.log(chalk.gray(`  Available models: ${ollamaModels.join(', ')}\n`));

    const ollamaAnswers = await inquirer.prompt([
      {
        type: 'list',
        name: 'ollamaModel',
        message: 'Select Ollama model for AI generation:',
        choices: ollamaModels.map(m => ({ name: m, value: m })),
        default: config.get('ollamaModel') || ollamaModels[0]
      }
    ]);

    config.set('ollamaModel', ollamaAnswers.ollamaModel);
    console.log(chalk.green(`\n  ✓ Ollama model set to: ${ollamaAnswers.ollamaModel}`));

  } else if (ollamaAvailable) {
    console.log(chalk.yellow('  ⚠ Ollama is running but no models are installed.'));
    console.log(chalk.gray('    Run: ollama pull llama3.2'));
    
    const modelAnswer = await inquirer.prompt([
      {
        type: 'input',
        name: 'ollamaModel',
        message: 'Ollama model to use (will be pulled if missing):',
        default: config.get('ollamaModel') || 'llama3.2'
      }
    ]);
    config.set('ollamaModel', modelAnswer.ollamaModel);

  } else {
    console.log(chalk.yellow('  ⚠ Ollama is not running.'));
    console.log(chalk.gray('    Install from: https://ollama.com/download'));
    console.log(chalk.gray('    Then run: ollama serve'));
    console.log(chalk.gray('    And pull a model: ollama pull llama3.2\n'));

    const modelAnswer = await inquirer.prompt([
      {
        type: 'input',
        name: 'ollamaModel',
        message: 'Ollama model to use (when available):',
        default: config.get('ollamaModel') || 'llama3.2'
      }
    ]);
    config.set('ollamaModel', modelAnswer.ollamaModel);
  }

  console.log(chalk.green('\n  ✓ Configuration saved!\n'));
  console.log(chalk.gray(`  Config location: ${config.store.path || 'default'}`));
  console.log('');
}
