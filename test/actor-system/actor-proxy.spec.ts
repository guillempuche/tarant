/**
 * Copyright (c) 2018-present, tarant
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
const mailboxMock = {
  push: jest.fn(),
}
const messageMock = {
  of: jest.fn(),
}
const actorMessageMock = {
  of: jest.fn(),
}

jest.mock('../../lib/mailbox/mailbox', () => ({
  __esModule: true,
  default: jest.fn(() => mailboxMock),
}))
jest.mock('../../lib/mailbox/message', () => ({ __esModule: true, default: messageMock }))
jest.mock('../../lib/actor-system/actor-message', () => ({ __esModule: true, default: actorMessageMock }))

import { faker } from '@faker-js/faker'
import { Actor } from '../../lib'
import ActorMessage from '../../lib/actor-system/actor-message'
import ActorProxy from '../../lib/actor-system/actor-proxy'
import Mailbox from '../../lib/mailbox/mailbox'

class SomeActor extends Actor {
  constructor() {
    super()
  }
  public aFunction() {
    //
  }
  public yetAnotherFunction() {
    //
  }
}

// tslint:disable-next-line:max-classes-per-file
class AnotherActor extends SomeActor {
  constructor() {
    super()
  }
  public anotherFunction() {
    //
  }
}

describe('actor proxy', () => {
  beforeEach(() => {
    mailboxMock.push.mockReset()
    messageMock.of.mockReset()
    actorMessageMock.of.mockReset()
  })

  describe('send and return', () => {
    it('should return a promise that pass and push the message to the mailbox', async () => {
      const mailbox = new Mailbox<ActorMessage>()
      const actorId = faker.string.uuid()
      const methodName = faker.string.uuid()
      const resultActorMessage = faker.string.uuid()
      const resultMessage = faker.string.uuid()
      const expectedResult = faker.string.uuid()
      const args = [faker.string.uuid(), faker.string.uuid()]

      actorMessageMock.of.mockImplementation((_, __, resolve, ___) => {
        resolve(expectedResult)
        return resultActorMessage
      })
      messageMock.of.mockReturnValue(resultMessage)

      const result = await ActorProxy.sendAndReturn(mailbox, actorId, methodName, args)

      expect(actorMessageMock.of).toBeCalledWith(methodName, args, expect.any(Function), expect.any(Function))
      expect(messageMock.of).toBeCalledWith(actorId, resultActorMessage)
      expect(mailboxMock.push).toBeCalledWith(resultMessage)
      expect(result).toEqual(expectedResult)
    })

    it('should return a promise that fails and push the message to the mailbox if fails', async () => {
      const mailbox = new Mailbox<ActorMessage>()
      const actorId = faker.string.uuid()
      const methodName = faker.string.uuid()
      const resultMessage = faker.string.uuid()
      const expectedResult = faker.string.uuid()
      const args = [faker.string.uuid(), faker.string.uuid()]

      actorMessageMock.of.mockImplementation((_, __, ___, reject) => {
        reject(expectedResult)
      })
      messageMock.of.mockReturnValue(resultMessage)

      try {
        await ActorProxy.sendAndReturn(mailbox, actorId, methodName, args)
        fail()
      } catch (_) {
        //
      }
    })
  })

  it('should proxy request to multiple levels of abstraction', () => {
    const mailbox = new Mailbox<ActorMessage>()
    const actor = new AnotherActor()
    const result: AnotherActor = ActorProxy.of(mailbox, actor)
    expect(result.ref).toEqual(actor)
    expect(result.anotherFunction).toBeDefined()
    expect(result.aFunction).toBeDefined()
    expect(result.yetAnotherFunction).toBeDefined()
    expect(result.self).toBeDefined()
  })
})
