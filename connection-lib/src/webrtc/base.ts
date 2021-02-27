import {DataChannelEventData} from '../model/chat';
import {EventEmitter} from '../utils/event-emitter';
import {logError, logInfo, logVerbose} from "../utils/logging";
import {
  DataChannelConfig,
  LocalEventMap,
  MediaStreamData,
  RTCPeerType,
  SharedEventMap,
} from './types';
import {Config} from "../config";

export abstract class WebRTCBase {

  protected dataChannels: { [name: string]: RTCDataChannel } = {};
  protected dataChannelMultiplexer: {
    [key: string]: {
      onMessage: EventEmitter<DataChannelEventData>,
      onOpen: EventEmitter<Event>,
    };
  } = {};
  protected mediaSenders: RTCRtpSender[] = [];
  protected stream?: MediaStreamData;
  protected onConnecting = new EventEmitter<void>();

  protected constructor(
    protected connection: RTCPeerConnection,
    protected dataChannelConfigs: DataChannelConfig[],
    protected localEvents: LocalEventMap,
    protected sharedEvents: SharedEventMap,
    protected getStream?: () => MediaStreamData,
  ) {
    if (getStream) {
      this.stream = getStream();
      this.addMediaStreamToConnection();
    }
    this.connection.onicecandidate = async e =>
      this.handleNewIceCandidateAsync(e);
    this.connection.oniceconnectionstatechange = e =>
      this.onIceConnectionStateChange(e);
    this.connection.ontrack = (e) => this.onStreamReady(e);
    this.connection.onsignalingstatechange = (e) => this.onSignalingStateChange(e);
    this.connection.ondatachannel = (e) => this.onDataChannel(e);
    this.connection.onnegotiationneeded = (e) => this.onNegotiationNeededAsync(e);
    this.initDataChannelMultiplexer(dataChannelConfigs);

    // Init shared events
    this.sharedEvents.onUpdateConnection.subscribe(async (remoteSdp) => {
      logVerbose(`[${this.getPeerType()}]: Updating connection`, remoteSdp);
      if (remoteSdp.source !== this.getPeerType()) {
        await this.connection.setRemoteDescription(remoteSdp.value);

        if (remoteSdp.value.type === "offer") {
          // Create answer because it is not yet created
          logVerbose(`[${this.getPeerType()}]: Create local answer`);
          const localSdp = await this.connection.createAnswer();
          await this.connection.setLocalDescription(localSdp);

          // Send back answer to remote
          logVerbose(`[${this.getPeerType()}]: Received offer, sending back the answer`);
          this.sharedEvents.onUpdateConnection.emit({
            source: this.getPeerType(),
            value: localSdp,
          });
        }
      }
    });
    this.sharedEvents.onIceCandidate.subscribe(async (candidate) => {
      if (candidate.source === this.getPeerType()) {
        return;
      }
      await this.connection.addIceCandidate(candidate.value);
    });
  }

  protected getPeerType(): RTCPeerType {
    throw new Error('Cannot call Base because it\'s abstract');
  }

  protected onStreamReady(event: RTCTrackEvent) {
    logVerbose(`[${this.getPeerType()}]: `, event);
    this.stream?.setRemoteMedia(event.streams[0]);
  }

  protected async handleNewIceCandidateAsync(e: RTCPeerConnectionIceEvent) {
    try {
      logVerbose(`[${this.getPeerType()}]: `, e);

      if (e.candidate) {
        logVerbose(`[${this.getPeerType()}]: Send new ICE candidate`);
        this.sharedEvents.onIceCandidate.emit({
          value: e.candidate,
          source: this.getPeerType(),
        });
      }
      else {
        logVerbose(`[${this.getPeerType()}]: Candidate search done`);
      }
    }
    catch (ex){
      logError(`[${this.getPeerType()}]: `, ex);
    }
  }

  protected onIceConnectionStateChange(e: Event) {
    logVerbose(`[${this.getPeerType()}]: `, e);
    const conn = e.target as RTCPeerConnection;
    logInfo(`[${this.getPeerType()}]: connection state: ${conn.iceConnectionState}`, e);
    if (conn.iceConnectionState === 'closed' || conn.iceConnectionState === 'disconnected'){
      this.localEvents.onClose.emit();
    }
  }

