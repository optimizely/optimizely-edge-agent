/**
 * Utilities for working with Optimizely SDK configuration and datafiles
 */

// Use lite ES module for Edge runtime compatibility
import * as optimizely from '@optimizely/optimizely-sdk/lite';
import { ILoggerAdapter } from '../adapters/interfaces/ILoggerAdapter';

/**
 * Maps from various Optimizely identifiers to each other
 * For instance, from flag key to experiment ID 
 */
export interface OptimizelyIdMappingUtils {
  /**
   * Gets all experiment IDs associated with a flag key
   * 
   * @param client - The Optimizely client instance
   * @param flagKey - The flag key to get experiment IDs for
   * @returns Array of experiment IDs associated with the flag
   */
  getExperimentIdsForFlag(client: optimizely.Client, flagKey: string): string[];

  /**
   * Gets the flag key associated with an experiment ID
   * 
   * @param client - The Optimizely client instance 
   * @param experimentId - The experiment ID to get the flag key for
   * @returns The associated flag key or undefined if not found
   */
  getFlagKeyForExperimentId(client: optimizely.Client, experimentId: string): string | undefined;
  
  /**
   * Gets all rule keys (human-readable experiment names) associated with a flag key
   * 
   * @param client - The Optimizely client instance
   * @param flagKey - The flag key to get rule keys for
   * @returns Array of rule keys associated with the flag
   */
  getRuleKeysForFlag(client: optimizely.Client, flagKey: string): string[];
}

/**
 * Implementation of OptimizelyIdMappingUtils
 */
export class OptimizelyIdMapper implements OptimizelyIdMappingUtils {
  private logger: ILoggerAdapter;
  
  constructor(logger: ILoggerAdapter) {
    this.logger = logger.forComponent('OptimizelyIdMapper');
  }
  
  /**
   * Gets all experiment IDs associated with a flag key
   * 
   * @param client - The Optimizely client instance
   * @param flagKey - The flag key to get experiment IDs for
   * @returns Array of experiment IDs associated with the flag
   */
  public getExperimentIdsForFlag(client: optimizely.Client, flagKey: string): string[] {
    try {
      const experimentIds: string[] = [];
      
      const optimizelyConfig = client.getOptimizelyConfig();
      if (!optimizelyConfig || !optimizelyConfig.featuresMap) {
        this.logger.warn(`No OptimizelyConfig available or featuresMap missing`);
        return experimentIds;
      }
      
      const feature = optimizelyConfig.featuresMap[flagKey];
      if (!feature) {
        this.logger.warn(`Feature with key ${flagKey} not found in config`);
        return experimentIds;
      }
      
      // Get experiment IDs from experiment rules (A/B tests)
      if (feature.experimentRules) {
        for (const experiment of feature.experimentRules) {
          if (experiment.id) {
            experimentIds.push(experiment.id);
            this.logger.debug(`Found experiment ID ${experiment.id} for flag ${flagKey} (experiment rule)`);
          }
        }
      }
      
      // Get experiment IDs from delivery rules (rollouts)
      if (feature.deliveryRules) {
        for (const rule of feature.deliveryRules) {
          if (rule.id) {
            experimentIds.push(rule.id);
            this.logger.debug(`Found experiment ID ${rule.id} for flag ${flagKey} (delivery rule)`);
          }
        }
      }
      
      // For backwards compatibility with older SDK versions
      if (experimentIds.length === 0 && feature.experimentsMap) {
        for (const experimentKey in feature.experimentsMap) {
          const experiment = feature.experimentsMap[experimentKey];
          if (experiment && experiment.id) {
            experimentIds.push(experiment.id);
            this.logger.debug(`Found experiment ID ${experiment.id} for flag ${flagKey} (via experimentsMap)`);
          }
        }
      }
      
      return experimentIds;
    } catch (error) {
      this.logger.error(`Error getting experiment IDs for flag ${flagKey}`, error);
      return [];
    }
  }
  
