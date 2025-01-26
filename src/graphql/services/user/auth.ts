import { CreateUserInputs } from "../../../models/user/types/userAuth";
import User from "../../../models/user/user";
import SocialAuthService from "../../../services/auth/socialauth";
import ClientResponse from "../../../services/response";
import { generateSignUpUserData } from "../../../utlis/utlis";

export default class AuthService {
  static async register(userInput: CreateUserInputs, context: any) {
    try {
      const user = await User.getUser({
        find: {
          $or: [{ email: userInput.email }, { username: userInput.username }],
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
    const user: any = await context.authenticate({
      email,
      password,
    });
    return new ClientResponse(200, true, 'Login successful', user);
  }

  static async socialAuth({ token }: { token: string }, context: any) {
    try {
      const socialAuthData = await SocialAuthService.verifyToken(token);
      const userExist = await User.findOne({ email: socialAuthData?.email });

      if (userExist) {
        context.authenticate({
          email: userExist.email,
          password: JSON.stringify({
            isValidated: true,
          }),
        });
        return new ClientResponse(200, true, 'Login successful', userExist);
      } else {
        const userData = generateSignUpUserData(socialAuthData);
        const newUser = await User.createUser(userData as CreateUserInputs);
        return new ClientResponse(200, true, 'Login successful', newUser);
      }
    } catch (error) {
      console.error('Error during social auth:', error);
      return new ClientResponse(500, false, 'An error occurred during login', null);
    }
  }
}