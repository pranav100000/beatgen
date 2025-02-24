import NiceModal from '@ebay/nice-modal-react';
import VirtualInstrumentsModal from '../components/VirtualInstrumentsModal';

// Register all modals here
export const registerModals = () => {
  NiceModal.register('virtual-instruments-modal', VirtualInstrumentsModal);
};

// Export modal IDs as constants to avoid typos
export const MODAL_IDS = {
  VIRTUAL_INSTRUMENTS: 'virtual-instruments-modal'
} as const; 