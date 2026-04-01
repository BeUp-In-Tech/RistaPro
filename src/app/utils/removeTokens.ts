import { Types } from 'mongoose';
import User from '../modules/user/user.model';

interface IRemovedTokenResult {
  removedCount: number;
  removedFromUserIds: string[];
}

export const removeTokenFromOtherUsers = async (
  token: string,
  currentUserId: string
): Promise<IRemovedTokenResult> => {
  const normalizedToken = token.trim();
  const filter = {
    'deviceTokens.token': normalizedToken,
    isDeleted: false,
    _id: { $ne: new Types.ObjectId(currentUserId) },
  };

  const matchedUsers = await User.find(filter).select('_id').lean();

  if (!matchedUsers.length) {
    return {
      removedCount: 0,
      removedFromUserIds: [],
    };
  }

  const result = await User.updateMany(filter, {
    $pull: { deviceTokens: { token: normalizedToken } },
  });

  return {
    removedCount: result.modifiedCount,
    removedFromUserIds: matchedUsers.map((user) => String(user._id)),
  };
};
