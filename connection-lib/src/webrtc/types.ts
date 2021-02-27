import { DataChannelEventData } from '../model/chat';
import { EventEmitter } from '../utils/event-emitter';

export class DataChannelConfig {
  constructor(
    public name: string,
    public onMessage: EventEmitter<DataChannelEventData>,
    public onOpen: EventEmitter<Event> = new EventEmitter<Event>(),
    public options?: RTCDataChannelInit
  ) {}
}

export class MediaStreamData {

  constructor(
    public mediaStream: MediaStream,
    public setRemoteMedia: (trackEvent: MediaStream) => void
  ) {}

}

export class LocalEventMap {

  constructor(
    public onClose = new EventEmitter<void>(),
    public onConnected = new EventEmitter<void>(),
  ) {}
}

export class SharedEventMap {

  constructor(
    public onUpdateConnection = new EventEmitter<IObjectWithSource<RTCSessionDescriptionInit>>(),
    public onIceCandidate = new EventEmitter<IObjectWithSource<RTCIceCandidate>>(),
  ) {}
}

export enum RTCPeerType {
  Host = 'Host',
  Guest = 'Guest'
}

export interface IObjectWithSource<T> {
  value: T;
  source: RTCPeerType;
}
