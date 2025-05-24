/**
 * Comprehensive Debug Logger for Core Features
 * Provides detailed logging for vector embeddings, search, AI analysis, and other critical components
 */

export class DebugLogger {
  private static instance: DebugLogger;
  private enabledModules: Set<string> = new Set();

  constructor() {
    // Enable all core modules by default
    this.enabledModules.add('vector');
    this.enabledModules.add('embedding');
    this.enabledModules.add('search');
    this.enabledModules.add('ai');
    this.enabledModules.add('analysis');
    this.enabledModules.add('accounts');
    this.enabledModules.add('database');
    this.enabledModules.add('api');
  }

  static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }

  log(module: string, message: string, data?: any) {
    if (this.enabledModules.has(module)) {
      const timestamp = new Date().toISOString();
      const prefix = `[DEBUG:${module.toUpperCase()}]`;
      
      if (data) {
        console.log(`${timestamp} ${prefix} ${message}`, data);
      } else {
        console.log(`${timestamp} ${prefix} ${message}`);
      }
    }
  }

  error(module: string, message: string, error?: any) {
    const timestamp = new Date().toISOString();
    const prefix = `[ERROR:${module.toUpperCase()}]`;
    
    if (error) {
      console.error(`${timestamp} ${prefix} ${message}`, error);
    } else {
      console.error(`${timestamp} ${prefix} ${message}`);
    }
  }

  // Vector operations debugging
  vectorLog(operation: string, details: any) {
    this.log('vector', `Vector ${operation}`, details);
  }

  // Embedding operations debugging
  embeddingLog(operation: string, details: any) {
    this.log('embedding', `Embedding ${operation}`, details);
  }

  // Search operations debugging
  searchLog(operation: string, query: string, results?: any) {
    this.log('search', `Search ${operation} for "${query}"`, results ? { resultCount: Array.isArray(results) ? results.length : 'unknown' } : undefined);
  }

  // AI operations debugging
  aiLog(operation: string, model: string, details: any) {
    this.log('ai', `AI ${operation} with ${model}`, details);
  }

  // Analysis operations debugging
  analysisLog(operation: string, details: any) {
    this.log('analysis', `Analysis ${operation}`, details);
  }

  // Account operations debugging
  accountLog(operation: string, accountInfo: any) {
    this.log('accounts', `Account ${operation}`, accountInfo);
  }

  // Database operations debugging
  dbLog(operation: string, details: any) {
    this.log('database', `Database ${operation}`, details);
  }

  // API operations debugging
  apiLog(endpoint: string, method: string, details?: any) {
    this.log('api', `${method} ${endpoint}`, details);
  }
}

export const debugLogger = DebugLogger.getInstance();