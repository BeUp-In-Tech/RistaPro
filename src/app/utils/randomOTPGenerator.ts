export const randomOTPGenerator = (min: number, max: number): number => Math.floor(Math.random() * (max - min)) + min
