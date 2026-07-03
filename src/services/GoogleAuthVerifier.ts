import { OAuth2Client } from 'google-auth-library';

export type GoogleIdTokenPayload = {
  iss?: string;
  aud?: string | string[];
  sub?: string | null;
  email?: string | null;
  email_verified?: boolean;
  hd?: string | null;
  name?: string | null;
};

export type GoogleIdTokenVerification = {
  payload: GoogleIdTokenPayload;
};

export interface GoogleAuthVerifierInterface {
  verifyIdToken(credential: string): Promise<GoogleIdTokenVerification | null>;
}

export class GoogleAuthVerifier implements GoogleAuthVerifierInterface {
  private readonly client = new OAuth2Client();

  constructor(private readonly clientId: string) {}

  async verifyIdToken(
    credential: string,
  ): Promise<GoogleIdTokenVerification | null> {
    const ticket = await this.client.verifyIdToken({
      idToken: credential,
      audience: this.clientId,
    });
    const payload = ticket.getPayload();
    return payload ? { payload } : null;
  }
}
