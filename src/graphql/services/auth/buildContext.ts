import { authenticate } from "./functions/authenticate";
import { getUserLocal } from "./functions/getUserLocal";
import { logout } from "./functions/logout";


export const buildContext = (contextObject: any) => {
    return {
        authenticate: authenticate(contextObject.req, contextObject.res),
        getUserLocal: getUserLocal(contextObject.req, contextObject.res),
        //   login: login(contextObject.req, contextObject.res),
        logout: logout(contextObject.req, contextObject.res),
    };
};