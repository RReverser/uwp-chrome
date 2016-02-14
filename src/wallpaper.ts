import { wrapAsync } from './runtime';

const { UserProfilePersonalizationSettings } = Windows.System.UserProfile;
const { ApplicationData, CreationCollisionOption } = Windows.Storage;
const { BackgroundDownloader } = Windows.Networking.BackgroundTransfer;
const { Uri } = Windows.Foundation;
const { FileIO } = Windows.Storage;

const downloader = new BackgroundDownloader();
const tempFolder = ApplicationData.current.temporaryFolder;
const personalization = UserProfilePersonalizationSettings.current;

function getThumbnail(file: Windows.Storage.IStorageFile) {
	let img = new Image();
	img.src = URL.createObjectURL(MSApp.createFileFromStorageFile(file));
	let canvas = document.createElement('canvas');
	canvas.width = 128;
	canvas.height = 60;
	canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
	return new Promise<ArrayBuffer>((resolve, reject) => {
		let reader = new FileReader();
		reader.onload = () => resolve(reader.result);
		reader.onerror = () => reject(reader.error);
		reader.readAsArrayBuffer(canvas.toBlob());
	});
}

export const wallpaper: typeof chrome.wallpaper = {
	setWallpaper: wrapAsync(async (details: chrome.wallpaper.WallpaperDetails) => {
		const file = await tempFolder.createFileAsync(details.filename, CreationCollisionOption.generateUniqueName);
		if (details.data) {
			await FileIO.writeBytesAsync(file, details.data);
		} else {
			await downloader.createDownload(new Uri(details.url), file).startAsync();
		}
		const [thumbnail] = await Promise.all([
			details.thumbnail ? getThumbnail(file) : undefined,
			personalization.trySetWallpaperImageAsync(file)
		]);
		return thumbnail;
	})
};
