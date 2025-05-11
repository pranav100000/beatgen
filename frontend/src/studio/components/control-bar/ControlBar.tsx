import React from 'react';
import { Box, IconButton, Typography, TextField, Tooltip, useTheme } from '@mui/material';
// Import components
import BPMControl from './BPMControl';
import TimeSignatureDisplay from './TimeSignatureDisplay';
import { TimeDisplay } from './TimeDisplay';
import KeySelector from './KeySelector';
import { SaveProjectButton } from './SaveProjectButton';
import { useStudioStore } from '../../stores/studioStore';
import { IconPlayerPlayFilled, IconPlayerSkipBackFilled, IconPlayerPauseFilled, IconArrowForwardUp, IconArrowBackUp, IconZoomIn, IconZoomOut, IconInputAi, IconChevronsRight, IconArrowLeft } from '@tabler/icons-react';

interface StudioControlBarProps {
    canUndo: boolean;
    canRedo: boolean;
    bpm: number;
    timeSignature: [number, number];
    keySignature: string;
    isPlaying: boolean;
    projectTitle: string;
    zoomLevel: number;
    currentTime: number;
    isChatOpen: boolean;
    existingProjectId: string | null;
    tracks: any[]; // You might want to properly type this based on your track type

    // Handlers
    onUndo: () => void;
    onRedo: () => void;
    onBpmChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onTimeSignatureChange: (numerator?: number, denominator?: number) => void;
    onKeySignatureChange: (key: string) => void;
    onPlayPause: () => void;
    onStop: () => void;
    onTitleChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onChatToggle: () => void;
}


const StudioControlBar: React.FC<StudioControlBarProps> = ({
    canUndo,
    canRedo,
    bpm,
    timeSignature,
    keySignature,
    isPlaying,
    projectTitle,
    zoomLevel,
    currentTime,
    isChatOpen,
    existingProjectId,
    tracks,
    onUndo,
    onRedo,
    onBpmChange,
    onTimeSignatureChange,
    onKeySignatureChange,
    onPlayPause,
    onStop,
    onTitleChange,
    onZoomIn,
    onZoomOut,
    onChatToggle,
}) => {
    const theme = useTheme();

    return (
        <Box sx={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            width: '100%',
            gap: 2,
            p: 1,
            borderBottom: `1px solid ${theme.palette.divider}`,
            position: 'relative',
            zIndex: 1300,
            bgcolor: 'background.paper',
            color: 'text.primary'
        }}>
            {/* Left section */}
            <Box sx={{ 
                justifySelf: 'start',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
            }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Go back to Projects" arrow>
                        <IconButton
                            size="small"
                            color="inherit"
                            onClick={() => {
                                window.location.href = '/home';
                            }}
                        >
                            <IconArrowLeft />
                        </IconButton>
                    </Tooltip>
                    <IconButton
                        size="small"
                        color="inherit"
                        onClick={onUndo}
                        disabled={!canUndo}
                        title="Undo"
                    >
                        <IconArrowBackUp />
                    </IconButton>
                    <IconButton
                        size="small"
                        color="inherit"
                        onClick={onRedo}
                        disabled={!canRedo}
                        title="Redo"
                    >
                        <IconArrowForwardUp />
                    </IconButton>
                </Box>

                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                    borderRadius: 1,
                    px: 2,
                    py: 0.5,
                    gap: 1,
                }}>
                    <BPMControl bpm={bpm} onBpmChange={onBpmChange} />
                </Box>

                {/* <TimeSignatureDisplay
                    topNumber={timeSignature[0]}
                    bottomNumber={timeSignature[1]}
                    onTopNumberChange={(value) => onTimeSignatureChange(value, undefined)}
                    onBottomNumberChange={(value) => onTimeSignatureChange(undefined, value)}
                /> */}

                <KeySelector
                    selectedKey={keySignature}
                    onKeyChange={onKeySignatureChange}
                />

                <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton
                        size="small"
                        color="inherit"
                        onClick={onPlayPause}
                    >
                        {isPlaying ? <IconPlayerPauseFilled /> : <IconPlayerPlayFilled />}
                    </IconButton>
                    <IconButton
                        size="small"
                        color="inherit"
                        onClick={onStop}
                    >
                        <IconPlayerSkipBackFilled />
                    </IconButton>
                </Box>
            </Box>

            {/* Center section - Project Title */}
            <Box>
                <TextField
                    variant="standard"
                    value={projectTitle}
                    onChange={onTitleChange}
                    InputProps={{ disableUnderline: true }} 
                    inputProps={{ style: { textAlign: 'center' } }} 
                    sx={{
                        width: '100%',
                        '& .MuiInputBase-input': { 
                           color: theme.palette.text.primary
                        }
                    }}
                />
            </Box>

            {/* Right section */}
            <Box sx={{
                justifySelf: 'end',
                paddingRight: 2,
            }}>
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                }}>
                    <IconButton size="small" color="inherit" onClick={onZoomIn}>
                        <IconZoomIn />
                    </IconButton>
                    <Box sx={{ 
                        color: "text.primary",
                        fontWeight: "bold", 
                        bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
                        minWidth: 40, 
                        textAlign: "center", 
                        border: `1px solid ${theme.palette.divider}`,
                        padding: "4px 4px", 
                        borderRadius: "6px" 
                    }}>
                        {zoomLevel.toFixed(1)}x
                    </Box>
                    <IconButton size="small" color="inherit" onClick={onZoomOut}>
                        <IconZoomOut />
                    </IconButton>
                    <TimeDisplay
                        currentTime={currentTime}
                    />
                    {<SaveProjectButton
                        projectTitle={projectTitle}
                        bpm={bpm}
                        timeSignature={timeSignature}
                        tracks={tracks}
                        projectId={existingProjectId || ""}
                        keySignature={keySignature}
                        onSaved={(project) => {
                            console.log('Project saved:', project);
                        }}
                    />}
                    <IconButton
                        size="small"
                        color="inherit"
                        onClick={onChatToggle}
                    >
                        {isChatOpen ? <IconChevronsRight /> : <IconInputAi />}
                    </IconButton>
                </Box>
            </Box>
        </Box>
    );
};

export default StudioControlBar;