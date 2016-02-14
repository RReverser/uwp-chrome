import { doAsync } from './runtime';

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

	private async _getRules(ruleIdentifiers?: string[]) {
		if (ruleIdentifiers) {
			return ruleIdentifiers.map(id => this._rules.get(id)).filter(Boolean);
		} else {
			return Array.from(this._rules.values());
		}
	}

	getRules(ruleIdentifiers: string[], callback: (rules: chrome.events.Rule[]) => void): void;
	getRules(callback: (rules: chrome.events.Rule[]) => void): void;
	getRules(...args: (string[] | ((rules: chrome.events.Rule[]) => void))[]) {
		doAsync(this._getRules, this, args);
	}

	hasListener(callback: T): boolean {
		return this._listeners.has(callback);
	}

	private async _removeRules(ruleIdentifiers?: string[]) {
		if (ruleIdentifiers) {
			for (let id of ruleIdentifiers) {
				this._rules.delete(id);
			}
		} else {
			this._rules.clear();
		}
	}

	removeRules(ruleIdentifiers: string[], callback?: () => void): void;
	removeRules(callback?: () => void): void;
	removeRules(...args: (string[] | (() => void))[]) {
		doAsync(this._removeRules, this, args);
	}

	private async _addRules(rules: chrome.events.Rule[]) {
		for (let rule of rules) {
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
		}
		return rules;
	}

	addRules(rules: chrome.events.Rule[], callback?: (rules: chrome.events.Rule[]) => void): void;
	addRules(...args: (chrome.events.Rule[] | ((rules: chrome.events.Rule[]) => void))[]) {
		doAsync(this._addRules, this, args);
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
		for (let listener of this._listeners) {
			listener.apply(this, arguments);
		}
	});
};
