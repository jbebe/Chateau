export class UserEntity {
  public get id(): string {
    return this.username;
  }

  public username: string;
  public creationDate: string;
  public connectionId: string;

  constructor(username: string, creationDate: string, connectionId: string) {
    this.username = username;
    this.creationDate = creationDate;
    this.connectionId = connectionId;
  }

  public static Cast(rawObj: UserEntity) {
    return new UserEntity(
      rawObj.username,
      rawObj.creationDate,
      rawObj.connectionId
    );
  }
}

export class DataChannelEventData {
  constructor(public message: string, public channelName: string) {}
}

export class ChatMessageData {
  constructor(
    public from: string,
    public message: string,
    public channelName: string
  ) {}
}

export class ChatMessage {
  constructor(public from: string, public message: string) {}
}
