/**
 * Copyright (c) 2018-present, tarant
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Fiber from '../fiber/fiber'
import IProcessor from '../fiber/processor'
import Mailbox from '../mailbox/mailbox'
import Actor, { ActorConstructor, IActor } from './actor'
import ActorMessage from './actor-message'
import ActorProxy from './actor-proxy'
import IActorSystemConfiguration from './configuration/actor-system-configuration'
import ActorSystemConfigurationBuilder from './configuration/actor-system-configuration-builder'
import IMaterializer from './materializer/materializer'
import IResolver from './resolver/resolver'
import IActorSupervisor from './supervision/actor-supervisor'

/**
 * Represents the core of the actor model implementation in Tarant.
 * This class is responsible for managing and orchestrating actors, processing
 * messages, and handling actor lifecycles.
 *
 * Actors in this system are objects that encapsulate state and behavior and
 * communicate asynchronously.
 */
export default class ActorSystem implements IProcessor {
  public static for(configuration: IActorSystemConfiguration): ActorSystem {
    return new ActorSystem(configuration)
  }

  public static default(): ActorSystem {
    return new ActorSystem(ActorSystemConfigurationBuilder.define().done())
  }

  /**
   * A list of requirements for the actor system. This array can include specific
   * conditions or resources that the actor system needs in order to function
   * properly. It's used to ensure that the system has all necessary prerequisites
   * before it starts operating.
   */
  public readonly requirements: string[] = ['default']

  /**
   * A collection of all actors within the system, keyed by their unique identifiers.
   * This map allows the system to keep track of all the actors it manages, enabling
   * quick access to any actor based on its ID.
   */
  private readonly actors: Map<string, IActor> = new Map()

  /**
   * A map that maintains the association between actors and their message
   * subscriptions. Each entry links an actor's unique identifier to a subscription
   * ID, which is used for message delivery within the mailbox. This structure is
   * key to ensuring that messages are correctly routed to their intended actors.
   */
  private readonly subscriptions: Map<string, string> = new Map()

  /**
   * The mailbox associated with the actor system, used for managing and routing
   * messages to the actors. The mailbox acts as a central point for message
   * handling, queuing incoming messages and delivering them to the appropriate
   * actors based on their subscriptions.
   */
  public readonly mailbox: Mailbox<ActorMessage>

  /**
   * The fiber instance used for scheduling and executing tasks within the actor
   * system. Fibers are lightweight threads that facilitate asynchronous processing.
   *
   * It is responsible for periodically invoking tasks such as message processing,
   * ensuring that the actor system operates efficiently and responsively.
   */
  private readonly fiber: Fiber

  /**
   * A collection of materializers used in the actor system. Materializers are
   * components that can perform certain operations or transformations on messages
   * or actors. They can be used for a variety of purposes, such as logging,
   * monitoring, or modifying message content.
   */
  private readonly materializers: IMaterializer[]

  /**
   * A list of resolvers used to locate and instantiate actors. Resolvers can help in
   * dynamically finding actors, especially in distributed systems or when actors are
   * not statically known at compile time. This allows for more flexible and dynamic
   * actor interactions.
   */
  private readonly resolvers: IResolver[]

  /**
   * The supervisor for the actor system. A supervisor is responsible for handling
   * failures and exceptions in actors. It defines the strategy for dealing with
   * errors, such as restarting an actor or escalating the problem. This role is
   * vital for maintaining the stability and resilience of the system.
   */
  private readonly supervisor: IActorSupervisor

  private constructor(configuration: IActorSystemConfiguration) {
    const { mailbox, resources, tickInterval, materializers, resolvers, supervisor } = configuration
    this.mailbox = mailbox
    this.materializers = materializers
    this.resolvers = resolvers
    this.supervisor = supervisor

    // The following part sets up the fiber. Fibers are like lightweight threads
    // used for scheduling tasks. Here, a fiber is created with the provided
    // configuration settings, including resources and the tick interval. The tick
    // interval determines how often the fiber should 'wake up' and perform tasks.
    // Once the fiber is set up, it is started by acquiring this ActorSystem
    // instance, effectively beginning its task scheduling duties, such as
    // periodically invoking the process method for message handling in the system.
    this.fiber = Fiber.with({ resources, tickInterval })
    this.fiber.acquire(this)
  }

