import React, { useState } from 'react';
import {
    Box,
    Modal,
    IconButton,
    Typography,
    Switch,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    useTheme,
    FormControlLabel,
    SelectChangeEvent,
    Grid,
    Divider
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Brightness4Icon from '@mui/icons-material/Brightness4'; // For Dark Mode
import SettingsIcon from '@mui/icons-material/Settings'; // Generic settings icon
import ModelTrainingIcon from '@mui/icons-material/ModelTraining'; // For Assistant Model
import { useAppTheme } from '../../../platform/theme/ThemeContext'; // Added import

export interface StudioSettingsModalProps {
    open: boolean;
    onClose: () => void;
    // Add props for managing settings if they are controlled from outside
    // e.g., uiDarkMode: boolean; onUiDarkModeChange: (value: boolean) => void;
}

// Dummy data for assistant models - replace with actual data source
const assistantModels = [
    { id: 'model1', name: 'GPT-4' },
    { id: 'model2', name: 'Claude 3 Opus' },
    { id: 'model3', name: 'Gemini Pro' },
];

export const StudioSettingsModal = ({ open, onClose }: StudioSettingsModalProps) => {
    const theme = useTheme();
    const { mode: uiMode, studioMode, toggleUITheme, toggleStudioTheme } = useAppTheme(); // Use theme context

    // Local state for settings - you might want to lift this up
    // const [uiDarkMode, setUiDarkMode] = useState(theme.palette.mode === 'dark'); // Removed
    // const [studioDarkMode, setStudioDarkMode] = useState(true); // Removed
    const [selectedAssistantModel, setSelectedAssistantModel] = useState(assistantModels[0]?.id || '');

    // const handleUiDarkModeChange = (event: React.ChangeEvent<HTMLInputElement>) => { // Removed
    //     setUiDarkMode(event.target.checked);
    //     // Add logic to actually change the UI theme
    //     console.log('UI Dark Mode:', event.target.checked);
    // };

    // const handleStudioDarkModeChange = (event: React.ChangeEvent<HTMLInputElement>) => { // Removed
    //     setStudioDarkMode(event.target.checked);
    //     // Add logic to change studio-specific theme elements
    //     console.log('Studio Dark Mode:', event.target.checked);
    // };

    const handleAssistantModelChange = (event: SelectChangeEvent<string>) => {
        setSelectedAssistantModel(event.target.value);
        console.log('Assistant Model:', event.target.value);
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <Box
                sx={{
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    borderRadius: 2,
                    p: { xs: 2, sm: 3 }, // Responsive padding
                    maxWidth: '600px', // Adjusted max width
                    width: '90%',
                    maxHeight: '90vh',
                    overflowY: 'auto', // Ensure content is scrollable if it exceeds maxHeight
                    boxShadow: theme.shadows[5], // Consistent shadow
                }}
            >
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6" component="h2">
                        Studio Settings
                    </Typography>
                    <IconButton
                        onClick={onClose}
                        color="inherit"
                        aria-label="close settings"
                        sx={{
                            borderRadius: '8px', // Consistent with other modals
                            '&:hover': {
                                backgroundColor: theme.palette.action.hover,
                            },
                        }}
                        disableRipple
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>

                <Divider sx={{ mb: 3 }} />

                {/* Settings Grid */}
                <Grid container spacing={3}>
                    {/* UI Dark Mode Setting */}
                    <Grid item xs={12} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Brightness4Icon sx={{ mr: 1.5, color: theme.palette.text.secondary }} />
                            <Typography variant="subtitle1">UI Dark Mode</Typography>
                        </Box>
                        <Switch
                            checked={uiMode === 'dark'} // Use context state
                            onChange={toggleUITheme} // Use context function
                            color="primary"
                        />
                    </Grid>

                    {/* Studio Dark Mode Setting */}
                    <Grid item xs={12} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <SettingsIcon sx={{ mr: 1.5, color: theme.palette.text.secondary }} /> {/* Example Icon, change as needed */}
                            <Typography variant="subtitle1">Studio Dark Mode</Typography>
                        </Box>
                        <Switch
                            checked={studioMode === 'dark'} // Use context state
                            onChange={toggleStudioTheme} // Use context function
                            color="primary"
                        />
                    </Grid>

                    {/* Assistant Model Setting */}
                    <Grid item xs={12} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <ModelTrainingIcon sx={{ mr: 1.5, color: theme.palette.text.secondary }} />
                            <Typography variant="subtitle1">Assistant Model</Typography>
                        </Box>
                        <FormControl variant="outlined" size="small" sx={{ minWidth: 200 /* Adjust width as needed */ }}>
                            {/* InputLabel is not strictly needed here if Typography serves as the label */}
                            {/* If you keep InputLabel for accessibility, hide it visually or ensure it's linked correctly */}
                            <Select
                                // labelId="assistant-model-label" // Only if InputLabel is present and visible
                                id="assistant-model-select"
                                value={selectedAssistantModel}
                                onChange={handleAssistantModelChange}
                                // Removed the complex InputLabel styling from here
                                sx={{
                                    color: theme.palette.text.primary,
                                    '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
                                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.text.secondary },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                                    '& .MuiSvgIcon-root': { color: theme.palette.text.secondary } // Dropdown arrow color
                                }}
                                MenuProps={{
                                    PaperProps: {
                                        sx: {
                                            bgcolor: theme.palette.background.paper,
                                            color: theme.palette.text.primary,
                                        }
                                    }
                                }}
                            >
                                {assistantModels.map((model) => (
                                    <MenuItem key={model.id} value={model.id}>
                                        {model.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>

                {/* Add a footer with Save/Cancel buttons if needed */}
                {/* <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                    <Button onClick={onClose} sx={{ mr: 1 }}>Cancel</Button>
                    <Button variant="contained" onClick={() => console.log('Settings Saved')}>Save Settings</Button>
                </Box> */}
            </Box>
        </Modal>
    );
};

// Example of how to use it (you'd typically manage state in a parent component)
// const ParentComponent = () => {
//   const [settingsOpen, setSettingsOpen] = useState(false);
//   return (
//     <>
//       <Button onClick={() => setSettingsOpen(true)}>Open Settings</Button>
//       <StudioSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
//     </>
//   );
// };
