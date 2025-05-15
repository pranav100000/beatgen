import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  IconHomeFilled,
  IconFolder,
  IconMusic,
  IconPiano,
  IconWaveSine,
  IconDisc,
  IconUserCircle,
  IconSettings,
  IconLogout,
} from '@tabler/icons-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";

import {
  Sidebar as ShadcnSidebar,
  SidebarTrigger,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

import { useAuth } from '../auth/auth-context';

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const { open } = useSidebar();
  const { signOut } = useAuth();

  const menuItems = [
    { text: 'Home', icon: <IconHomeFilled />, path: '/' },
    { text: 'Projects', icon: <IconFolder />, path: '/projects' },
    { text: 'Audio Tracks', icon: <IconMusic />, path: '/audio-tracks' },
    { text: 'Midi Tracks', icon: <IconPiano />, path: '/midi-tracks' },
    { text: 'Sampler Tracks', icon: <IconWaveSine />, path: '/sampler-tracks' },
    { text: 'Drum Tracks', icon: <IconDisc />, path: '/drum-tracks' },
  ];

  return (
    <ShadcnSidebar collapsible="icon">
      <SidebarHeader 
        className={`flex flex-row items-center h-16 px-4 ${
          open ? 'justify-between' : 'justify-end'
        }`}
      >
        {open && (
          <div className="flex items-center">
            <img src="/beatgen-favicon.png" alt="BeatGen Favicon" className="mr-2 h-6 w-6" />
            <span className="text-xl font-semibold">BeatGen</span>
          </div>
        )}
        <SidebarTrigger className="translate-x-1.5" />
      </SidebarHeader>
      
      <SidebarContent>
        {/* User Profile Section */}
        <SidebarMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                aria-label="User Menu"
                tooltip="My Profile"
                className="w-full justify-start translate-x-1.5"
              >
                <IconUserCircle />
                {open && <span>My Profile</span>}
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" side="right" align="start" sideOffset={open ? 5 : 10}>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">pranav100000@gmail.com</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    pranav100000@gmail.com
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="translate-x-1.5" onClick={() => navigate({ to: '/profile' })}>
                <IconUserCircle className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="translate-x-1.5" onClick={() => navigate({ to: '/settings' })}>
                <IconSettings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="translate-x-1.5"
                onClick={async () => {
                  await signOut();
                  navigate({ to: '/login', replace: true });
                }}
              >
                <IconLogout className="mr-2 h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenu>
        
        <SidebarSeparator className="my-2" />
        
        {/* Navigation Links */}
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.text}>
              <SidebarMenuButton
                className="translate-x-1.5"
                onClick={() => navigate({ to: item.path })}
                tooltip={item.text}
              >
                {React.cloneElement(item.icon, { className: "shrink-0" })}
                <span>{item.text}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </ShadcnSidebar>
  );
};

export default Sidebar; 