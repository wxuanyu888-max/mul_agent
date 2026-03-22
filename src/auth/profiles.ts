/**
 * Auth Profile System
 *
 * Manages multiple authentication profiles with rotation and failover
 * Based on OpenClaw's auth-profiles system
 */

import crypto from 'crypto';

export interface AuthProfile {
  id: string;
  provider: string;
  credential: AuthCredential;
  priority: number;
  cooldownUntil?: number;
  failureCount: number;
  lastUsed?: number;
  metadata?: Record<string, unknown>;
}

export interface AuthCredential {
  type: 'api_key' | 'oauth';
  apiKey?: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface AuthProfileOptions {
  provider: string;
  credential: AuthCredential;
  priority?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Create a new auth profile
 */
export function createAuthProfile(options: AuthProfileOptions): AuthProfile {
  return {
    id: `${options.provider}:${crypto.randomUUID().slice(0, 8)}`,
    provider: options.provider,
    credential: options.credential,
    priority: options.priority ?? 0,
    failureCount: 0,
    metadata: options.metadata,
  };
}

/**
 * Auth Profile Store - manages multiple profiles
 */
export class AuthProfileStore {
  private profiles: Map<string, AuthProfile[]> = new Map();

  /**
   * Add a profile
   */
  addProfile(profile: AuthProfile): void {
    const existing = this.profiles.get(profile.provider) || [];
    existing.push(profile);
    // Sort by priority (higher first)
    existing.sort((a, b) => b.priority - a.priority);
    this.profiles.set(profile.provider, existing);
  }

  /**
   * Get profiles for a provider
   */
  getProfiles(provider: string): AuthProfile[] {
    return this.profiles.get(provider) || [];
  }

  /**
   * Get the next available profile (not in cooldown)
   */
  getAvailableProfile(provider: string): AuthProfile | null {
    const profiles = this.getProfiles(provider);
    const now = Date.now();

    for (const profile of profiles) {
      // Skip if in cooldown
      if (profile.cooldownUntil && profile.cooldownUntil > now) {
        continue;
      }
      // Skip if credentials expired
      if (profile.credential.expiresAt && profile.credential.expiresAt < now) {
        continue;
      }
      return profile;
    }

    return null;
  }

  /**
   * Mark profile as successful
   */
  markSuccess(profileId: string): void {
    for (const profiles of this.profiles.values()) {
      const profile = profiles.find(p => p.id === profileId);
      if (profile) {
        profile.failureCount = 0;
        profile.cooldownUntil = undefined;
        profile.lastUsed = Date.now();
        break;
      }
    }
  }

  /**
   * Mark profile as failed
   */
  markFailure(profileId: string, cooldownMs: number = 60000): void {
    for (const profiles of this.profiles.values()) {
      const profile = profiles.find(p => p.id === profileId);
      if (profile) {
        profile.failureCount++;
        profile.cooldownUntil = Date.now() + cooldownMs;
        // Increase cooldown based on failure count
        const extraCooldown = Math.min(profile.failureCount * 30000, 300000);
        profile.cooldownUntil += extraCooldown;
        break;
      }
    }
  }

  /**
   * Get next profile in rotation
   */
  getNextProfile(provider: string): AuthProfile | null {
    const current = this.getAvailableProfile(provider);
    if (!current) return null;

    const profiles = this.getProfiles(provider);
    const currentIndex = profiles.findIndex(p => p.id === current.id);

    // Try next profile in priority order
    const nextIndex = (currentIndex + 1) % profiles.length;
    return profiles[nextIndex];
  }

  /**
   * Check if credentials need refresh
   */
  needsRefresh(profileId: string): boolean {
    for (const profiles of this.profiles.values()) {
      const profile = profiles.find(p => p.id === profileId);
      if (profile && profile.credential.refreshToken) {
        // Refresh if expires in next 5 minutes
        const expiresAt = profile.credential.expiresAt || 0;
        return expiresAt - Date.now() < 5 * 60 * 1000;
      }
    }
    return false;
  }

  /**
   * Remove a profile
   */
  removeProfile(profileId: string): boolean {
    for (const [provider, profiles] of this.profiles.entries()) {
      const index = profiles.findIndex(p => p.id === profileId);
      if (index !== -1) {
        profiles.splice(index, 1);
        if (profiles.length === 0) {
          this.profiles.delete(provider);
        }
        return true;
      }
    }
    return false;
  }

  /**
   * List all profiles
   */
  listAll(): AuthProfile[] {
    const all: AuthProfile[] = [];
    for (const profiles of this.profiles.values()) {
      all.push(...profiles);
    }
    return all;
  }

  /**
   * Clear all profiles
   */
  clear(): void {
    this.profiles.clear();
  }
}

/**
 * Create an auth profile store from config
 */
export function createAuthProfileStore(
  profiles: Array<{
    provider: string;
    apiKey?: string;
    refreshToken?: string;
    expiresAt?: number;
    priority?: number;
  }>
): AuthProfileStore {
  const store = new AuthProfileStore();

  for (const p of profiles) {
    const profile = createAuthProfile({
      provider: p.provider,
      credential: {
        type: p.refreshToken ? 'oauth' : 'api_key',
        apiKey: p.apiKey,
        refreshToken: p.refreshToken,
        expiresAt: p.expiresAt,
      },
      priority: p.priority,
    });
    store.addProfile(profile);
  }

  return store;
}
