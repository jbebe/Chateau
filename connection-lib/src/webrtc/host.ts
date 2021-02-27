/*  TODO:
    WebRTC solution should be interchangeable with this:
      https://jeevasubburaj.com/2019/08/13/screencastr-simple-screensharing-app-using-signalr-streaming/
*/

import {DataChannelEventData} from '../model/chat';
import {logError, logInfo, logVerbose} from "../utils/logging";
import {DataChannelConfig, LocalEventMap, MediaStreamData, RTCPeerType, SharedEventMap} from './types';
import {WebRTCBase} from './base';

export class WebRTCHost extends WebRTCBase {

  constructor(
    dataChannelConfigs: DataChannelConfig[] = [],
    localEvents: LocalEventMap,
    sharedEvents: SharedEventMap,
    getLocalStream?: () => MediaStreamData,
    config?: RTCConfiguration
  ) {
    super(new RTCPeerConnection(config), dataChannelConfigs, localEvents, sharedEvents, getLocalStream);
    // init data channel for host
    // that means we only create it, we won't receive the channels one by one
    this.createDataChannels(dataChannelConfigs);
  }

  // public methods

  public getPeerType(): RTCPeerType {
    return RTCPeerType.Host;
  }

  public async connectAsync() {
    await this.waitForOpenDataChannelsAsync();

    logInfo(`[${this.getPeerType()}]: Fully connected to remote`);
    this.localEvents.onConnected.emit();
  }

  private createDataChannels(dataChannelConfigs: DataChannelConfig[]) {
    dataChannelConfigs.forEach(config => {
      const dataChannel = this.connection.createDataChannel(
        config.name,
        config.options
      );
      this.dataChannels[config.name] = dataChannel;
      dataChannel.onerror = error => {
        logVerbose(`[${this.getPeerType()}]: Data Channel (${config.name}) Error:`, error);
      };
      dataChannel.onmessage = event => {
        logVerbose(`[${this.getPeerType()}]: Data Channel (${config.name}) Message:`, event.data);
        this.dataChannelMultiplexer[config.name].onMessage.emit(
          new DataChannelEventData(event.data, config.name)
        );
      };
      dataChannel.onopen = (event: Event) => {
        const state = dataChannel.readyState;
        if (state === 'open') {
          logVerbose(`[${this.getPeerType()}]: Data channel (${config.name}) open`);
        }
        config.onOpen.emit(event);
      };
      dataChannel.onclose = () => {
        logVerbose(`[${this.getPeerType()}]: Data Channel (${config.name}) is closed`);
      };
    });
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
