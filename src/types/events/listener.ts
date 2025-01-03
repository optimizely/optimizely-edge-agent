import { Decision } from './decision';

export type EventType = 
  | 'beforeDecide'
  | 'afterDecide'
  | 'beforeCacheResponse'
  | 'afterCacheResponse'
  | 'beforeDatafileGet'
  | 'afterDatafileGet';

type EventListener = (data: unknown) => Promise<Record<string, unknown>>;

type EventListenerMap = {
  [key: string]: EventListener[];
}

type DecisionEvent = {
  decisions: Decision[];
  metadata?: Record<string, unknown>;
}

export type { EventListener, EventListenerMap, DecisionEvent };
