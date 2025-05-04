import React, { useState, useEffect } from 'react';
import { 
    Box, 
    Modal, 
    IconButton, 
    Typography, 
    Grid, 
    Accordion, 
    AccordionSummary, 
    AccordionDetails,
    CircularProgress,
    Alert,
    useTheme
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PianoIcon from '@mui/icons-material/Piano';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { SvgIconComponent } from '@mui/icons-material';
import { getPublicSoundfonts, getSoundfontDownloadUrl } from '../../../platform/api/soundfonts';
import SoundfontManager from '../../core/soundfont/soundfontManager';
import { db } from '../../core/db/dexie-client';
import { InstrumentFileRead } from 'src/platform/types/project';
import { alpha } from '@mui/material/styles';

interface Instrument {
    id: string;
    name: string;
    icon: SvgIconComponent;
    color: string;
}

const instruments: Instrument[] = [
{
    id: 'piano',
    name: 'Grand Piano',
    icon: PianoIcon,
    color: '#2ECC71'
},
{
    id: 'synth',
    name: 'Synth Lead',
    icon: MusicNoteIcon,
    color: '#3498DB'
},
{
    id: 'strings',
    name: 'Strings',
    icon: MusicNoteIcon,
    color: '#9B59B6'
},
{
    id: 'bass',
    name: 'Bass',
    icon: MusicNoteIcon,
    color: '#E67E22'
},
{
    id: 'organ',
    name: 'Electric Organ',
    icon: MusicNoteIcon,
    color: '#E74C3C'
},
{
    id: 'pad',
    name: 'Ambient Pad',
    icon: MusicNoteIcon,
    color: '#1ABC9C'
}
];

// Map of instrument categories to colors
const categoryColors: Record<string, string> = {
    piano: '#2ECC71',
    synth: '#3498DB',
    strings: '#9B59B6',
    bass: '#E67E22',
    guitar: '#E67E22',
    synthesizers: '#A19E24',
    organ: '#327AB7',
    pads: '#1ABC9C',
    brass: '#F1C40F',
    woodwind: '#16A085',
    drum: '#FF5722',
    default: '#607D8B'
};

// Get color for a category
const getCategoryColor = (category: string): string => {
    return categoryColors[category.toLowerCase()] || categoryColors.default;
};

// Get icon for a category
const getCategoryIcon = (category: string): SvgIconComponent => {
    if (category === 'piano') return PianoIcon;
    return MusicNoteIcon;
};

export interface VirtualInstrumentsModalProps {
    open: boolean;
    onClose: () => void;
    onSelect: (instrumentId: string, displayName: string, storageKey?: string) => void;
}

export const VirtualInstrumentsModal = ({ open, onClose, onSelect }: VirtualInstrumentsModalProps) => {
    const theme = useTheme();
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState<string | null>(null);
    const [soundfonts, setSoundfonts] = useState<InstrumentFileRead[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(false);

    // Fetch available soundfonts when the modal opens
    useEffect(() => {
        if (open) {
        fetchSoundfonts();
        }
    }, [open]);

    const fetchSoundfonts = async () => {
        try {
        setLoading(true);
        setError(null);
        
        const data = await getPublicSoundfonts();
        setSoundfonts(data);
        console.log('Fetched soundfonts:', data);
        } catch (err) {
        console.error('Error fetching soundfonts:', err);
        setError('Failed to load soundfonts from library');
        } finally {
        setLoading(false);
        }
    };

    const handleSelect = (instrumentId: string) => {
        // Find the selected instrument to get its name
        const instrument = instruments.find(i => i.id === instrumentId);
        if (!instrument) {
        console.error(`Instrument with ID ${instrumentId} not found`);
        return;
        }
        onSelect(instrumentId, instrument.name);
        onClose();
    };

    const handleSoundfontSelect = async (soundfont: InstrumentFileRead) => {
        try {
            setDownloading(soundfont.id);
            setError(null);
            
            // Get the SoundfontManager instance
            const soundfontManager = SoundfontManager.getInstance(db);
            
            // Check if we already have this soundfont cached
            const isCached = await soundfontManager.isSoundfontCached(soundfont.id);
            
            if (!isCached) {
                console.log(`Downloading soundfont: ${soundfont.name}`);
                
                // The getSoundfont method will download and store the soundfont if needed
                await soundfontManager.getSoundfont(soundfont.id);
                
                console.log(`Soundfont ${soundfont.name} successfully stored`);
            } else {
                console.log(`Soundfont ${soundfont.name} already in cache`);
            }
            
            // Call onSelect with the soundfont ID, display name, and storage key
            onSelect(soundfont.id, soundfont.display_name, soundfont.storage_key);
            onClose();
            
        } catch (err) {
            console.error('Error processing soundfont:', err);
            setError(`Failed to process soundfont: ${err.message}`);
        } finally {
            setDownloading(null);
        }
    };

    return (
        <Modal
        open={open}
        onClose={onClose}
        sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}
        >
        <Box
            sx={{
            bgcolor: 'background.paper',
            color: 'text.primary',
            borderRadius: 2,
            p: 3,
            maxWidth: '900px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">Choose Virtual Instrument</Typography>
            <IconButton
                onClick={onClose}
                color="inherit"
            >
                <CloseIcon />
            </IconButton>
            </Box>
            
            {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
                {error}
            </Alert>
            )}
            
            {/* Quick access - Common instruments */}
            <Typography variant="subtitle1" sx={{ mb: 2 }}>Common Instruments</Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
            {instruments.map((instrument) => (
                <Grid item xs={12} sm={6} md={4} key={instrument.id}>
                <Box
                    onClick={() => handleSelect(instrument.id)}
                    sx={{
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    borderRadius: 2,
                    p: 2,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                        bgcolor: theme.palette.action.hover,
                        transform: 'translateY(-2px)'
                    },
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2
                    }}
                >
                    <Box
                    sx={{
                        bgcolor: instrument.color,
                        borderRadius: 2,
                        p: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 64,
                        height: 64
                    }}
                    >
                    <instrument.icon sx={{ fontSize: 32, color: 'white' }} />
                    </Box>
                    <Typography variant="subtitle1" align="center" color="text.primary">
                    {instrument.name}
                    </Typography>
                </Box>
                </Grid>
            ))}
            </Grid>
            
            {/* Explore All Virtual Instruments section */}
            <Accordion 
            expanded={expanded}
            onChange={() => setExpanded(!expanded)}
            sx={{ 
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                color: 'inherit',
                boxShadow: 'none',
                '&:before': {
                display: 'none',
                },
                borderRadius: 2,
            }}
            >
            <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: 'text.secondary' }} />}
                sx={{ 
                borderRadius: 2,
                '&:hover': {
                    bgcolor: theme.palette.action.hover
                }
                }}
            >
                <Typography variant="subtitle1">Explore All Virtual Instruments</Typography>
            </AccordionSummary>
            <AccordionDetails>
                {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress size={40} />
                </Box>
                ) : soundfonts.length === 0 ? (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ p: 2 }}>
                    No virtual instruments found in the library
                </Typography>
                ) : (
                <Grid container spacing={2}>
                    {soundfonts.map((soundfont) => {
                    const isDownloading = downloading === soundfont.id;
                    const color = getCategoryColor(soundfont.category);
                    const Icon = getCategoryIcon(soundfont.category);
                    
                    return (
                        <Grid item xs={12} sm={6} md={4} key={soundfont.id}>
                        <Box
                            onClick={() => !isDownloading && handleSoundfontSelect(soundfont)}
                            sx={{
                            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                            borderRadius: 2,
                            p: 2,
                            cursor: isDownloading ? 'wait' : 'pointer',
                            transition: 'all 0.2s',
                            '&:hover': {
                                bgcolor: theme.palette.action.hover,
                                transform: isDownloading ? 'none' : 'translateY(-2px)'
                            },
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 2,
                            position: 'relative'
                            }}
                        >
                            <Box
                            sx={{
                                bgcolor: color,
                                borderRadius: 2,
                                p: 2,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 64,
                                height: 64
                            }}
                            >
                            <Icon sx={{ fontSize: 32, color: 'white' }} />
                            </Box>
                            <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="subtitle1" color="text.primary">
                                {soundfont.display_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {soundfont.category}
                            </Typography>
                            </Box>
                            
                            {/* Loading overlay */}
                            {isDownloading && (
                            <Box sx={{ 
                                bgcolor: alpha(theme.palette.background.paper, 0.85),
                                borderRadius: 2,
                                zIndex: 2
                            }}>
                                <Box sx={{ textAlign: 'center' }}>
                                <CircularProgress size={40} sx={{ mb: 1 }} color="inherit"/>
                                <Typography variant="caption" display="block" color="text.primary">
                                    Downloading...
                                </Typography>
                                </Box>
                            </Box>
                            )}
                        </Box>
                        </Grid>
                    );
                    })}
                </Grid>
                )}
            </AccordionDetails>
            </Accordion>
        </Box>
        </Modal>
    );
}; 