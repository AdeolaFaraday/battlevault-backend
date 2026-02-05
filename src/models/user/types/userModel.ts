import { FilterQuery, Model, HydratedDocument } from "mongoose";
import UserDoc from "./userDoc";
import { CreateUserInputs } from "./userAuth";


export default interface UserModel extends Model<UserDoc> {
    createUser(data: CreateUserInputs): Promise<HydratedDocument<UserDoc> | null>;
    getUser(data: {
        find: FilterQuery<UserDoc>;
        populate?: any;
    }): Promise<HydratedDocument<UserDoc> | null>;
}