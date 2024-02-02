/**
 * Copyright (c) 2018-present, tarant
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ActorConstructor, IProtocol, ProtocolMethods, Topic } from '../../../lib'
import Actor from '../../../lib/actor-system/actor'

interface SubscriberActorConstructor extends ActorConstructor {
  callback: (incomingData: string) => void
  topicToListen: Topic<IProtocolSenderActor>
}

export class SubscriberActor extends Actor implements ProtocolMethods<IProtocolSenderActor> {
  private readonly callback: (incomingData: string) => void

  public constructor({ callback, topicToListen }: SubscriberActorConstructor) {
    super()

    this.callback = callback
    this.subscribeToTopic(topicToListen)
  }

  // Listen SenderActor method `listenSender`
  public listenSender(incomingData: string): void {
    this.callback(incomingData)
  }
}

export abstract class IProtocolSenderActor implements IProtocol {
  abstract listenSender(withString: string): void
}
interface SenderActorConstructor extends ActorConstructor {
  topicToSendThings: Topic<IProtocolSenderActor>
}
export class SenderActor extends Actor {
  private readonly topic: Topic<IProtocolSenderActor>

  public constructor({ topicToSendThings }: SenderActorConstructor) {
    super()

    this.topic = topicToSendThings
  }

  public doSomething(withString: string): void {
    this.topic.notify('listenSender', withString)
  }
}
