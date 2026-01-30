import User from "../models/user/user";

export function importFunctionsAndAppendToSchema(
  functionImport: any,
  mongoSchema: any
) {
  const keys = Object.keys(functionImport);
  const filteredKeys = keys.map((key: string) =>
    key.replace(/(^\/)(.+)(\.\w+$)/, '$2')
  );
  const values = keys.map(
    key => functionImport[key].default || functionImport[key]
  );

  filteredKeys.forEach((key: string, index: number) => {
    mongoSchema.statics[key] = values[index];
  });

  return filteredKeys;
}

/**
 * Generates a random alphanumeric string
 */
const generateRandomString = (length: number): string => {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

/**
 * Generates a unique username with the brand name "battlevault"
 * Checks the database to ensure the username doesn't already exist
 */
const generateUniqueUserName = async (): Promise<string> => {
  const BRAND_NAME = 'battlevault';
  const MAX_ATTEMPTS = 10;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const randomSuffix = generateRandomString(6);
    const userName = `${BRAND_NAME}_${randomSuffix}`;

    const existingUser = await User.findOne({ userName });
    if (!existingUser) {
      return userName;
    }
  }

  // Fallback: use timestamp for guaranteed uniqueness
  return `${BRAND_NAME}_${Date.now()}`;
};

export const generateSignUpUserData = async (data: any) => {
  const [firstName, lastName] = data?.name?.split(" ") || ['', ''];
  const userName = await generateUniqueUserName();

  return {
    userName,
    firstName,
    lastName,
    avatar: data?.picture,
    email: data?.email,
    emailVerifiedAt: new Date(),
    country: {
      countryName: 'Nigeria',
      countryCode: 'NG',
    },
  };
}