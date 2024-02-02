/**
 * Copyright (c) 2018-present, tarant
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ActorMessage from '../actor-system/actor-message'
import Message from './message'
import ISubscriber from './subscriber'

/**
 * Represents a subscription in the mailbox, associated with a specific actor (subscriber). It holds
 * the messages queued for this actor.
 */
export default class Subscription<T extends ActorMessage> {
  public readonly id: string
  /**
   * The list of messages queued for this subscription.
   */
  public readonly messages: Message<T>[] = []
  /**
   * The actor that has subscribed to receive messages.
   */
  public readonly subscriber: ISubscriber<T>

  public constructor(id: string, subscriber: ISubscriber<T>) {
    this.id = id
    this.subscriber = subscriber
  }

  /**
   * Processes the next message in the queue, if any. This involves delivering the message to
   * the subscriber and removing it from the queue if successfully processed.
   */
  public async process(): Promise<void> {
    const message = this.messages[0]
    if (this.messages.length > 0)
      if (message) {
        // console.log(
        //   'process list messages:',
        //   this.messages.map((message) => message.content.methodName),
        // )
        // console.log('process messages[0]:', message.content.methodName)
        if (await this.subscriber.onReceiveMessage(message)) {
          this.messages.splice(0, 1)
        }
      }
  }
}
