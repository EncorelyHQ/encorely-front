import { updateUserSettings } from '@/clients/encorely/userClient';
import type { UpdateUserSettingsBody } from '@/clients/encorely/types';

export const settingsService = {
  updateMood: (body: UpdateUserSettingsBody) => updateUserSettings(body),
};
