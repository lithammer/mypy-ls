export const isNotNull = <T>(v: T | null): v is T => {
  return v !== null;
};

export const isNumber = (v: unknown): v is number => {
  return typeof v === "number";
};
