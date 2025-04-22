// /**
//  * Unified Track types for BeatGen
//  * This file provides a single source of truth for track types across the application
//  */

import { DrumTrackRead, MidiTrackRead, SamplerTrackRead } from "src/platform/types/project";

import { AudioTrackRead } from "src/platform/types/project";

export type AnyTrackRead = AudioTrackRead | MidiTrackRead | SamplerTrackRead | DrumTrackRead;
