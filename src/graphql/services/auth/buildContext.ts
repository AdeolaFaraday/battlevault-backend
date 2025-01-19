import { authenticate } from "./functions/authenticate";


export const buildContext = (contextObject: any) => {
    return {
      authenticate: authenticate(contextObject.req, contextObject.res),
    //   getUser: getUser(contextObject.req, contextObject.res),
    //   login: login(contextObject.req, contextObject.res),
    //   logout: logout(contextObject.req, contextObject.res),
    };
  };