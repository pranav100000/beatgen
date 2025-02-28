import React, { useState, useRef, useEffect } from 'react';
import { Modal, Box, Button } from '@mui/material';

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

export interface DraggableModalProps {
  children: React.ReactNode;
  title?: string;
  open: boolean;
  onClose: () => void;
  initialPosition?: Position;
  initialSize?: Size;
  minWidth?: number;
  minHeight?: number;
}

const DraggableModal: React.FC<DraggableModalProps> = ({ 
  children, 
  title, 
  open, 
  onClose,
  initialPosition = { x: 100, y: 100 },
  initialSize = { width: 800, height: 500 },
  minWidth = 400,
  minHeight = 300
}) => {
  const [position, setPosition] = useState<Position>(initialPosition);
  const [size, setSize] = useState<Size>(initialSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        setPosition({ x: newX, y: newY });
      } else if (isResizing) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        setSize(prev => ({
          width: Math.max(minWidth, prev.width + deltaX),
          height: Math.max(minHeight, prev.height + deltaY)
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
  }, [isDragging, isResizing, dragStart, minWidth, minHeight]);

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
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

  return (
    <Modal
      open={open}
      disableAutoFocus
      disableEscapeKeyDown
      onClose={onClose}
      sx={{
        pointerEvents: 'none',  // Make the modal container non-blocking
        '& .MuiBackdrop-root': {
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          pointerEvents: 'none'
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
          bgcolor: '#333333',
          boxShadow: 24,
          borderRadius: 1,
          display: 'flex',
          flexDirection: 'column',
          outline: 'none',
          overflow: 'hidden',
          pointerEvents: 'auto'  // Re-enable pointer events for the modal content
        }}
        onMouseDown={handleHeaderMouseDown}
      >
        <Box sx={{ 
          height: '8px',
          cursor: 'move',
          borderTopLeftRadius: 'inherit',
          borderTopRightRadius: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 8px',
          paddingBottom: '12px'
        }}>
          {title && (
            <Box sx={{
              color: '#999999',
              fontSize: '14px',
              fontWeight: 500,
              marginTop: '8px',
              marginLeft: '4px'
            }}>
              {title}
            </Box>
          )}
        </Box>
        
        <Button 
          onClick={onClose} 
          className="close-button"
          sx={{
            position: 'absolute',
            right: 2,
            top: 8,
            minWidth: 'auto',
            width: 16,
            height: 16,
            p: 0,
            color: '#999999',
            zIndex: 10,
            fontSize: '14px',
            lineHeight: 1,
            '&:hover': {
              color: '#ffffff',
              bgcolor: 'rgba(255, 255, 255, 0.1)'
            }
          }}
        >
          ×
        </Button>

        <Box sx={{ 
          flex: 1, 
          overflow: 'hidden',
          bgcolor: 'background.paper',
          borderBottomLeftRadius: 'inherit',
          borderBottomRightRadius: 'inherit'
        }}>
          {children}
        </Box>

        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 20,
            height: 20,
            cursor: 'se-resize',
            bgcolor: 'grey.300',
            clipPath: 'polygon(100% 0, 100% 100%, 0 100%)'
          }}
          onMouseDown={handleResizeMouseDown}
        />
      </Box>
    </Modal>
  );
};

export default DraggableModal;