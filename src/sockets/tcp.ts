import { doAsync, wrapAsync } from '../runtime';
import { Event } from '../events';

const { HostName, Sockets: { StreamSocket, SocketProtectionLevel } } = Windows.Networking;
const { DataReader, DataWriter, InputStreamOptions } = Windows.Storage.Streams;
type StreamSocket = Windows.Networking.Sockets.StreamSocket;
type StreamSocketControl = Windows.Networking.Sockets.StreamSocketControl;
type SocketProperties = chrome.sockets.tcp.SocketProperties;

var counter = 0;

class SocketEntry {
	props: SocketProperties = {
		persistent: false
	};
	paused = false;
	connected = false;
	socket = new StreamSocket();
	dataReader = new DataReader(this.socket.inputStream);
	dataWriter = new DataWriter(this.socket.outputStream);

	constructor(public socketId: number, props?: SocketProperties) {
		this.dataReader.inputStreamOptions = InputStreamOptions.partial;
		if (props) {
			this.setProps(props);
		}
	}

	setProps(props: SocketProperties) {
		Object.assign(this.props, props);
	}

	async resume() {
		try {
			while (this.connected && !this.paused) {
				await this.dataReader.loadAsync(this.props.bufferSize || 4096);
				if (!this.connected || this.paused) {
					break;
				}
				let { unconsumedBufferLength } = this.dataReader;
				if (unconsumedBufferLength === 0) {
					this.connected = false;
					break;
				}
				let bytes = new Uint8Array(unconsumedBufferLength);
				this.dataReader.readBytes(bytes);
				onReceive._emit({
					socketId: this.socketId,
					data: bytes.buffer
				});
			}
		} catch (err) {
			this.paused = true;
			onReceiveError._emit({
				socketId: this.socketId,
				resultCode: (err as Windows.WinRTError).number
			});
		}
	}
}

type TLSVersion = 'tls1' | 'tls1.1' | 'tls1.2';

interface SecureOptions {
	tlsVersion?: {
		min?: TLSVersion;
		max?: TLSVersion;
	}
}

const sockets = new Map<number, SocketEntry>();

async function tryWithSocket(socketId: number, action: (entry: SocketEntry) => void | PromiseLike<void>) {
	try {
		await action(sockets.get(socketId));
		return 0;
	} catch (err) {
		if (err.name !== 'WinRTError') throw err;
		return (err as Windows.WinRTError).number;
	}
}

function getSocketInfo(socket: SocketEntry): chrome.sockets.tcp.SocketInfo {
	let { props, socket: { information: info } } = socket;

	return {
		socketId: socket.socketId,
		persistent: props.persistent,
		name: props.name,
		bufferSize: props.bufferSize,
		paused: socket.paused,
		connected: socket.connected,
		localAddress: info.localAddress.rawName,
		localPort: +info.localPort,
		peerAddress: info.remoteAddress.rawName,
		peerPort: +info.remotePort
	};
}

const onReceive = new Event<(info: chrome.sockets.tcp.ReceiveEventArgs) => void>();
const onReceiveError = new Event<(info: chrome.sockets.tcp.ReceiveErrorEventArgs) => void>();

function connect(socketId: number, peerAddress: string, peerPort: number): Promise<number> {
	return tryWithSocket(socketId, async (entry) => {
		await entry.socket.connectAsync(new HostName(peerAddress), peerPort.toString());
		entry.connected = true;
	});
}

export const tcp: typeof chrome.sockets.tcp = {
	onReceive,
	onReceiveError,

	create: wrapAsync(async (props?: SocketProperties) => {
		let socketId = counter++;
		sockets.set(socketId, new SocketEntry(socketId, props));
		return { socketId };
	}),

	update: wrapAsync(async (socketId: number, props: SocketProperties) => {
		sockets.get(socketId).setProps(props);
	}),

	setPaused: wrapAsync(async (socketId: number, paused: boolean) => {
		let entry = sockets.get(socketId);
		if (paused !== entry.paused) {
			entry.paused = paused;
			if (!paused) {
				entry.resume();
			}
		}
	}),

	setKeepAlive: wrapAsync((socketId: number, enable: boolean, delay?: number) => tryWithSocket(socketId, entry => {
		entry.socket.control.keepAlive = enable;
	})) as typeof chrome.sockets.tcp.setKeepAlive,

	setNoDelay: wrapAsync((socketId: number, noDelay: boolean) => tryWithSocket(socketId, entry => {
		entry.socket.control.noDelay = noDelay;
	})),

	connect(socketId: number, peerAddress: string, peerPort: number, callback: (result: number) => void) {
		doAsync(connect, this, [socketId, peerAddress, peerPort, callback]).then(() => {
			// Gave a chance to pause reading in advance.
			// Prevents https://code.google.com/p/chromium/issues/detail?id=467677
			sockets.get(socketId).resume();
		});
	},

	disconnect: wrapAsync(async (socketId: number) => {
		let entry = sockets.get(socketId);
		entry.connected = false;
		await entry.socket.cancelIOAsync();
	}),

	secure: wrapAsync(async (socketId: number, options?: SecureOptions) => {
		let { socket } = sockets.get(socketId);
		let level = SocketProtectionLevel.tls12;
		if (options) {
			let { tlsVersion } = options;
			if (tlsVersion) {
				let { max } = tlsVersion;
				switch (max) {
					case 'tls1.1':
						level = SocketProtectionLevel.tls11;
						break;
					case 'tls1':
						level = SocketProtectionLevel.tls10;
						break;
				}
			}
		}
		await socket.upgradeToSslAsync(level, socket.information.remoteHostName);
	}),

	send: wrapAsync(async (socketId: number, data: ArrayBuffer) => {
		let { dataWriter } = sockets.get(socketId);
		try {
			dataWriter.writeBytes(new Uint8Array(data));
			return {
				resultCode: 0,
				bytesSent: await dataWriter.storeAsync()
			};
		} catch (err) {
			if (err.name !== 'WinRTError') throw err;
			return {
				resultCode: (err as Windows.WinRTError).number
			};
		}
	}),

	close: wrapAsync(async (socketId: number) => {
		let { socket } = sockets.get(socketId);
		sockets.delete(socketId);
		try {
			await socket.cancelIOAsync();
		} finally {
			socket.close();
		}
	}),

	getInfo: wrapAsync(async (socketId: number) => getSocketInfo(sockets.get(socketId))),

	getSockets: wrapAsync(async () => Array.from(sockets.values(), getSocketInfo))
};
