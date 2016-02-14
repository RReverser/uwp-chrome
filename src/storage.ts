import { doAsync, wrapAsync } from './runtime';
import { Event } from './events';

const { ApplicationData, ApplicationDataCreateDisposition } = Windows.Storage;
type ApplicationDataContainer = Windows.Storage.ApplicationDataContainer;
type IPropertySet = Windows.Foundation.Collections.IPropertySet;
type StorageChange = chrome.storage.StorageChange;

const appData = ApplicationData.current;

type Keys = string | string[];

interface Items {
	[key: string]: any;
}

interface StorageChanges {
	[key: string]: StorageChange;
}

interface Change {
	oldPair: { key: string, value?: any };
	newValue?: any;
}

const onChanged = new Event<(changes: StorageChanges, areaName: string) => void>();

class ReadOnlyStorageArea implements chrome.storage.StorageArea {
	protected _values: IPropertySet;

	constructor(rootContainer: ApplicationDataContainer, protected _name: string) {
		this._values = rootContainer.createContainer(`chrome.storage.${name}`, ApplicationDataCreateDisposition.always).values;
	}

	protected _normalizeKeys(keys: Keys) {
		return typeof keys === 'string' ? [keys] : keys;
	}

	protected *_iterateKeyValues(keys?: Keys): IterableIterator<{ key: string, value?: any }> {
		if (keys !== undefined) {
			for (let key of this._normalizeKeys(keys)) {
				let pair: { key: string, value?: any } = { key };
				if (this._values.hasKey(key)) {
					pair.value = this._values.lookup(key);
				}
				yield pair;
			}
		} else {
			const iterator = this._values.first();
			while (iterator.hasCurrent) {
				yield iterator.current;
				iterator.moveNext();
			}
		}
	}

	private async _getBytesInUse(keys?: Keys) {
		/*
		let size = 0;
		for (let { key, value } of this._iterateKeyValues(keys)) {
			size += encodeURIComponent(value).replace(/%[0-9a-f]{2}/ig, '_').length;
		}
		return size;
		*/
		return 0;
	}

	getBytesInUse(callback: (bytesInUse: number) => void): void;
	getBytesInUse(keys: Keys, callback: (bytesInUse: number) => void): void;
	getBytesInUse(...args: any[]) {
		doAsync(this._getBytesInUse, this, args);
	}

	private _readOnly() {
		return Promise.reject(new TypeError('Attempt to write to read-only storage.'));
	}

	protected _clear() {
		return this._readOnly();
	}

	clear(callback?: () => void): void;
	clear(...args: (() => void)[]) {
		doAsync(this._clear, this, args);
	}

	protected _set(items: Items) {
		return this._readOnly();
	}

	set(items: Items, callback?: () => void): void;
	set(...args: (Items | (() => void))[]) {
		doAsync(this._set, this, args);
	}

	protected _remove(keys: Keys) {
		return this._readOnly();
	}

	remove(keys: Keys, callback?: () => void): void;
	remove(...args: (Keys | (() => void))[]) {
		doAsync(this._remove, this, args);
	}

	protected async _get(keysOrItems?: Keys | Items) {
		let keys: Keys;
		let result: Items = {};

		if (typeof keysOrItems === 'string' || Array.isArray(keysOrItems)) {
			keys = keysOrItems;
		} else if (keysOrItems !== undefined) {
			keys = Object.keys(keysOrItems);
			Object.assign(result, keysOrItems);
		}

		for (let { key, value } of this._iterateKeyValues(keys)) {
			result[key] = value;
		}

		return result;
	}

	get(callback: (items: Items) => void): void;
	get(keys: Keys | Items, callback: (items: Items) => void): void;
	get(...args: (Keys | Items | ((items: Items) => void))[]) {
		doAsync(this._get, this, args);
	}
}

class StorageArea extends ReadOnlyStorageArea {
	private _emit(changeList: Change[]) {
		let changes: StorageChanges = {};
		for (let change of changeList) {
			let storageChange: StorageChange = {};
			let pair = change.oldPair;
			if ('value' in pair) {
				storageChange.oldValue = pair.value;
			}
			if ('newValue' in change) {
				storageChange.newValue = change.newValue;
			}
			changes[pair.key] = change;
		}
		onChanged._emit(changes, this._name);
	}

	protected async _clear() {
		let changes = Array.from(this._iterateKeyValues(), pair => ({ oldPair: pair }));
		this._values.clear();
		this._emit(changes);
	}

	protected async _set(items: Items) {
		let changes: Change[] = [];
		try {
			for (let pair of this._iterateKeyValues(Object.keys(items))) {
				let { key } = pair;
				let newValue = items[key];
				this._values.insert(key, newValue);
				changes.push({ oldPair: pair, newValue });
			}
		} finally {
			this._emit(changes);
		}
	}

	protected async _remove(keys: Keys) {
		let changes: Change[] = [];
		try {
			for (let pair of this._iterateKeyValues(keys)) {
				this._values.remove(pair.key);
				changes.push({ oldPair: pair });
			}
		} finally {
			this._emit(changes);
		}
	}
}

class LocalStorageArea extends StorageArea implements chrome.storage.LocalStorageArea {
	// No quota in UWP, but just to simulate Chrome:
	QUOTA_BYTES = 5 << 20;

	constructor() {
		super(appData.localSettings, 'local');
	}
}

class SyncStorageArea extends StorageArea implements chrome.storage.SyncStorageArea {
	// roamingStorageQuota currently defaults to 100 KB, which matches Chrome value
	QUOTA_BYTES = appData.roamingStorageQuota << 10;

	// https://msdn.microsoft.com/en-us/library/windows/apps/windows.storage.applicationdata.roamingsettings.aspx
	// Also matches Chrome value:
	QUOTA_BYTES_PER_ITEM = 8 << 10;

	// Simulating Chrome
	MAX_ITEMS = 512;

	// Deprecated, so just setting to same value as latest Chrome:
	MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE = 1e6;

	// Simulating Chrome
	MAX_WRITE_OPERATIONS_PER_HOUR = 1800;

	// Simulating Chrome
	MAX_WRITE_OPERATIONS_PER_MINUTE = 120;

	constructor() {
		super(appData.roamingSettings, 'sync');
	}
}

class ManagedStorageArea extends ReadOnlyStorageArea {
	constructor() {
		super(appData.localSettings, 'managed');
	}
}

export const storage: typeof chrome.storage = {
	onChanged,

	local: new LocalStorageArea(),
	sync: new SyncStorageArea(),
	managed: new ManagedStorageArea()
};
