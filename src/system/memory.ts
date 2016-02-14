import { wrapAsync } from '../runtime';

const { MemoryManager } = Windows.System;

export const memory: typeof chrome.system.memory = {
	getInfo: wrapAsync(async () => {
		let { appMemoryUsageLimit, appMemoryUsage } = MemoryManager;
		return {
			availableCapacity: appMemoryUsageLimit - appMemoryUsage,
			capacity: appMemoryUsageLimit
		};
	})
};