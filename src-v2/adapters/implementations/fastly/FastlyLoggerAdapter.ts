import { StandardLoggerAdapter } from '../StandardLoggerAdapter';
import { IEnvironmentAdapter } from '../../interfaces/IEnvironmentAdapter';

/**
 * Fastly-specific implementation of ILoggerAdapter.
 * Extends StandardLoggerAdapter with Fastly-specific console handling.
 */
export class FastlyLoggerAdapter extends StandardLoggerAdapter {
  constructor(environmentAdapter?: IEnvironmentAdapter) {
    super(environmentAdapter, {
      format: 'text', // Fastly typically uses text format for console output
      useColors: false, // Disable colors for Fastly console
      destinations: ['console']
    });
  }
} 