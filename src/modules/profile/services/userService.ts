import { getUserMe } from '@/clients/encorely/userClient';

export const userService = {
  getMe: (userId: string) => getUserMe(userId),
};
