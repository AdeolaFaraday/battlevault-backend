import ClientResponse from "../../../services/response";

const userQueries = {
    // get user in the current context
    getUser: (_: any, __: any, context: any) => {
        return new ClientResponse(200, true, 'successful', context.currentUser);
    },
}

export default userQueries;