/**
 * Copyright (c) 2018-present, tarant
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Actor, { ActorConstructor } from '../../../lib/actor-system/actor'
import sleep from './sleep'

export interface SemaphoreActorConstructor extends ActorConstructor {
  id: string
  callback: (n: number) => void
}
export default class SemaphoreActor extends Actor {
  private current: number
  private readonly callback: (n: number) => void

  public constructor({ id, callback }: SemaphoreActorConstructor) {
    super(id)

    this.current = 0
    this.callback = callback
  }

  public async runFor(ms: number): Promise<any> {
    this.current++
    this.callback(this.current)
    await sleep(ms)
    this.current--
  }
}
