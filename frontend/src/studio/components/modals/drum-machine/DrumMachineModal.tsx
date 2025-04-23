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
    Button
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { getPublicDrumSamples } from '../../../../platform/api/drum_samples';
import { DrumSamplePublicRead } from 'src/platform/types/public_models/drum_samples';
import { DrumSampleCard } from './DrumMachineModalCard';

// --- DrumMachineModal Component --- //

export interface DrumMachineModalProps {
    open: boolean;
    onClose: () => void;
    onConfirmSelection: (selectedSamples: DrumSamplePublicRead[]) => void;
}

export const DrumMachineModal = ({ open, onClose, onConfirmSelection }: DrumMachineModalProps) => {
    const [loading, setLoading] = useState(false);
    const [drumSamples, setDrumSamples] = useState<DrumSamplePublicRead[]>([]);
    const [selectedSampleIds, setSelectedSampleIds] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(true);

    useEffect(() => {
        if (open) {
            fetchDrumSamples();
            setSelectedSampleIds(new Set());
        }
    }, [open]);

    const fetchDrumSamples = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const data = await getPublicDrumSamples();
            setDrumSamples(data);
            console.log('Fetched drum samples:', data);
        } catch (err) {
            console.error('Error fetching drum samples:', err);
            setError('Failed to load drum samples from library');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleSelect = (sample: DrumSamplePublicRead) => {
        setSelectedSampleIds(prevSelectedIds => {
            const newSelectedIds = new Set(prevSelectedIds);
            if (newSelectedIds.has(sample.id)) {
                newSelectedIds.delete(sample.id);
            } else {
                newSelectedIds.add(sample.id);
            }
            return newSelectedIds;
        });
    };

    const handleConfirmSelection = () => {
        const selectedSamples = drumSamples.filter(sample => selectedSampleIds.has(sample.id));
        if (selectedSamples.length > 0) {
            console.log('Confirming selection:', selectedSamples);
            onConfirmSelection(selectedSamples);
            onClose();
        } else {
            console.warn('Confirm button clicked with no selection.');
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
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexShrink: 0 }}>
                    <Typography variant="h6">Choose Drum Sample(s)</Typography>
                    <IconButton
                        onClick={onClose}
                        sx={{ color: 'white' }}
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>
                
                {error && (
                    <Alert severity="error" sx={{ mb: 2, flexShrink: 0 }}>
                        {error}
                    </Alert>
                )}
                
                <Box sx={{ overflowY: 'auto', flexGrow: 1, mb: 2 }}>
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
                            <Typography variant="subtitle1">Explore Drum Sample Library</Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ p: { xs: 1, sm: 2 } }}>
                            {loading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                                    <CircularProgress size={40} />
                                </Box>
                            ) : drumSamples.length === 0 ? (
                                <Typography variant="body2" color="text.secondary" align="center" sx={{ p: 2 }}>
                                    No drum samples found in the library
                                </Typography>
                            ) : (
                                <Grid container spacing={2}>
                                    {drumSamples.map((sample) => (
                                        <Grid item xs={12} sm={6} md={4} key={sample.id}>
                                            <DrumSampleCard 
                                                sample={sample}
                                                onToggleSelect={handleToggleSelect}
                                                isSelected={selectedSampleIds.has(sample.id)}
                                                isLoading={loading}
                                            />
                                        </Grid>
                                    ))}
                                </Grid>
                            )}
                        </AccordionDetails>
                    </Accordion>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.1)', flexShrink: 0 }}>
                    <Button
                        variant="contained"
                        onClick={handleConfirmSelection}
                        disabled={selectedSampleIds.size === 0 || loading}
                    >
                        Confirm Selection ({selectedSampleIds.size})
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
}; 