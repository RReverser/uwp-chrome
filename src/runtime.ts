import { Event } from './events';

const { Uri } = Windows.Foundation;

const arch = ['x86-32', 'arm', 'x86-64'][Windows.ApplicationModel.Package.current.id.architecture] || 'unknown';

interface Callback<R> {
	(result?: R): void;
}

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
		callback();
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

	id: '',
	
	getManifest() {
		return manifest;
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
	}))
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
}

var manifest: chrome.runtime.Manifest;

export const setup = requireSetup('runtime', (shim: Shim) => {
	runtime.id = shim.id;
	manifest = shim.manifest;
});