  /**
   * Gets the flag key associated with an experiment ID
   * 
   * @param client - The Optimizely client instance 
   * @param experimentId - The experiment ID to get the flag key for
   * @returns The associated flag key or undefined if not found
   */
  public getFlagKeyForExperimentId(client: optimizely.Client, experimentId: string): string | undefined {
    try {
      const optimizelyConfig = client.getOptimizelyConfig();
      if (!optimizelyConfig || !optimizelyConfig.featuresMap) {
        this.logger.warn(`No OptimizelyConfig available or featuresMap missing`);
        return undefined;
      }
      
      // Iterate through features to find matching experiment ID
      for (const flagKey in optimizelyConfig.featuresMap) {
        const feature = optimizelyConfig.featuresMap[flagKey];
        
        // Check experiment rules
        if (feature.experimentRules) {
          for (const experiment of feature.experimentRules) {
            if (experiment.id === experimentId) {
              this.logger.debug(`Found flag key ${flagKey} for experiment ID ${experimentId} (experiment rule)`);
              return flagKey;
            }
          }
        }
        
        // Check delivery rules
        if (feature.deliveryRules) {
          for (const rule of feature.deliveryRules) {
            if (rule.id === experimentId) {
              this.logger.debug(`Found flag key ${flagKey} for experiment ID ${experimentId} (delivery rule)`);
              return flagKey;
            }
          }
        }
        
        // For backwards compatibility
        if (feature.experimentsMap) {
          for (const experimentKey in feature.experimentsMap) {
            const experiment = feature.experimentsMap[experimentKey];
            if (experiment && experiment.id === experimentId) {
              this.logger.debug(`Found flag key ${flagKey} for experiment ID ${experimentId} (via experimentsMap)`);
              return flagKey;
            }
          }
        }
      }
      
      this.logger.warn(`No flag key found for experiment ID ${experimentId}`);
      return undefined;
    } catch (error) {
      this.logger.error(`Error getting flag key for experiment ID ${experimentId}`, error);
      return undefined;
    }
  }
  
  /**
   * Gets all rule keys (human-readable experiment names) associated with a flag key
   * 
   * @param client - The Optimizely client instance
   * @param flagKey - The flag key to get rule keys for
   * @returns Array of rule keys associated with the flag
   */
  public getRuleKeysForFlag(client: optimizely.Client, flagKey: string): string[] {
    try {
      const ruleKeys: string[] = [];
      
      const optimizelyConfig = client.getOptimizelyConfig();
      if (!optimizelyConfig || !optimizelyConfig.featuresMap) {
        this.logger.warn(`No OptimizelyConfig available or featuresMap missing`);
        return ruleKeys;
      }
      
      const feature = optimizelyConfig.featuresMap[flagKey];
      if (!feature) {
        this.logger.warn(`Feature with key ${flagKey} not found in config`);
        return ruleKeys;
      }
      
      // Get rule keys from experiment rules
      if (feature.experimentRules) {
        for (const experiment of feature.experimentRules) {
          if (experiment.key) {
            ruleKeys.push(experiment.key);
            this.logger.debug(`Found rule key ${experiment.key} for flag ${flagKey} (experiment rule)`);
          }
        }
      }
      
      // Get rule keys from delivery rules
      if (feature.deliveryRules) {
        for (const rule of feature.deliveryRules) {
          if (rule.key) {
            ruleKeys.push(rule.key);
            this.logger.debug(`Found rule key ${rule.key} for flag ${flagKey} (delivery rule)`);
          }
        }
      }
      
      // For backwards compatibility
      if (ruleKeys.length === 0 && feature.experimentsMap) {
        for (const experimentKey in feature.experimentsMap) {
          ruleKeys.push(experimentKey);
          this.logger.debug(`Found rule key ${experimentKey} for flag ${flagKey} (via experimentsMap)`);
        }
      }
      
      return ruleKeys;
    } catch (error) {
      this.logger.error(`Error getting rule keys for flag ${flagKey}`, error);
      return [];
    }
  }
}