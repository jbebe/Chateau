type AsyncObserverType<T> = (value: T) => Promise<void>;
type ErrorHandlerType<T> = (value: T, exception: any) => void;

interface IObserverObject<T> {
  original: ((value: T) => void) | ((value: T) => Promise<void>),
  handleEvent: (value: T) => Promise<void>,
  handleError?: ErrorHandlerType<T>,
  count?: number,
}

export class EventEmitter<T> {

  public static fallbackErrorHandler: ErrorHandlerType<any>;

  private observers: Array<IObserverObject<T>> = [];

  constructor(private eventwiseErrorHandler?: ErrorHandlerType<T>) {}

  /**
   * Emits an event containing a given value.
   * @param value The value to emit.
   */
  public emit(value: T): void {
    for (const observer of this.observers) {
      const asyncHandle = observer.handleEvent;
      asyncHandle(value)
        .catch((ex: any) => {
          ( observer.handleError ??
            this.eventwiseErrorHandler ??
            EventEmitter.fallbackErrorHandler
          )(value, ex);
        });

      if (observer.count){
        if (--observer.count < 1) {
          this.unsubscribe(observer.original);
        }
      }
    }
  }

  /**
   * Registers handlers for events emitted by this instance.
   * @param handleEvent When supplied, a custom handler for emitted events.
   * @param handleError When supplied, a custom handler for an error notification
   * @param count Sets how many times the event is handled before it being unsubscribed
   * from this emitter.
   */
  public subscribe(
    handleEvent: ((value: T) => void) | ((value: T) => Promise<void>),
    count?: number,
    handleError?: ErrorHandlerType<T>,
  ): any {
    const isAsync = handleEvent.constructor.name === 'AsyncFunction';
    const asyncHandle = isAsync
      ? handleEvent as AsyncObserverType<T>
      : async (value: T) => { handleEvent(value); };

    const observer: IObserverObject<T> = {
      handleEvent: asyncHandle,
      handleError,
      original: handleEvent,
      count,
    };
    this.observers.push(observer);
  }

  public unsubscribe(handleEvent: ((value: T) => void) | ((value: T) => Promise<void>)){
    const observerIdx = this.observers
      .findIndex((observer) => observer.original === handleEvent);
    if (observerIdx === -1){
      throw Error('Observer not found while trying to unsubscribe');
    }
    this.observers.splice(observerIdx, 1);
  }
}
