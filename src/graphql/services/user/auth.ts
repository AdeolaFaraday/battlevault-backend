import jwt from 'jsonwebtoken';
import { CreateUserInputs } from "../../../models/user/types/userAuth";
import User from "../../../models/user/user";
import SocialAuthService from "../../../services/auth/socialauth";
import ClientResponse from "../../../services/response";
import { generateSignUpUserData } from "../../../utlis/utlis";
import DailyBlitzService from "../../../services/dailyBlitz";

const MAX_BIO_LENGTH = 500;

export default class AuthService {
  static async register(userInput: CreateUserInputs, context: any) {
    try {
      const user = await User.getUser({
        find: {
          $or: [{ email: userInput.email }, { username: userInput.userName }],
        },
      });

      if (user && !user.password) {
        return new ClientResponse(
          400,
          false,
          'Oops! You have a existing account, Please set a password on it'
        );
      }
      if (user) {
        return new ClientResponse(400, false, 'User already exists');
      }
      const newUser = await User.createUser({ ...userInput });

      // const authenticatedUser = await context.authenticate({
      //   email: userInput.email,
      //   password: userInput.password,
      // });

      // context.login(authenticatedUser);

      return new ClientResponse(
        200,
        true,
        'Account creation successfully. Check your email for verification',
        null
      );
    } catch (err: any) {
      throw new Error(err.message);
    }
  }


  static async login({ email, password }: { email: string; password: string }, context: any) {
    const result: any = await context.authenticate({
      email,
      password,
    });

    // Check Daily Blitz Login Reward (Fire and Forget)
    if (result.user && result.user.id) {
      DailyBlitzService.checkLoginReward(result.user.id).catch(e => console.error("DailyBlitz Login Check Failed:", e));
    }

    return new ClientResponse(200, true, 'Login successful', { user: result.user, token: result.token });
  }

  static async verifyEmail({ token }: { token: string }, _: any) {
    //TODO:refactor to use login jwt convention
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as { email: string };
    const user = await User.findOne({ email: decoded?.email });

    if (!user) {
      return new ClientResponse(404, true, 'User not found', null)
    }

    if (user?.emailVerifiedAt) {
      return new ClientResponse(400, true, 'Email already verified', null);
    }
    user.emailVerifiedAt = new Date();
    user.emailVerificationToken = undefined;
    await user.save();
    return new ClientResponse(200, true, 'Email verified successfully', user);
  }

  static async socialAuth({ token }: { token: string }, context: any) {
    try {
      const socialAuthData = await SocialAuthService.verifyToken(token);
      const userExist = await User.findOne({ email: socialAuthData?.email });

      if (userExist) {
        const result = await context.authenticate({
          email: userExist.email,
          password: JSON.stringify({
            isValidated: true,
          }),
        });

        // Check Daily Blitz Login Reward (Fire and Forget)
        if (result.user && result.user.id) {
          DailyBlitzService.checkLoginReward(result.user.id).catch(e => console.error("DailyBlitz Login Check Failed:", e));
        }

        return new ClientResponse(200, true, 'Login successful', { user: result.user, token: result.token });
      } else {
        const userData = await generateSignUpUserData(socialAuthData);
        const newUser = await User.createUser(userData as CreateUserInputs);
        if (!newUser) {
          return new ClientResponse(500, false, 'Failed to create user', null);
        }
        // For new social auth users, generate a token manually
        const jwt = require('jsonwebtoken');
        const { jwt: jwtEnv } = require('../../../config/environment');
        const authToken = jwt.sign({ id: newUser._id }, jwtEnv.jwtSecret, { expiresIn: jwtEnv.jwtExp });

        // Check Daily Blitz Login Reward (Fire and Forget)
        if (newUser && newUser.id) {
          DailyBlitzService.checkLoginReward(newUser.id).catch(e => console.error("DailyBlitz Login Check Failed:", e));
        }

        return new ClientResponse(200, true, 'Login successful', { user: newUser, token: authToken });
      }
    } catch (error) {
      console.error('Error during social auth:', error);
      return new ClientResponse(500, false, 'An error occurred during login', null);
    }
  }

  static async updateProfile(
    updateInput: {
      userName?: string;
      firstName?: string;
      lastName?: string;
      bio?: string;
      avatar?: string;
    },
    context: any
  ) {
    try {
      const currentUser = context.currentUser;

      if (!currentUser) {
        return new ClientResponse(401, false, 'Unauthorized / Please login to perform this action', null);
      }

      const updates: any = {};

      if (typeof updateInput.firstName === 'string') {
        updates.firstName = updateInput.firstName;
      }

      if (typeof updateInput.avatar === 'string') {
        updates.avatar = updateInput.avatar;
      }

      if (typeof updateInput.lastName === 'string') {
        updates.lastName = updateInput.lastName;
      }

      if (typeof updateInput.bio === 'string') {
        if (updateInput.bio.length > MAX_BIO_LENGTH) {
          return new ClientResponse(
            400,
            false,
            `Bio must be at most ${MAX_BIO_LENGTH} characters long`,
            null
          );
        }
        updates.bio = updateInput.bio;
      }

      if (
        typeof updateInput.userName === 'string' &&
        updateInput.userName !== currentUser.userName
      ) {
        const existing = await User.findOne({ userName: updateInput.userName });

        if (existing && existing.id.toString() !== currentUser.id.toString()) {
          return new ClientResponse(400, false, 'Username is already taken', null);
        }

        updates.userName = updateInput.userName;
      }

      if (Object.keys(updates).length === 0) {
        return new ClientResponse(200, true, 'Nothing to update', currentUser);
      }

      const updatedUser = await User.findByIdAndUpdate(currentUser.id, updates, {
        new: true,
      });

      if (!updatedUser) {
        return new ClientResponse(404, false, 'User not found', null);
      }

      return new ClientResponse(
        200,
        true,
        'Profile updated successfully',
        updatedUser
      );
    } catch (err: any) {
      return new ClientResponse(
        500,
        false,
        err.message || 'Failed to update profile',
        null
      );
    }
  }

  static async requestPasswordReset({ email }: { email: string }) {
    try {
      const result = await User.requestPasswordReset({ email });
      return new ClientResponse(
        200,
        result.success,
        result.message,
        null
      );
    } catch (err: any) {
      return new ClientResponse(
        500,
        false,
        err.message || 'Failed to send password reset email',
        null
      );
    }
  }

  static async resetPassword({ token, newPassword }: { token: string; newPassword: string }) {
    try {
      const result = await User.resetPassword({ token, newPassword });
      return new ClientResponse(
        result.success ? 200 : 400,
        result.success,
        result.message,
        null
      );
    } catch (err: any) {
      return new ClientResponse(
        500,
        false,
        err.message || 'Failed to reset password',
        null
      );
    }
  }
}