  public sendData(channelName: string, message: string) {
    if (!(channelName in this.dataChannels)) {
      throw Error(
        `Channel name (${channelName}) not in available data channels!`
      );
    }
    this.dataChannels[channelName].send(message);
  }

  public close() {
    this.connection.close();
    this.stream?.mediaStream.getTracks().forEach(track => {
      track.stop();
      this.stream?.mediaStream.removeTrack(track);
    });
  }

  private initDataChannelMultiplexer(dataChannelConfigs: DataChannelConfig[]) {
    dataChannelConfigs.forEach(config => {
      this.dataChannelMultiplexer[config.name] = {
        onMessage: config.onMessage,
        onOpen: config.onOpen,
      };
    });
  }

  private onDataChannel(dataChannelEvent: RTCDataChannelEvent) {
    logVerbose(`[${this.getPeerType()}]: `, dataChannelEvent);
    const channel = dataChannelEvent.channel;
    const channelName = channel.label;
    if (channelName in this.dataChannels) {
      logError(`[${this.getPeerType()}]: Channel name (${channelName}) is already defined in the channels table!`);
    } else {
      this.dataChannels[channelName] = channel;
    }
    channel.onerror = error => {
      logVerbose(`[${this.getPeerType()}]: Data Channel (${channelName}) Error:`, error);
    };
    channel.onmessage = event => {
      logVerbose(`[${this.getPeerType()}]: Data Channel (${channelName}) Message:`, event.data);
      this.dataChannelMultiplexer[channelName].onMessage.emit(
        new DataChannelEventData(event.data, channelName)
      );
    };
    channel.onopen = event => {
      const state = channel.readyState;
      if (state === 'open') {
        logVerbose(`[${this.getPeerType()}]: Data channel (${channelName}) opened`);
      }
      const channelConfig = this.dataChannelConfigs.find(
        config => config.name === channelName
      );
      logVerbose(`[${this.getPeerType()}]: Emit data channel opened event`);
      channelConfig!.onOpen.emit(event);
    };
    channel.onclose = () => {
      logVerbose(`[${this.getPeerType()}]: Data Channel (${channelName}) is Closed`);
    };
  }

  protected async waitForOpenDataChannelsAsync(): Promise<void> {
    await Promise.all(
      this.dataChannelConfigs.map(
        (config) =>
          new Promise((resolve, reject) => {
            const timeoutHandle = setTimeout(
              () => {
                reject();
              },
              Config.DataChannelWaitSec * 1000
            );
            config.onOpen.subscribe(ev => {
              clearInterval(timeoutHandle);
              logVerbose(`[${this.getPeerType()}]: Data channel opened, promise resolved`, ev);
              resolve();
            });
          })
      )
    );
  }

  protected onSignalingStateChange(e: Event) {
    logVerbose(`[${this.getPeerType()}]: `, e);
    logInfo(`[${this.getPeerType()}]: signaling state change`, e);
  }

  // TODO: find out if we even need that
  protected async onNegotiationNeededAsync(ev: Event) {
    logVerbose(`[${this.getPeerType()}]: `, ev);

    if (this.connection.connectionState !== "connected") {
      this.onConnecting.emit();

      if (this.getPeerType() === RTCPeerType.Guest){
        logInfo(`[${this.getPeerType()}]: Guest cannot start negotiation in early stage`);
        return;
      }
    }

    // Create local sdp
    logVerbose(`[${this.getPeerType()}]: Create local offer`);
    const localSdp = await this.connection.createOffer();
    await this.connection.setLocalDescription(localSdp);

    // Send offer to remote
    logVerbose(`[${this.getPeerType()}]: Send local offer to remote`);
    this.sharedEvents.onUpdateConnection.emit({
      value: localSdp,
      source: this.getPeerType()
    });
  }

  public async connectAsync(..._: any[]) {
    throw new Error('This method should be overloaded');
  }

  protected addMediaStreamToConnection() {
    this.stream = this.getStream!();
    this.stream.mediaStream.getTracks().forEach(track => {
      const sender = this.connection.addTrack(track, this.stream!.mediaStream);
      this.mediaSenders.push(sender);
      logInfo(`[${this.getPeerType()}]: Stream #${track.id} added to connection`);
    });
  }

  protected removeMediaStreamFromConnection() {
    this.mediaSenders.forEach((s) => {
      logInfo(`[${this.getPeerType()}]: Stream #${s.track?.id} removed from connection`);
      this.connection.removeTrack(s);
    });
  }
}
