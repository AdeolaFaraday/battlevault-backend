import { CreateUserInputs } from "../types/userAuth";
import UserDoc from "../types/userDoc";
import UserModel from "../types/userModel";

export default async function createUser(
    this: UserModel,
    data: CreateUserInputs
): Promise<UserDoc | null> {
    const newUser = new this({ ...data });
    newUser.save()
    return newUser
}