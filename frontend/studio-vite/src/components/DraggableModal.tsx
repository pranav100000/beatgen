import React, { useState, useRef, useEffect } from 'react';
import { Box, Button, Modal, Typography } from '@mui/material';

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

interface DraggableModalProps {
  children: React.ReactNode;
  title: string;
  isOpen: boolean;
  onClose: () => void;
  initialPosition?: Position;
  initialSize?: Size;
}

const DraggableModal: React.FC<DraggableModalProps> = ({ 
  children, 
  title, 
  isOpen, 
  onClose, 
  initialPosition = { x: 100, y: 100 },
  initialSize = { width: 800, height: 500 }
}) => {
  const [position, setPosition] = useState<Position>(initialPosition);
  const [size, setSize] = useState<Size>(initialSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset position when modal opens
  useEffect(() => {
    if (isOpen) {
      setPosition(initialPosition);
      setSize(initialSize);
    }
  }, [isOpen, initialPosition, initialSize]);

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        // Calculate new position based on mouse movement
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        setPosition({ x: newX, y: newY });
      } else if (isResizing) {
        // Calculate new size based on mouse movement
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        setSize(prev => ({
          width: Math.max(400, prev.width + deltaX),
          height: Math.max(300, prev.height + deltaY)
        }));
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, isResizing, dragStart]);

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    // Don't start dragging if clicking the close button
    if ((e.target as HTMLElement).closest('.close-button')) return;
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY
    });
  };

  if (!isOpen) return null;

  return (
    <Modal
      open={true}
      disableAutoFocus
      disableEscapeKeyDown
      onClose={onClose}
      sx={{
        pointerEvents: 'none',  // Make the modal container non-blocking
        '& .MuiBackdrop-root': {
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          pointerEvents: 'none' // Let clicks through the backdrop
        }
      }}
      keepMounted
    >
      <Box
        ref={modalRef}
        sx={{
          position: 'absolute',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
          bgcolor: '#222',
          boxShadow: 24,
          borderRadius: 1,
          display: 'flex',
          flexDirection: 'column',
          outline: 'none',
          overflow: 'hidden',
          pointerEvents: 'auto',  // Re-enable pointer events for the modal content
          color: 'white'
        }}
      >
        {/* Header - draggable area */}
        <Box 
          sx={{ 
            height: '32px',
            bgcolor: '#333',
            display: 'flex',
            alignItems: 'center',
            pl: 2,
            pr: 4,
            cursor: 'move',
            borderTopLeftRadius: 'inherit',
            borderTopRightRadius: 'inherit',
            userSelect: 'none'
          }} 
          onMouseDown={handleHeaderMouseDown}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', flex: 1 }}>
            {title}
          </Typography>
        </Box>
        
        {/* Close button */}
        <Button 
          onClick={onClose} 
          className="close-button"
          sx={{
            position: 'absolute',
            right: 8,
            top: 4,
            minWidth: 'auto',
            width: 24,
            height: 24,
            p: 0,
            color: '#999',
            zIndex: 10,
            fontSize: '18px',
            lineHeight: 1,
            '&:hover': {
              color: '#fff',
              bgcolor: 'rgba(255, 255, 255, 0.1)'
            }
          }}
        >
          ×
        </Button>

        {/* Content area */}
        <Box sx={{ 
          flex: 1, 
          overflow: 'hidden',
          bgcolor: '#181818',
          borderBottomLeftRadius: 'inherit',
          borderBottomRightRadius: 'inherit'
        }}>
          {children}
        </Box>

        {/* Resize handle */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 20,
            height: 20,
            cursor: 'se-resize',
            bgcolor: 'transparent',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.1)'
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              bottom: 4,
              right: 4,
              width: 10,
              height: 10,
              borderRight: '2px solid #666',
              borderBottom: '2px solid #666'
            }
          }}
          onMouseDown={handleResizeMouseDown}
        />
      </Box>
    </Modal>
  );
};

export default DraggableModal;