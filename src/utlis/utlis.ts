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

  export const generateSignUpUserData = (data: any) => {
    return {
      username: "",
      email: data?.email,
      gender: data?.gender,
    }
  }