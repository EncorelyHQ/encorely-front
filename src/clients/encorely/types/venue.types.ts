export type VenueRoom = {
  id: string;
  name: string;
  expiresAt: string;
  eventId: string;
};

export type VenueMessage = {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  isModerated: boolean;
  timestamp: string;
};

export type SendVenueMessageResponse = {
  id: string;
  content: string;
  isModerated: boolean;
  timestamp: string;
};
