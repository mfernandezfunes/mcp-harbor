export class Logger {
  private enabled: boolean;
  private prefix: string;

  constructor(prefix: string = "[MCP Harbor]", enabled: boolean = false) {
    this.prefix = prefix;
    this.enabled = enabled;
  }

  debug(...args: unknown[]): void {
    if (this.enabled) {
      console.error(`${this.prefix} [DEBUG]`, ...args);
    }
  }

  info(...args: unknown[]): void {
    console.error(`${this.prefix} [INFO]`, ...args);
  }

  error(...args: unknown[]): void {
    console.error(`${this.prefix} [ERROR]`, ...args);
  }
}

let globalLogger: Logger = new Logger();

export function initLogger(debug: boolean): Logger {
  globalLogger = new Logger("[MCP Harbor]", debug);
  return globalLogger;
}

export function getLogger(): Logger {
  return globalLogger;
}
