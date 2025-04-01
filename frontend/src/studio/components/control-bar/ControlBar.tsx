import React from 'react';
import { Box, IconButton, Button, Typography, TextField, Menu, MenuItem, Tooltip } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';

// Import components
import BPMControl from './BPMControl';
import TimeSignatureDisplay from './TimeSignatureDisplay';
import { TimeDisplay } from './TimeDisplay';
import KeySelector from './KeySelector';
import { ArrowBack, ChatBubbleOutlineRounded, ChatBubbleRounded } from '@mui/icons-material';
import { SaveProjectButton } from './SaveProjectButton';

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
    return (
        <Box sx={{
            display: 'flex',
            alignItems: 'center',
            p: 1,
            borderBottom: '1px solid #333',
            position: 'relative',
            zIndex: 1300,
        }}>
            {/* Left section */}
            <Box sx={{ 
                display: 'flex', 
                alignItems: 'center',
                gap: 2,
                flex: '1 1 0',
                minWidth: 0,
                maxWidth: '40%', // Prevent left section from taking too much space
            }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Go back to Projects" arrow>
                        <IconButton
                            size="small"
                            sx={{ color: 'white' }}
                            onClick={() => {
                                window.location.href = '/home';
                            }}
                        >
                            <ArrowBack />
                        </IconButton>
                    </Tooltip>
                    <IconButton
                        size="small"
                        sx={{ color: canUndo ? 'white' : '#666' }}
                        onClick={onUndo}
                        disabled={!canUndo}
                        title="Undo"
                    >
                        <UndoIcon />
                    </IconButton>
                    <IconButton
                        size="small"
                        sx={{ color: canRedo ? 'white' : '#666' }}
                        onClick={onRedo}
                        disabled={!canRedo}
                        title="Redo"
                    >
                        <RedoIcon />
                    </IconButton>
                </Box>

                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    bgcolor: '#1E1E1E',
                    borderRadius: 1,
                    px: 2,
                    py: 0.5,
                    gap: 1,
                }}>
                    <BPMControl bpm={bpm} onBpmChange={onBpmChange} />
                </Box>

                <TimeSignatureDisplay
                    topNumber={timeSignature[0]}
                    bottomNumber={timeSignature[1]}
                    onTopNumberChange={(value) => onTimeSignatureChange(value, undefined)}
                    onBottomNumberChange={(value) => onTimeSignatureChange(undefined, value)}
                />

                <KeySelector
                    selectedKey={keySignature}
                    onKeyChange={onKeySignatureChange}
                />

                <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton
                        size="small"
                        sx={{ color: 'white' }}
                        onClick={onPlayPause}
                    >
                        {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                    </IconButton>
                    <IconButton
                        size="small"
                        sx={{ color: 'white' }}
                        onClick={onStop}
                    >
                        <SkipPreviousIcon />
                    </IconButton>
                </Box>
            </Box>

            {/* Center section - Project Title */}
            <Box sx={{
                flex: '0 0 250px', // Slightly reduced fixed width
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                px: 3, // Increased padding
                mx: 2, // Added margin
            }}>
                <TextField
                    variant="standard"
                    value={projectTitle}
                    onChange={onTitleChange}
                    sx={{
                        width: '100%',
                        '& input': {
                            color: 'white',
                            textAlign: 'center',
                            fontSize: '1rem',
                            fontWeight: 500,
                            padding: '4px 8px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            '&:hover': {
                                backgroundColor: 'rgba(255, 255, 255, 0.05)'
                            }
                        },
                        '& .MuiInput-underline:before': {
                            borderBottom: 'none'
                        },
                        '& .MuiInput-underline:hover:before': {
                            borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
                        },
                        '& .MuiInput-underline:after': {
                            borderBottom: '2px solid white'
                        }
                    }}
                />
            </Box>

            {/* Right section */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                flex: '1 1 0',
                justifyContent: 'flex-end',
                minWidth: 0,
                maxWidth: '40%', // Prevent right section from taking too much space
            }}>
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                }}>
                    <IconButton size="small" sx={{ color: 'white' }} onClick={onZoomIn}>
                        <ZoomInIcon />
                    </IconButton>
                    <Box sx={{ color: "white", fontWeight: "bold", backgroundColor: "#333", minWidth: 40, textAlign: "center", border: "1px solid rgba(255, 255, 255, 0.2)", padding: "4px 4px", borderRadius: "6px" }}>
                        {zoomLevel.toFixed(1)}x
                    </Box>
                    <IconButton size="small" sx={{ color: 'white' }} onClick={onZoomOut}>
                        <ZoomOutIcon />
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
                        sx={{ color: 'white' }}
                        onClick={onChatToggle}
                    >
                        {isChatOpen ? <ChatBubbleRounded /> : <ChatBubbleOutlineRounded />}
                    </IconButton>
                </Box>
            </Box>
        </Box>
    );
};

export default StudioControlBar;