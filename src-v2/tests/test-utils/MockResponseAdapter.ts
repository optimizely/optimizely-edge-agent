/**
 * Mock implementation of IResponseAdapter for testing
 */
import { IResponseAdapter } from '../../adapters/interfaces/IResponseAdapter';

export class MockResponseAdapter implements IResponseAdapter {
  private statusCode: number;
  private headers: Record<string, string>;
  private body: any;
  private sent: boolean;

  constructor() {
    this.statusCode = 200;
    this.headers = {};
    this.body = null;
    this.sent = false;
  }

  status(code: number): void {
    this.statusCode = code;
  }

  getStatus(): number {
    return this.statusCode;
  }

  setHeader(name: string, value: string): void {
    this.headers[name.toLowerCase()] = value;
  }

  getHeader(name: string): string | null {
    return this.headers[name.toLowerCase()] || null;
  }

  getHeaders(): Headers {
    const headers = new Headers();
    Object.entries(this.headers).forEach(([key, value]) => {
      headers.append(key, value);
    });
    return headers;
  }

  json(data: any): void {
    this.body = data;
    this.headers['content-type'] = 'application/json';
    this.sent = true;
  }

  text(data: string): void {
    this.body = data;
    this.headers['content-type'] = 'text/plain';
    this.sent = true;
  }

  html(data: string): void {
    this.body = data;
    this.headers['content-type'] = 'text/html';
    this.sent = true;
  }

  send(data: any): void {
    this.body = data;
    this.sent = true;
  }

  redirect(url: string): void {
    this.statusCode = 302;
    this.headers['location'] = url;
    this.sent = true;
  }

  getBody(): string {
    if (typeof this.body === 'object' && this.body !== null) {
      return JSON.stringify(this.body);
    }
    return String(this.body || '');
  }

  isSent(): boolean {
    return this.sent;
  }
} 