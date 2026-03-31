import { Types } from "mongoose";
import User from "../modules/user/user.model";

export const  removeTokenFromOtherUsers = async (token: string, currentUserId: string) => {
  await User.updateMany(
    {
      "deviceTokens.token": token,
      isDeleted: false,
      _id: { $ne: new Types.ObjectId(currentUserId) },
    },
    { $pull: { deviceTokens: { token } } }
  );
}
