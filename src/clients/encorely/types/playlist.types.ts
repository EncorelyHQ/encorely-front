export type DnaMixResponse = {
  spotifyPlaylistId: string;
  name: string;
  description: string;
  totalTracks: number;
  externalUrl: string;
  syncSuccess: boolean;
};

export type DnaMixQuery = {
  userId1: string;
  userId2: string;
  accessToken1: string;
  accessToken2: string;
};
