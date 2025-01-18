import { CreateUserInputs } from "../../../models/user/types/userAuth";
import ClientResponse from "../../../services/response";
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
}

export default userMutations;