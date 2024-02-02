/**
 * Copyright (c) 2018-present, tarant
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ActorMessage from '../actor-system/actor-message'
import uuid from '../helper/uuid'
import Message from './message'
import ISubscriber from './subscriber'
import Subscription from './subscription'

/**
 * Represents a mailbox which queues and manages messages for actors. It handles sending and
 * receiving messages in a non-blocking, asynchronous manner.
 */
export default class Mailbox<T extends ActorMessage> {
  /**
   * Creates an empty mailbox. This static method is a convenience for initializing a new mailbox.
   */
  public static empty(): Mailbox<ActorMessage> {
    return new Mailbox()
  }

  /**
   * A mapping from subscription IDs to the list of partitions (actors) they subscribe to.
   * This helps in routing messages to the correct actors based on their subscriptions.
   */
  private readonly subscribedPartitions: { [subscription: string]: string[] } = {}

  /**
   * A mapping from partitions to their corresponding list of subscriptions. Each subscription
   * is associated with a queue of messages intended for the subscriber (actor).
   */
  private readonly subscriptions: { [partition: string]: Subscription<T>[] } = {}

  /**
   * Registers a new subscriber (actor) to the mailbox, enabling it to receive messages.
   * @param subscriber The actor subscribing to the mailbox.
   * @returns A subscription ID that uniquely identifies the subscriber.
   */
  public addSubscriber(subscriber: ISubscriber<T>): string {
    const id = uuid()
    const { partitions } = subscriber

    this.subscribedPartitions[id] = partitions
    partitions.forEach((partition) => {
      this.subscriptions[partition] = this.subscriptions[partition] || []
      this.subscriptions[partition].push(new Subscription(id, subscriber))
    })

    return id
  }

  /**
   * Removes a subscriber's registration from the mailbox, stopping it from receiving further messages.
   * @param subscription The subscription ID to be removed.
   */
  public removeSubscription(subscription: string): void {
    const partitions = this.subscribedPartitions[subscription]
    partitions.forEach(
      (partition) =>
        (this.subscriptions[partition] = this.subscriptions[partition].filter((s) => s.id !== subscription)),
    )

    delete this.subscribedPartitions[subscription]
  }

  /**
   * Adds a message to the mailbox, queuing it for delivery to the appropriate subscribers.
   * @param message The message to be queued.
   */
  public push(message: Message<T>): void {
    this.subscriptions[message.partition].forEach((subscription) => subscription.messages.push(message))
  }

  /**
   * Processes the queued messages for a given subscription. This typically involves delivering the message
   * to the appropriate subscriber.
   * @param subscription The subscription ID whose messages are to be processed.
   */
  public async poll(subscription: string): Promise<void> {
    const partitions = this.subscribedPartitions[subscription]
    if (!partitions) {
      return
    }

    partitions.forEach((partition) =>
      this.subscriptions[partition]
        .filter((managedSubscription) => managedSubscription.id === subscription)
        .forEach(async (managedSubscription) => await managedSubscription.process()),
    )
  }
}
