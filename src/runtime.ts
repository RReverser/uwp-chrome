/*
Namespace: chrome.runtime
Issues:
 - ... (almost nothing is implemented yet) ...
*/

import { Event } from './events';

interface Callback<R> {
	(result?: R): void;
}

var lastError: Error = undefined;

export function doAsync<T, R>(func: (...args: T[]) => PromiseLike<R>, context: any, args: (T | Callback<R>)[]) {
	let callback = args[args.length - 1] as Callback<R>;
	if (typeof callback === 'function') {
		args.length--;
	} else {
		callback = undefined;
	}
	(func.apply(context, args) as PromiseLike<R>).then(
		callback,
		err => {
			lastError = err;
			if (callback) callback();
			if (lastError !== undefined) {
				console.warn(`Unchecked runtime.lastError: ${lastError.message}.`);
			}
		}
	);
}

export function wrapAsync<R>(func: () => PromiseLike<R>): (callback: Callback<R>) => void;
export function wrapAsync<T0, R>(func: (arg0: T0) => PromiseLike<R>): (arg0: T0, callback: Callback<R>) => void;
export function wrapAsync<T0, T1, R>(func: (arg0: T0, arg1: T1) => PromiseLike<R>): (arg0: T0, arg1: T1, callback: Callback<R>) => void;
export function wrapAsync<T0, T1, T2, R>(func: (arg0: T0, arg1: T1, arg2: T2) => PromiseLike<R>): (arg0: T0, arg1: T1, arg2: T2, callback: Callback<R>) => void;
export function wrapAsync<T, R>(func: (...args: T[]) => PromiseLike<R>): (...args: (T | Callback<R>)[]) => void {
	return function(...args) {
		doAsync(func, this, args);
	};
}

export const runtime: typeof chrome.runtime = {
	get lastError() {
		let err = lastError;
		lastError = undefined;
		return err;
	},

	id: Windows.ApplicationModel.Store.CurrentApp.appId
};
