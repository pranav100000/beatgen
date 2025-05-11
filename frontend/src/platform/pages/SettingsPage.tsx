import React from 'react';
import {
    Box,
    Container,
    Paper,
    Typography,
    Switch,
    FormControlLabel,
    Divider,
    useTheme,
    Button,
    IconButton
} from '@mui/material';
import { useAppTheme } from '../theme/ThemeContext';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import SettingsIcon from '@mui/icons-material/Settings';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useRouter } from '@tanstack/react-router';

const SettingsPage: React.FC = () => {
    const muiTheme = useTheme();
    const { mode: uiMode, studioMode, toggleUITheme, toggleStudioTheme } = useAppTheme();
    const router = useRouter();

    const handleGoBack = () => {
        router.history.back();
    };

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Paper elevation={3} sx={{ p: { xs: 2, sm: 4 }, position: 'relative' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <IconButton 
                        onClick={handleGoBack} 
                        aria-label="go back" 
                        sx={{ mr: 1 }}
                    >
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h4" component="h1">
                        Application Settings
                    </Typography>
                </Box>

                {/* UI Theme Settings */}
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h6" component="h2" gutterBottom>
                        UI Theme
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1, borderRadius: 1, bgcolor: muiTheme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Brightness4Icon sx={{ mr: 1.5, color: muiTheme.palette.text.secondary }} />
                            <Typography variant="subtitle1">
                                Dark Mode
                            </Typography>
                        </Box>
                        <Switch
                            checked={uiMode === 'dark'}
                            onChange={toggleUITheme}
                            color="primary"
                            inputProps={{ 'aria-label': 'toggle ui dark mode' }}
                        />
                    </Box>
                </Box>

                {/* Studio Theme Settings */}
                <Box>
                    <Typography variant="h6" component="h2" gutterBottom>
                        Studio Theme
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1, borderRadius: 1, bgcolor: muiTheme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <SettingsIcon sx={{ mr: 1.5, color: muiTheme.palette.text.secondary }} />
                            <Typography variant="subtitle1">
                                Dark Mode
                            </Typography>
                        </Box>
                        <Switch
                            checked={studioMode === 'dark'}
                            onChange={toggleStudioTheme}
                            color="primary"
                            inputProps={{ 'aria-label': 'toggle studio dark mode' }}
                        />
                    </Box>
                </Box>

                {/* Future settings can be added here */}
                {/* e.g., Assistant Model, etc. */}

            </Paper>
        </Container>
    );
};

export default SettingsPage; 