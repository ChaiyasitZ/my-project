/**
 * NetConfig Agent - Entry Point
 * 
 * Lightweight agent that runs on user's machine to:
 * 1. Connect to NetConfig cloud (Vercel) via WebSocket
 * 2. Execute SSH/NETCONF commands on local network devices
 * 3. Stream results back to the web app
 */

import chalk from 'chalk';
import ora from 'ora';
import { AgentConfig } from './config.js';
import { HttpPollingClient } from './httpClient.js';
import { SSHHandler } from './handlers/sshHandler.js';
import { NetconfHandler } from './handlers/netconfHandler.js';
import { ConsoleHandler } from './handlers/consoleHandler.js';
import { OllamaHandler } from './handlers/ollamaHandler.js';
import { setupCLI } from './cli.js';

const VERSION = '1.0.0';

async function main() {
  console.clear();
  console.log(chalk.cyan(`
  ╔══════════════════════════════════════════╗
  ║         NetConfig Agent v${VERSION}          ║
  ║   Local Network Device Manager           ║
  ╚══════════════════════════════════════════╝
  `));

  // Load or setup configuration
  const config = new AgentConfig();
  
  // Check if first run (needs setup)
  if (!config.get('serverUrl') || !config.get('agentToken')) {
    console.log(chalk.yellow('  First time setup required.\n'));
    await setupCLI(config);
  }

  const serverUrl = config.get('serverUrl');
  const agentToken = config.get('agentToken');
  const agentName = config.get('agentName') || 'Default Agent';

  console.log(chalk.gray(`  Server: ${serverUrl}`));
  console.log(chalk.gray(`  Agent:  ${agentName}`));
  console.log('');

  // ─── Check Ollama availability ───
  const ollamaHandler = new OllamaHandler();
  const ollamaSpinner = ora('Checking Ollama availability...').start();
  const ollamaHealth = await ollamaHandler.checkHealth();

  if (!ollamaHealth.available) {
    ollamaSpinner.fail(chalk.red('Ollama is not running!'));
    console.log('');
    console.log(chalk.yellow('  ⚠ Ollama is required for AI configuration generation.'));
    console.log('');
    console.log(chalk.white('  To install Ollama:'));
    console.log(chalk.gray('    1. Visit https://ollama.com/download'));
    console.log(chalk.gray('    2. Download and install for your platform'));
    console.log(chalk.gray('    3. Run: ollama serve'));
    console.log(chalk.gray('    4. Pull a model: ollama pull llama3.2'));
    console.log('');
    console.log(chalk.yellow('  The agent will continue without AI features.'));
    console.log(chalk.yellow('  Restart the agent after installing Ollama.\n'));
  } else {
    ollamaSpinner.succeed(chalk.green(`Ollama v${ollamaHealth.version} detected`));

    // Check/set configured model
    const configuredModel = config.get('ollamaModel');
    if (configuredModel) {
      ollamaHandler.setModel(configuredModel);
    }

    const models = await ollamaHandler.listModels().catch(() => []);
    if (models.length === 0) {
      console.log(chalk.yellow('  ⚠ No models installed. Pull one with: ollama pull llama3.2'));
    } else {
      console.log(chalk.gray(`  Models: ${models.map(m => m.name).join(', ')}`));
      console.log(chalk.gray(`  Active: ${ollamaHandler.getModel()}`));
    }
  }
  console.log('');

  // Initialize handlers
  const sshHandler = new SSHHandler();
  const netconfHandler = new NetconfHandler();
  const consoleHandler = new ConsoleHandler();

  // Connect to server via HTTP polling
  const spinner = ora('Connecting to NetConfig server...').start();
  
  const client = new HttpPollingClient({
    serverUrl,
    agentToken,
    agentName,
    version: VERSION,
    handlers: {
      ssh: sshHandler,
      netconf: netconfHandler,
      console: consoleHandler,
      ollama: ollamaHandler
    }
  });

  client.on('connected', () => {
    spinner.succeed(chalk.green('Connected to NetConfig server (HTTP polling mode)'));
    console.log(chalk.gray(`  Session ID: ${client.sessionId}`));
    console.log('');
    console.log(chalk.cyan('  Agent is running. Polling for commands every 2 seconds...'));
    console.log(chalk.gray('  Press Ctrl+C to stop\n'));
  });

  client.on('error', (error) => {
    spinner.fail(chalk.red(`Connection error: ${error.message}`));
  });

  client.on('command', (cmd) => {
    console.log(chalk.blue(`  ← Command: ${cmd.type} for device ${cmd.deviceId}`));
  });

  client.on('result', (result) => {
    const icon = result.success ? chalk.green('✓') : chalk.red('✗');
    console.log(`  → ${icon} Result sent for ${result.type}`);
  });

  // Start connection
  try {
    await client.connect();
  } catch (error) {
    spinner.fail(chalk.red(`Failed to connect: ${error.message}`));
    console.log(chalk.yellow('\n  Check your server URL and agent token.'));
    console.log(chalk.gray('  Run with --setup to reconfigure.\n'));
    process.exit(1);
  }

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n  Shutting down agent...'));
    await sshHandler.disconnectAll();
    await netconfHandler.disconnectAll();
    await consoleHandler.disconnectAll();
    await client.disconnect();
    console.log(chalk.gray('  Goodbye!\n'));
    process.exit(0);
  });

  // Handle --setup flag
  if (process.argv.includes('--setup')) {
    await setupCLI(config);
    process.exit(0);
  }
}

main().catch((error) => {
  console.error(chalk.red(`\n  Fatal error: ${error.message}\n`));
  process.exit(1);
});
