import { wrapAsync } from './runtime';

const { Launcher } = Windows.System;
const { Uri } = Windows.Foundation;

export const browser: typeof chrome.browser = {
	openTab: wrapAsync(async (options: chrome.browser.Options) => {
		await Launcher.launchUriAsync(new Uri(options.url));
	})
};
