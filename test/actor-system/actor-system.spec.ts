/**
 * Copyright (c) 2018-present, tarant
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ActorSystem from '../../lib/actor-system/actor-system'
import ActorSystemConfigurationBuilder from '../../lib/actor-system/configuration/actor-system-configuration-builder'
import IMaterializer from '../../lib/actor-system/materializer/materializer'
import NamedActor from './fixtures/named-actor'
import SemaphoreActor from './fixtures/semaphore-actor'
import waitFor from './fixtures/wait-for'
import IResolver from '../../lib/actor-system/resolver/resolver'
import { Actor } from '../../lib'

describe('Actor System', () => {
  jest.useFakeTimers()

  let actorSystem: ActorSystem
  let firstMaterializer: IMaterializer
  let secondMaterializer: IMaterializer

  let firstResolver: IResolver
  let secondResolver: IResolver

  beforeEach(() => {
    firstMaterializer = {
      onAfterMessage: jest.fn(),
      onBeforeMessage: jest.fn(),
      onError: jest.fn(),
      onInitialize: jest.fn(),
    }
    secondMaterializer = {
      onAfterMessage: jest.fn(),
      onBeforeMessage: jest.fn(),
      onError: jest.fn(),
      onInitialize: jest.fn(),
    }
    firstResolver = {
      resolveActorById: jest.fn(),
    }
    secondResolver = {
      resolveActorById: jest.fn(),
    }

    actorSystem = ActorSystem.for(
      ActorSystemConfigurationBuilder.define()
        .withMaterializers([firstMaterializer, secondMaterializer])
        .withResolvers([firstResolver, secondResolver])
        .done(),
    )
  })

  afterEach(() => {
    actorSystem.free()
  })

  test('should build a new actor based on constructor parameters', async () => {
    const actor: NamedActor = actorSystem.actorOf(NamedActor, { name: 'myName' })
    const name = await waitFor(() => actor.sayHi())

    expect(name).toStrictEqual('myName')
  })

  test("should get an actor based on it's id", async () => {
    actorSystem.actorOf(NamedActor, { name: 'myName' })
    const foundActor: NamedActor = (await actorSystem.actorFor('myName')) as NamedActor

    const name = await waitFor(() => foundActor.sayHi())

    expect(name).toStrictEqual('myName')
  })

  test('should get actor from first resolver if not local', async () => {
    const mockedActor = new NamedActor({ name: 'myName' })
    ;(firstResolver.resolveActorById as jest.Mock).mockImplementation(() => Promise.resolve(mockedActor))
    ;(secondResolver.resolveActorById as jest.Mock).mockImplementation(() => Promise.reject())
    const foundActor: NamedActor = (await actorSystem.actorFor('myName')) as NamedActor

    const name = await waitFor(() => foundActor.sayHi())

    expect(name).toBe('myName')
  })

  test('should get actor from second resolver if not local or in first resolver', async () => {
    const mockedActor = new NamedActor({ name: 'myName' })
    ;(firstResolver.resolveActorById as jest.Mock).mockImplementation(() => Promise.reject())
    ;(secondResolver.resolveActorById as jest.Mock).mockImplementation(() => Promise.resolve(mockedActor))
    const foundActor: NamedActor = (await actorSystem.actorFor('myName')) as NamedActor

    const name = await waitFor(() => foundActor.sayHi())

    expect(name).toBe('myName')
  })

  test('should reject if actor is not local or resolvable', async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;(firstResolver.resolveActorById as jest.Mock).mockImplementation(() => Promise.reject())
    ;(secondResolver.resolveActorById as jest.Mock).mockImplementation(() => Promise.reject())
    try {
      await actorSystem.actorFor('myName')
      fail('should have thrown an error')
    } catch (err) {
      expect(err).toEqual(new Error(`unable to resolve actor myName`))
    }
  })

  test('should return first resolved actor if exists', async () => {
    class AnActor extends Actor {
      constructor() {
        super()
      }
    }
    const expectedActor = new AnActor()
    ;(firstResolver.resolveActorById as jest.Mock).mockImplementation(() => Promise.resolve(expectedActor))
    const actor = (await actorSystem.resolveOrNew('myId', SemaphoreActor, { id: 'myId', callback: null })) as any
    expect(actor.ref).toBe(expectedActor)
  })

  test('should let actors process messages only once at a time', async () => {
    const cb = jest.fn()
    const actor = actorSystem.actorOf(SemaphoreActor, { id: 'mySemaphore', callback: cb })

    await waitFor(() => actor.runFor(5))
    await waitFor(() => actor.runFor(5))

    expect(cb).not.toHaveBeenCalledWith(2)
    expect(cb).toHaveBeenCalledTimes(2)
  })

  test('should call all materializers when actor is built', async () => {
    const actor = actorSystem.actorOf(SemaphoreActor, { id: 'mySemaphore', callback: jest.fn() })
    expect(firstMaterializer.onInitialize).toHaveBeenCalled()
    expect(secondMaterializer.onInitialize).toHaveBeenCalled()
  })

  test('should call all materializer before the message is processed', async () => {
    const actor: SemaphoreActor = actorSystem.actorOf(SemaphoreActor, { id: 'mySemaphore', callback: jest.fn() })
    await waitFor(() => actor.runFor(5))

    expect(firstMaterializer.onBeforeMessage).toHaveBeenCalled()
    expect(secondMaterializer.onBeforeMessage).toHaveBeenCalled()
  })

  test('should call all materializer after the message is processed', async () => {
    const actor: SemaphoreActor = actorSystem.actorOf(SemaphoreActor, { id: 'mySemaphore', callback: jest.fn() })
    await waitFor(() => actor.runFor(5))

    expect(firstMaterializer.onAfterMessage).toHaveBeenCalled()
    expect(secondMaterializer.onAfterMessage).toHaveBeenCalled()
  })

  test('should call materializer when errored', async () => {
    const actor: SemaphoreActor = actorSystem.actorOf(SemaphoreActor, {
      id: 'mySemaphore',
      callback: () => {
        throw new Error('something')
      },
    })

    try {
      await waitFor(() => actor.runFor(5))
    } catch (e) {
      // expected
    }

    expect(firstMaterializer.onError).toHaveBeenCalled()
    expect(secondMaterializer.onError).toHaveBeenCalled()
  })

  // test('should allow function actors', async () => {
  //   // interface Constructor extends ActorConstructor {
  //   //   a: number
  //   //   b: number
  //   // }
  //   // const sum: FunctionActorConstructor<number> = async ({ a, b }: Constructor) => a + b
  //   const sum = async ({ a, b }: { a: number; b: number }) => a + b
  //   // const sum: FunctionActorConstructor<number> = async ({ a, b }: Constructor) => {
  //   //   // Cast the constructor to the extended interface to access a and b
  //   //   return a + b
  //   // }
  //   const sumActor = actorSystem.functionFor<number>(sum)

  //   const result = await waitFor(() => sumActor({ a: 5, b: 15 }))
  //   expect(result).toBe(20)
  // })

  // test('should allow function actors not returning anything', async () => {
  //   const fn: jest.Mock = jest.fn()
  //   const fnActor = actorSystem.functionFor(fn)

  //   await waitFor(() => fnActor({ a: 5, b: 15 }))
  //   expect(fn).toBeCalledWith(5, 15)
  // })
})
