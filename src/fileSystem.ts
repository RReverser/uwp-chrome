import { wrapAsync, runtime } from './runtime';
import { createStorageEntry, StorageEntry } from '../../uwp-filesystem-shim/src/StorageEntry';
import { StorageFileEntry } from '../../uwp-filesystem-shim/src/StorageFileEntry';
import { StorageFileSystem } from '../../uwp-filesystem-shim/src/StorageFileSystem';

const { FileOpenPicker, FileSavePicker, FolderPicker } = Windows.Storage.Pickers;
const { CryptographicBuffer } = Windows.Security.Cryptography;
const { mostRecentlyUsedList } = Windows.Storage.AccessCache.StorageApplicationPermissions;

async function isWritableEntry(entry: Entry) {
	if (entry instanceof StorageFileEntry) {
		try {
			let stream = await entry._storageItem.openAsync(Windows.Storage.FileAccessMode.readWrite);
			stream.close();
			return true;
		} catch (err) {
			return false;
		}
	} else {
		return true;
	}
}

class IsolatedFileSystem extends StorageFileSystem {
	constructor(folder: Windows.Storage.StorageFolder, fsName = `chrome-extension_${runtime.id}_0:Isolated_${CryptographicBuffer.encodeToHexString(CryptographicBuffer.generateRandom(16))}`) {
		super(fsName, folder);
		Object.defineProperty(this.root, 'name', {
			value: ''
		});
	}
}

export async function createPickedEntry(item: Windows.Storage.IStorageItem, fsName?: string): Promise<Entry> {
	let entry = createStorageEntry(new IsolatedFileSystem(await item.getParentAsync(), fsName), item);
	entry.toURL = () => '';
	return entry;
}

export const fileSystem: typeof chrome.fileSystem = {
	getDisplayPath: wrapAsync(async (entry: Entry) => entry.fullPath),

	isWritableEntry: wrapAsync(isWritableEntry),

	getWritableEntry: wrapAsync(async (entry: Entry) => {
		if (await isWritableEntry(entry)) {
			return entry;
		} else {
			throw new Error('Entry is not writable.');
		}
	}),

	chooseEntry: wrapAsync(async (options?: chrome.fileSystem.ChooseEntryOptions) => {
		switch (options.type) {
			case 'openFile':
			case 'openWritableFile': {
				let picker = new FileOpenPicker();
				if (options.accepts) {
					let filter = picker.fileTypeFilter;
					for (let accept of options.accepts) {
						for (let ext of accept.extensions) {
							filter.append(`.${ext}`);
						}
					}
				}
				if (options.acceptsMultiple) {
					let files: Windows.Storage.Pickers.FilePickerSelectedFilesArray = await picker.pickMultipleFilesAsync();
					return Promise.all(files.map(file => createPickedEntry(file)));
				} else {
					return createPickedEntry(await picker.pickSingleFileAsync());
				}
			}

			case 'openDirectory': {
				return createPickedEntry(await new FolderPicker().pickSingleFolderAsync());
			}

			case 'saveFile': {
				let picker = new FileSavePicker();
				if (options.suggestedName) {
					picker.suggestedFileName = options.suggestedName;
				}
				if (options.accepts) {
					let choices = picker.fileTypeChoices;
					for (let accept of options.accepts) {
						if (accept.extensions) {
							let { description } = accept;
							if (!description && accept.mimeTypes) {
								description = accept.mimeTypes.map(type => type.replace(/.*?\//, '')).join(', ').toUpperCase();
							}
							if (!description) {
								description = accept.extensions.join(', ').toUpperCase();
							}
							choices.insert(description, accept.extensions);
						}
					}
				}
				return createPickedEntry(await picker.pickSaveFileAsync());
			}
		}
	}),

	retainEntry(entry) {
		if (entry instanceof StorageEntry) {
			mostRecentlyUsedList.add(entry._storageItem as Windows.Storage.IStorageItem, entry.filesystem.name);
		}
		return '';
	},

	isRestorable(token) {
		return mostRecentlyUsedList.containsItem(token);
	},

	restoreEntry: wrapAsync(async (id: string) => {
		let item = await mostRecentlyUsedList.getItemAsync(id);
		return createPickedEntry(
			item,
			mostRecentlyUsedList.entries.find(entry => entry.token === id).metadata
		);
	}),

	getVolumeList: wrapAsync(async () => {
		throw new Error('Operation not supported on the current platform.');
	}),

	requestFileSystem: wrapAsync(async (options: { volumeId: string, writable?: boolean }) => {
		throw new Error('Operation not supported on the current platform.');
	})
};
