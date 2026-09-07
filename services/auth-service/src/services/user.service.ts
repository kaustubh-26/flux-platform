import { AuthProvider, IUser, UserModel } from '../models/user.model';

export interface OAuthProfileInput {
  provider: AuthProvider;
  providerId: string;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
}

function buildUserId(provider: string, providerId: string): string {
  return `${provider}_${providerId}`;
}

export async function findOrCreateOAuthUser(
  profile: OAuthProfileInput
): Promise<IUser> {
  const existingUser = await UserModel.findOne({
    provider: profile.provider,
    providerId: profile.providerId
  });

  if (existingUser) {
    let changed = false;

    if (profile.email !== undefined && existingUser.email !== (profile.email || null)) {
      existingUser.email = profile.email || null;
      changed = true;
    }

    if (profile.name && existingUser.name !== profile.name) {
      existingUser.name = profile.name;
      changed = true;
    }

    if (
      profile.avatarUrl !== undefined &&
      existingUser.avatarUrl !== (profile.avatarUrl || null)
    ) {
      existingUser.avatarUrl = profile.avatarUrl || null;
      changed = true;
    }

    if (changed) {
      await existingUser.save();
    }

    return existingUser;
  }

  const user = await UserModel.create({
    userId: buildUserId(profile.provider, profile.providerId),
    provider: profile.provider,
    providerId: profile.providerId,
    email: profile.email || null,
    name: profile.name || 'Unknown User',
    avatarUrl: profile.avatarUrl || null
  });

  return user;
}

export async function findById(userId: string): Promise<IUser | null> {
  return UserModel.findOne({ userId });
}