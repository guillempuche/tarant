/**
 * Copyright (c) 2018-present, tarant
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Message from '../mailbox/message'
import ISubscriber from '../mailbox/subscriber'
import ActorMessage from './actor-message'
import ActorSystem from './actor-system'
import IMaterializer from './materializer/materializer'

import { Timer } from '../common'
import uuid from '../helper/uuid'
import ActorProxy from './actor-proxy'
import IActorSupervisor, { SupervisionStrategies } from './supervision/actor-supervisor'
import Topic, { IProtocol, ProtocolMethods } from '../pubsub/topic'

type Cancellable = string

// export type ActorConstructor<T extends Actor, Args extends any[]> = new (...args: Args) => T
// export type ActorConstructorParams<T extends Actor> = ConstructorParameters<{ new (...args: any[]): T }>
// export type ActorConstructorParams<T extends Actor> = ConstructorParameters<T>
// export type ActorConstructorParams<T extends new (...args: any) => Actor> = ConstructorParameters<T>

/**
 * Represents the constructor type for an actor. This is used to define the signature
 * of actor constructors in the system.
 *
 * It serves as a template or guideline for creating new actors, ensuring that they
 * conform to the expected structure and initialization parameters.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ActorConstructor {}

export interface IActor extends ISubscriber<ActorMessage>, IActorSupervisor {
  id: string
}

export type ActorState = Omit<
  Actor,
  // | 'self'
  | 'partitions'
  | 'system'
  | 'materializers'
  | 'supervisor'
  | 'scheduled'
  | 'topicSubscriptions'
  | 'busy'
  // | 'ref'
  | 'reactState'
  | 'reactSnapshot'
  | 'reactSubs'
>

/**
 * Class that must be extended by all actors. All defined public methods in actors should be
 * asynchronous (return a Promise<T>) or return void.
 */
export default abstract class Actor implements IActor {
  public readonly id: string
  public readonly partitions: string[]
  // protected readonly self: this = this
  // protected readonly system?: ActorSystem
  // private readonly materializers: IMaterializer[] = []
  // private supervisor?: IActorSupervisor
  self?: this = this
  system?: ActorSystem
  materializers: IMaterializer[] = []
  supervisor?: IActorSupervisor
  private readonly scheduled: Map<Cancellable, NodeJS.Timer | number> = new Map()
  private readonly topicSubscriptions: Map<string, string> = new Map()
  private busy = false
  // protected ref: this;
  ref: this

  // public reactSnapshot?: () => ActorState
  // public reactState: ActorState
  public stateCopy: any
  public stateChangeSubscriptions?: Map<any, any>

  // // Allow state management libraries to define new properties
  // [key: string]: any

  protected constructor(id?: string) {
    this.id = id || uuid()
    this.partitions = [this.id]
  }

  /**
   * Method called by the mailbox when there are messages to be processed. This should
   * not be overriden by the actor.
   *
   * @param message Message received from the mailbox
   */
  public async onReceiveMessage(message: Message<ActorMessage>): Promise<boolean> {
    if (this.busy) {
      return false
    }

    this.busy = true
    const actorMessage = message.content

    try {
      this.materializers.forEach((materializer) => materializer.onBeforeMessage(this, actorMessage))
      const result = await this.dispatchAndPromisify(actorMessage)
      actorMessage.resolve(result)
    } catch (ex) {
      this.materializers.forEach((materializer) => materializer.onError(this, actorMessage, ex))
      const strategy = this.supervisor.supervise(this.self, ex, actorMessage)

      if (strategy === 'drop-message') {
        actorMessage.reject(ex)
        return true
      }

      if (strategy === 'retry-message') {
        return false
      }

      actorMessage.reject(ex)
      return true
    } finally {
      this.busy = false
      this.materializers.forEach((materializer) => materializer.onAfterMessage(this, actorMessage))
    }
    return true
  }

  /**
   * Supervision method, called when a child actor failed.
   * The default strategy is to delegate the supervision to this actor supervisor.
   *
   * @param actor Actor that raised the exception
   * @param exception Exception that raised the actor
   * @param message Message that we failed to process
   */
  public supervise(actor: Actor, exception: any, message: any): SupervisionStrategies {
    return this.supervisor.supervise(actor, exception, message)
  }

  /**
   * Schedules a message to this actor every {interval} milliseconds. Returns a cancellable, that
   * can be passed to #cancel to stop the scheduled message.
   *
   * @param interval Interval, in ms, between messages
   * @param fn Message to send to this current actor, in form of a method reference (like this.myMethod)
   * @param values Parameters to pass with the message (parameters of the method to call)
   *
   * @see Actor#cancel
   */
  protected schedule(interval: number, fn: (...args: any[]) => void, values: any[]): Cancellable {
    const id = uuid()
    setTimeout(() => {
      const sysAny = this.system
      this.scheduled.set(
        id,
        setInterval(() => ActorProxy.sendAndReturn(sysAny.mailbox, this.id, fn.name, values), interval),
      )
    }, 0)
    return id
  }

