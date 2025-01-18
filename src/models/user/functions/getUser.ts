import { FilterQuery } from "mongoose";
import UserModel from "../types/userModel";
import UserDoc from "../types/userDoc";

export default async function getUser(
    this: UserModel,
    data: { find: FilterQuery<UserDoc>; populate?: any }
): Promise<UserDoc | null> {
    const { find, populate } = data;
    const user = await this.findOne(find).populate(populate || null);
    return user;
}