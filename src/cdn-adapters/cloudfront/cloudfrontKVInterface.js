/**
 * @module CloudfrontKVInterface
 * 
 * The CloudfrontKVInterface module is responsible for interacting with the AWS CloudFront Lambda@Edge KV store.
 * Since CloudFront Lambda@Edge does not provide a built-in key-value (KV) store like Cloudflare Workers 
 * or other edge computing platforms, the module is implemented using AWS DynamoDB.
 * The following methods are implemented:
 * - get(key) - Retrieves a value by key from the AWS CloudFront Lambda@Edge KV store.
 * - put(key, value) - Puts a value into the AWS CloudFront Lambda@Edge KV store.
 * - delete(key) - Deletes a key from the AWS CloudFront Lambda@Edge KV store.
 */

import { DynamoDB } from 'aws-sdk';
import { logger } from '../../_helpers_/optimizelyHelper.js';

/**
 * AWS CloudFront Lambda@Edge does not provide a built-in key-value (KV) store like Cloudflare Workers 
 * or other edge computing platforms. Lambda@Edge functions are stateless and do not have direct access
 * to a persistent storage mechanism.

/**
 * Class representing the AWS DynamoDB interface for key-value storage.
 * @class
 */
class AWSDynamoDBInterface {
  /**
   * @param {string} tableName - The name of the DynamoDB table.
   * @param {Object} [options] - Additional options for the DynamoDB client.
   */
  constructor(tableName, options = {}) {
    this.tableName = tableName;
    this.dynamodb = new DynamoDB.DocumentClient(options);
  }

  /**
   * Get a value by key from the DynamoDB table.
   * @param {string} key - The key to retrieve.
   * @returns {Promise<string|null>} - The value associated with the key.
   */
  async get(key) {
    try {
      const params = {
        TableName: this.tableName,
        Key: { id: key },
      };
      const result = await this.dynamodb.get(params).promise();
      return result.Item ? result.Item.value : null;
    } catch (error) {
      logger().error(`Error getting value for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Put a value into the DynamoDB table.
   * @param {string} key - The key to store.
   * @param {string} value - The value to store.
   * @returns {Promise<void>}
   */
  async put(key, value) {
    try {
      const params = {
        TableName: this.tableName,
        Item: {
          id: key,
          value: value,
        },
      };
      await this.dynamodb.put(params).promise();
    } catch (error) {
      logger().error(`Error putting value for key ${key}:`, error);
    }
  }

  /**
   * Delete a key from the DynamoDB table.
   * @param {string} key - The key to delete.
   * @returns {Promise<void>}
   */
  async delete(key) {
    try {
      const params = {
        TableName: this.tableName,
        Key: { id: key },
      };
      await this.dynamodb.delete(params).promise();
    } catch (error) {
      logger().error(`Error deleting key ${key}:`, error);
    }
  }
}

export default AWSDynamoDBInterface;