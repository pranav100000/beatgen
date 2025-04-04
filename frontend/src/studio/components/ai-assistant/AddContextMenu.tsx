import React, { useState, useEffect, useRef } from 'react';
import { Menu, MenuItem, TextField, Box } from '@mui/material';

interface AddContextMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  onSelect: (trackId: string) => void;
  tracks: Array<{ id: string; name: string }>;
}

const AddContextMenu: React.FC<AddContextMenuProps> = ({ 
  anchorEl, 
  open, 
  onClose, 
  onSelect,
  tracks 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredTracks, setFilteredTracks] = useState(tracks);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset search and selection when menu opens/closes
  useEffect(() => {
    if (!open) {
      setSearchTerm('');
      setSelectedIndex(0);
    }
    setFilteredTracks(tracks);
  }, [open, tracks]);

  // Filter tracks and update selection based on search term
  useEffect(() => {
    const filtered = tracks.filter(track => 
      track.name.toLowerCase().startsWith(searchTerm.toLowerCase())
    );
    setFilteredTracks(filtered);
    // Reset selection index when filtered results change
    setSelectedIndex(filtered.length > 0 ? 0 : -1);
  }, [searchTerm, tracks]);

  // Focus input when menu opens
  useEffect(() => {
    if (open) {
      // Use a small timeout to ensure the menu is fully rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [open]);

  const handleSelect = (trackId: string) => {
    onSelect(trackId);
    onClose();
  };

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      disableAutoFocusItem
      anchorOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
      transformOrigin={{
        vertical: 'bottom',
        horizontal: 'left',
      }}
      PaperProps={{
        sx: {
          borderRadius: 2,
          mt: 1,
          width: 200
        }
      }}
      MenuListProps={{
        disablePadding: true,
        autoFocusItem: false,
      }}
    >
      <Box sx={{ p: 1 }}>
        <TextField
          inputRef={inputRef}
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          fullWidth
          variant="outlined"
          autoComplete="off"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowUp' && 
                e.key !== 'ArrowDown' && 
                e.key !== 'Enter' && 
                e.key !== 'Escape') {
              e.stopPropagation();
            }

            // Handle arrow key navigation
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              e.stopPropagation();
              if (filteredTracks.length > 0) {
                setSelectedIndex(prev => 
                  prev < filteredTracks.length - 1 ? prev + 1 : prev
                );
              }
            }

            if (e.key === 'ArrowUp') {
              e.preventDefault();
              e.stopPropagation();
              if (filteredTracks.length > 0) {
                setSelectedIndex(prev => 
                  prev > 0 ? prev - 1 : prev
                );
              }
            }

            // Handle enter key to select the highlighted item
            if (e.key === 'Enter' && selectedIndex >= 0 && filteredTracks.length > 0) {
              e.preventDefault();
              e.stopPropagation();
              handleSelect(filteredTracks[selectedIndex].id);
            }
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 1,
              fontSize: '0.875rem',
              color: 'white',
              bgcolor: 'rgba(30, 30, 30, 0.8)',
              '& fieldset': {
                borderColor: 'rgba(255, 255, 255, 0.2)'
              },
              '&:hover fieldset': {
                borderColor: 'rgba(255, 255, 255, 0.4)'
              },
              '&.Mui-focused fieldset': {
                borderColor: 'primary.secondary'
              }
            },
            '& .MuiOutlinedInput-notchedOutline': {
              border: 'none'
            },
            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
              border: '1px solid',
              borderColor: 'primary.secondary'
            }
          }}
        />
      </Box>
      {filteredTracks.map((track, index) => (
        <MenuItem 
          key={track.id} 
          onClick={() => handleSelect(track.id)}
          selected={index === selectedIndex}
          sx={{
            fontSize: '0.875rem',
            py: 0.75,
            '&.Mui-selected': {
              backgroundColor: 'rgba(255, 255, 255, 0.08)'
            },
            '&.Mui-selected:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.12)'
            }
          }}
        >
          {track.name}
        </MenuItem>
      ))}
      {filteredTracks.length === 0 && (
        <MenuItem disabled sx={{ fontSize: '0.875rem', py: 0.75 }}>
          No tracks found
        </MenuItem>
      )}
    </Menu>
  );
};

export default AddContextMenu;
