export type EventFeedItem = {
  id: string;
  name: string;
  venue: string;
  date: string;
  mood: string;
  affiliatePurchaseUrl: string;
};

export type RadarMatch = {
  id: string;
  displayName: string;
  affinity: number;
  isHighPriority: boolean;
  mood: string;
};
