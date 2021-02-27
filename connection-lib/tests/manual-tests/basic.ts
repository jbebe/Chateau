import {DataChannelEventData} from "../../src/model/chat";
import {EventEmitter} from "../../src/utils/event-emitter";
import {logError, logInfo, LogLevel, logVerbose, setLogLevel} from "../../src/utils/logging";
import {WebRTCGuest} from "../../src/webrtc/guest";
import {WebRTCHost} from '../../src/webrtc/host';
import {
  LocalEventMap,
  DataChannelConfig,
  MediaStreamData,
  SharedEventMap,
  IObjectWithSource
} from "../../src/webrtc/types";

const onStopHost = new EventEmitter<void>();
const onStopGuest = new EventEmitter<void>();
const onHostVideoStateChange = new EventEmitter<boolean>();
const onGuestVideoStateChange = new EventEmitter<boolean>();

document.querySelector('#host-start')!.addEventListener('click', startWebRTCAsync);
document.querySelector('#host-stop')!.addEventListener('click', () => onStopHost.emit());
document.querySelector('#guest-stop')!.addEventListener('click', () => onStopGuest.emit());
document.querySelector('#host-video-state')!.addEventListener('change', (e) => {
  const checkBox = e.target as HTMLInputElement;
  onHostVideoStateChange.emit(checkBox.checked);
});
document.querySelector('#guest-video-state')!.addEventListener('change', (e) => {
  const checkBox = e.target as HTMLInputElement;
  onGuestVideoStateChange.emit(checkBox.checked);
});

