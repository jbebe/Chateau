import {logError, logInfo, logVerbose} from "../utils/logging";
import {WebRTCBase} from './base';
import {DataChannelConfig, LocalEventMap, MediaStreamData, RTCPeerType, SharedEventMap} from './types';

export class WebRTCGuest extends WebRTCBase {
  constructor(
    dataChannelConfigs: DataChannelConfig[],
    localEvents: LocalEventMap,
    sharedEvents: SharedEventMap,
    getLocalStream?: () => MediaStreamData,
    config?: RTCConfiguration
  ) {
    super(new RTCPeerConnection(config), dataChannelConfigs, localEvents, sharedEvents, getLocalStream);
    this.onConnecting.subscribe(async () => {
      await this.connectAsync();
    });
  }

  public getPeerType(): RTCPeerType {
    return RTCPeerType.Guest;
  }

  public async connectAsync() {
    await this.waitForOpenDataChannelsAsync();

    logInfo(`[${this.getPeerType()}]: Fully connected to remote`);
    this.localEvents.onConnected.emit();
  }

  public async setMediaAsync(isMediaAvailable: boolean) {
    try {
      logVerbose(`[${this.getPeerType()}]: set media to ${isMediaAvailable}`);
      isMediaAvailable
        ? this.addMediaStreamToConnection()
        : this.removeMediaStreamFromConnection();
    } catch (ex) {
      logError(`[${this.getPeerType()}]: `, ex);
    }
  }
}
