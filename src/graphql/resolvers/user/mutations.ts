import { CreateUserInputs } from "../../../models/user/types/userAuth";
import ClientResponse from "../../../services/response";
import authenticatedRequest from "../../authenticatedRequest";
import AuthService from "../../services/user/auth";

const userMutations = {
    createUser: async (
        _: any,
        userInput: {
            args: CreateUserInputs;
        },
        context: any
    ) => {
        try {
            const { args } = userInput;
            return await AuthService.register(args, context);
        } catch (err: any) {
            return new ClientResponse(400, false, err.message, null);
        }
    },
    login: async (
        _: any,
        { email, password }: { email: string; password: string },
        context: any
    ) => {
        try {
            return await AuthService.login({ email, password }, context);
        } catch (error: any) {
            return new ClientResponse(401, false, error.message, null);
        }
    },
    logout: authenticatedRequest(async (_: any, __: any, context: any) => {
        context.logout();
        return new ClientResponse(200, true, 'Logout successful');
    }),
    verifyEmail: async (
        _: any,
        { token }: { token: string },
        context: any
    ) => {
        try {
            return await AuthService.verifyEmail({ token }, context);
        } catch (error: any) {
            return new ClientResponse(401, false, error.message, null);
        }
    },
    socialAuth: async (
        _: any,
        { token }: { token: string },
        context: any
    ) => {
        try {
            return await AuthService.socialAuth({ token }, context);
        } catch (error: any) {
            return new ClientResponse(401, false, error.message, null);
        }
    },
    updateUserProfile: authenticatedRequest(
        async (
            _: any,
            {
                args,
            }: {
                args: {
                    userName?: string;
                    firstName?: string;
                    lastName?: string;
                    bio?: string;
                    avatar?: string;
                };
            },
            context: any
        ) => {
            try {
                return await AuthService.updateProfile(args, context);
            } catch (err: any) {
                return new ClientResponse(400, false, err.message, null);
            }
        }
    ),
    requestPasswordReset: async (
        _: any,
        { email }: { email: string },
        context: any
    ) => {
        try {
            return await AuthService.requestPasswordReset({ email });
        } catch (err: any) {
            return new ClientResponse(500, false, err.message, null);
        }
    },
    resetPassword: async (
        _: any,
        { token, newPassword }: { token: string; newPassword: string },
        context: any
    ) => {
        try {
            return await AuthService.resetPassword({ token, newPassword });
        } catch (err: any) {
            return new ClientResponse(500, false, err.message, null);
        }
    },
}

export default userMutations;