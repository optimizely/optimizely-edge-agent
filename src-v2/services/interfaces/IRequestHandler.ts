import { IRequestAdapter } from "../../adapters/interfaces/IRequestAdapter";

/**
 * Represents the response to be sent back.
 * TODO: Define structure (e.g., status code, headers, body).
 */
export interface ResponseResult { // Replace with actual type or use standard Response
  status: number;
  headers: Record<string, string>;
  body?: string | ReadableStream | ArrayBuffer | null;
}

/**
 * @interface IRequestHandler
 * @description Defines the contract for the main request handler pipeline.
 */
export interface IRequestHandler {
  /**
   * Handles an incoming request adapted by the IRequestAdapter.
   * This method orchestrates calls to other services (Config, Decision, Event) 
   * to generate an appropriate response.
   * @param requestAdapter - The adapter for the incoming request.
   * @returns A promise resolving to the ResponseResult.
   */
  handleRequest(requestAdapter: IRequestAdapter): Promise<ResponseResult>;
} 