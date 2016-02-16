import { Event } from './events';

const arch = ['x86-32', 'arm', 'x86-64'][Windows.ApplicationModel.Package.current.id.architecture];

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

export const runtime: typeof chrome.runtime = {
	get lastError() {
		checkedLastError = true;
		return lastError;
	},

	id: Windows.ApplicationModel.Store.CurrentApp.appId,

	getPlatformInfo: wrapAsync(async () => ({
		os: 'win',
		arch,
		nacl_arch: arch
	}))
};
