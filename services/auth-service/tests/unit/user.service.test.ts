/**
 * Focus:
 * - User bootstrapping via findOrCreateOAuthUser
 * - User profile updates for existing accounts
 * - Fetching user records by userId
 * - Error propagation from database operations
 */

import { UserModel } from '@/models/user.model';
import { findById, findOrCreateOAuthUser } from '@/services/user.service';

jest.mock('@/models/user.model', () => ({
  UserModel: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

describe('user.service (unit)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const sampleProfile = {
    provider: 'github' as const,
    providerId: 'gh-456',
    email: 'alice@example.com',
    name: 'Alice Developer',
    avatarUrl: 'https://avatars.github.com/u/456',
  };

  /**
   * Purpose:
   * Verifies Core behavior:
   * - Creates a new user record in MongoDB when user is not found
   * - Constructs compound userId from provider and providerId
   */
  it('creates and returns a new user when no matching account exists', async () => {
    (UserModel.findOne as jest.Mock).mockResolvedValueOnce(null);

    const createdUser = {
      userId: 'github_gh-456',
      ...sampleProfile,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (UserModel.create as jest.Mock).mockResolvedValueOnce(createdUser);

    const result = await findOrCreateOAuthUser(sampleProfile);

    expect(UserModel.findOne).toHaveBeenCalledWith({
      provider: 'github',
      providerId: 'gh-456',
    });
    expect(UserModel.create).toHaveBeenCalledWith({
      userId: 'github_gh-456',
      provider: 'github',
      providerId: 'gh-456',
      email: 'alice@example.com',
      name: 'Alice Developer',
      avatarUrl: 'https://avatars.github.com/u/456',
    });
    expect(result).toEqual(createdUser);
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - Falls back to default values for missing email, name, and avatarUrl
   */
  it('handles optional and missing fields gracefully on creation', async () => {
    (UserModel.findOne as jest.Mock).mockResolvedValueOnce(null);

    const minimalProfile = {
      provider: 'google' as const,
      providerId: 'google-999',
    };

    (UserModel.create as jest.Mock).mockResolvedValueOnce({
      userId: 'google_google-999',
      provider: 'google',
      providerId: 'google-999',
      email: null,
      name: 'Unknown User',
      avatarUrl: null,
    });

    const result = await findOrCreateOAuthUser(minimalProfile);

    expect(UserModel.create).toHaveBeenCalledWith({
      userId: 'google_google-999',
      provider: 'google',
      providerId: 'google-999',
      email: null,
      name: 'Unknown User',
      avatarUrl: null,
    });
    expect(result.name).toBe('Unknown User');
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - Finds existing user and updates modified fields
   * - Persists changes via existingUser.save()
   */
  it('updates and returns existing user when profile details change', async () => {
    const existingUser = {
      userId: 'github_gh-456',
      provider: 'github',
      providerId: 'gh-456',
      email: 'old@example.com',
      name: 'Old Name',
      avatarUrl: 'https://old-avatar.jpg',
      save: jest.fn().mockResolvedValue(true),
    };

    (UserModel.findOne as jest.Mock).mockResolvedValueOnce(existingUser);

    const result = await findOrCreateOAuthUser({
      ...sampleProfile,
      email: 'new@example.com',
      name: 'New Name',
      avatarUrl: 'https://new-avatar.jpg',
    });

    expect(existingUser.email).toBe('new@example.com');
    expect(existingUser.name).toBe('New Name');
    expect(existingUser.avatarUrl).toBe('https://new-avatar.jpg');
    expect(existingUser.save).toHaveBeenCalledTimes(1);
    expect(UserModel.create).not.toHaveBeenCalled();
    expect(result).toBe(existingUser);
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - Does not invoke save() when profile details are unchanged
   */
  it('avoids saving existing user when no fields have changed', async () => {
    const existingUser = {
      userId: 'github_gh-456',
      provider: 'github',
      providerId: 'gh-456',
      email: 'alice@example.com',
      name: 'Alice Developer',
      avatarUrl: 'https://avatars.github.com/u/456',
      save: jest.fn(),
    };

    (UserModel.findOne as jest.Mock).mockResolvedValueOnce(existingUser);

    const result = await findOrCreateOAuthUser(sampleProfile);

    expect(existingUser.save).not.toHaveBeenCalled();
    expect(result).toBe(existingUser);
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - Retrieves user document by unique userId
   */
  it('finds user by unique userId', async () => {
    const mockUser = { userId: 'github_gh-456', name: 'Alice' };
    (UserModel.findOne as jest.Mock).mockResolvedValueOnce(mockUser);

    const result = await findById('github_gh-456');

    expect(UserModel.findOne).toHaveBeenCalledWith({ userId: 'github_gh-456' });
    expect(result).toEqual(mockUser);
  });

  /**
   * Purpose:
   * Verifies Error handling:
   * - Propagates database exceptions back to caller
   */
  it('propagates database error when query fails', async () => {
    (UserModel.findOne as jest.Mock).mockRejectedValueOnce(
      new Error('MongoDB query failed')
    );

    await expect(findOrCreateOAuthUser(sampleProfile)).rejects.toThrow(
      'MongoDB query failed'
    );
  });
});
