/**
 * Copyright (c) 2018-present, tarant
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ActorSystem from '../../lib/actor-system/actor-system'
import Topic from '../../lib/pubsub/topic'
import sleep from '../actor-system/fixtures/sleep'
import { IProtocolSenderActor, SenderActor, SubscriberActor } from '../actor-system/fixtures/topic-subscriber-actor'

describe('Topics', () => {
  jest.useRealTimers()
  let actorSystem: ActorSystem

  beforeEach(() => {
    actorSystem = ActorSystem.default()
  })

  afterEach(() => {
    actorSystem.free()
  })

  test('should send the message to a single subscriber', async () => {
    const callback = jest.fn()

    const topic = Topic.for<IProtocolSenderActor>(actorSystem, 'my-topic')
    const sender = actorSystem.actorOf(SenderActor, { topicToSendThings: topic })
    actorSystem.actorOf(SubscriberActor, { callback, topicToListen: topic })

    await sleep(10)
    sender.doSomething('withMessage')
    await sleep(10)

    expect(callback).toHaveBeenCalledWith('withMessage')
  })

  test('should send the message to multiple subscribers', async () => {
    const callback = jest.fn()

    const topic = Topic.for<IProtocolSenderActor>(actorSystem, 'my-topic')
    const sender = actorSystem.actorOf(SenderActor, { topicToSendThings: topic })
    actorSystem.actorOf(SubscriberActor, { callback, topicToListen: topic })
    actorSystem.actorOf(SubscriberActor, { callback, topicToListen: topic })

    await sleep(10)
    sender.doSomething('withMessage')
    await sleep(10)

    expect(callback).toHaveBeenCalledTimes(2)
  })
})