async function startWebRTCAsync() {

  EventEmitter.fallbackErrorHandler = (value, exception) => {
    logError(value, exception);
  };
  setLogLevel(LogLevel.Verbose);

  function generateId() {
    return (Math.random() * 1e18).toString(36);
  }

  let messageCounter = 1;
  let metaCounter = 1;

  const hostId = generateId();
  const guestId = generateId();
  enum DataChannelType { Message = 'message', Meta = 'meta' }
  const dataChannelNames: DataChannelType[] = [DataChannelType.Message, DataChannelType.Meta];
  const onSendSdpToGuest = new EventEmitter<RTCSessionDescriptionInit>();
  const onSendSdpToHost = new EventEmitter<RTCSessionDescriptionInit>();
  const hostMessage = document.querySelector('#host-data-message') as HTMLPreElement;
  const hostMeta = document.querySelector('#host-data-meta') as HTMLPreElement;
  const guestMessage = document.querySelector('#guest-data-message') as HTMLPreElement;
  const guestMeta = document.querySelector('#guest-data-meta') as HTMLPreElement;

  //
  // Init
  //

  const getWebCamAsync = async (): Promise<MediaStream> =>
    await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
  const sharedEvents = new SharedEventMap();

  // init host side
  const localVideo = document.querySelector('#host-video') as HTMLVideoElement;
  await localVideo.play();
  const miniGuest = document.querySelector('#host-miniguest-video') as HTMLVideoElement;
  // @ts-ignore
  const localStream = localVideo.captureStream(); // await getWebCamAsync();
  const localStreamData = new MediaStreamData(localStream, (track) => {
    miniGuest.srcObject = track;
    miniGuest.play();
    logInfo('[Guest]: Set mini guest video');
  });

  // init guest side
  const remoteVideo = document.querySelector('#guest-video') as HTMLVideoElement;
  await remoteVideo.play();
  const miniHost = document.querySelector('#guest-minihost-video') as HTMLVideoElement;
  // @ts-ignore
  const remoteStreamData = new MediaStreamData(remoteVideo.captureStream(), (track) => {
    miniHost.srcObject = track;
    miniHost.play();
    logInfo('[Host]: Set mini host video');
  });

  //
  // Guest
  //
  (async () => {
    try {
      // send offer to host
      const sendOfferToRemote = async (sdpHeader: RTCSessionDescriptionInit) => {
        onSendSdpToHost.emit(sdpHeader);
      };

      // init guest object
      let guestConnection: WebRTCGuest;
      const dataChannels = dataChannelNames.map((name) => {
        const onChannelMessage = new EventEmitter<DataChannelEventData>();
        onChannelMessage.subscribe((eventData) => {
          logInfo(`[Guest]: <- ${eventData.channelName}: ${eventData.message}`);

          switch (eventData.channelName) {
            case DataChannelType.Message:
              guestMessage.innerHTML += `Host said: ${eventData.message}\n`;
              break;
            case DataChannelType.Meta:
              guestMeta.innerHTML += `Host said: ${eventData.message}\n`;
              break;
          }
        });
        return new DataChannelConfig(name, onChannelMessage);
      });
      const localEvents = new LocalEventMap();
      localEvents.onClose.subscribe(() => guestMeta.innerHTML += 'Guest says: connection closed\n');

      guestConnection = new WebRTCGuest(dataChannels, localEvents, sharedEvents, () => remoteStreamData);

      onGuestVideoStateChange.subscribe((isMediaAvailable) => {
        guestConnection.setMediaAsync(isMediaAvailable);
      });

      onStopGuest.subscribe(() => {
        logInfo('[Guest]: Stop streaming from guest');
        guestConnection.close();
      });

      const createGuestOnCall = () => {
        const messageData = `#${messageCounter++}-guest-message-start`;
        guestConnection.sendData(DataChannelType.Message, messageData);
        guestMessage.innerHTML += `You said: ${messageData}\n`;
        const metaData = `#${metaCounter++}-guest-meta-start`;
        guestConnection.sendData(DataChannelType.Meta, metaData);
        guestMeta.innerHTML += `You said: ${metaData}\n`;
      };
      localEvents.onConnected.subscribe(createGuestOnCall, 1);
    }
    catch (ex) {
      logError('[Guest]: ', ex);
    }
  })();

  //
  // Host
  //
  (async () => {
    try {
      const onChannelMessage = new EventEmitter<DataChannelEventData>();
      onChannelMessage.subscribe((eventData) => {
        logInfo(`[Host]: -> ${eventData.channelName}: ${eventData.message}`);

        switch (eventData.channelName) {
          case DataChannelType.Message:
            const newMessage = `#${messageCounter++}-${eventData.channelName}-${generateId()}`;
            hostConnection.sendData(eventData.channelName, newMessage);
            hostMessage.innerHTML += `Guest said: ${eventData.message}\nYou said: ${newMessage}\n`;
            break;
          case DataChannelType.Meta:
            const newMeta = `#${metaCounter++}-${eventData.channelName}-${generateId()}`;
            hostConnection.sendData(eventData.channelName, newMeta);
            hostMeta.innerHTML += `Guest said: ${eventData.message}\nYou said: ${newMeta}$\n`;
            break;
        }
      });
      const dataChannels = dataChannelNames.map((name) => {
        return new DataChannelConfig(name, onChannelMessage);
      });
      const localEvents = new LocalEventMap();
      localEvents.onClose.subscribe(() => hostMeta.innerHTML += 'Host says: connection closed\n');

      const hostConnection = new WebRTCHost(dataChannels, localEvents, sharedEvents, () => localStreamData);

      onHostVideoStateChange.subscribe((isMediaAvailable) => {
        hostConnection.setMediaAsync(isMediaAvailable);
      });

      const receiveOfferFromRemoteEvent = new EventEmitter<RTCSessionDescriptionInit>();
      const sendOfferToRemoteAsync = async (sdpHeader: RTCSessionDescriptionInit) => {
        onSendSdpToGuest.emit(sdpHeader);
      };

      const onRespondToSdpExchange = (guestSdpHeader: RTCSessionDescriptionInit) => {
        receiveOfferFromRemoteEvent.emit(guestSdpHeader);
      };
      onSendSdpToHost.subscribe(onRespondToSdpExchange);
      onStopHost.subscribe((_) => {
        logInfo('[Host]: Stop streaming from host');
        hostConnection.close();
      });

      await hostConnection.connectAsync();
    }
    catch (ex){
      logError(`[Host]: `, ex);
    }
  })();
}