  /**
   * Schedules a message to this actor once, after {timeout} milliseconds. Returns a cancellable, that
   * can be passed to #cancel to stop the scheduled message.
   *
   * @param timeout Time to send the message, in ms
   * @param fn Message to send to this current actor, in form of a method reference (like this.myMethod)
   * @param values Parameters to pass with the message (parameters of the method to call)
   *
   * @see Actor#cancel
   */
  protected scheduleOnce(timeout: number, fn: (...args: any[]) => void, values: any[]): Cancellable {
    const id = uuid()
    setTimeout(() => {
      const sysAny = this.system as any
      this.scheduled.set(
        id,
        setTimeout(() => {
          ActorProxy.sendAndReturn(sysAny.mailbox, this.id, fn.name, values)
          this.scheduled.delete(id)
        }, timeout),
      )
    }, 0)
    return id
  }

  /**
   * Cancels a scheduled action created by #schedule or #scheduleOnce
   *
   * @param cancellable Cancellable reference
   * @see Actor#schedule
   * @see Actor#scheduleOnce
   */
  protected cancel(cancellable: Cancellable): void {
    setTimeout(() => {
      const id = this.scheduled.get(cancellable) as Timer
      clearTimeout(id)
      clearInterval(id)

      this.scheduled.delete(cancellable)
    }, 0)
  }

  /**
   * Creates a child actor of this actor. The current actor will behave as the supervisor
   * of the created actor.
   *
   * @param classFn Constructor of the actor to build
   * @param values Values to pass as the constructor parameters
   */
  protected actorOf<T extends Actor, ActorConstructor>(
    ClassFn: new (arg: ActorConstructor) => T,
    constructorArg: ActorConstructor,
  ): T {
    if (!this.system) {
      throw new Error('Actor system is not initialized.')
    }

    const actor = this.system.actorOf(ClassFn, constructorArg)

    if (actor instanceof Actor) {
      actor.ref.supervisor = this
    }

    return actor
  }

  protected subscribeToTopic<T extends IProtocol>(topic: Topic<T>): void {
    // if (this.#isActorAndProtocol()) {
    // if (Topic.isActorAndIProtocol(this)) {
    setTimeout(async () => {
      const topicSubscription = await topic.subscribe(this as unknown as Actor & ProtocolMethods<T>)
      this.topicSubscriptions.set(topic.id, topicSubscription)
    }, 0)
    // } else {
    //   console.error('Actor does not implement required protocol methods.')
    // }
  }

  protected unsubscribeFromTopic(topic: Topic<IProtocol>): void {
    const id = this.topicSubscriptions.get(topic.id)
    if (id === undefined) {
      return
    }

    topic.unsubscribe(id)
    this.topicSubscriptions.delete(topic.id)
  }

  private dispatchAndPromisify(actorMessage: ActorMessage): Promise<any> {
    // try {
    //   const r: any = this.constructor.prototype[actorMessage.methodName].apply(this, actorMessage.arguments)
    //   if (r && r.then && r.catch) {
    //     return r
    //   } else {
    //     return Promise.resolve(r)
    //   }
    // } catch (ex) {
    //   return Promise.reject(ex)
    // }

    try {
      if (Reflect.has(this, actorMessage.methodName)) {
        // console.log(`dispatchAndPromisify this.${actorMessage.methodName}`)
        const result = Reflect.apply(this[actorMessage.methodName], this, actorMessage.arguments)
        return Promise.resolve(result)
      }
      throw new Error(`Method ${actorMessage.methodName} not found`)
    } catch (ex) {
      return Promise.reject(ex)
    }
  }

  // private initialized(): void {
  initialized(): void {
    this.materializers.forEach((materializer) => materializer.onInitialize(this))
  }

  // private isActorAndIProtocol(): this is Actor & ProtocolMethods<IProtocol> {
  //   return this instanceof Actor && Object.keys(this).every((key) => typeof this[key] === 'function')
  // }

  /**
   * Type guard function to check if an object is both an Actor and conforms to ProtocolMethods<IProtocol>.
   * @param actor The object to check.
   * @returns True if the object is an Actor and conforms to ProtocolMethods<IProtocol>, false otherwise.
  //  */
  // #isActorAndProtocol(): this is Actor & ProtocolMethods<IProtocol> {
  //   const isActorInstance = this instanceof Actor
  //   const conformsToProtocolMethods =
  //     isActorInstance &&
  //     Object.keys(this).every((key) => {
  //       const prop = this[key]
  //       console.log(`Property: ${key}, is Function: ${typeof prop === 'function'}`) // Logging each property and if it's a function
  //       return typeof prop === 'function'
  //     })
  //   console.log(`Conforms to Protocol Methods: ${conformsToProtocolMethods}`) // Logging if it conforms to Protocol Methods
  //   return conformsToProtocolMethods
  // }
  #isActorAndProtocol<T extends IProtocol>(methodNames: Array<keyof T>): this is Actor & ProtocolMethods<T> {
    // #isActorAndProtocol<T extends IProtocol>(): this is Actor & ProtocolMethods<T> {
    const isActorInstance = this instanceof Actor
    // return Object.getOwnPropertyNames(T.prototype).filter(prop => typeof T.prototype[prop] === 'function');

    // const hasAllMethods = methodNames.every(methodName =>
    //   typeof this[methodName] === 'function'
    // );
    // const protocolMethods = Object.keys(ProtocolMethods<T>());
    // const hasRequiredMethods = protocolMethods.every(method => typeof this[method] === 'function');

    // const protocolMethods = Object.getOwnPropertyNames(T.prototype)
    // const hasAllMethods = protocolMethods
    //   .filter((method) => method !== 'constructor')
    //   .every((method) => typeof this[method] === 'function')

    // return isActorInstance && hasAllMethods
    return true
  }
}
