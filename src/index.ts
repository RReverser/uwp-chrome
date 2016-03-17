import { browser } from './browser';
import { fileSystem } from './fileSystem';
import { identity } from './identity';
import { notifications } from './notifications';
import { power } from './power';
import { runtime, RuntimeShim, setupRuntime } from './runtime';
import { sockets } from './sockets';
import { storage } from './storage';
import { system } from './system';
import { tts } from './tts';
import { wallpaper } from './wallpaper';

export {
	browser,
	fileSystem,
	identity,
	notifications,
	power,
	runtime,
	storage,
	system,
	tts,
	wallpaper
};

export function setup(shim: RuntimeShim) {
	setupRuntime(shim);
}
