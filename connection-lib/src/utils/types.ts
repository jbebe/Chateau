export type Action<T> = (_: T) => void;
export type AsyncAction<T> = (_: T) => Promise<void>;
