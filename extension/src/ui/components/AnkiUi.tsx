import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Image,
    ImageModel,
    AudioModel,
    SubtitleModel,
    AnkiUiState,
    AnkiUiResumeState,
    AnkiUiSavedState,
    AnkiUiBridgeRerecordMessage,
    AnkiUiBridgeResumeMessage,
    AnkiUiBridgeRewindMessage,
    CopyToClipboardMessage,
    AnkiSettingsToVideoMessage,
    Message,
    UpdateStateMessage,
    FileModel,
} from '@project/common';
import { createTheme } from '@project/common/theme';
import { AnkiSettings } from '@project/common/settings';
import { AudioClip } from '@project/common/audio-clip';
import ThemeProvider from '@material-ui/styles/ThemeProvider';
import Alert, { Color } from '@material-ui/lab/Alert';
import CssBaseline from '@material-ui/core/CssBaseline';
import AnkiDialog from '@project/common/components/AnkiDialog';
import ImageDialog from '@project/common/components/ImageDialog';
import Snackbar from '@material-ui/core/Snackbar';
import Bridge from '../bridge';
import { PaletteType } from '@material-ui/core';
import { AnkiDialogState } from '@project/common/components/AnkiDialog';
import { BridgeFetcher } from '../bridge-fetcher';
import { Anki, AnkiExportMode } from '@project/common/anki';

interface Props {
    bridge: Bridge;
    mp3WorkerUrl: string;
}

const blobToDataUrl = async (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        var reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result as string);
        };
        reader.readAsDataURL(blob);
    });
};

