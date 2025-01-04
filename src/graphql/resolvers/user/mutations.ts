import ClientResponse from "../../../services/response";

const userMutations = {
    createUser: async (
        _: any,
        userInput: {
            args: any;
        },
        context: any
    ) => {
        return new ClientResponse(200, false, "create user", null);
    },
}

export default userMutations;