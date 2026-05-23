export type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiration: string;
  userId: string;
};

export type ProviderTokenBody = {
  token: string;
};

export type EmailPasswordBody = {
  email: string;
  password: string;
};
