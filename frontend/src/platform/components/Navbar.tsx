import React, { useState } from 'react';
import { Link as RouterLink } from '@tanstack/react-router';
import { useAuth } from '../auth/auth-context';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Tooltip,
  ListItemIcon,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  Menu as MenuIcon,
  Home as HomeIcon,
  MusicNote as MusicNoteIcon,
  Person as PersonIcon,
  ExitToApp as LogoutIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';

const Navbar = () => {
  const { user, profile, signOut } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  
  // Handlers
  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };
  
  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };
  
  const handleLogout = async () => {
    handleUserMenuClose();
    await signOut();
    window.location.href = '/';
  };
  
  // User menu component
  const userMenuOpen = Boolean(userMenuAnchor);
  
  return (
    <AppBar position="static" sx={{ bgcolor: 'rgba(0, 0, 0, 0.9)' }}>
      <Toolbar>
        {/* Logo */}
        <Typography
          variant="h6"
          component={RouterLink}
          to="/"
          sx={{
            flexGrow: 1,
            fontWeight: 'bold',
            textDecoration: 'none',
            color: 'white',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <MusicNoteIcon sx={{ mr: 1 }} />
          BeatGen
        </Typography>
        
        {/* Desktop Navigation */}
        {!isMobile && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {user ? (
              <>
                <Button
                  component={RouterLink}
                  to="/home"
                  color="inherit"
                  startIcon={<HomeIcon />}
                  sx={{ ml: 2 }}
                >
                  Projects
                </Button>
                
                <Button
                  component={RouterLink}
                  to="/studio"
                  color="inherit"
                  startIcon={<MusicNoteIcon />}
                  sx={{ ml: 2 }}
                >
                  Studio
                </Button>
                
                {/* User Menu Button */}
                <Tooltip title="Account Settings">
                  <IconButton
                    onClick={handleUserMenuOpen}
                    sx={{ ml: 2 }}
                    aria-controls={userMenuOpen ? 'user-menu' : undefined}
                    aria-haspopup="true"
                    aria-expanded={userMenuOpen ? 'true' : undefined}
                  >
                    {profile?.avatar_url ? (
                      <Avatar 
                        src={profile.avatar_url} 
                        alt={profile.display_name || user.email} 
                      />
                    ) : (
                      <Avatar>
                        {user.email.charAt(0).toUpperCase()}
                      </Avatar>
                    )}
                  </IconButton>
                </Tooltip>
              </>
            ) : (
              <>
                <Button
                  component={RouterLink}
                  to="/login"
                  color="inherit"
                  sx={{ ml: 2 }}
                >
                  Log In
                </Button>
                
                <Button
                  component={RouterLink}
                  to="/register"
                  variant="contained"
                  color="primary"
                  sx={{ ml: 2 }}
                >
                  Sign Up
                </Button>
              </>
            )}
          </Box>
        )}
        
        {/* Mobile Menu Button */}
        {isMobile && (
          <IconButton
            edge="end"
            color="inherit"
            aria-label="menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <MenuIcon />
          </IconButton>
        )}
      </Toolbar>
      
      {/* User Menu (Desktop) */}
      <Menu
        id="user-menu"
        anchorEl={userMenuAnchor}
        open={userMenuOpen}
        onClose={handleUserMenuClose}
        PaperProps={{
          sx: {
            width: 220,
            bgcolor: '#111',
            color: 'white',
            boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle1" noWrap>
            {profile?.display_name || user?.email}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {user?.email}
          </Typography>
        </Box>
        
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
        
        <MenuItem component={RouterLink} to="/profile" onClick={handleUserMenuClose}>
          <ListItemIcon>
            <PersonIcon fontSize="small" color="primary" />
          </ListItemIcon>
          Profile
        </MenuItem>
        
        <MenuItem component={RouterLink} to="/settings" onClick={handleUserMenuClose}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" color="primary" />
          </ListItemIcon>
          Settings
        </MenuItem>
        
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
        
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" color="error" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>
    </AppBar>
  );
};

export default Navbar;