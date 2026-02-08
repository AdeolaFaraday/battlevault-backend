import { FilterQuery, Model, HydratedDocument } from "mongoose";
import UserDoc from "./userDoc";
import { CreateUserInputs } from "./userAuth";
import { RequestPasswordResetResult } from "../functions/requestPasswordReset";
import { ResetPasswordResult } from "../functions/resetPassword";


export default interface UserModel extends Model<UserDoc> {
    createUser(data: CreateUserInputs): Promise<HydratedDocument<UserDoc> | null>;
    getUser(data: {
        find: FilterQuery<UserDoc>;
        populate?: any;
    }): Promise<HydratedDocument<UserDoc> | null>;
    requestPasswordReset(data: { email: string }): Promise<RequestPasswordResetResult>;
    resetPassword(data: { token: string; newPassword: string }): Promise<ResetPasswordResult>;
}