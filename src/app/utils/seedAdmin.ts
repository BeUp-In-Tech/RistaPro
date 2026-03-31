/* eslint-disable no-console */
import env from "../config/env";
import { ensureNotificationPreference } from "../modules/notification/notification.service";
import { IUser, Role } from "../modules/user/user.interface";
import User from "../modules/user/user.model";

export const createAdmin = async () => {
    try {
        const isExist = await User.findOne({email: env.ADMIN_MAIL });
        if (isExist) {
             console.log("Admin already created");
             return
             
        }
        
        const adminPayload: IUser = {
            full_name: "Admin",
            email: env.ADMIN_MAIL,
            role: Role.ADMIN,
            isVerified: true,
            deviceTokens: [],
            password: env.ADMIN_PASSWORD
        }

    const admin =  await User.create(adminPayload);

    await ensureNotificationPreference(admin._id.toString(), Role.ADMIN);
    console.log("Admin created");
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.log("Admin creationg error: ", error.message);
    }
}
