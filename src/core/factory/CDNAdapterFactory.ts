import { ICDNAdapter } from '../../types';

export type AdapterConstructor = new (...args: any[]) => ICDNAdapter;

export class CDNAdapterFactory {
	private static instance: CDNAdapterFactory;
	private adapters: Map<string, AdapterConstructor>;

	private constructor() {
		this.adapters = new Map();
	}

	static getInstance(): CDNAdapterFactory {
		if (!CDNAdapterFactory.instance) {
			CDNAdapterFactory.instance = new CDNAdapterFactory();
		}
		return CDNAdapterFactory.instance;
	}

	registerAdapter(name: string, adapterClass: AdapterConstructor): void {
		if (this.adapters.has(name)) {
			throw new Error(`Adapter ${name} is already registered`);
		}
		this.adapters.set(name, adapterClass);
	}

	createAdapter(name: string, ...args: any[]): ICDNAdapter {
		const AdapterClass = this.adapters.get(name);
		if (!AdapterClass) {
			throw new Error(`No adapter registered for ${name}`);
		}
		return new AdapterClass(...args);
	}

	hasAdapter(name: string): boolean {
		return this.adapters.has(name);
	}

	getRegisteredAdapters(): string[] {
		return Array.from(this.adapters.keys());
	}
}
