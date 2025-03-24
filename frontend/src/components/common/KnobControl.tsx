import React, { useState, useRef, useEffect } from 'react';
import { Box, Slider, Popover, Typography } from '@mui/material';
import { Knob } from 'primereact/knob';

interface KnobControlProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  color?: string;
  size?: number;
  label?: string;
  type: 'volume' | 'pan';
  valueFormatter?: (value: number) => string;
}

const KnobControl: React.FC<KnobControlProps> = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  color = '#1976d2',
  size = 60,
  label,
  type,
  valueFormatter = (val) => `${val}`
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);
  const [showPopover, setShowPopover] = useState(false);
  const knobRef = useRef<HTMLDivElement>(null);
  const popoverIsHoveredRef = useRef(false);
  
  // Normalize value for knob (0-100)
  const normalizedValue = Math.round(((value - min) / (max - min)) * 100);
  
  // Convert normalized value back to actual value
  const denormalizeValue = (norm: number) => {
    return min + (norm / 100) * (max - min);
  };
  
  const handleKnobChange = (newValue: number) => {
    const actualValue = denormalizeValue(newValue);
    onChange(actualValue);
  };
  
  const handleSliderChange = (_event: Event, newValue: number | number[]) => {
    // Ensure popover stays open while using the slider
    if (!showPopover) {
      setShowPopover(true);
    }
    onChange(newValue as number);
  };
  
  const handleKnobMouseEnter = () => {
    // Clear any existing hover timeout
    if (hoverTimeoutRef.current !== null) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    
    // Set anchor and show popover
    setAnchorEl(knobRef.current);
    setShowPopover(true);
  };
  
  const handleKnobMouseLeave = () => {
    // Close popover only if mouse isn't over the popover
    // with a small delay to allow cursor to move to popover
    hoverTimeoutRef.current = window.setTimeout(() => {
      if (!popoverIsHoveredRef.current) {
        setShowPopover(false);
      }
    }, 100);
  };
  
  // Add a delay mechanism to prevent rapid open/close cycles
  const timeoutRef = useRef<number | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  
  const handlePopoverMouseEnter = () => {
    popoverIsHoveredRef.current = true;
    
    // Clear any pending timeout
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };
  
  const handlePopoverMouseLeave = () => {
    popoverIsHoveredRef.current = false;
    
    // Delay closing to allow mouse to move between elements
    timeoutRef.current = window.setTimeout(() => {
      if (!popoverIsHoveredRef.current) {
        setShowPopover(false);
      }
    }, 150); // Increased timeout for more reliable transitions
  };
  
  // Clean up timeouts to prevent memory leaks
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      if (hoverTimeoutRef.current !== null) {
        window.clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);
  
  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      marginBottom: -0.5 // Negative margin to bring components closer
    }}>
      <Box 
        ref={knobRef}
        sx={{ 
          cursor: 'default', 
          mb: -0.5,
          position: 'relative'
        }}
      >
        {/* Invisible hitbox circle */}
        <Box
          onMouseEnter={handleKnobMouseEnter}
          onMouseLeave={handleKnobMouseLeave}
          sx={{
            position: 'absolute',
            width: size + 20, // Make hitbox 20px larger than the knob
            height: size + 20,
            borderRadius: '50%',
            top: -10, // Offset to center the larger hitbox
            left: -10,
            zIndex: 1001,
            cursor: 'pointer', // Show hand cursor on hitbox area
            // Comment this line when you're done debugging
            // backgroundColor: 'rgba(255,0,0,0.1)',
          }}
        />
      
        <Box sx={{ position: 'relative' }}>
          <Knob
            value={normalizedValue}
            readOnly={true}
            disabled={false} // Still want it to look active
            size={size}
            strokeWidth={size <= 30 ? 3 : 4}
            textColor="#888"
            valueColor={color}
            rangeColor="rgba(255,255,255,0.2)"
            showValue={false}
            min={0}
            max={100}
            step={1}
          />
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              pointerEvents: 'none',
              // Fix vertical alignment to center perfectly
              marginTop: size <= 30 ? '-2px' : '-1px',
            }}
          >
            <Typography 
              variant="caption" 
              sx={{ 
                color: '#FFF', 
                fontSize: size <= 30 ? '0.45rem' : size <= 40 ? '0.50rem' : '0.75rem', 
                lineHeight: 1,
                textShadow: '0px 1px 2px rgba(0,0,0,0.8)'
              }}
            >
              {valueFormatter(value)}
            </Typography>
          </Box>
        </Box>
      </Box>
      
      {label && (
        <Typography variant="caption" sx={{mt: -0.5, color: '#888', fontSize: size <= 30 ? '0.5rem' : size <= 40 ? '0.6rem' : '0.7rem' }}>
          {label}
        </Typography>
      )}
      
      <Popover
        id="knob-popover"
        open={showPopover}
        anchorEl={anchorEl}
        // We handle closing ourselves
        onClose={() => {}}
        disableRestoreFocus
        anchorOrigin={{
          vertical: 'center',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'center',
          horizontal: 'right',
        }}
        sx={{
          pointerEvents: 'auto',
          zIndex: 9999, // Very high z-index for the popover
          cursor: 'pointer', // Show hand cursor on popover
          '& .MuiPopover-paper': {
            backgroundColor: '#2A2A2A',
            padding: 1.5,
            width: size <= 30 ? 150 : 200,
            boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
            borderRadius: '8px',
            border: `1px solid ${color}`,
            position: 'relative',
          },
        }}
        slotProps={{
          paper: {
            onMouseEnter: handlePopoverMouseEnter, // Fixed to use popover handlers
            onMouseLeave: handlePopoverMouseLeave
          }
        }}
      >
        <Box sx={{ width: '100%' }}>
          <Slider
            size="small"
            value={value}
            onChange={handleSliderChange}
            min={min}
            max={max}
            step={step}
            sx={{ 
              '& .MuiSlider-track': {
                backgroundColor: color
              },
              '& .MuiSlider-thumb': {
                backgroundColor: color,
              },
              '& .MuiSlider-rail': {
                opacity: 0.3
              }
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Typography variant="caption" sx={{ color: '#AAA' }}>{min}</Typography>
            <Typography variant="caption" sx={{ color: '#FFF' }}>{valueFormatter(value)}</Typography>
            <Typography variant="caption" sx={{ color: '#AAA' }}>{max}</Typography>
          </Box>
        </Box>
      </Popover>
    </Box>
  );
};

export default KnobControl;