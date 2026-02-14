import DailyBlitzService from "../../../services/dailyBlitz";
import ClientResponse from "../../../services/response";
import authenticatedRequest from "../../authenticatedRequest";

const dailyBlitzQueries = {
    getDailyBlitz: authenticatedRequest(async (_: any, __: any, context: any) => {
        try {
            const user = context.currentUser;
            return await DailyBlitzService.getDailyBlitz(user.id);
        } catch (error: any) {
            return new ClientResponse(500, false, error.message);
        }
    })
};

export default dailyBlitzQueries;
