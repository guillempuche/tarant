/**
 * Copyright (c) 2018-present, tarant
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Actor, { ActorConstructor } from '../actor-system/actor'
import ActorSystem from '../actor-system/actor-system'
import uuid from '../helper/uuid'

// type TopicSeenAs<T> = T & Topic<T> // eslint-disable-line

// export abstract class Protocol extends Actor {}

/**
 * Represents the protocol interface for actors in the Tarant framework.
 * This interface defines the contract that actors must adhere to for communication.
 * Example implementations like IProtocolExample must implement the abstract methods defined in this interface.
 * @interface
 * @example
 * // Example of a class implementing IProtocol
 * abstract class IProtocolExample implements IProtocol {
 *   abstract onMethodA(argA: string): Promise<void>;
 * }
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IProtocol {
  // [methodName: string]: (...args: any[]) => void | Promise<void>
}

/**
 * Maps each property in a given type extending IProtocol to a method signature.
 * This utility type enforces that implementations of IProtocol consist solely of methods.
 * Actor can implement these methods to adhere to the protocol.
 * @template T - A type that extends IProtocol
 * @typedef {Object} ProtocolMethods
 * @example
 * // Example of a class implementing ProtocolMethods
 * class ActorExample extends Actor implements ProtocolMethods<IProtocolEditors> {
 *   async onMethodA(argA: string): Promise<void> {
 *     // Implementation...
 *   }
 * }
 */
export type ProtocolMethods<T extends IProtocol> = {
  // [P in keyof T]: (...args: any[]) => any;
  // [P in keyof T]: (...args: (string | number | symbol)[]) => void | Promise<void>

  // [P in keyof T]: T[P] extends (...args: infer Args) => infer ReturnType
  //   ? (...args: Args) => ReturnType
  //   : // If P is not a function, it is mapped to never, effectively filtering out non-function properties.
  //     never

  //  Methods<T> checks if each property of T is a function. If it is, it retains the same argument types (A) and return type. If not, it maps to never.
  [P in keyof T]: T[P] extends (...args: infer A) => any ? (...args: A) => ReturnType<T[P]> : never

  // eslint-disable-next-line @typescript-eslint/ban-types
  // [P in keyof T as T[P] extends Function ? P : never]: T[P]
}
// export type Methods = Record<string, (...args: any[]) => any>

// interface TopicConstructor<Protocol> extends ActorConstructor {
interface TopicConstructor extends ActorConstructor {
  topicName: string
  // ClassFn?: new () => Topic<IProtocol>
}
// export function ProtocolMethod(target: any, propertyKey: string): void {
//   target.constructor.protocolMethods = target.constructor.protocolMethods || []
//   target.constructor.protocolMethods.push(propertyKey)
// }

export default class Topic<Protocol extends IProtocol> extends Actor {
  private readonly subscriptions: Map<string, Actor & ProtocolMethods<Protocol>>

  public constructor({ topicName }: TopicConstructor) {
    super('topics/' + topicName)
    this.subscriptions = new Map()
  }

  /**
   * Creates a topic for the given actor system. The id of the topic will be `topics/NAME_OF_THE_TOPIC`
   *
   * @param system Actor system where the topic will live
   * @param name Name of the topic to be created
   * @param protocol Protocol of the topic
   */
  public static for<T extends IProtocol>(system: ActorSystem, topicName: string): Topic<T> {
    return system.actorOf<Topic<T>, TopicConstructor>(Topic, { topicName })
  }

  public subscribe(actor: Actor & ProtocolMethods<Protocol>): string {
    const id = uuid()
    this.subscriptions.set(id, actor)
    return id
  }

  public unsubscribe(id: string): void {
    this.subscriptions.delete(id)
  }

  public notify<K extends keyof ProtocolMethods<Protocol>>(
    methodName: K,
    ...args: Parameters<ProtocolMethods<Protocol>[K]>
  ): void {
    this.subscriptions.forEach((subscriber) => {
      const method = subscriber[methodName]
      if (typeof method === 'function') {
        method.apply(subscriber, args)
      }
    })
  }
}
