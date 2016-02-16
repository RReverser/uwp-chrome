import { wrapAsync } from '../runtime';
import { Event } from '../events';

const { DisplayInformation, DisplayOrientations } = Windows.Graphics.Display;

const onDisplayChanged = new Event<() => void>();

const displayInfo = DisplayInformation.getForCurrentView();

function emitDisplayChanged() {
	onDisplayChanged._emit();
}

['colorprofilechanged', 'dpichanged', 'orientationchanged'].forEach(eventType => {
	displayInfo.addEventListener(eventType, emitDisplayChanged);
});

export const display: typeof chrome.system.display = {
	onDisplayChanged,
	
	getInfo: wrapAsync(async () => {
		return [{
			id: '0',
			name: 'Active Windows monitor',
			mirroringSourceId: '',
			isPrimary: true,
			isInternal: false,
			isEnabled: true,
			dpiX: displayInfo.rawDpiX,
			dpiY: displayInfo.rawDpiY,
			rotation: Math.abs(displayInfo.nativeOrientation - displayInfo.currentOrientation) * 90,
			bounds: {
				left: 0,
				top: 0,
				width: screen.width,
				height: screen.height
			},
			overscan: {
				left: 0,
				top: 0,
				right: 0,
				bottom: 0
			},
			workArea: {
				left: 0,
				top: 0,
				width: screen.availWidth,
				height: screen.availHeight
			}
		}];
	}),
	
	setDisplayProperties: wrapAsync(async (id: string, info: chrome.system.display.DisplayInfo) => {
		throw new Error('Cannot change display properties from Windows app.');
	})
};
