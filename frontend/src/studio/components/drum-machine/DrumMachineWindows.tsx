import React, { useMemo, useRef, useEffect } from 'react';
import { useStudioStore } from '../../stores/studioStore';
import DrumMachine from './DrumMachine';
import { RootState, CombinedTrack, SamplerTrackRead } from '../../stores/types'; 
import { useShallow } from 'zustand/react/shallow';

const DrumMachineWindows: React.FC = () => {
    // Select state and actions (NO shallow on object selector)
    const { 
        tracks, 
        openDrumMachines,
        closeDrumMachine,
        addSamplerTrackToDrumTrack, 
        removeSamplerTrack,
        addNote, 
        removeSamplerNote 
    } = useStudioStore(useShallow((state: RootState) => ({
            tracks: state.tracks,
            openDrumMachines: state.openDrumMachines,
            closeDrumMachine: state.closeDrumMachine,
            addSamplerTrackToDrumTrack: state.addSamplerTrackToDrumTrack,
            removeSamplerTrack: state.removeSamplerTrack,
            addNote: state.addMidiNote, 
            removeSamplerNote: state.removeSamplerNote,
        }))
    );

    // Memoize the list of open track IDs
    const openTrackIds = useMemo(() => 
        Object.entries(openDrumMachines || {})
            .filter(([, isOpen]) => isOpen)
            .map(([trackId]) => trackId),
        [openDrumMachines]
    );

    // Optional: Log when the list of open IDs actually changes
    useEffect(() => {
        console.log('DrumMachineWindows: Derived openTrackIds changed:', openTrackIds);
    }, [openTrackIds]);

    if (!tracks || openTrackIds.length === 0) return null; 

    return (
        <>
            {openTrackIds.map(trackId => {
                const parentDrumTrack = tracks.find(t => t.id === trackId && t.type === 'drum');
                const parentDrumTrackName = parentDrumTrack?.name;

                // Derive associated sampler tracks with safer type check
                const associatedSamplerTracks = tracks
                    .filter((t): t is CombinedTrack & { track: SamplerTrackRead } => {
                        return (
                            t.type === 'sampler' && 
                            // Explicitly check if track is an object before accessing properties
                            typeof t.track === 'object' && 
                            t.track !== null && 
                            'drum_track_id' in t.track && // Ensure property exists
                            t.track.drum_track_id === trackId
                        );
                    })
                    .map(t => t.track as SamplerTrackRead); 

                // Add null checks for actions before passing down
                if (!addSamplerTrackToDrumTrack || !removeSamplerTrack || !addNote || !removeSamplerNote) {
                    return null; 
                }

                return (
                    <DrumMachine 
                        key={trackId}
                        trackId={trackId}
                        samplerTracks={associatedSamplerTracks} 
                        parentDrumTrackName={parentDrumTrackName} 
                        addSamplerTrackToDrumTrack={addSamplerTrackToDrumTrack}
                        removeSamplerTrack={removeSamplerTrack}
                        addNote={addNote}
                        removeSamplerNote={removeSamplerNote}
                        onClose={closeDrumMachine ? () => closeDrumMachine(trackId) : undefined}
                    />
                );
            })}
        </>
    );
};

export default DrumMachineWindows; 