interface Callback<T> {
	(arg: T): void;
}

export class Event<T extends Function> implements chrome.events.Event<T> {
	private _listeners = new Set<T>();
	private _counter = 0;
	private _rules = new Map<string, chrome.events.Rule>();

	addListener(callback: T): void {
		this._listeners.add(callback);
	}

	getRules(ruleIdentifiers: string[], callback: (rules: chrome.events.Rule[]) => void): void;
	getRules(callback: (rules: chrome.events.Rule[]) => void): void;
	getRules(arg0: any, arg1?: any) {
		let rules: chrome.events.Rule[];
		let callback: (rules: chrome.events.Rule[]) => void;
		if (typeof arg0 === 'function') {
			rules = Array.from(this._rules.values());
			callback = arg0;
		} else {
			rules = (arg0 as string[]).map(id => this._rules.get(id)).filter(Boolean);
			callback = arg1;
		}
		callback(rules);
	}

	hasListener(callback: T): boolean {
		return this._listeners.has(callback);
	}

	removeRules(ruleIdentifiers: string[], callback?: () => void): void;
	removeRules(callback?: () => void): void;
	removeRules(arg0: any, arg1?: any) {
		let callback: () => void;
		if (typeof arg0 === 'function') {
			this._rules.clear();
			callback = arg0;
		} else {
			(arg0 as string[]).forEach(id => {
				this._rules.delete(id);
			});
			callback = arg1;
		}
		if (callback) callback();
	}

	addRules(rules: chrome.events.Rule[], callback?: (rules: chrome.events.Rule[]) => void): void {
		rules.forEach(rule => {
			if (rule.id === undefined) {
				rule.id = `_rule_${this._counter++}_`;
			}
			if (rule.tags === undefined) {
				rule.tags = [];
			}
			if (rule.priority === undefined) {
				rule.priority = 100;
			}
			this._rules.set(rule.id, rule);
		});
		if (callback) callback(rules);
	}

	removeListener(callback: T): void {
		this._listeners.delete(callback);
	}

	hasListeners(): boolean {
		return this._listeners.size > 0;
	}

	_emit: T
}

Event.prototype._emit = function() {
	setImmediate(() => {
		this._listeners.forEach((listener: Function) => {
			listener.apply(this, arguments);
		});
	});
};
