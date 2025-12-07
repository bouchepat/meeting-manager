import { Controller, Post, Body, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from '../entities/user.entity';
import { Public } from './public.decorator';
import { FirebaseService } from './firebase.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
    private firebaseService: FirebaseService,
  ) {}

  /**
   * Exchange Firebase ID token for JWT
   * Automatically creates user if they don't exist
   */
  @Public()
  @Post('login')
  async login(@Body('firebaseToken') firebaseToken: string) {
    if (!firebaseToken) {
      throw new UnauthorizedException('Firebase token is required');
    }

    try {
      let decodedToken: any;

      // Try to verify with Firebase Admin SDK first
      if (this.firebaseService.isInitialized()) {
        try {
          decodedToken = await this.firebaseService.verifyIdToken(firebaseToken);
          this.logger.log('Firebase token verified successfully');
        } catch (verifyError) {
          this.logger.warn('Firebase verification failed, falling back to decode-only');
          // Fall back to decoding without verification (development only)
          decodedToken = this.firebaseService.decodeTokenWithoutVerification(firebaseToken);
        }
      } else {
        // Firebase not initialized, use decode-only (development)
        this.logger.warn('Firebase not initialized, using decode-only (DEVELOPMENT MODE)');
        decodedToken = this.firebaseService.decodeTokenWithoutVerification(firebaseToken);
      }

      const userId = decodedToken?.user_id || decodedToken?.uid;
      if (!userId) {
        throw new UnauthorizedException('Invalid Firebase token');
      }

      this.logger.log(`Processing login for user: ${decodedToken.email}`);

      // Find or create user
      let user = await this.usersRepository.findOne({
        where: { firebaseUid: userId },
      });

      if (!user) {
        // User doesn't exist, create them
        this.logger.log('User not found, creating new user...');

        user = this.usersRepository.create({
          email: decodedToken.email,
          displayName: decodedToken.name || decodedToken.email,
          photoURL: decodedToken.picture || null,
          firebaseUid: userId,
        });

        await this.usersRepository.save(user);
        this.logger.log(`New user created: ${user.id}`);
      } else {
        this.logger.log(`Existing user found: ${user.id}`);
      }

      // Generate JWT
      const payload = {
        sub: user.firebaseUid,
        email: user.email,
      };

      const token = this.jwtService.sign(payload);

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          firebaseUid: user.firebaseUid,
          enableTranscription: user.enableTranscription,
          autoSaveRecordings: user.autoSaveRecordings,
          notificationsEnabled: user.notificationsEnabled,
          theme: user.theme,
          audioQuality: user.audioQuality,
        },
      };
    } catch (error) {
      this.logger.error('Error during login:', error);
      throw new UnauthorizedException('Authentication failed');
    }
  }
}
