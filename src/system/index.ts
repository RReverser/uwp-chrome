import { display } from './display';
import { memory } from './memory';

export const system: typeof chrome.system = {
	display,
	memory
};
