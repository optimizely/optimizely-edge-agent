import { describe, it, expect, vi, beforeEach } from 'vitest';
import EventListeners from './eventListeners';
import { afterEach } from 'vitest';

describe('EventListeners', () => {
	let instance;
	const mockHandler = vi.fn();

	beforeEach(() => {
		instance = EventListeners.getInstance();
		instance.clearListeners();
	});

	it('should maintain singleton instance', () => {
		const instance2 = EventListeners.getInstance();
		expect(instance).toBe(instance2);
	});

	it('should trigger event with no listeners', async () => {
		await expect(instance.trigger('unknownEvent')).resolves.not.toThrow();
	});

	it('should handle event with multiple listeners', async () => {
		const handler1 = vi.fn();
		const handler2 = vi.fn();

		instance.on(EventListeners.LISTENER_EVENTS.BEFORE_RESPONSE, handler1);
		instance.on(EventListeners.LISTENER_EVENTS.AFTER_RESPONSE, handler2);

		await instance.trigger(EventListeners.LISTENER_EVENTS.BEFORE_RESPONSE, 'payload');

		expect(handler1).toHaveBeenCalledWith('payload');
		expect(handler2).not.toHaveBeenCalled();
	});

	it('should remove specific listener with off()', async () => {
		instance.on(EventListeners.LISTENER_EVENTS.BEFORE_RESPONSE, mockHandler);
		instance.off(EventListeners.LISTENER_EVENTS.BEFORE_RESPONSE, mockHandler);

		await instance.trigger(EventListeners.LISTENER_EVENTS.BEFORE_RESPONSE);
		expect(mockHandler).not.toHaveBeenCalled();
	});

	it('should remove all listeners for event with off()', async () => {
		instance.on(EventListeners.LISTENER_EVENTS.BEFORE_RESPONSE, vi.fn());
		instance.on(EventListeners.LISTENER_EVENTS.AFTER_RESPONSE, vi.fn());
		instance.off(EventListeners.LISTENER_EVENTS.BEFORE_RESPONSE);

		await instance.trigger(EventListeners.LISTENER_EVENTS.BEFORE_RESPONSE);
		expect(instance.listeners[EventListeners.LISTENER_EVENTS.BEFORE_RESPONSE]).toBeUndefined();
	});

	it('should handle async listeners', async () => {
		const asyncHandler = vi.fn().mockImplementation(async () => {
			await new Promise((resolve) => setTimeout(resolve, 50));
		});

		instance.on(EventListeners.LISTENER_EVENTS.AFTER_RESPONSE, asyncHandler);
		await instance.trigger(EventListeners.LISTENER_EVENTS.AFTER_RESPONSE);

		expect(asyncHandler).toHaveBeenCalled();
	});

	it('should clear all listeners', () => {
		instance.on(EventListeners.LISTENER_EVENTS.BEFORE_RESPONSE, vi.fn());
		instance.on(EventListeners.LISTENER_EVENTS.AFTER_RESPONSE, vi.fn());
		instance.clearListeners();    
    
		for (const [key, value] of instance.listeners.entries()) {
			expect(value).toEqual([]);
		}
	});

	it('should handle removing listener before trigger', () => {
		const mockListener = vi.fn();
		instance.on(EventListeners.LISTENER_EVENTS.BEFORE_RESPONSE, mockListener);
		instance.off(EventListeners.LISTENER_EVENTS.BEFORE_RESPONSE, mockListener);
		instance.trigger(EventListeners.LISTENER_EVENTS.BEFORE_RESPONSE);
		expect(mockListener).not.toHaveBeenCalled();
	});

	it('should return true when removing existing listener', () => {
		const mockListener = vi.fn();
		instance.on(EventListeners.LISTENER_EVENTS.BEFORE_RESPONSE, mockListener);
		expect(instance.off(EventListeners.LISTENER_EVENTS.BEFORE_RESPONSE, mockListener)).toBe(true);
	});

	it('should return false when removing non-existent listener', () => {
		const mockListener = vi.fn();
		expect(instance.off(EventListeners.LISTENER_EVENTS.BEFORE_RESPONSE, mockListener)).toBe(false);
	});

	it('clearAllListeners should remove all event subscriptions', () => {
		const mockListener1 = vi.fn();
		const mockListener2 = vi.fn();

		instance.on(EventListeners.LISTENER_EVENTS.BEFORE_RESPONSE, mockListener1);
		instance.on(EventListeners.LISTENER_EVENTS.AFTER_RESPONSE, mockListener2);
		instance.clearListeners();

		instance.trigger(EventListeners.LISTENER_EVENTS.BEFORE_RESPONSE);
		instance.trigger(EventListeners.LISTENER_EVENTS.AFTER_RESPONSE);

		expect(mockListener1).not.toHaveBeenCalled();
		expect(mockListener2).not.toHaveBeenCalled();
	});
});
