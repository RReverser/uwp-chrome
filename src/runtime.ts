import { Event } from './events';
import { createPickedEntry } from './fileSystem';

const { Uri } = Windows.Foundation;
const { ApplicationViewSwitcher } = Windows.UI.ViewManagement;

const arch = ['x86-32', 'arm', 'x86-64'][Windows.ApplicationModel.Package.current.id.architecture] || 'unknown';

interface Callback<R> {
	(result?: R): void;
}

type UpdateStatus = 'throttled' | 'no_update' | 'update_available';

type UpdateCallbackArgs = ['throttled' | 'update_available', chrome.runtime.UpdateCheckDetails] | ['no_update'];

var lastError: Error = undefined;
var checkedLastError: boolean = true;

export async function doAsync<R>(func: (...args: any[]) => PromiseLike<R>, context: any, args: any[]) {
	let i = args.length - 1;
	for (; i >= 0 && args[i] === undefined; i--);
	let callback: Callback<R>;
	if (i >= 0) {
		let arg = args[i];
		if (typeof arg === 'function') {
			callback = arg as Callback<R>;
			i--;
		}
	}
	let res: R;
	try {
		res = await func.apply(context, args.slice(0, i + 1));
		lastError = undefined;
		checkedLastError = true;
	} catch (e) {
		lastError = e;
		checkedLastError = false;
	}
	if (callback) {
		callback(res);
	}
	if (!checkedLastError) {
		checkedLastError = true;
		throw new Error(`Unchecked runtime.lastError: ${lastError}.`);
	}
}

export function wrapAsync<R>(func: () => PromiseLike<R>): (callback: Callback<R>) => void;
export function wrapAsync<T0, R>(func: (arg0: T0) => PromiseLike<R>): (arg0: T0, callback?: Callback<R>) => void;
export function wrapAsync<T0, T1, R>(func: (arg0: T0, arg1: T1) => PromiseLike<R>): (arg0: T0, arg1: T1, callback?: Callback<R>) => void;
export function wrapAsync<T0, T1, T2, R>(func: (arg0: T0, arg1: T1, arg2: T2) => PromiseLike<R>): (arg0: T0, arg1: T1, arg2: T2, callback?: Callback<R>) => void;
export function wrapAsync<T, R>(func: (...args: T[]) => PromiseLike<R>): (...args: (T | Callback<R>)[]) => void {
	return function(...args) {
		doAsync(func, this, args);
	};
}

const onConnect: chrome.runtime.ExtensionConnectEvent = new Event();
const onConnectExternal: chrome.runtime.RuntimeEvent = new Event();
const onSuspend: chrome.runtime.RuntimeEvent = new Event();
const onStartup: chrome.runtime.RuntimeEvent = new Event();
const onInstalled: chrome.runtime.RuntimeInstalledEvent = new Event();
const onSuspendCanceled: chrome.runtime.RuntimeEvent = new Event();
const onMessage: chrome.runtime.ExtensionMessageEvent = new Event();
const onMessageExternal: chrome.runtime.ExtensionMessageEvent = new Event();
const onRestartRequired: chrome.runtime.RuntimeRestartRequiredEvent = new Event();
const onUpdateAvailable: chrome.runtime.RuntimeUpdateAvailableEvent = new Event();
const onBrowserUpdateAvailable: chrome.runtime.RuntimeEvent = new Event();

export const runtime: typeof chrome.runtime = {
	onConnect,
	onConnectExternal,
	onSuspend,
	onStartup,
	onInstalled,
	onSuspendCanceled,
	onMessage,
	onMessageExternal,
	onRestartRequired,
	onUpdateAvailable,
	onBrowserUpdateAvailable,

	get lastError() {
		checkedLastError = true;
		return lastError;
	},

	get id() {
		return shim.id;
	},

	getManifest() {
		return shim.manifest;
	},

	getURL(path: string) {
		return new Uri(`ms-appx-web:///`, path).absoluteUri;
	},

	reload() {
		location.reload();
	},

	restart() {},

	setUninstallURL: wrapAsync(async () => {
		throw new Error('Windows app cannot trigger custom actions on removal.');
	}),

	getPlatformInfo: wrapAsync(() => Promise.resolve({
		os: 'win',
		arch,
		nacl_arch: arch
	})),

	requestUpdateCheck(callback: (status: UpdateStatus, details?: chrome.runtime.UpdateCheckDetails) => void) {
		if (shim.requestUpdateCheck) {
			let checkResult: UpdateCallbackArgs;
			doAsync(async () => {
				checkResult = await shim.requestUpdateCheck();
			}, this, [() => callback.apply(null, checkResult)]);
		} else {
			callback('no_update');
		}
	},

	getBackgroundPage: wrapAsync(() => shim.getBackgroundPage()),

	openOptionsPage: wrapAsync(async () => {
		let manifest = runtime.getManifest();
		let { page = manifest.options_page } = manifest.options_ui;
		if (!page) {
			throw new Error('No options page found in manifest.');
		}
		window.open(page);
	}),

	getPackageDirectoryEntry: wrapAsync(async () => {
		return createPickedEntry(Windows.ApplicationModel.Package.current.installedLocation);
	})
};

export function requireSetup<T>(name: string, setup: (shim: T) => void) {
	function setupWrapper(shim: T) {
		clearImmediate(warning);
		setup(shim);
	}

	let warning = setImmediate(() => {
		console.warn(`chrome.${name}::setup({ ... }) needs to be called during initialization, but wasn't.`);
	});
}

interface Shim {
	id: string;
	manifest: chrome.runtime.Manifest;
	requestUpdateCheck?: () => Promise<UpdateCallbackArgs>;
	getBackgroundPage?: () => Promise<Window>;
}

var shim: Shim;

export const setup = requireSetup('runtime', (passedShim: Shim) => {
	shim = passedShim;
});
