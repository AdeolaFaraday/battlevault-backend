import { CreateUserInputs } from "../../../models/user/types/userAuth";
import User from "../../../models/user/user";
import ClientResponse from "../../../services/response";

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

}