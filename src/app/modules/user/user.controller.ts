import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { CatchAsync } from '../../utils/CatchAsync';
import { SendResponse } from '../../utils/SendResponse';
import { UserService } from './user.service';

// ADMIN CREATE CONSULTANT
const createConsultant = CatchAsync(async (req: Request, res: Response) => {
  const result = await UserService.createConsultant(req.body);

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Consultant created successfully',
    data: result,
  });
});

// ADMIN LIST USERS
const getUsers = CatchAsync(async (req: Request, res: Response) => {
  const result = await UserService.getUsers(req.query as Record<string, string>);

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Users retrieved successfully',
    data: result
  });
});

// ADMIN GET SINGLE USER
const getUserById = CatchAsync(async (req: Request, res: Response) => {
  const result = await UserService.getUserById(String(req.params.id));

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User retrieved successfully',
    data: result,
  });
});

// ADMIN UPDATE USER
const updateUserByAdmin = CatchAsync(async (req: Request, res: Response) => {

 const payload = {
    ...req.body,
    picture: req.file?.path as string,
  }

  const result = await UserService.updateUserByAdmin(String(req.params.id),  payload);

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User updated successfully',
    data: result,
  });
});

// ADMIN SOFT DELETE USER
const deleteUser = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const result = await UserService.deleteUser(
    userId,
    req.params.id as string
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User deleted successfully',
    data: result,
  });
});

// AUTH USER PROFILE
const getMe = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const result = await UserService.getMe(String(userId));

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User profile retrieved successfully',
    data: result,
  });
});

// AUTH USER PROFILE UPDATE
const updateMyProfile = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;

  const payload = {
    ...req.body,
    ...(req.file?.path && { picture: req.file.path }),
  }  
  const result = await UserService.updateMyProfile(String(userId), payload);

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Profile updated successfully',
    data: result,
  });
});

// AUTH USER SEND OTP
const sendVerificationOtp = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const result = await UserService.sendVerificationOtp(String(userId));

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Verification OTP sent successfully',
    data: result,
  });
});

// AUTH USER VERIFY PROFILE
const verifyMyProfile = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const result = await UserService.verifyMyProfile(
    userId,
    req.body.otp
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Profile verified successfully',
    data: result,
  });
});

// AUTH USER REGISTER DEVICE TOKEN
const registerPushToken = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const result = await UserService.registerPushToken(String(userId), req.body);

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Device token registered successfully',
    data: result,
  });
});

// AUTH USER UNREGISTER DEVICE TOKEN
const unregisterPushToken = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const result = await UserService.unregisterPushToken(
    String(userId),
    String(req.params.deviceId)
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Device token unregistered successfully',
    data: result,
  });
});

// AUTH USER DEVICES
const listMyDevices = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const result = await UserService.listMyDevices(String(userId));

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Devices retrieved successfully',
    data: result,
  });
});

export const UserController = {
  createConsultant,
  getUsers,
  getUserById,
  updateUserByAdmin,
  deleteUser,
  getMe,
  updateMyProfile,
  sendVerificationOtp,
  verifyMyProfile,
  registerPushToken,
  unregisterPushToken,
  listMyDevices,
};