export default function AnkiUi({ bridge, mp3WorkerUrl }: Props) {
    const [open, setOpen] = useState<boolean>(false);
    const [disabled, setDisabled] = useState<boolean>(false);
    const [canRerecord, setCanRerecord] = useState<boolean>(false);
    const [subtitle, setSubtitle] = useState<SubtitleModel>();
    const [surroundingSubtitles, setSurroundingSubtitles] = useState<SubtitleModel[]>();
    const [text, setText] = useState<string>();
    const [serializedAudio, setSerializedAudio] = useState<AudioModel>();
    const [image, setImage] = useState<Image>();
    const [serializedImage, setSerializedImage] = useState<ImageModel>();
    const [file, setFile] = useState<FileModel>();
    const [imageDialogOpen, setImageDialogOpen] = useState<boolean>(false);
    const [source, setSource] = useState<string>('');
    const [url, setUrl] = useState<string>('');
    const [definition, setDefinition] = useState('');
    const [word, setWord] = useState('');
    const [customFieldValues, setCustomFieldValues] = useState<{ [key: string]: string }>({});
    const [initialTimestampInterval, setInitialTimestampInterval] = useState<number[]>();
    const [timestampInterval, setTimestampInterval] = useState<number[]>();
    const [timestampBoundaryInterval, setTimestampBoundaryInterval] = useState<number[]>();
    const [lastAppliedTimestampIntervalToText, setLastAppliedTimestampIntervalToText] = useState<number[]>();
    const [lastAppliedTimestampIntervalToAudio, setLastAppliedTimestampIntervalToAudio] = useState<number[]>();
    const [settingsProvider, setSettingsProvider] = useState<AnkiSettings>();
    const [alertSeverity, setAlertSeverity] = useState<Color>('error');
    const [alertOpen, setAlertOpen] = useState<boolean>(false);
    const [alert, setAlert] = useState<string>('');
    const [themeType, setThemeType] = useState<string>('dark');
    const [dialogRequestedTimestamp, setDialogRequestedTimestamp] = useState<number>(0);

    const theme = useMemo(() => createTheme(themeType as PaletteType), [themeType]);
    const anki = useMemo(
        () => (settingsProvider ? new Anki(settingsProvider, new BridgeFetcher(bridge)) : undefined),
        [settingsProvider, bridge]
    );
    const dialogStateRef = useRef<AnkiDialogState>();

    const savedState = useCallback(() => {
        const dialogState = dialogStateRef.current!;
        const savedState: AnkiUiSavedState = {
            subtitle: subtitle!,
            text: dialogState.text,
            surroundingSubtitles: dialogState.surroundingSubtitles,
            definition: dialogState.definition,
            image: serializedImage,
            audio: serializedAudio,
            file,
            word: dialogState.word,
            source: dialogState.source,
            url: dialogState.url,
            customFieldValues: dialogState.customFieldValues,
            initialTimestampInterval: dialogState.initialTimestampInterval!,
            timestampInterval: dialogState.timestampInterval!,
            timestampBoundaryInterval: dialogState.timestampBoundaryInterval,
            lastAppliedTimestampIntervalToText: dialogState.lastAppliedTimestampIntervalToText!,
            lastAppliedTimestampIntervalToAudio: dialogState.lastAppliedTimestampIntervalToAudio,
            dialogRequestedTimestamp: dialogRequestedTimestamp,
        };
        return savedState;
    }, [subtitle, serializedImage, serializedAudio, file, dialogRequestedTimestamp]);

    useEffect(() => {
        return bridge.addClientMessageListener((message: Message) => {
            if (message.command !== 'updateState') {
                return;
            }

            const s = (message as UpdateStateMessage).state as AnkiUiState;

            if (s.type === 'initial') {
                setText(undefined);
                setTimestampInterval((s.audio?.start && s.audio?.end && [s.audio.start, s.audio.end]) || undefined);
                setTimestampBoundaryInterval(undefined);
                setInitialTimestampInterval(undefined);
                setDefinition('');
                setWord('');
                setCustomFieldValues({});
                setLastAppliedTimestampIntervalToText(undefined);
                setLastAppliedTimestampIntervalToAudio(undefined);
            } else if (s.type === 'resume') {
                const state = s as AnkiUiResumeState;
                setText(state.text);
                setInitialTimestampInterval(state.initialTimestampInterval);
                setTimestampInterval(state.timestampInterval);
                setTimestampBoundaryInterval(state.timestampBoundaryInterval);
                setDefinition(state.definition);
                setWord(state.word);
                setCustomFieldValues(state.customFieldValues);
                setLastAppliedTimestampIntervalToText(state.lastAppliedTimestampIntervalToText);
                setLastAppliedTimestampIntervalToAudio(state.lastAppliedTimestampIntervalToAudio);
            }

            setCanRerecord(s.canRerecord);
            setSubtitle(s.subtitle);
            setSurroundingSubtitles(s.surroundingSubtitles);
            setSource(s.source);
            setUrl(s.url ?? '');
            setDialogRequestedTimestamp(s.dialogRequestedTimestamp);
            setSerializedAudio(s.audio);
            setSerializedImage(s.image);
            setFile(s.file);
            setImageDialogOpen(false);
            setDisabled(false);
            setSettingsProvider(s.settingsProvider);
            setImage(image);
            setThemeType(s.themeType || 'dark');
            setOpen(s.open);
        });
    }, [bridge, image]);

    const mp3WorkerFactory = useMemo(() => () => new Worker(mp3WorkerUrl), [mp3WorkerUrl]);
    const handleProceed = useCallback(
        async (
            text: string,
            definition: string,
            audioClip: AudioClip | undefined,
            image: Image | undefined,
            word: string,
            source: string,
            url: string,
            customFieldValues: { [key: string]: string },
            tags: string[],
            mode: AnkiExportMode
        ) => {
            setDisabled(true);

            try {
                await anki!.export(
                    text,
                    definition,
                    audioClip,
                    image,
                    word,
                    source,
                    url,
                    customFieldValues,
                    tags,
                    mode
                );

                if (mode !== 'gui') {
                    setOpen(false);
                    setImageDialogOpen(false);
                    const message: AnkiUiBridgeResumeMessage = {
                        command: 'resume',
                        uiState: savedState(),
                        cardExported: true,
                    };
                    bridge.sendMessageFromServer(message);
                }
            } catch (e) {
                console.error(e);
                setAlertSeverity('error');

                if (e instanceof Error) {
                    setAlert((e as Error).message);
                } else {
                    setAlert(String(e));
                }

                setAlertOpen(true);
            } finally {
                setDisabled(false);
            }
        },
        [anki, bridge, savedState]
    );

    const handleCancel = useCallback(() => {
        setOpen(false);
        setImageDialogOpen(false);
        const message: AnkiUiBridgeResumeMessage = { command: 'resume', uiState: savedState(), cardExported: false };
        bridge.sendMessageFromServer(message);
    }, [bridge, savedState]);

    const handleRewind = useCallback(() => {
        setOpen(false);
        setImageDialogOpen(false);
        const message: AnkiUiBridgeRewindMessage = { command: 'rewind', uiState: savedState() };
        bridge.sendMessageFromServer(message);
    }, [bridge, savedState]);

    const handleViewImage = useCallback((image: Image) => {
        setImage(image);
        setImageDialogOpen(true);
    }, []);

    const handleRerecord = useCallback(() => {
        setOpen(false);
        setImageDialogOpen(false);

        const state = savedState();
        const message: AnkiUiBridgeRerecordMessage = {
            command: 'rerecord',
            uiState: state,
            recordStart: state.timestampInterval![0],
            recordEnd: state.timestampInterval![1],
        };

        bridge.sendMessageFromServer(message);
    }, [bridge, savedState]);

    const handleOpenSettings = useCallback(() => {
        bridge.sendMessageFromServer({ command: 'openSettings' });
    }, [bridge]);

    const lastFocusOutRef = useRef<HTMLElement>();

    const handleFocusOut = useCallback((event: FocusEvent) => {
        if (event.target instanceof HTMLElement) {
            lastFocusOutRef.current = event.target;
        }
    }, []);

    const handleCopyToClipboard = useCallback(
        async (blob: Blob) => {
            const message: CopyToClipboardMessage = {
                command: 'copy-to-clipboard',
                dataUrl: await blobToDataUrl(blob),
            };
            bridge.sendMessageFromServer(message);
        },
        [bridge]
    );

    useEffect(() => {
        return bridge.addClientMessageListener((message) => {
            if (message.command === 'focus') {
                lastFocusOutRef.current?.focus();
            } else if (message.command === 'ankiSettings') {
                setSettingsProvider((message as AnkiSettingsToVideoMessage).value);
            } else if (message.command === 'rewind') {
                handleRewind();
            }
        });
    }, [bridge, handleRewind]);

    useEffect(() => {
        if (open) {
            window.removeEventListener('focusout', handleFocusOut);
            window.addEventListener('focusout', handleFocusOut);
        } else {
            window.removeEventListener('focusout', handleFocusOut);
        }
    }, [open, handleFocusOut]);

    const card = useMemo(() => {
        if (!subtitle || !surroundingSubtitles) {
            return undefined;
        }

        return {
            subtitle,
            surroundingSubtitles,
            url,
            audio: serializedAudio,
            image: serializedImage,
            file,
            subtitleFileName: source,
            mediaTimestamp: serializedAudio?.start ?? subtitle.start,
        };
    }, [file, source, subtitle, surroundingSubtitles, url, serializedImage, serializedAudio]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Snackbar
                anchorOrigin={{ horizontal: 'center', vertical: 'top' }}
                open={alertOpen}
                autoHideDuration={5000}
                onClose={() => setAlertOpen(false)}
            >
                <Alert onClose={() => setAlertOpen(false)} severity={alertSeverity}>
                    {alert}
                </Alert>
            </Snackbar>
            <ImageDialog open={imageDialogOpen} image={image} onClose={() => setImageDialogOpen(false)} />
            {settingsProvider && card && anki && mp3WorkerFactory && (
                <AnkiDialog
                    open={open}
                    disabled={disabled}
                    card={card}
                    settings={settingsProvider}
                    anki={anki}
                    onProceed={handleProceed}
                    onRerecord={canRerecord ? handleRerecord : undefined}
                    onCancel={handleCancel}
                    onViewImage={handleViewImage}
                    onOpenSettings={handleOpenSettings}
                    onCopyToClipboard={handleCopyToClipboard}
                    text={text}
                    definition={definition}
                    word={word}
                    source={source}
                    customFieldValues={customFieldValues}
                    initialTimestampInterval={initialTimestampInterval}
                    timestampBoundaryInterval={timestampBoundaryInterval}
                    timestampInterval={timestampInterval}
                    lastAppliedTimestampIntervalToText={lastAppliedTimestampIntervalToText}
                    lastAppliedTimestampIntervalToAudio={lastAppliedTimestampIntervalToAudio}
                    stateRef={dialogStateRef}
                    mp3WorkerFactory={mp3WorkerFactory}
                />
            )}
        </ThemeProvider>
    );
}
