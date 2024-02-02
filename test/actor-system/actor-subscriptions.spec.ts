/**
 * Copyright (c) 2018-present, tarant
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ActorSystem from '../../lib/actor-system/actor-system'
import Topic from '../../lib/pubsub/topic'
import sleep from './fixtures/sleep'
import {
  IProtocolSenderActor,
  SenderActor,
  SubscriberFromConstructorActor,
} from './fixtures/topic-subscriber-from-constructor-actor'

describe('Actor System Subscriptions', () => {
  jest.useRealTimers()
  let actorSystem: ActorSystem

  beforeEach(() => {
    actorSystem = ActorSystem.default()
  })

  afterEach(() => {
    actorSystem.free()
  })

  test('call methods in a subscriptor', async () => {
    // const cb = jest.fn()
    // const topic = Topic.for<IProtocolSenderActor>(actorSystem, 'topic-name')
    // actorSystem.actorOf(TopicSubscriberFromConstructorActor, { callback: cb, topic })

    const callback = jest.fn()
    const topic = Topic.for<IProtocolSenderActor>(actorSystem, 'my-topic')
    const sender = actorSystem.actorOf(SenderActor, { topicToSendThings: topic })
    actorSystem.actorOf(SubscriberFromConstructorActor, { callback, topicToListen: topic })

    await sleep(10)
    sender.doSomething('withMessage')
    await sleep(10)

    expect(callback).toHaveBeenCalledWith('withMessage')
  })

  test('not call methods when unsubscribed', async () => {
    const callback = jest.fn()
    const topic = Topic.for<IProtocolSenderActor>(actorSystem, 'my-topic')
    const sender = actorSystem.actorOf(SenderActor, { topicToSendThings: topic })
    const actor = actorSystem.actorOf(SubscriberFromConstructorActor, { callback, topicToListen: topic })

    await sleep(10)
    actor.triggerUnsubscriptionOf(topic)
    await sleep(100)
    sender.doSomething('withMessage')
    await sleep(100)
    expect(callback).not.toHaveBeenCalledWith('xxx')
  })
})
