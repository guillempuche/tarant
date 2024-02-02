/**
 * Copyright (c) 2018-present, tarant
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Actor, { ActorConstructor } from '../../../lib/actor-system/actor'
import uuid from '../../../lib/helper/uuid'

interface FailingActorConstructor extends ActorConstructor {
  exceptionToThrow: Record<string, any>
}
export default class FailingActor extends Actor {
  private readonly exceptionToThrow: Record<string, any>

  public constructor({ exceptionToThrow }: FailingActorConstructor) {
    super(uuid())

    this.exceptionToThrow = exceptionToThrow
  }

  public async fails(): Promise<Record<string, any>> {
    throw this.exceptionToThrow
  }
}
