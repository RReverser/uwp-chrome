import { wrapAsync } from './runtime';
import { Event } from './events';

const { ToastNotification, ToastNotificationManager, ToastDismissalReason, NotificationSetting } = Windows.UI.Notifications;
const { XmlDocument } = Windows.Data.Xml.Dom;

const toastNotifier = ToastNotificationManager.createToastNotifier();

var counter = 0;

const onClosed = new Event<(notificationId: string, byUser: boolean) => void>();
const onClicked = new Event<(notificationId: string) => void>();
const onButtonClicked = new Event<(notificationId: string, buttonIndex: number) => void>();

class JSXML {
	public document = new XmlDocument();

	addChildren(parent: JSX.Element, children: (JSX.Element | JSX.Element[] | string)[]) {
		for (let child of children) {
			if (typeof child === 'string') {
				parent.appendChild(this.document.createTextNode(child));
			} else if (Array.isArray(child)) {
				this.addChildren(parent, child);
			} else if (child) {
				parent.appendChild(child);
			}
		}
	}

	createElement(type: string, props: { [key: string]: any }, ...children: (JSX.Element | JSX.Element[] | string)[]) {
		let element = this.document.createElement(type);
		if (props) {
			for (let key in props) {
				if (props[key]) {
					element.setAttribute(key, props[key]);
				}
			}
		}
		this.addChildren(element, children);
		return element;
	}
}

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
		const jsx = new JSXML();
		jsx.document.appendChild(<toast>
			<visual>
				<binding template="ToastGeneric">
					<text>{options.title}</text>
					<text>
						{options.message}
						{options.items && options.items.map(item => `${item.title}: ${item.message}`).join('\n')}
					</text>
					{options.iconUrl && <image placement="appLogoOverride" src={options.iconUrl} />}
					{options.type === 'image' && <image placement="inline" src={options.imageUrl} />}
				</binding>
				{options.buttons && <actions>{
					options.buttons.map((button, i) => <action imageUri={button.iconUrl} content={button.title} arguments={i.toString()} />)
				}</actions>}
			</visual>
		</toast>);
		let toast = new ToastNotification(jsx.document);
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
