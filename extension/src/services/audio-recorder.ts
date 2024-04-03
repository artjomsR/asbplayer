import { bufferToBase64 } from './base64';

export default class AudioRecorder {
    private recording: boolean;
    private recorder: MediaRecorder | null;
    private stream: MediaStream | null;
    private blobPromise: Promise<Blob> | null;

    constructor() {
        this.recording = false;
        this.recorder = null;
        this.stream = null;
        this.blobPromise = null;
    }

    startWithTimeout(stream: MediaStream, time: number, onStartedCallback: () => void): Promise<string> {
        return new Promise(async (resolve, reject) => {
            try {
                if (this.recording) {
                    console.error('Already recording, cannot start with timeout.');
                    reject('Already recording');
                    return;
                }

                await this.start(stream);
                onStartedCallback();
                setTimeout(async () => {
                    resolve(await this.stop());
                }, time);
            } catch (e) {
                reject(e);
            }
        });
    }

    start(stream: MediaStream): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.recording) {
                reject('Already recording, cannot start');
                return;
            }

            try {
                const recorder = new MediaRecorder(stream);
                const chunks: BlobPart[] = [];
                recorder.ondataavailable = (e) => {
                    chunks.push(e.data);
                };
                this.blobPromise = new Promise((resolve, reject) => {
                    recorder.onstop = (e) => {
                        resolve(new Blob(chunks));
                    };
                });
                recorder.start();
                const output = new AudioContext();
                const source = output.createMediaStreamSource(stream);
                source.connect(output.destination);

                this.recorder = recorder;
                this.recording = true;
                this.stream = stream;
                resolve(undefined);
            } catch (e) {
                reject(e);
            }
        });
    }

    async stop(): Promise<string> {
        if (!this.recording) {
            throw new Error('Not recording, unable to stop');
        }

        this.recording = false;
        this.recorder?.stop();
        this.recorder = null;
        this.stream?.getTracks()?.forEach((t) => t.stop());
        this.stream = null;
        const blob = await this.blobPromise;
        this.blobPromise = null;
        return await bufferToBase64(await blob!.arrayBuffer());
    }
}
