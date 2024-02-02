/**
 * Copyright (c) 2018-present, tarant
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Actor, { ActorConstructor } from '../../../lib/actor-system/actor'

interface NamedActorConstructor extends ActorConstructor {
  name: string
}

export default class NamedActor extends Actor {
  private readonly name: string

  public constructor({ name }: NamedActorConstructor) {
    super(name)

    this.name = name
  }

  public async sayHi(): Promise<string> {
    return this.name
  }
}
