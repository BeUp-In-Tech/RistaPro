/* eslint-disable @typescript-eslint/no-explicit-any */
  // SORT THE QUERY/FILTER KEYS SO THE HASH IS CONSISTENT
 export const sortObject = (obj: Record<string, any>) =>
    Object.keys(obj)
      .sort()
      .reduce((res: Record<string, any>, key) => {
        res[key] = obj[key];
        return res;
      }, {});