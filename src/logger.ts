import chalk from 'chalk';

// chalk v5 为 ESM，在 CJS/打包后可能是 chalk.default，统一取可用的实例；若非函数则不用颜色
const raw = (chalk as any).default ?? chalk;
const c = {
  blue: (s: string) => (typeof raw?.blue === 'function' ? raw.blue(s) : s),
  green: (s: string) => (typeof raw?.green === 'function' ? raw.green(s) : s),
  yellow: (s: string) => (typeof raw?.yellow === 'function' ? raw.yellow(s) : s),
  red: (s: string) => (typeof raw?.red === 'function' ? raw.red(s) : s),
  magenta: (s: string) => (typeof raw?.magenta === 'function' ? raw.magenta(s) : s),
};

// 定义日志级别枚举
enum LogLevel {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

export class Logger {
  // 获取当前格式化的时间 [HH:mm:ss]
  private getTimestamp(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    return `[${hours}:${minutes}:${seconds}]`;
  }

  // 核心输出方法
  private logMessage(level: LogLevel, message: string, ...args: any[]) {
    const timestamp = this.getTimestamp();
    const levelStr = `[${level}]`;

    let coloredMessage: string;
    switch (level) {
      case LogLevel.INFO:
        coloredMessage = c.blue(`${timestamp} ${levelStr} ${message}`);
        break;
      case LogLevel.SUCCESS:
        coloredMessage = c.green(`${timestamp} ${levelStr} ${message}`);
        break;
      case LogLevel.WARN:
        coloredMessage = c.yellow(`${timestamp} ${levelStr} ${message}`);
        break;
      case LogLevel.ERROR:
        coloredMessage = c.red(`${timestamp} ${levelStr} ${message}`);
        break;
      case LogLevel.DEBUG:
        coloredMessage = c.magenta(`${timestamp} ${levelStr} ${message}`);
        break;
      default:
        coloredMessage = `${timestamp} ${levelStr} ${message}`;
    }

    console.log(coloredMessage, ...args);
  }

  info(message: string, ...args: any[]) {
    this.logMessage(LogLevel.INFO, message, ...args);
  }

  success(message: string, ...args: any[]) {
    this.logMessage(LogLevel.SUCCESS, message, ...args);
  }

  warn(message: string, ...args: any[]) {
    this.logMessage(LogLevel.WARN, message, ...args);
  }

  error(message: string, ...args: any[]) {
    this.logMessage(LogLevel.ERROR, message, ...args);
  }

  debug(message: string, ...args: any[]) {
    this.logMessage(LogLevel.DEBUG, message, ...args);
  }
}

export const logger = new Logger();