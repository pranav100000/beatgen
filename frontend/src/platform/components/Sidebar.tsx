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
} from '@tabler/icons-react';

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

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const { open } = useSidebar();

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
      <SidebarHeader className="flex items-center justify-between h-16 px-4">
        {open && <span className="text-xl font-semibold">BeatGen</span>}
        <SidebarTrigger />
      </SidebarHeader>
      
      <SidebarContent>
        {/* User Profile Section */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => navigate({ to: '/profile' })}
              tooltip="My Profile"
            >
              <IconUserCircle />
              <span>My Profile</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        
        <SidebarSeparator className="my-2" />
        
        {/* Navigation Links */}
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.text}>
              <SidebarMenuButton
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