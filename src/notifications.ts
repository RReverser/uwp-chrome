/*
Namespace: chrome.wallpaper
Issues:
 - progress notification is not (can not be) implemented in UWP
 - notification update is not implemented (need to investigate whether possible)
 - onShowSettings is not implemented (anyway "As of Chrome 47, only ChromeOS has UI that dispatches this event.")
 - onPermissionLevelChanged is not implemented (same)
*/

import { wrapAsync } from './runtime';
import { Event } from './events';

const { ToastNotification, ToastNotificationManager, ToastDismissalReason, NotificationSetting } = Windows.UI.Notifications;
const { XmlDocument } = Windows.Data.Xml.Dom;

const toastNotifier = ToastNotificationManager.createToastNotifier();

var counter = 0;

const onClosed = new Event<(notificationId: string, byUser: boolean) => void>();
const onClicked = new Event<(notificationId: string) => void>();
const onButtonClicked = new Event<(notificationId: string, buttonIndex: number) => void>();

export const notifications: typeof chrome.notifications = {
	onClosed,
	onClicked,
	onButtonClicked,
	onPermissionLevelChanged: new Event<(level: string) => void>(),
	onShowSettings: new Event<() => void>(),

	create: wrapAsync(async (arg0: any, arg1?: any) => {
		let notificationId: string;
		let options: chrome.notifications.NotificationOptions;
		if (typeof arg0 === 'string') {
			notificationId = arg0;
			options = arg1;
		} else {
			notificationId = `_notification_${counter++}_`;
			options = arg0;
		}
		if (options.type !== 'basic' && options.type !== 'image' && options.type !== 'list') {
			throw new TypeError(`Unsupported notification type ${options.type}`);
		}
		let toastXML = new XmlDocument();
		const xml = (type: string, props: { [key: string]: string }, ...children: (Windows.Data.Xml.Dom.IXmlNode | string)[]) => {
			let element = toastXML.createElement(type);
			if (props) {
				for (let key in props) {
					if (props[key]) {
						element.setAttribute(key, props[key]);
					}
				}
			}
			for (let child of children) {
				if (child) {
					if (typeof child === 'string') {
						child = toastXML.createTextNode(child as string);
					}
					element.appendChild(child as Windows.Data.Xml.Dom.IXmlNode);
				}
			}
			return element;
		};
		toastXML.appendChild(xml(
			'toast',
			null,
			xml('visual', null, xml(
				'binding',
				{ template: 'ToastGeneric' },
				xml('text', null, options.title),
				options.message && xml('text', null, options.message),
				...(options.items || []).map(item => xml('text', null, `${item.title}: ${item.message}`)),
				options.iconUrl && xml('image', { placement: 'appLogoOverride', src: options.iconUrl }),
				options.type === 'image' && xml('image', { placement: 'inline', src: options.imageUrl })
			)),
			options.buttons && options.buttons.length && xml(
				'actions',
				null,
				...options.buttons.map((button, i) => xml('action', {
					imageUri: button.iconUrl,
					content: button.title,
					arguments: String(i)
				}))
			)
		));
		let toast = new ToastNotification(toastXML);
		toast.tag = notificationId;
		toast.onactivated = ({ detail: [{ arguments: args }]}) => {
			if (args) {
				onButtonClicked._emit(notificationId, +args);
			} else {
				onClicked._emit(notificationId);
			}
		};
		toast.ondismissed = ({ reason }) => onClosed._emit(notificationId, reason == ToastDismissalReason.userCanceled);
		toastNotifier.show(toast);
		return notificationId;
	}),

	update: wrapAsync(async (notificationId: string, options: chrome.notifications.NotificationOptions) => {
		return false;
	}),

	clear: wrapAsync(async (notificationId: string) => {
		ToastNotificationManager.history.remove(notificationId);
		return true;
	}),

	getAll: wrapAsync(async () => ToastNotificationManager.history.getHistory().reduce((obj, item) => {
		obj[item.tag] = true;
		return obj;
	}, {} as { [notificationId: string]: boolean })),

	getPermissionLevel: wrapAsync(async () => toastNotifier.setting === NotificationSetting.enabled ? 'granted' : 'denied')
};
