import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import * as fs from 'fs';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: admin.app.App;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    // Try to use GOOGLE_APPLICATION_CREDENTIALS file (same as Speech-to-Text)
    const credentialsPath = this.configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS');

    if (credentialsPath && fs.existsSync(credentialsPath)) {
      try {
        const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        this.app = admin.initializeApp({
          credential: admin.credential.cert(credentials),
        });
        this.logger.log('Firebase Admin SDK initialized with Google credentials file');
        return;
      } catch (error) {
        this.logger.warn(`Failed to load credentials from ${credentialsPath}: ${error.message}`);
      }
    }

    // Fallback: Try individual environment variables
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

    if (projectId && clientEmail && privateKey) {
      this.app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
      this.logger.log('Firebase Admin SDK initialized with environment variables');
      return;
    }

    // No credentials available - development mode
    this.logger.warn(
      'Firebase credentials not configured. Token verification will use decode-only mode.',
    );
  }

  async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    if (!this.app) {
      throw new Error('Firebase Admin SDK not initialized');
    }
    return admin.auth().verifyIdToken(idToken);
  }

  /**
   * Decode token without verification (fallback for development)
   * WARNING: This should NOT be used in production
   */
  decodeTokenWithoutVerification(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = parts[1];
      const decoded = Buffer.from(
        payload.replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      ).toString('utf8');

      return JSON.parse(decoded);
    } catch (error) {
      this.logger.error('Error decoding Firebase token:', error);
      return null;
    }
  }

  isInitialized(): boolean {
    return !!this.app;
  }
}
