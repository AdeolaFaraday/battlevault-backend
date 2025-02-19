import jwt from 'jsonwebtoken';
import { CreateUserInputs } from "../types/userAuth";
import UserDoc from "../types/userDoc";
import UserModel from "../types/userModel";

export default async function createUser(
    this: UserModel,
    data: CreateUserInputs
): Promise<UserDoc | null> {
    const emailVerificationToken = jwt.sign({ email: data.email }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
    const newUser = new this({ ...data, emailVerificationToken });
    newUser.save()
    return newUser
}