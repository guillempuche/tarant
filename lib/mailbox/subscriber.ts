/**
 * Copyright (c) 2018-present, tarant
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ActorMessage from '../actor-system/actor-message'
import Message from './message'
import Partition from './partition'

/**
 * Defines the interface for a subscriber in the actor system. Subscribers is a
 * functionality for actors to receive and handle messages.
 *
 * Actor class implements ISubscriber, enabling it to receive messages from the actor
 * system's mailbox. The mailbox, which is a central component of the actor system,
 * routes messages to subscribers based on their partitions.
 *
 * @interface
 * @template T The type of the message that the subscriber can handle.
 */
export default interface ISubscriber<T extends ActorMessage> {
  /**
   * An array of partitions that the subscriber is interested in. Partitions are used
   * by the mailbox to determine to which subscriber a message should be delivered.
   * Actors usually subscribe to partitions that match their unique identifiers.
   *
   * @type {Partition[]}
   */
  partitions: Partition[]

  /**
   * Called by the actor system's mailbox when there is a message for the subscriber.
   * Implementations of this method in Actor class should define how to process the
   * incoming message.
   *
   * @param message The message sent to the actor.
   * @returns {Promise<boolean>} A promise that resolves to a boolean indicating
   *                             whether the message was processed successfully.
   */
  onReceiveMessage(message: Message<T>): Promise<boolean>
}
