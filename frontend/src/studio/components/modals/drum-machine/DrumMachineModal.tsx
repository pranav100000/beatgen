import React, { useState, useEffect, useMemo } from 'react';
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
    Button,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    SelectChangeEvent,
    useTheme
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { getPublicDrumSamples } from '../../../../platform/api/drum_samples';
import { DrumSamplePublicRead } from 'src/platform/types/public_models/drum_samples';
import { DrumSampleCard } from './DrumMachineModalCard';
import { prettyPrint } from '../../../../utils/pretty_print';

// --- DrumMachineModal Component --- //

export interface DrumMachineModalProps {
    open: boolean;
    onClose: () => void;
    onConfirmSelection: (selectedSamples: DrumSamplePublicRead[]) => void;
}

export const DrumMachineModal = ({ open, onClose, onConfirmSelection }: DrumMachineModalProps) => {
    const theme = useTheme();
    const [loading, setLoading] = useState(false);
    const [drumSamples, setDrumSamples] = useState<DrumSamplePublicRead[]>([]);
    const [filteredDrumSamples, setFilteredDrumSamples] = useState<DrumSamplePublicRead[]>([]);
    const [selectedSampleIds, setSelectedSampleIds] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(true);

    // Filter and Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedKit, setSelectedKit] = useState<string>('All');
    const [selectedGenre, setSelectedGenre] = useState<string>('All');
    const [selectedType, setSelectedType] = useState<string>('All');

    // --- Fetching --- //

    useEffect(() => {
        if (open) {
            fetchDrumSamples();
            // Reset state when modal opens
            setSelectedSampleIds(new Set());
            setSearchQuery('');
            setSelectedKit('All');
            setSelectedGenre('All');
            setSelectedType('All');
        }
    }, [open]);

    const fetchDrumSamples = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const data = await getPublicDrumSamples();
            setDrumSamples(data);
            setFilteredDrumSamples(data); // Initialize filtered list
            console.log('Fetched drum samples:', data);
        } catch (err) {
            console.error('Error fetching drum samples:', err);
            setError('Failed to load drum samples from library');
        } finally {
            setLoading(false);
        }
    };

    // --- Filtering Logic --- //

    const uniqueKits = useMemo(() => ['All', ...new Set(drumSamples.map(s => prettyPrint(s.kit_name || 'Unknown')))], [drumSamples]);
    const uniqueGenres = useMemo(() => ['All', ...new Set(drumSamples.map(s => prettyPrint(s.genre || 'Unknown')))], [drumSamples]);
    const uniqueTypes = useMemo(() => ['All', ...new Set(drumSamples.map(s => prettyPrint(s.category || 'Unknown')))], [drumSamples]);

    useEffect(() => {
        let filtered = [...drumSamples];

        // Filter by Search Query (case-insensitive)
        if (searchQuery) {
            const lowerCaseQuery = searchQuery.toLowerCase();
            filtered = filtered.filter(sample => 
                sample.display_name.toLowerCase().includes(lowerCaseQuery) ||
                (sample.kit_name && sample.kit_name.toLowerCase().includes(lowerCaseQuery))
            );
        }

        // Filter by Kit
        if (selectedKit !== 'All') {
            filtered = filtered.filter(sample => (sample.kit_name || 'Unknown') === selectedKit);
        }

        // Filter by Genre
        if (selectedGenre !== 'All') {
            filtered = filtered.filter(sample => (sample.genre || 'Unknown') === selectedGenre);
        }

        // Filter by Type
        if (selectedType !== 'All') {
            filtered = filtered.filter(sample => (sample.category || 'Unknown') === selectedType);
        }

        setFilteredDrumSamples(filtered);

    }, [searchQuery, selectedKit, selectedGenre, selectedType, drumSamples]);

    // --- Handlers --- //

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
        // Confirm based on the original list, using the selected IDs
        const selectedSamples = drumSamples.filter(sample => selectedSampleIds.has(sample.id));
        if (selectedSamples.length > 0) {
            console.log('Confirming selection:', selectedSamples);
            onConfirmSelection(selectedSamples);
            onClose();
        } else {
            console.warn('Confirm button clicked with no selection.');
        }
    };

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(event.target.value);
    };

    const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (event: SelectChangeEvent<string>) => {
        setter(event.target.value);
    };


    // --- Rendering --- //

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
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}
            >
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexShrink: 0 }}>
                    <Typography variant="h6">Choose Drum Sample(s)</Typography>
                    <IconButton
                        onClick={onClose}
                        color="inherit"
                        sx={{
                            borderRadius: '8px',
                            '&:hover': {
                                backgroundColor: theme.palette.action.hover,
                            },
                        }}
                        disableRipple
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>
                
                {/* Error Alert */}
                {error && (
                    <Alert severity="error" sx={{ mb: 2, flexShrink: 0 }}>
                        {error}
                    </Alert>
                )}
                
                {/* Main Content Area (Scrollable) */}
                <Box sx={{ overflowY: 'auto', flexGrow: 1, mb: 2 }}>
                    <Accordion 
                        expanded={expanded}
                        onChange={() => setExpanded(!expanded)}
                        sx={{ 
                            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                            color: 'inherit',
                            boxShadow: 'none',
                            '&:before': { display: 'none' },
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
                            <Typography variant="subtitle1">Explore Drum Sample Library</Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ p: { xs: 1, sm: 2 } }}>
                            {/* Filter and Search Section */}
                            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                                <TextField
                                    label="Search Samples"
                                    variant="outlined"
                                    size="small"
                                    value={searchQuery}
                                    onChange={handleSearchChange}
                                    sx={{ 
                                        flexGrow: 1, 
                                        minWidth: '200px',
                                        '& .MuiOutlinedInput-root': {
                                            '& fieldset': { borderColor: theme.palette.divider },
                                            '&:hover fieldset': { borderColor: theme.palette.text.secondary },
                                            '&.Mui-focused fieldset': { borderColor: 'primary.main' },
                                        },
                                        '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
                                        '& .MuiInputBase-input': { color: theme.palette.text.primary }
                                    }}
                                />
                                <FormControl size="small" sx={{ minWidth: 120 }}>
                                    <InputLabel sx={{ color: theme.palette.text.secondary }}>Kit</InputLabel>
                                    <Select
                                        value={selectedKit}
                                        label="Kit"
                                        onChange={handleFilterChange(setSelectedKit)}
                                        sx={{ 
                                            color: theme.palette.text.primary,
                                            '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
                                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.text.secondary },
                                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                                            '& .MuiSvgIcon-root': { color: theme.palette.text.secondary }
                                        }}
                                        MenuProps={{ PaperProps: { sx: { bgcolor: 'background.paper', color: 'text.primary' } } }}
                                    >
                                        {uniqueKits.map(kit => <MenuItem key={kit} value={kit}>{kit}</MenuItem>)}
                                    </Select>
                                </FormControl>
                                <FormControl size="small" sx={{ minWidth: 120 }}>
                                    <InputLabel sx={{ color: theme.palette.text.secondary }}>Genre</InputLabel>
                                    <Select
                                        value={selectedGenre}
                                        label="Genre"
                                        onChange={handleFilterChange(setSelectedGenre)}
                                        sx={{ 
                                            color: theme.palette.text.primary,
                                            '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
                                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.text.secondary },
                                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                                            '& .MuiSvgIcon-root': { color: theme.palette.text.secondary }
                                        }}
                                        MenuProps={{ PaperProps: { sx: { bgcolor: 'background.paper', color: 'text.primary' } } }}
                                    >
                                        {uniqueGenres.map(genre => <MenuItem key={genre} value={genre}>{genre}</MenuItem>)}
                                    </Select>
                                </FormControl>
                                <FormControl size="small" sx={{ minWidth: 120 }}>
                                    <InputLabel sx={{ color: theme.palette.text.secondary }}>Type</InputLabel>
                                    <Select
                                        value={selectedType}
                                        label="Type"
                                        onChange={handleFilterChange(setSelectedType)}
                                        sx={{ 
                                            color: theme.palette.text.primary,
                                            '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
                                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.text.secondary },
                                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                                            '& .MuiSvgIcon-root': { color: theme.palette.text.secondary }
                                        }}
                                        MenuProps={{ PaperProps: { sx: { bgcolor: 'background.paper', color: 'text.primary' } } }}
                                    >
                                        {uniqueTypes.map(type => <MenuItem key={type} value={type}>{type}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            </Box>

                            {/* Sample Grid */}
                            {loading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                                    <CircularProgress size={40} />
                                </Box>
                            ) : filteredDrumSamples.length === 0 ? (
                                <Typography variant="body2" color="text.secondary" align="center" sx={{ p: 2 }}>
                                    {drumSamples.length === 0 ? 'No drum samples found in the library' : 'No samples match the current filters.'}
                                </Typography>
                            ) : (
                                <Grid container spacing={2}>
                                    {filteredDrumSamples.map((sample) => (
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
                
                {/* Footer Actions */}
                <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'flex-end', 
                    pt: 2, 
                    borderTop: `1px solid ${theme.palette.divider}`,
                    flexShrink: 0 
                }}>
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