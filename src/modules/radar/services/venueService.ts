import {
  createVenueRoom,
  deleteVenueMessage,
  getVenueMessages,
  sendVenueMessage,
} from '@/clients/encorely/venueClient';

export const venueService = {
  createRoom: createVenueRoom,
  getMessages: getVenueMessages,
  sendMessage: sendVenueMessage,
  deleteMessage: deleteVenueMessage,
};
