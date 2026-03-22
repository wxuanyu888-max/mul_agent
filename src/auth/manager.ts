/**
 * Auth Manager
 *
 * Handles auth profile rotation, failover, and credential refresh
 * Based on OpenClaw's auth-profiles system
 */

import type { AuthProfile, AuthCredential, AuthProfileStore } from './profiles.js';

export interface AuthManagerOptions {
  defaultCooldownMs?: number;
  maxFailures?: number;
  onProfileChange?: (profile: AuthProfile) => void;
  onProfileFailure?: (profile: AuthProfile, error: Error) => void;
}

export interface AuthResult {
  profile: AuthProfile;
  credential: AuthCredential;
}

/**
 * Auth Manager - handles auth profile rotation and failover
 */
export class AuthManager {
  private store: AuthProfileStore;
  private options: Required<AuthManagerOptions>;
  private currentProfile: Map<string, AuthProfile> = new Map();

  constructor(store: AuthProfileStore, options?: AuthManagerOptions) {
    this.store = store;
    this.options = {
      defaultCooldownMs: options?.defaultCooldownMs ?? 60000,
      maxFailures: options?.maxFailures ?? 3,
      onProfileChange: options?.onProfileChange ?? (() => {}),
      onProfileFailure: options?.onProfileFailure ?? (() => {}),
    };
  }

  /**
   * Get auth credential for a provider
   */
  async getAuth(provider: string): Promise<AuthResult | null> {
    let profile = this.currentProfile.get(provider);

    // If no current profile or needs refresh, get a fresh one
    if (!profile || this.store.needsRefresh(profile.id)) {
      profile = this.store.getAvailableProfile(provider) ?? undefined;

      if (!profile) {
        // Try to get any profile even if in cooldown
        const profiles = this.store.getProfiles(provider);
        if (profiles.length > 0) {
          profile = profiles[0];
        }
      }

      if (profile) {
        this.currentProfile.set(provider, profile);
        this.options.onProfileChange(profile);
      }
    }

    if (!profile) {
      return null;
    }

    // Check if credential needs refresh (OAuth)
    if (profile.credential.refreshToken && this.store.needsRefresh(profile.id)) {
      try {
        await this.refreshCredential(profile);
      } catch (error) {
        this.handleFailure(profile, error as Error);
        // Try next profile
        return this.getAuth(provider);
      }
    }

    return {
      profile,
      credential: profile.credential,
    };
  }

  /**
   * Mark current profile as successful
   */
  markSuccess(provider: string): void {
    const profile = this.currentProfile.get(provider);
    if (profile) {
      this.store.markSuccess(profile.id);
    }
  }

  /**
   * Mark current profile as failed
   */
  markFailure(provider: string, error: Error): void {
    const profile = this.currentProfile.get(provider);
    if (profile) {
      this.handleFailure(profile, error);
    }
  }

  /**
   * Handle profile failure
   */
  private handleFailure(profile: AuthProfile, error: Error): void {
    this.store.markFailure(profile.id, this.options.defaultCooldownMs);
    this.options.onProfileFailure(profile, error);

    // Clear current profile to force rotation
    this.currentProfile.delete(profile.provider);

    // If too many failures, switch to next profile
    if (profile.failureCount >= this.options.maxFailures) {
      const nextProfile = this.store.getNextProfile(profile.provider);
      if (nextProfile) {
        this.currentProfile.set(profile.provider, nextProfile);
        this.options.onProfileChange(nextProfile);
      }
    }
  }

  /**
   * Refresh OAuth credential
   */
  private async refreshCredential(profile: AuthProfile): Promise<void> {
    if (!profile.credential.refreshToken) {
      throw new Error('No refresh token available');
    }

    // In a real implementation, this would call the provider's token endpoint
    // For now, we'll simulate a refresh
    console.log(`[Auth] Refreshing credential for ${profile.provider}`);

    // Placeholder for actual OAuth refresh logic
    // const response = await fetch(`https://${profile.provider}.com/oauth/refresh`, {
    //   method: 'POST',
    //   body: JSON.stringify({ refresh_token: profile.credential.refreshToken }),
    // });
    // const tokens = await response.json();

    // Update profile with new credentials
    // profile.credential.apiKey = tokens.access_token;
    // profile.credential.refreshToken = tokens.refresh_token;
    // profile.credential.expiresAt = Date.now() + tokens.expires_in * 1000;

    this.store.markSuccess(profile.id);
  }

  /**
   * Rotate to next profile
   */
  async rotate(provider: string): Promise<AuthResult | null> {
    const nextProfile = this.store.getNextProfile(provider);
    if (nextProfile) {
      this.currentProfile.set(provider, nextProfile);
      this.options.onProfileChange(nextProfile);
      return {
        profile: nextProfile,
        credential: nextProfile.credential,
      };
    }
    return null;
  }

  /**
   * Force use a specific profile
   */
  setProfile(provider: string, profileId: string): boolean {
    const profiles = this.store.getProfiles(provider);
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      this.currentProfile.set(provider, profile);
      this.options.onProfileChange(profile);
      return true;
    }
    return false;
  }

  /**
   * Get current profile info
   */
  getCurrentProfile(provider: string): AuthProfile | undefined {
    return this.currentProfile.get(provider);
  }

  /**
   * List all providers with profiles
   */
  listProviders(): string[] {
    const profiles = this.store.listAll();
    const providers = new Set(profiles.map(p => p.provider));
    return Array.from(providers);
  }

  /**
   * Check if a provider has available profiles
   */
  hasAvailableProfiles(provider: string): boolean {
    return this.store.getAvailableProfile(provider) !== null;
  }
}
