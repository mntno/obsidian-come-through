

export class UniqueID {

  public static isValid(value: string) {
    return value.length == 10;
  }

  /**
   * IDs are ten characters long and consist of digits 0-9 and lowercase letters a-z.
   * 
   * - IDs are based on milliseconds since 1979.
   * - To mitigate collisions when generating more than one ID per millisecond a two character random string is appended.
   * 
   * @param preventIDs These IDs will never be returned. May be set when calling this method programmatically, e.g, in a loop.
   * @returns 
   */
  public static generateID(preventIDs?: Set<string>) {

    // 10 character long id
    const generate = () => {

      // Convert to base36 to make it shorter: eight characters.
      // For radix 36, toString() represents the numbers using the digits 0-9 and the lowercase letters a-z.
      const timestamp = Date.now().toString(36);

      // Start substring from pos 2 because it's floating point.
      // One symbol can be 36 characters (0-9 + a-z), thus two characters have 36×36 = 1296 permutations.   
      const randomSuffix = Math.random().toString(36).substring(2, 4);

      // For looks, put the more permanent characters at the end.
      return randomSuffix + timestamp.split("").reverse().join("");
    }

    let id = generate();
    if (preventIDs)
      while (preventIDs.has(id))
        id = generate();
    
    console.assert(this.isValid(id));

    return id;
  }
}