/**
 * Structured Logger for Network Automation Backend
 * Provides consistent, level-based logging with optional JSON output for production
 */

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4
};

class Logger {
  constructor(options = {}) {
    this.level = LOG_LEVELS[options.level || process.env.LOG_LEVEL || 'info'];
    this.jsonOutput = options.json || process.env.LOG_JSON === 'true' || process.env.NODE_ENV === 'production';
    this.serviceName = options.service || 'network-automation';
    this.silent = options.silent || process.env.LOG_SILENT === 'true';
  }

  _formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    
    if (this.jsonOutput) {
      return JSON.stringify({
        timestamp,
        level,
        service: this.serviceName,
        message,
        ...meta
      });
    }

    // Pretty format for development
    const levelColors = {
      error: '\x1b[31m', // Red
      warn: '\x1b[33m',  // Yellow
      info: '\x1b[36m',  // Cyan
      debug: '\x1b[35m', // Magenta
      trace: '\x1b[90m'  // Gray
    };
    const reset = '\x1b[0m';
    const color = levelColors[level] || '';
    
    const levelEmoji = {
      error: '❌',
      warn: '⚠️',
      info: 'ℹ️',
      debug: '🔧',
      trace: '📝'
    };

    let output = `${color}${levelEmoji[level]} [${level.toUpperCase()}]${reset} ${message}`;
    
    if (Object.keys(meta).length > 0) {
      output += ` ${JSON.stringify(meta)}`;
    }
    
    return output;
  }

  _log(level, message, meta = {}) {
    if (this.silent) return;
    if (LOG_LEVELS[level] > this.level) return;

    const formattedMessage = this._formatMessage(level, message, meta);
    
    switch (level) {
      case 'error':
        console.error(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }
  }

  error(message, meta = {}) {
    this._log('error', message, meta);
  }

  warn(message, meta = {}) {
    this._log('warn', message, meta);
  }

  info(message, meta = {}) {
    this._log('info', message, meta);
  }

  debug(message, meta = {}) {
    this._log('debug', message, meta);
  }

  trace(message, meta = {}) {
    this._log('trace', message, meta);
  }

  // Request logging middleware for Express
  requestLogger() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logLevel = res.statusCode >= 500 ? 'error' 
                       : res.statusCode >= 400 ? 'warn' 
                       : 'info';
        
        this._log(logLevel, `${req.method} ${req.originalUrl}`, {
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip || req.connection?.remoteAddress
        });
      });
      
      next();
    };
  }

  // Create child logger with prefix
  child(prefix) {
    const parent = this;
    return {
      error: (msg, meta) => parent.error(`[${prefix}] ${msg}`, meta),
      warn: (msg, meta) => parent.warn(`[${prefix}] ${msg}`, meta),
      info: (msg, meta) => parent.info(`[${prefix}] ${msg}`, meta),
      debug: (msg, meta) => parent.debug(`[${prefix}] ${msg}`, meta),
      trace: (msg, meta) => parent.trace(`[${prefix}] ${msg}`, meta)
    };
  }
}

// Create and export default logger instance
const logger = new Logger();

// Named exports for convenience
export const error = (msg, meta) => logger.error(msg, meta);
export const warn = (msg, meta) => logger.warn(msg, meta);
export const info = (msg, meta) => logger.info(msg, meta);
export const debug = (msg, meta) => logger.debug(msg, meta);
export const trace = (msg, meta) => logger.trace(msg, meta);

export default logger;
