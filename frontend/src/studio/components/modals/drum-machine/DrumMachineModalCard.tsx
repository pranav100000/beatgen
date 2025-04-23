import React from 'react';
import {
    Box,
    Typography,
    CircularProgress,
    Checkbox
} from '@mui/material';
import { DrumSamplePublicRead } from 'src/platform/types/public_models/drum_samples';
import { prettyPrint } from '../../../../utils/pretty_print';
import { useTheme } from '@mui/material/styles';

export interface DrumSampleCardProps {
    sample: DrumSamplePublicRead;
    onToggleSelect: (sample: DrumSamplePublicRead) => void;
    isLoading: boolean;
    isSelected: boolean;
}

export const DrumSampleCard: React.FC<DrumSampleCardProps> = ({
    sample,
    onToggleSelect,
    isLoading,
    isSelected
}) => {
    const handleToggle = (event?: React.MouseEvent) => {
        event?.stopPropagation();
        if (!isLoading) {
            onToggleSelect(sample);
        }
    };

    const theme = useTheme();

    return (
        <Box
            onClick={() => handleToggle()}
            sx={{
                bgcolor: isSelected ? 'action.selected' : 'background.paper' ,
                opacity: isSelected ? 1 : 0.8,
                borderRadius: 3,
                p: 2.5,
                transition: 'all 0.25s ease-in-out',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
                position: 'relative',
                minHeight: 160,
                cursor: isLoading ? 'wait' : 'pointer',
                border: isSelected ? `1px solid ${theme.palette.primary.main}` : '1px solid transparent',
                boxShadow: isSelected ? '0 0 8px rgba(0, 123, 255, 0.3)' : 'none',
                '&:hover': {
                    bgcolor: isSelected ? 'action.selected' : 'action.hover',
                    opacity: 1,
                    transform: 'translateY(-2px)',
                    boxShadow: isSelected ? '0 0 12px rgba(0, 123, 255, 0.4)' : '0 4px 8px rgba(0,0,0,0.2)'
                }
            }}
        >
            <Checkbox
                checked={isSelected}
                onChange={(e) => handleToggle(e as any)}
                disabled={isLoading}
                onClick={(e) => e.stopPropagation()}
                sx={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    zIndex: 2
                }}
            />
            {isLoading && (
                <CircularProgress
                    size={24}
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        marginTop: '-12px',
                        marginLeft: '-12px',
                        zIndex: 1
                    }}
                />
            )}

            <Box sx={{ textAlign: 'center', flexGrow: 1, width: '100%', mt: 2, opacity: isLoading ? 0.5 : 1 }}>
                <Typography
                    variant="subtitle1"
                    sx={{
                        wordBreak: 'break-word',
                        fontWeight: 'bold',
                        mb: 0.5
                    }}
                >
                    {prettyPrint(sample.display_name)}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                    Kit: {prettyPrint(sample.kit_name)}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                    Genre: {prettyPrint(sample.genre)}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                    Type: {prettyPrint(sample.category)}
                </Typography>
            </Box>
        </Box>
    );
};
