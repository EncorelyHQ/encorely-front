import { createDnaMix } from '@/clients/encorely/playlistClient';
import type { DnaMixQuery } from '@/clients/encorely/types';

export const playlistService = {
  createDnaMix: (query: DnaMixQuery) => createDnaMix(query),
};
