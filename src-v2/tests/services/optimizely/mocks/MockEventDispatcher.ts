import { IEventDispatcher, OptimizelyEvent } from "../../../../services/interfaces/IEventDispatcher";
import { MockLogger } from "./MockLogger";
import { vi } from "vitest";

/**
 * Mock implementation of IEventDispatcher for testing
 */
export class MockEventDispatcher implements IEventDispatcher {
  public dispatchEventMock = vi.fn();
  public flushEventsMock = vi.fn();
  private logger: MockLogger;
  
  // Store dispatched events for inspection in tests
  public events: OptimizelyEvent[] = [];

  constructor(logger: MockLogger) {
    this.logger = logger;

    // Setup default implementations
    this.dispatchEventMock.mockImplementation((event: OptimizelyEvent) => {
      this.events.push(event);
      this.logger.debug(`MockEventDispatcher: Event dispatched`, event);
      return Promise.resolve();
    });

    this.flushEventsMock.mockImplementation(() => {
      this.logger.debug(`MockEventDispatcher: Events flushed`, { count: this.events.length });
      return Promise.resolve();
    });
  }

  /**
   * Accepts an event for dispatch
   */
  async dispatchEvent(event: OptimizelyEvent): Promise<void> {
    return this.dispatchEventMock(event);
  }

  /**
   * (Optional) Flushes any queued events
   */
  async flushEvents?(): Promise<void> {
    return this.flushEventsMock();
  }

  /**
   * Clears stored events and resets mocks
   */
  reset(): void {
    this.events = [];
    this.dispatchEventMock.mockClear();
    this.flushEventsMock.mockClear();
  }

  /**
   * Returns events of a specific type
   */
  getEventsByType(type: string): OptimizelyEvent[] {
    return this.events.filter(event => event.type === type);
  }
} 