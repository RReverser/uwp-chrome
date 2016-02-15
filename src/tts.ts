import { wrapAsync } from './runtime';

const { SpeechSynthesizer, VoiceGender } = Windows.Media.SpeechSynthesis;

const audio = document.createElement('audio');
const synth = new SpeechSynthesizer();
const queue: string[] = [];

function playAudio(src: string) {
	audio.src = src;
	audio.play();
}

function stopAudio() {
	audio.src = '';
}

audio.addEventListener('ended', () => {
	if (queue.length > 0) {
		playAudio(queue.shift());
	} else {
		stopAudio();
	}
});

export const tts: typeof chrome.tts = {
	speak: wrapAsync(async (utterance: string, options?: chrome.tts.SpeakOptions) => {
		let stream = await synth.synthesizeSsmlToStreamAsync(utterance);
		let blob = MSApp.createBlobFromRandomAccessStream(stream.contentType, stream);
		let url = URL.createObjectURL(blob, { oneTimeOnly: true });
		if (audio.src) {
			if (options && options.enqueue) {
				queue.push(url);
				return;
			}
			queue.length = 0;
		}
		audio.src = url;
		audio.play();
	}),

	stop() {
		queue.length = 0;
		stopAudio();
	},

	pause() {
		audio.pause();
	},

	resume() {
		audio.play();
	},

	isSpeaking: wrapAsync(async () => !audio.paused),

	getVoices: wrapAsync(async () => {
		return SpeechSynthesizer.allVoices.map<chrome.tts.TtsVoice>(voice => ({
			lang: voice.language,
			gender: VoiceGender[voice.gender],
			voiceName: voice.displayName
		}));
	})
};
