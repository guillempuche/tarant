/**
 * Copyright (c) 2018-present, tarant
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Mailbox from '../mailbox/mailbox'
import Message from '../mailbox/message'
import { IActor } from './actor'
import ActorMessage from './actor-message'

/**
 * ActorProxy acts as an intermediary between the actor system and the actual actors. It handles
 * communication to and from actors, ensuring that method calls on actors are properly dispatched
 * and processed in an asynchronous, non-blocking manner.
 */
export default class ActorProxy {
  /**
   * Sends a method invocation to the actor and returns a promise that resolves with the result.
   * This function is used internally to handle method calls on actors through their proxies.
   * @param mailbox The mailbox of the actor system used for message passing.
   * @param actorId The unique identifier of the actor to which the method call is being sent.
   * @param methodName The name of the method to be invoked on the actor.
   * @param args The arguments to be passed to the method.
   * @returns A promise that resolves with the result of the method call.
   */
  public static sendAndReturn(
    mailbox: Mailbox<ActorMessage>,
    actorId: string,
    methodName: string,
    args: any[],
  ): Promise<object> {
    return new Promise((resolve, reject) =>
      mailbox.push(Message.of(actorId, ActorMessage.of(methodName, args, resolve, reject))),
    )
  }

  /**
   * Creates a proxy for an actor. This proxy intercepts method calls and directs them
   * to the actor's mailbox for asynchronous processing.
   * @param mailbox The mailbox associated with the actor system.
   * @param actor The actor for which the proxy is being created.
   * @returns A proxy object that represents the actor.
   */
  public static of<T extends IActor>(mailbox: Mailbox<ActorMessage>, actor: T): T {
    // The 'handler' for the proxy defines custom behavior for fundamental operations
    // on the proxy object. This includes property access (get) and property assignment (set).
    const handler: ProxyHandler<T> = {
      // The 'get' method is invoked when a property is accessed on the proxy object.
      // It intercepts the property access and can modify the default behavior.
      get(target, prop, receiver) {
        // Return the original actor when the 'ref' property is accessed
        if (prop === 'ref') {
          return actor
        }

        // First, check if the property being accessed has a special getter function.
        // A getter function is a special method that looks like a property. It's
        // used to compute and return a value.
        const propertyDescriptor = Reflect.getOwnPropertyDescriptor(Reflect.getPrototypeOf(target), prop)

        // If the property has a getter function...
        if (propertyDescriptor && typeof propertyDescriptor.get === 'function') {
          // Then call this getter function with the correct 'this' context.
          // The 'call(target)' method ensures that 'this' inside the getter refers
          // to the original object.
          return propertyDescriptor.get.call(target)
        }

        // If the property is not a getter, then handle it as a regular property or method.
        // 'Reflect.get' is a standard way to get the value of a property from an object.
        const value = Reflect.get(target, prop, receiver)

        // For function properties, instead of executing the function locally,
        // it sends the method invocation to a remote actor and returns the result.
        if (typeof value === 'function') {
          return (...args) => {
            return ActorProxy.sendAndReturn(mailbox, actor.id, prop as string, args)
          }
        }

        // For non-getters & non-function properties, it returns the property value directly.
        return value
      },
      // The 'set' method is invoked when a property is set on the proxy object.
      // It can be used to intercept and modify the behavior of setting a property.
      set(target, prop, value, receiver) {
        console.log(`of() set ${actor.id}`)
        // Sends the updated property value to the remote actor and waits for a result.
        ActorProxy.sendAndReturn(mailbox, actor.id, 'setProperty', [prop, value])
          .then()
          .catch((error) => {
            console.error(`Error setting property ${String(prop)}:`, error)
          })
        return Reflect.set(target, prop, value, receiver)
      },
    }

    // Creates a new proxy object with the specified handler to manage interactions
    // with the actor.
    return new Proxy(actor, handler)
  }
}
