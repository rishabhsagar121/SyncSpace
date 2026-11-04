import { EventEmitter } from 'node:events';

class DomainEvents extends EventEmitter {}

export const domainEvents = new DomainEvents();
domainEvents.setMaxListeners(50);