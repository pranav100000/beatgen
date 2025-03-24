import React from 'react';
import { TrackSidebarControlsFactory } from './index';

/**
 * This component exists for backward compatibility.
 * It simply re-exports the TrackSidebarControlsFactory component
 * to allow for a smooth transition from the original TrackControls system.
 */
const TrackSidebarControls = TrackSidebarControlsFactory;

export default TrackSidebarControls;