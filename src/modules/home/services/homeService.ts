import { getUserMe } from '@/clients/encorely/userClient';

export const homeService = {
  getProfile: (userId: string) => getUserMe(userId),
};
