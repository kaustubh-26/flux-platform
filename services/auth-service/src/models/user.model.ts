import mongoose, { Document, Model, Schema } from 'mongoose';

export type AuthProvider = 'google' | 'github';

export interface IUser extends Document {
  userId: string;
  provider: AuthProvider;
  providerId: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },
    provider: {
      type: String,
      required: true,
      enum: ['google', 'github'],
      index: true
    },
    providerId: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      default: null,
      index: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    avatarUrl: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

userSchema.index({ provider: 1, providerId: 1 }, { unique: true });

export const UserModel: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', userSchema);