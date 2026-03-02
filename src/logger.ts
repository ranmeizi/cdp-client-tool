import chalk from 'chalk';

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
        coloredMessage = chalk.blue(`${timestamp} ${levelStr} ${message}`);
        break;
      case LogLevel.SUCCESS:
        coloredMessage = chalk.green(`${timestamp} ${levelStr} ${message}`);
        break;
      case LogLevel.WARN:
        coloredMessage = chalk.yellow(`${timestamp} ${levelStr} ${message}`);
        break;
      case LogLevel.ERROR:
        coloredMessage = chalk.red(`${timestamp} ${levelStr} ${message}`);
        break;
      case LogLevel.DEBUG:
        coloredMessage = chalk.magenta(`${timestamp} ${levelStr} ${message}`);
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