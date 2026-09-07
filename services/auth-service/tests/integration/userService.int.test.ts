/**
 * Integration Test
 * Focus:
 * - MongoDB connection and lifecycle via connectDatabase and disconnectDatabase
 * - User persistence and compound unique index enforcement
 * - User profile updates and retrieval through real database operations
 */

import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { connectDatabase, disconnectDatabase, isDatabaseConnected } from '@/config/db';
import { UserModel } from '@/models/user.model';
import { findById, findOrCreateOAuthUser } from '@/services/user.service';

jest.setTimeout(120_000);

describe('userService (integration)', () => {
  let mongoContainer: StartedTestContainer | null = null;
  let mongoUri: string;

  /**
   * Setup:
   * - Spin up MongoDB container via Testcontainers if MONGODB_URI is not provided
   * - Connect Mongoose to the MongoDB instance
   */
  beforeAll(async () => {
    if (process.env.MONGODB_URI) {
      mongoUri = process.env.MONGODB_URI;
    } else {
      mongoContainer = await new GenericContainer('mongo:6.0')
        .withExposedPorts(27017)
        .start();

      const host = mongoContainer.getHost();
      const port = mongoContainer.getMappedPort(27017);
      mongoUri = `mongodb://${host}:${port}/flux_auth_test`;
    }

    await connectDatabase(mongoUri);
    await UserModel.syncIndexes();
  });

  /**
   * Cleanup after each test:
   * - Remove all user records to ensure test isolation
   */
  afterEach(async () => {
    await UserModel.deleteMany({});
  });

  /**
   * Teardown:
   * - Disconnect Mongoose
   * - Stop MongoDB container
   */
  afterAll(async () => {
    await disconnectDatabase();

    if (mongoContainer) {
      await mongoContainer.stop();
    }
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - Database connection is successfully established
   */
  it('connects to MongoDB instance successfully', () => {
    expect(isDatabaseConnected()).toBe(true);
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - Persists a new OAuth user document into MongoDB
   * - Verified by direct query against the collection
   */
  it('persists a new user record into MongoDB', async () => {
    const input = {
      provider: 'github' as const,
      providerId: 'int-user-1',
      email: 'gh_user1@flux.local',
      name: 'GitHub User 1',
      avatarUrl: 'https://avatar.url/1',
    };

    const user = await findOrCreateOAuthUser(input);

    expect(user).toBeDefined();
    expect(user.userId).toBe('github_int-user-1');
    expect(user.provider).toBe('github');
    expect(user.email).toBe('gh_user1@flux.local');

    const inDb = await UserModel.findOne({ userId: 'github_int-user-1' });
    expect(inDb).not.toBeNull();
    expect(inDb?.name).toBe('GitHub User 1');
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - Updates existing user fields in MongoDB without creating duplicate records
   */
  it('updates existing user profile on subsequent login without duplicating', async () => {
    const initialInput = {
      provider: 'google' as const,
      providerId: 'int-google-2',
      email: 'initial@gmail.com',
      name: 'Initial Name',
      avatarUrl: null,
    };

    const firstResult = await findOrCreateOAuthUser(initialInput);
    expect(firstResult.name).toBe('Initial Name');

    const updatedInput = {
      provider: 'google' as const,
      providerId: 'int-google-2',
      email: 'updated@gmail.com',
      name: 'Updated Name',
      avatarUrl: 'https://google.com/avatar2.jpg',
    };

    const secondResult = await findOrCreateOAuthUser(updatedInput);

    expect(secondResult._id.toString()).toBe(firstResult._id.toString());
    expect(secondResult.email).toBe('updated@gmail.com');
    expect(secondResult.name).toBe('Updated Name');
    expect(secondResult.avatarUrl).toBe('https://google.com/avatar2.jpg');

    const totalCount = await UserModel.countDocuments({
      provider: 'google',
      providerId: 'int-google-2',
    });
    expect(totalCount).toBe(1);
  });

  /**
   * Purpose:
   * Verifies Core behavior:
   * - Finds persisted user by unique userId
   */
  it('retrieves stored user by userId via findById', async () => {
    const created = await UserModel.create({
      userId: 'github_direct-query',
      provider: 'github',
      providerId: 'direct-query',
      name: 'Direct Query User',
      email: 'direct@flux.local',
    });

    const found = await findById('github_direct-query');
    expect(found).not.toBeNull();
    expect(found?._id.toString()).toBe(created._id.toString());
    expect(found?.name).toBe('Direct Query User');
  });

  /**
   * Purpose:
   * Verifies Defensive behavior:
   * - Returns null when findById searches for non-existent userId
   */
  it('returns null when findById is queried with unknown userId', async () => {
    const result = await findById('non-existent-user-id');
    expect(result).toBeNull();
  });
});
