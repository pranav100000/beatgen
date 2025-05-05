import * as Tone from 'tone';

class AudioContextManager {
    private _context: AudioContext | null = null;
    private _initializationPromise: Promise<AudioContext> | null = null;

    /**
     * Initializes the AudioContext. Ensures Tone.start() is called (requires user gesture)
     * and necessary AudioWorklet modules are added. Only runs the core logic once.
     * Returns the initialized AudioContext.
     */
    public initialize(): Promise<AudioContext> {
        if (!this._initializationPromise) {
            this._initializationPromise = (async () => {
                console.log("AudioContextManager: Initializing...");
                try {
                    // Ensure Tone.js context is started/resumed (requires user gesture)
                    await Tone.start();
                    console.log("AudioContextManager: Tone.start() successful.");

                    const rawCtx = Tone.getContext().rawContext;

                    // Validate the context using property checks (more robust across realms than instanceof)
                    if (!rawCtx || typeof rawCtx.destination === 'undefined' || typeof rawCtx.state === 'undefined') {
                        console.error("AudioContextManager: Context from Tone.js does not appear to be a valid online AudioContext", rawCtx);
                        throw new Error("Failed to get valid online AudioContext from Tone.js");
                    }

                    // If checks pass, assert the type for TypeScript
                    this._context = rawCtx as AudioContext;

                    // Add necessary worklets ONCE
                    console.log("AudioContextManager: Adding required AudioWorklet modules...");
                    await this._context.audioWorklet.addModule('/js-synthesizer/libfluidsynth-2.3.0.js');
                    await this._context.audioWorklet.addModule('/js-synthesizer/js-synthesizer.worklet.js');
                    // Add other worklets if needed here
                    console.log("AudioContextManager: AudioWorklet modules added.");

                    console.log("AudioContextManager: Initialization complete.");
                    return this._context;

                } catch (err) {
                    console.error("AudioContextManager: Initialization failed.", err);
                    this._initializationPromise = null; // Allow retry on next call
                    throw err; // Re-throw the error
                }
            })();
        }
        return this._initializationPromise;
    }

    /**
     * Gets the initialized AudioContext. Throws an error if initialize() hasn't been called successfully.
     */
    public getContext(): AudioContext {
        if (!this._context) {
            throw new Error("AudioContextManager: Context not initialized. Call initialize() first.");
        }
        return this._context;
    }

     /**
     * Checks if the audio context has been successfully initialized.
     */
    public isInitialized(): boolean {
        return !!this._context;
    }
}

// Export a singleton instance
export const audioContextManager = new AudioContextManager(); 