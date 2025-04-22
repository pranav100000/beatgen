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
    Alert
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
import { SamplerTrack } from 'src/platform/types/track_models/sampler_track';

interface DrumKit {
    id: string;
    name: string;
    samplers: SamplerTrack[];
}

// Sample Drum Kits for 6 Common Music Genres
// This code provides structured data for six common music genres with sample drum kits
// Each drum kit includes common percussion elements with sample file paths

const drumKits = {
    // 1. Pop Drum Kit
    pop: {
      name: "Pop Essentials",
      description: "Bright, punchy drums with a focus on clarity and impact",
      elements: [
        {
          name: "Kick",
          samples: [
            { name: "Pop Kick Clean", path: "/samples/pop/kick_clean.wav" },
            { name: "Pop Kick Processed", path: "/samples/pop/kick_processed.wav" },
            { name: "Pop Kick Sub", path: "/samples/pop/kick_sub.wav" }
          ]
        },
        {
          name: "Snare",
          samples: [
            { name: "Pop Snare Standard", path: "/samples/pop/snare_standard.wav" },
            { name: "Pop Snare Rimshot", path: "/samples/pop/snare_rimshot.wav" },
            { name: "Pop Snare Processed", path: "/samples/pop/snare_processed.wav" }
          ]
        },
        {
          name: "Hi-Hat",
          samples: [
            { name: "Pop Hi-Hat Closed", path: "/samples/pop/hihat_closed.wav" },
            { name: "Pop Hi-Hat Open", path: "/samples/pop/hihat_open.wav" },
            { name: "Pop Hi-Hat Pedal", path: "/samples/pop/hihat_pedal.wav" }
          ]
        },
        {
          name: "Cymbals",
          samples: [
            { name: "Pop Crash", path: "/samples/pop/crash.wav" },
            { name: "Pop Ride", path: "/samples/pop/ride.wav" }
          ]
        },
        {
          name: "Percussion",
          samples: [
            { name: "Pop Tambourine", path: "/samples/pop/tambourine.wav" },
            { name: "Pop Shaker", path: "/samples/pop/shaker.wav" },
            { name: "Pop Clap", path: "/samples/pop/clap.wav" }
          ]
        }
      ]
    },
  
    // 2. Rock Drum Kit
    rock: {
      name: "Rock Foundation",
      description: "Powerful, room-heavy drums with natural ambience",
      elements: [
        {
          name: "Kick",
          samples: [
            { name: "Rock Kick Deep", path: "/samples/rock/kick_deep.wav" },
            { name: "Rock Kick Punchy", path: "/samples/rock/kick_punchy.wav" },
            { name: "Rock Kick Resonant", path: "/samples/rock/kick_resonant.wav" }
          ]
        },
        {
          name: "Snare",
          samples: [
            { name: "Rock Snare Standard", path: "/samples/rock/snare_standard.wav" },
            { name: "Rock Snare Rimshot", path: "/samples/rock/snare_rimshot.wav" },
            { name: "Rock Snare Flam", path: "/samples/rock/snare_flam.wav" }
          ]
        },
        {
          name: "Toms",
          samples: [
            { name: "Rock Rack Tom", path: "/samples/rock/rack_tom.wav" },
            { name: "Rock Floor Tom", path: "/samples/rock/floor_tom.wav" }
          ]
        },
        {
          name: "Hi-Hat",
          samples: [
            { name: "Rock Hi-Hat Closed", path: "/samples/rock/hihat_closed.wav" },
            { name: "Rock Hi-Hat Open", path: "/samples/rock/hihat_open.wav" }
          ]
        },
        {
          name: "Cymbals",
          samples: [
            { name: "Rock Crash", path: "/samples/rock/crash.wav" },
            { name: "Rock Ride", path: "/samples/rock/ride.wav" },
            { name: "Rock Splash", path: "/samples/rock/splash.wav" }
          ]
        }
      ]
    },
  
    // 3. Hip-Hop/Rap Drum Kit
    hiphop: {
      name: "Hip-Hop Beats",
      description: "Heavy, processed drums with deep kicks and crisp snares",
      elements: [
        {
          name: "Kick",
          samples: [
            { name: "Hip-Hop Kick 808", path: "/samples/hiphop/kick_808.wav" },
            { name: "Hip-Hop Kick Distorted", path: "/samples/hiphop/kick_distorted.wav" },
            { name: "Hip-Hop Kick Clean", path: "/samples/hiphop/kick_clean.wav" }
          ]
        },
        {
          name: "Snare",
          samples: [
            { name: "Hip-Hop Snare Trap", path: "/samples/hiphop/snare_trap.wav" },
            { name: "Hip-Hop Snare Classic", path: "/samples/hiphop/snare_classic.wav" },
            { name: "Hip-Hop Snare Layered", path: "/samples/hiphop/snare_layered.wav" }
          ]
        },
        {
          name: "Hi-Hat",
          samples: [
            { name: "Hip-Hop Hi-Hat Closed", path: "/samples/hiphop/hihat_closed.wav" },
            { name: "Hip-Hop Hi-Hat Open", path: "/samples/hiphop/hihat_open.wav" },
            { name: "Hip-Hop Hi-Hat Roll", path: "/samples/hiphop/hihat_roll.wav" }
          ]
        },
        {
          name: "808s",
          samples: [
            { name: "Hip-Hop 808 Sub", path: "/samples/hiphop/808_sub.wav" },
            { name: "Hip-Hop 808 Distorted", path: "/samples/hiphop/808_distorted.wav" },
            { name: "Hip-Hop 808 Short", path: "/samples/hiphop/808_short.wav" }
          ]
        },
        {
          name: "FX",
          samples: [
            { name: "Hip-Hop Vinyl Scratch", path: "/samples/hiphop/vinyl_scratch.wav" },
            { name: "Hip-Hop Vocal Shot", path: "/samples/hiphop/vocal_shot.wav" },
            { name: "Hip-Hop Riser", path: "/samples/hiphop/riser.wav" }
          ]
        }
      ]
    },
  
    // 4. Electronic/Dance Drum Kit
    electronic: {
      name: "Electronic Pulse",
      description: "Tight, synthetic drums designed for club environments",
      elements: [
        {
          name: "Kick",
          samples: [
            { name: "Electronic Kick Four-on-Floor", path: "/samples/electronic/kick_4floor.wav" },
            { name: "Electronic Kick Sidechained", path: "/samples/electronic/kick_sidechain.wav" },
            { name: "Electronic Kick Layered", path: "/samples/electronic/kick_layered.wav" }
          ]
        },
        {
          name: "Snare/Clap",
          samples: [
            { name: "Electronic Snare", path: "/samples/electronic/snare.wav" },
            { name: "Electronic Clap", path: "/samples/electronic/clap.wav" },
            { name: "Electronic Snare/Clap Layer", path: "/samples/electronic/snareclap_layer.wav" }
          ]
        },
        {
          name: "Hi-Hat",
          samples: [
            { name: "Electronic Hi-Hat Closed", path: "/samples/electronic/hihat_closed.wav" },
            { name: "Electronic Hi-Hat Open", path: "/samples/electronic/hihat_open.wav" }
          ]
        },
        {
          name: "Percussion",
          samples: [
            { name: "Electronic Percussion Stick", path: "/samples/electronic/perc_stick.wav" },
            { name: "Electronic Percussion Tom", path: "/samples/electronic/perc_tom.wav" }
          ]
        },
        {
          name: "FX",
          samples: [
            { name: "Electronic White Noise", path: "/samples/electronic/white_noise.wav" },
            { name: "Electronic Downlifter", path: "/samples/electronic/downlifter.wav" },
            { name: "Electronic Impact", path: "/samples/electronic/impact.wav" },
            { name: "Electronic Build-up", path: "/samples/electronic/buildup.wav" }
          ]
        }
      ]
    },
  
    // 5. R&B/Soul Drum Kit
    rnb: {
      name: "Soul Grooves",
      description: "Warm, vintage-inspired drums with organic textures",
      elements: [
        {
          name: "Kick",
          samples: [
            { name: "R&B Kick Warm", path: "/samples/rnb/kick_warm.wav" },
            { name: "R&B Kick Tight", path: "/samples/rnb/kick_tight.wav" },
            { name: "R&B Kick Vintage", path: "/samples/rnb/kick_vintage.wav" }
          ]
        },
        {
          name: "Snare",
          samples: [
            { name: "R&B Snare Crisp", path: "/samples/rnb/snare_crisp.wav" },
            { name: "R&B Snare Brush", path: "/samples/rnb/snare_brush.wav" },
            { name: "R&B Snare Rim", path: "/samples/rnb/snare_rim.wav" }
          ]
        },
        {
          name: "Hi-Hat",
          samples: [
            { name: "R&B Hi-Hat Closed", path: "/samples/rnb/hihat_closed.wav" },
            { name: "R&B Hi-Hat Open", path: "/samples/rnb/hihat_open.wav" },
            { name: "R&B Hi-Hat Shuffle", path: "/samples/rnb/hihat_shuffle.wav" }
          ]
        },
        {
          name: "Percussion",
          samples: [
            { name: "R&B Tambourine", path: "/samples/rnb/tambourine.wav" },
            { name: "R&B Shaker", path: "/samples/rnb/shaker.wav" },
            { name: "R&B Bongo", path: "/samples/rnb/bongo.wav" }
          ]
        },
        {
          name: "FX",
          samples: [
            { name: "R&B Vinyl Crackle", path: "/samples/rnb/vinyl_crackle.wav" },
            { name: "R&B Room Noise", path: "/samples/rnb/room_noise.wav" }
          ]
        }
      ]
    },
  
    // 6. Country Drum Kit
    country: {
      name: "Nashville Sound",
      description: "Natural, open drums with acoustic character",
      elements: [
        {
          name: "Kick",
          samples: [
            { name: "Country Kick Standard", path: "/samples/country/kick_standard.wav" },
            { name: "Country Kick Muted", path: "/samples/country/kick_muted.wav" },
            { name: "Country Kick Brush", path: "/samples/country/kick_brush.wav" }
          ]
        },
        {
          name: "Snare",
          samples: [
            { name: "Country Snare Standard", path: "/samples/country/snare_standard.wav" },
            { name: "Country Snare Rimshot", path: "/samples/country/snare_rimshot.wav" },
            { name: "Country Snare Cross-Stick", path: "/samples/country/snare_crossstick.wav" }
          ]
        },
        {
          name: "Hi-Hat",
          samples: [
            { name: "Country Hi-Hat Closed Tight", path: "/samples/country/hihat_closed_tight.wav" },
            { name: "Country Hi-Hat Closed Loose", path: "/samples/country/hihat_closed_loose.wav" },
            { name: "Country Hi-Hat Open", path: "/samples/country/hihat_open.wav" }
          ]
        },
        {
          name: "Cymbals",
          samples: [
            { name: "Country Crash", path: "/samples/country/crash.wav" },
            { name: "Country Ride", path: "/samples/country/ride.wav" },
            { name: "Country Ride Bell", path: "/samples/country/ride_bell.wav" }
          ]
        },
        {
          name: "Percussion",
          samples: [
            { name: "Country Tambourine", path: "/samples/country/tambourine.wav" },
            { name: "Country Shaker", path: "/samples/country/shaker.wav" },
            { name: "Country Cowbell", path: "/samples/country/cowbell.wav" }
          ]
        }
      ]
    }
  };
  
  // Usage example:
  // 
  // // Access a specific sample
  // const popKickClean = drumKits.pop.elements[0].samples[0];
  // console.log(`Loading sample: ${popKickClean.name} from ${popKickClean.path}`);
  // 
  // // Iterate through a genre's elements
  // drumKits.hiphop.elements.forEach(element => {
  //   console.log(`${drumKits.hiphop.name} ${element.name} samples:`);
  //   element.samples.forEach(sample => console.log(`- ${sample.name}`));
  // });
  // 
  // // Get all kick drums across genres
  // const allKicks = Object.values(drumKits).map(kit => {
  //   const kickElement = kit.elements.find(el => el.name === "Kick");
  //   return kickElement ? kickElement.samples : [];
  // }).flat();

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
            onSelect(soundfont.id, soundfont.name, soundfont.storage_key);
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
            bgcolor: '#1A1A1A',
            color: 'white',
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
                sx={{ color: 'white' }}
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
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: 2,
                    p: 2,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.1)',
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
                    <Typography variant="subtitle1" align="center">
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
                bgcolor: 'rgba(255, 255, 255, 0.03)', 
                color: 'white',
                boxShadow: 'none',
                '&:before': {
                display: 'none',
                },
                borderRadius: 2,
            }}
            >
            <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: 'white' }} />}
                sx={{ 
                borderRadius: 2,
                '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.05)'
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
                            bgcolor: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: 2,
                            p: 2,
                            cursor: isDownloading ? 'wait' : 'pointer',
                            transition: 'all 0.2s',
                            '&:hover': {
                                bgcolor: 'rgba(255, 255, 255, 0.1)',
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
                            <Typography variant="subtitle1">
                                {soundfont.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {soundfont.category}
                            </Typography>
                            </Box>
                            
                            {/* Loading overlay */}
                            {isDownloading && (
                            <Box sx={{ 
                                position: 'absolute', 
                                top: 0, 
                                left: 0, 
                                right: 0, 
                                bottom: 0, 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                bgcolor: 'rgba(0,0,0,0.7)',
                                borderRadius: 2,
                                zIndex: 2
                            }}>
                                <Box sx={{ textAlign: 'center' }}>
                                <CircularProgress size={40} sx={{ mb: 1 }} />
                                <Typography variant="caption" display="block">
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