/**
 * Copyright (c) 2018-present, tarant
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ActorMessage from '../actor-system/actor-message'
import Partition from './partition'

export default class Message<T extends ActorMessage> {
  public static of<T extends ActorMessage>(partition: Partition, content: T): Message<T> {
    return new Message(partition, content)
  }

  public static ofJson<T extends ActorMessage>(partition: Partition, content: T): Message<T> {
    return new Message(partition, content)
  }

  public readonly partition: Partition
  public readonly content: T

  private constructor(partition: Partition, content: T) {
    this.partition = partition
    this.content = content
  }
}
