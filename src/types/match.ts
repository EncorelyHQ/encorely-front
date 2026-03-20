export type EncorelyMatchRequest = {
  id?: string;
  fromUserId: string;
  toUserId: string;
  similarityScore: number;
  createdAt: string;
  status: 'pending' | 'accepted' | 'rejected';
};
