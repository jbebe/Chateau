
export enum LogLevel {
  Verbose = 0,
  Info = 1,
  Warning = 2,
  Error = 3,
  Silent = 4,
}

let logLevelValue: LogLevel;

export function setLogLevel(level: LogLevel){
  logLevelValue = level;
}

export function logVerbose(...objs: any) {
  if (logLevelValue <= LogLevel.Verbose){
    console.log(...objs);
  }
}

export function logInfo(...objs: any) {
  if (logLevelValue <= LogLevel.Info) {
    console.info(...objs);
  }
}

export function logWarning(...objs: any) {
  if (logLevelValue <= LogLevel.Warning) {
    console.warn(...objs);
  }
}

export function logError(...objs: any) {
  if (logLevelValue <= LogLevel.Error) {
    console.error(...objs);
  }
}
