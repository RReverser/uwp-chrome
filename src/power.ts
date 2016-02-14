import { wrapAsync } from './runtime';

const displayRequest = new Windows.System.Display.DisplayRequest();

export const power: typeof chrome.power = {
	requestKeepAwake(level: 'system' | 'display') {
		displayRequest.requestActive();
	},

	releaseKeepAwake() {
		displayRequest.requestRelease();
	}
};
