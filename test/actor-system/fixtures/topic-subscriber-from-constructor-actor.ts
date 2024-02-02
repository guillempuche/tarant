/**
 * Copyright (c) 2018-present, tarant
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Actor, { ActorConstructor } from '../../../lib/actor-system/actor'
import Topic, { IProtocol, ProtocolMethods } from '../../../lib/pubsub/topic'

interface SubscriberFromConstructorActorCtr extends ActorConstructor {
  callback: (incomingData: string) => void
  topicToListen: Topic<IProtocolSenderActor>
}

export class SubscriberFromConstructorActor extends Actor implements ProtocolMethods<IProtocolSenderActor> {
  private readonly callback: (incomingData: string) => void

  public constructor({ callback, topicToListen }: SubscriberFromConstructorActorCtr) {
    super()

    this.callback = callback
    this.subscribeToTopic(topicToListen)
  }

  public triggerUnsubscriptionOf(topic: Topic<IProtocolSenderActor>): void {
    this.unsubscribeFromTopic(topic)
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
