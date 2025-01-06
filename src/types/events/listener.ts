import type { Decision } from './decision';

export type EventType = 
  | 'beforeDecide'
  | 'afterDecide'
  | 'beforeCacheResponse'
  | 'afterCacheResponse'
  | 'beforeDatafileGet'
  | 'afterDatafileGet'
  | 'beforeResponse'
  | 'afterResponse'
  | 'beforeCreateCacheKey'
  | 'afterCreateCacheKey'
  | 'beforeRequest'
  | 'afterRequest'
  | 'beforeDetermineFlagsToDecide'
  | 'afterDetermineFlagsToDecide'
  | 'afterReadingCookie'
  | 'beforeReadingCache'
  | 'afterReadingCache'
  | 'beforeProcessingRequest'
  | 'afterProcessingRequest'
  | 'beforeDispatchingEvents'
  | 'afterDispatchingEvents';

type EventListener = (data: unknown) => Promise<Record<string, unknown>>;

type EventListenerMap = {
  [key: string]: EventListener[];
}

type DecisionEvent = {
  decisions: Decision[];
  metadata?: Record<string, unknown>;
}

export type { EventListener, EventListenerMap, DecisionEvent };
