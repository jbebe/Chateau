export interface IWebSocketEventHandlers {
  onOpen?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  onClosed?: (event: Event) => void;
  onError?: (event: Event) => void;
}