  /**
   * Periodically executes tasks to manage actors. Think of it as the conductor
   * waving their baton to keep the orchestra in time.
   */
  public async process(): Promise<void> {
    this.actors.forEach(async (v) => {
      await this.mailbox.poll(this.subscriptions.get(v.id) as string)
    })
  }

  /**
   * Stops the actor system and frees resources (like actors)
   */
  public free(): void {
    setTimeout(() => this.fiber.free(), 0)
  }

  /**
   * Creates a new root actor.
   *
   * @param classFn Constructor of the actor to create
   * @param values Parameters to pass to the constructor
   */
  // public actorOf<T extends IActor>(ClassFn: new (...args: any[]) => T, values: any[]): T {
  // public actorOf<T extends Actor>(
  //   ClassFn: new (...args: ActorConstructorParams<T>) => T,
  //   ...values: ActorConstructorParams<T>
  // ): T {
  public actorOf<T extends Actor, ActorConstructor>(
    ClassFn: new (arg: ActorConstructor) => T,
    constructorArg: ActorConstructor,
  ): T {
    const instance = new ClassFn(constructorArg)

    const proxy = ActorProxy.of(this.mailbox, instance)

    const subscription = this.mailbox.addSubscriber(instance)

    this.actors.set(instance.id, instance)
    this.subscriptions.set(instance.id, subscription)

    this.setupInstance(instance, proxy)
    return proxy
  }

  /**
   * Looks for an existing actor in this actor system. If none exist,
   * it will try to resolve the actor, by id, with the provided resolvers.
   *
   * @param id Id of the actor to find
   */
  public async actorFor<T extends Actor>(id: string): Promise<T> {
    let instance: T = this.actors.get(id) as T
    if (instance === undefined) {
      for (const resolver of this.resolvers) {
        try {
          instance = (await resolver.resolveActorById(id)) as T
          break
        } catch (_) {
          //
        }
      }
      if (instance === undefined) {
        return Promise.reject(new Error(`unable to resolve actor ${id}`))
      }

      this.actors.set(id, instance)
      this.subscriptions.set(instance.id, this.mailbox.addSubscriber(instance))

      const proxy = ActorProxy.of(this.mailbox, instance)
      this.setupInstance(instance, proxy)
      return proxy
    }
    return ActorProxy.of(this.mailbox, instance as T)
  }

  // /**
  //  * Converts a function to a function actor, with the same signature. Function actors behave the same way as
  //  * actors, but can be called as ordinary functions.
  //  *
  //  * Like actors, there is a limitation on the signature of the function. It can receive any number and type
  //  * of parameters, but it *must* return a Promise.
  //  *
  //  * @param fn Function to be wrapped in an actor
  //  */
  // public functionFor<T>(fn: any): (constructor: ActorConstructor) => Promise<T> {
  //   return FunctionActor.for<T>(this, fn)
  // }

  /**
   * Tries to find an actor, if it doesn't exist, creates a new one.
   *
   * @param id Id of the actor to find
   * @param elseClass Constructor of the actor to create, if doesn't exist
   * @param values Parameters of the constructor
   */
  public async resolveOrNew<T extends Actor>(
    id: string,
    elseClass: new (...args: any[]) => T,
    constructor: ActorConstructor,
  ): Promise<T> {
    try {
      return await this.actorFor(id)
    } catch (_) {
      return this.actorOf(elseClass, constructor)
    }
  }

  private setupInstance(instance: Actor, proxy: any): void {
    instance.self = proxy
    instance.system = this
    instance.materializers = this.materializers
    instance.supervisor = this.supervisor
    instance.initialized()
  }
}
