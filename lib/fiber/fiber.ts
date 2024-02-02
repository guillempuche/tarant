/**
 * Copyright (c) 2018-present, tarant
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import IProcessor from './processor'

interface IFiberConfiguration {
  resources: string[]
  tickInterval: number
}

/**
 * Fiber is a lightweight scheduler that periodically executes tasks. It's designed to manage
 * and schedule tasks (like processing messages in an actor system) at regular intervals.
 */
export default class Fiber {
  /**
   * Creates a new Fiber instance with a specific configuration.
   * @param config The configuration for the Fiber, including resources and tick interval.
   */
  public static with(config: IFiberConfiguration): Fiber {
    return new Fiber(config)
  }

  /**
   * The name of the Fiber, typically derived from the resources it uses.
   */
  public readonly name: string

  /**
   * The configuration settings for this Fiber, including resources and the interval
   * for task execution. The type is `NodeJS.Timer | number` to support both
   * Node.js (returns `NodeJS.Timer`) and browser environments (returns `number`).
   */
  private readonly configuration: IFiberConfiguration

  /**
   * Identifier for the interval timer. This is used to manage the regular execution
   * of tasks scheduled by the Fiber.
   */
  private readonly timerId: NodeJS.Timer | number

  /**
   * A list of processors (tasks) that the Fiber manages. Each processor is an entity
   * that has a specific task to be executed periodically.
   */
  private readonly processors: IProcessor[] = []

  private constructor(configuration: IFiberConfiguration) {
    const { resources, tickInterval } = configuration
    this.configuration = configuration
    this.name = `fiber-with${resources.reduce((aggregation, current) => `${aggregation}-${current}`, '')}`
    this.timerId = setInterval(this.tick.bind(this), tickInterval)
  }

  /**
   * Stops the Fiber from executing tasks. It clears the interval set for task execution,
   * essentially stopping the Fiber's activity.
   */
  public free(): void {
    clearInterval(this.timerId)
  }

  /**
   * Adds a new task (processor) to this Fiber's list of tasks to be executed periodically.
   * @param processor The task to be added. It should conform to the IProcessor interface.
   * @returns A boolean indicating if the processor was successfully added.
   */
  public acquire(processor: IProcessor): boolean {
    if (processor.requirements.every((req) => this.configuration.resources.indexOf(req) !== -1)) {
      this.processors.push(processor)
      return true
    }

    return false
  }

  /**
   * It gets called at each tick (interval). It iterates over all registered
   * processors and calls their `process` method.
   */
  private tick(): void {
    this.processors.forEach((p) => p.process())
  }
}
